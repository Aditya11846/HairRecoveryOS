import { get, set } from '../utils/storage';
import { supabase } from '../lib/supabase';
import { MODEL, RESEARCH_CACHE_TTL_MS } from '../constants/config';
import { logger } from '../utils/logger';

const API_URL = 'https://api.anthropic.com/v1/messages';
const RESEARCH_LOCAL_KEY = 'research_cache_local';
const INSIGHTS_LOCAL_KEY = 'insights_cache_local';

const HEADERS = (apiKey) => ({
  'Content-Type': 'application/json',
  'x-api-key': apiKey,
  'anthropic-version': '2023-06-01',
  'anthropic-dangerous-direct-browser-access': 'true',
});

// Returns { result: Array|null, error: string|null } — never throws
async function callClaude(apiKey, system, userMsg, maxTokens = 1024) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: HEADERS(apiKey),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });

    const rawBody = await res.text();
    logger.debug('Claude', `status: ${res.status} | body preview: ${rawBody.slice(0, 500)}`);

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const errData = JSON.parse(rawBody);
        errMsg = errData?.error?.message || errMsg;
      } catch {}
      return { result: null, error: errMsg };
    }

    let data;
    try {
      data = JSON.parse(rawBody);
    } catch (e) {
      return { result: null, error: `Response JSON parse failed: ${e.message}` };
    }

    const text = data.content?.find(b => b.type === 'text')?.text || '';
    logger.debug('Claude', `text output: ${text.slice(0, 600)}`);

    const stripped = text.replace(/```[\w]*\n?/g, '').replace(/```/g, '').trim();
    const match = stripped.match(/\[[\s\S]*\]/);
    if (!match) {
      const errMsg = `No JSON array found. Claude said: "${stripped.slice(0, 200)}"`;
      logger.warn('Claude', errMsg);
      return { result: null, error: errMsg };
    }

    try {
      return { result: JSON.parse(match[0]), error: null };
    } catch (e) {
      return { result: null, error: `Array JSON parse failed: ${e.message}` };
    }
  } catch (e) {
    logger.error('Claude', 'fetch error', e.message);
    return { result: null, error: e.message };
  }
}

// ─── Feature 1: Dynamic Insights ─────────────────────────────────────────────

const INSIGHTS_SYSTEM = `You are a hair recovery AI specialist for Aditya Singh, 22, Pune.
Androgenetic alopecia, crown/vertex dominant, Norwood ~3 vertex.
Protocol: oral minoxidil 2.5mg daily, Novegrow topical 10% solution bedtime,
dutasteride 0.5mg Mon+Thu, red light comb. Smokes ~5/day.
No bloodwork done yet. Peak regrowth Aug 2025 (90% crown coverage).
Phase 1 baseline Jun 2026. Next checkpoint Sep 2026.
Analyze the provided metrics and return exactly 3 insights as JSON.
Use your training knowledge — no web search needed.
Return ONLY a raw JSON array, no markdown, no code fences:
[{"priority":"critical"|"positive"|"informational","title":string,"body":string}]
Be specific to the actual numbers. No generic advice.`;

export async function generateInsights(metrics) {
  const apiKey = await get('api_key', '');
  if (!apiKey) return null;

  const msg = `Metrics — last 7 days:
- Cigarettes: ${metrics.avgCigs} cigs/day avg (prior 7-day: ${metrics.prevAvgCigs}, delta: ${metrics.cigsDelta > 0 ? '+' : ''}${metrics.cigsDelta}%)
- Sleep: ${metrics.avgSleep}h avg (target ≥7h)
- Stress: ${metrics.avgStress}/10 avg
- Med consistency: ${metrics.consistency}% days with both oral + topical minoxidil
- Shedding: ${metrics.sheddingPct}% of days with shedding reported
- Current streak: ${metrics.streak} consecutive days`;

  const { result } = await callClaude(apiKey, INSIGHTS_SYSTEM, msg, 1024);
  return result;
}

export async function getCachedOrFreshInsights(metrics) {
  const today = new Date().toISOString().split('T')[0];

  // 1. Supabase cache
  try {
    const { data } = await supabase
      .from('insights')
      .select('content, created_at')
      .eq('date', today)
      .maybeSingle();

    if (data?.content) {
      return { insights: JSON.parse(data.content), cachedAt: data.created_at };
    }
  } catch { /* table missing or offline */ }

  // 2. Local AsyncStorage cache (same-day only)
  try {
    const local = await get(INSIGHTS_LOCAL_KEY, null);
    if (local?.date === today && local?.insights) {
      logger.debug('Insights', 'served from local cache');
      return { insights: local.insights, cachedAt: local.cachedAt };
    }
  } catch {}

  // 3. Generate fresh
  const insights = await generateInsights(metrics);
  if (!insights) return null;

  const cachedAt = new Date().toISOString();

  set(INSIGHTS_LOCAL_KEY, { date: today, insights, cachedAt }).catch(() => {});

  supabase.from('insights').upsert(
    { date: today, content: JSON.stringify(insights) },
    { onConflict: 'date' },
  ).catch(() => {});

  return { insights, cachedAt };
}

// ─── Feature 2: Research Agent (live web search) ──────────────────────────────

const RESEARCH_USER_MSG = `Search the web for the latest research and developments on:
1) oral minoxidil + dutasteride combination therapy results
2) microneedling for androgenetic alopecia 2026
3) new topical treatments for crown AGA
4) r/tressless recent success stories with similar protocols

For Aditya Singh's profile: 22yo male, crown-dominant AGA, Norwood ~3 vertex,
on oral minoxidil 2.5mg + topical 10% + dutasteride 0.5mg Mon/Thu.

After searching, return EXACTLY this JSON format with 5 items found from real search results:
[{
  "title": "string (from actual search result)",
  "source": "PubMed"|"Reddit"|"ClinicalTrial"|"NewProduct"|"Technique",
  "summary": "string (2 sentences, based on what you found)",
  "relevance": "HIGH"|"MEDIUM"|"LOW",
  "relevance_reason": "string (1 sentence specific to this profile)",
  "action": "ask_doctor"|"add_to_protocol"|"monitor"|"informational",
  "canAddToProtocol": boolean,
  "url": "string (actual source URL, or empty string if none)"
}]

Return ONLY the JSON array, no other text, no markdown fences.`;

// Returns { result: Array|null, error: string|null } — never throws
async function fetchResearchWithWebSearch(apiKey) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: HEADERS(apiKey),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: RESEARCH_USER_MSG }],
      }),
    });

    const rawBody = await res.text();
    logger.debug('Research', `status: ${res.status}`);
    logger.debug('Research', `raw body preview: ${rawBody.slice(0, 800)}`);

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const errData = JSON.parse(rawBody);
        errMsg = errData?.error?.message || errMsg;
      } catch {}
      return { result: null, error: errMsg };
    }

    let data;
    try {
      data = JSON.parse(rawBody);
    } catch (e) {
      return { result: null, error: `Response JSON parse failed: ${e.message}` };
    }

    logger.debug('Research', `stop_reason: ${data.stop_reason}`);
    logger.debug('Research', `content block types: ${data.content?.map(b => b.type).join(', ')}`);

    // Web search responses include tool_use + tool_result + text blocks.
    // The final answer is always the LAST text block.
    const textBlocks = (data.content || []).filter(b => b.type === 'text');
    const finalText = textBlocks.length > 0
      ? textBlocks[textBlocks.length - 1].text
      : '';

    logger.debug('Research', `final text block: ${finalText.slice(0, 800)}`);

    if (!finalText) {
      const blockSummary = data.content?.map(b => `${b.type}`).join(', ') || 'none';
      return { result: null, error: `No text block in response. Blocks: [${blockSummary}]. stop_reason: ${data.stop_reason}` };
    }

    // Strip markdown code fences
    const stripped = finalText.replace(/```[\w]*\n?/g, '').replace(/```/g, '').trim();
    const match = stripped.match(/\[[\s\S]*\]/);
    if (!match) {
      return { result: null, error: `No JSON array in response. Claude said: "${stripped.slice(0, 300)}"` };
    }

    try {
      return { result: JSON.parse(match[0]), error: null };
    } catch (e) {
      return { result: null, error: `JSON parse failed: ${e.message}. Text: "${stripped.slice(0, 150)}"` };
    }
  } catch (e) {
    logger.error('Research', 'fetch error', e.message);
    return { result: null, error: e.message };
  }
}

// Returns one of:
//   { noApiKey: true }
//   { apiError: true, errorDetail: string }
//   { items, fetchedAt, fromCache: boolean }
//
// forceRefresh=true always skips all cache and does a live web search
export async function getCachedOrFreshResearch(forceRefresh = false) {
  const apiKey = await get('api_key', '');
  if (!apiKey) return { noApiKey: true };

  if (!forceRefresh) {
    // 1. Supabase cache
    try {
      const { data } = await supabase
        .from('research_cache')
        .select('fetched_at, items')
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        const ageMs = Date.now() - new Date(data.fetched_at).getTime();
        if (ageMs < RESEARCH_CACHE_TTL_MS) {
          logger.debug('Research', 'served from Supabase cache');
          return { items: data.items, fetchedAt: data.fetched_at, fromCache: true };
        }
      }
    } catch { /* table missing or offline */ }

    // 2. Local AsyncStorage cache
    try {
      const local = await get(RESEARCH_LOCAL_KEY, null);
      if (local?.fetchedAt && local?.items) {
        const ageMs = Date.now() - new Date(local.fetchedAt).getTime();
        if (ageMs < RESEARCH_CACHE_TTL_MS) {
          logger.debug('Research', 'served from local cache');
          return { items: local.items, fetchedAt: local.fetchedAt, fromCache: true };
        }
      }
    } catch {}
  }

  // Live web search
  logger.info('Research', `fetching fresh with web search, forceRefresh: ${forceRefresh}`);
  const { result: items, error: fetchError } = await fetchResearchWithWebSearch(apiKey);
  if (!items) return { apiError: true, errorDetail: fetchError };

  const fetchedAt = new Date().toISOString();

  // Save to local cache
  set(RESEARCH_LOCAL_KEY, { items, fetchedAt }).catch(() => {});

  // Save to Supabase (fire-and-forget)
  supabase.from('research_cache').insert({ items }).catch(() => {});

  return { items, fetchedAt, fromCache: false };
}
