import { get, set, saveProtocolGuide } from '../utils/storage';
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
    logger.error('Research', 'fetch error', e.message, e.stack);
    return { result: null, error: `Network: ${e.message}` };
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

// ─── Feature 3: Protocol Guide (web search for usage info) ───────────────────

const PROTOCOL_SUGGESTIONS_CACHE_KEY = 'protocol_suggestions_cache';
const SUGGESTIONS_TTL_MS = 24 * 60 * 60 * 1000;

async function callClaudeWebSearchObject(apiKey, userMsg, maxTokens = 1500) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: HEADERS(apiKey),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: userMsg }],
      }),
    });
    const rawBody = await res.text();
    if (!res.ok) return { result: null, error: `HTTP ${res.status}` };
    let data;
    try { data = JSON.parse(rawBody); } catch (e) { return { result: null, error: e.message }; }
    const textBlocks = (data.content || []).filter(b => b.type === 'text');
    const finalText = textBlocks.length > 0 ? textBlocks[textBlocks.length - 1].text : '';
    if (!finalText) return { result: null, error: 'No text block' };
    const stripped = finalText.replace(/```[\w]*\n?/g, '').replace(/```/g, '').trim();
    // Try object first, then array
    const objMatch = stripped.match(/\{[\s\S]*\}/);
    const arrMatch = stripped.match(/\[[\s\S]*\]/);
    const match = objMatch || arrMatch;
    if (!match) return { result: null, error: `No JSON in response: "${stripped.slice(0, 200)}"` };
    try { return { result: JSON.parse(match[0]), error: null }; }
    catch (e) { return { result: null, error: e.message }; }
  } catch (e) {
    return { result: null, error: e.message };
  }
}

export async function fetchProtocolGuide(protocolName) {
  const apiKey = await get('api_key', '');
  if (!apiKey) return null;

  const msg = `Search the web for evidence-based information about "${protocolName}" as a treatment for androgenetic alopecia (male pattern hair loss).

Return ONLY a JSON object (no markdown, no code fences):
{
  "mechanism": "how it works for hair loss in 1-2 sentences",
  "dose": "recommended dose or amount",
  "timing": "when and how often to use",
  "evidence": "evidence level — e.g. Strong RCTs / Moderate / Anecdotal",
  "caution": "key safety note or side effect warning",
  "steps": [
    {"icon": "emoji", "title": "step title", "body": "step detail"}
  ],
  "note": "one additional practical tip"
}

steps should have 3-4 items covering how to use it correctly. Use simple emojis for icons.`;

  const { result } = await callClaudeWebSearchObject(apiKey, msg, 1500);
  return result && typeof result === 'object' && !Array.isArray(result) ? result : null;
}

export async function getSuggestedProtocols() {
  const apiKey = await get('api_key', '');
  if (!apiKey) return [];

  // Check cache
  try {
    const cached = await get(PROTOCOL_SUGGESTIONS_CACHE_KEY, null);
    if (cached?.fetchedAt && cached?.items) {
      const age = Date.now() - new Date(cached.fetchedAt).getTime();
      if (age < SUGGESTIONS_TTL_MS) return cached.items;
    }
  } catch {}

  const msg = `Search the web for evidence-backed hair loss treatments that would complement this existing protocol for Aditya Singh (22yo male, androgenetic alopecia, crown-dominant Norwood ~3 vertex, Pune India):

CURRENT PROTOCOL:
- Oral Minoxidil 2.5mg daily
- Novegrow Topical 10% solution nightly
- Dutasteride 0.5mg Mon+Thu
- Red Light Comb (LLLT) 3x/week

Find 5 evidence-backed additions NOT already in this protocol. Return ONLY a JSON array (no markdown):
[{
  "name": "protocol name",
  "category": "Topical"|"Supplement"|"Procedure"|"Device"|"Lifestyle",
  "evidence": "one-line evidence summary",
  "whyRelevant": "why this specifically helps with crown AGA on this protocol",
  "caution": "key warning or contraindication",
  "canAddToProtocol": true
}]

Focus on: microneedling, supplements (biotin, zinc, saw palmetto, etc), tretinoin, ketoconazole shampoo, or other validated additions. Be specific to 2026 evidence.`;

  const { result } = await callClaudeWebSearchObject(apiKey, msg, 1500);
  const items = Array.isArray(result) ? result : [];

  if (items.length > 0) {
    set(PROTOCOL_SUGGESTIONS_CACHE_KEY, { items, fetchedAt: new Date().toISOString() }).catch(() => {});
  }

  return items;
}

// ─── Feature 4: Community search via AI web search ───────────────────────────

const COMMUNITY_CACHE_KEY = 'community_search_cache_v2';
const COMMUNITY_TTL_MS = 6 * 60 * 60 * 1000; // 6h

export const DEFAULT_COMMUNITY_SUBS = ['tressless', 'HairLoss', 'minoxidil', 'Alopecia'];
export const ALL_COMMUNITY_SUBS = ['tressless', 'HairLoss', 'minoxidil', 'Alopecia', 'malehairadvice', 'FTMOver30'];

export async function fetchCommunityViaAI({
  forceRefresh = false,
  query = '',
  subreddits = DEFAULT_COMMUNITY_SUBS,
} = {}) {
  const apiKey = await get('api_key', '');
  if (!apiKey) return { noApiKey: true };

  const isDefault = !query && JSON.stringify(subreddits) === JSON.stringify(DEFAULT_COMMUNITY_SUBS);

  if (isDefault && !forceRefresh) {
    try {
      const cached = await get(COMMUNITY_CACHE_KEY, null);
      if (cached?.fetchedAt && cached?.items) {
        const age = Date.now() - new Date(cached.fetchedAt).getTime();
        if (age < COMMUNITY_TTL_MS) return { items: cached.items, fromCache: true, fetchedAt: cached.fetchedAt };
      }
    } catch {}
  }

  const subList = subreddits.map(s => `r/${s}`).join(', ');
  const searchTerm = query || 'minoxidil dutasteride results progress';
  const siteFilter = subreddits.map(s => `site:reddit.com/r/${s}`).join(' OR ');

  const msg = `Search Reddit for recent posts in these communities: ${subList}.

Search query: ${searchTerm}
Site filter: ${siteFilter}

Find posts from the past 1-3 months where users share real experiences, progress reports, results, side effects, or protocol tips related to hair loss treatments (especially minoxidil, dutasteride, finasteride, topical treatments, or androgenetic alopecia).

Return ONLY a JSON array of 10 posts found from actual search results:
[{
  "title": "exact post title from search result",
  "author": "u/username if visible, otherwise 'u/anonymous'",
  "subreddit": "tressless or HairLoss or minoxidil etc",
  "summary": "2-3 sentences summarizing the post content, results shared, or key insight",
  "score": 0,
  "numComments": 0,
  "url": "direct reddit.com post URL if available in search result, otherwise empty string",
  "created": "approximate date like 'Jun 2026' or 'May 2026'",
  "sentiment": "positive" | "negative" | "neutral",
  "tags": ["progress report" | "side effects" | "question" | "success story" | "protocol" | "before/after"]
}]

Focus on posts with real data, timelines, or concrete observations. No generic advice posts. Return ONLY the JSON array.`;

  const { result, error } = await callClaudeWebSearchObject(apiKey, msg, 2500);
  if (!result || !Array.isArray(result)) return { apiError: true, errorDetail: error };

  const items = result.map((item, i) => ({
    ...item,
    id: item.url || `${item.title}-${i}`,
    source: 'Reddit',
    relevance: 'MEDIUM',
    relevance_reason: `From r/${item.subreddit || 'tressless'} — real user experience.`,
    action: 'informational',
    canAddToProtocol: false,
    isReddit: true,
  }));

  const fetchedAt = new Date().toISOString();
  if (isDefault) set(COMMUNITY_CACHE_KEY, { items, fetchedAt }).catch(() => {});

  return { items, fromCache: false, fetchedAt };
}
