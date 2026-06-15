import AsyncStorage from '@react-native-async-storage/async-storage';
import { get } from '../utils/storage';
import { MODEL, EXPLORE_CACHE_TTL_MS } from '../constants/config';
import { logger } from '../utils/logger';

const EXPLORE_LOCAL_KEY = 'hair_os_explore_cache_local';
const API_URL = 'https://api.anthropic.com/v1/messages';

async function fetchPubMed() {
  try {
    const searchRes = await fetch(
      'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=oral+minoxidil+dutasteride+androgenetic+alopecia&retmax=10&sort=date&retmode=json',
    );
    const searchData = await searchRes.json();
    const ids = searchData?.esearchresult?.idlist || [];
    if (!ids.length) return [];

    const summaryRes = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`,
    );
    const summaryData = await summaryRes.json();
    const result = summaryData?.result || {};

    return ids
      .map(id => ({
        id,
        title: result[id]?.title || '',
        authors: (result[id]?.authors || []).slice(0, 2).map(a => a.name).join(', '),
        journal: result[id]?.source || '',
        pubdate: result[id]?.pubdate || '',
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      }))
      .filter(p => p.title);
  } catch (e) {
    logger.error('Explore', 'PubMed error', e.message);
    return [];
  }
}

async function fetchClinicalTrials() {
  try {
    const res = await fetch(
      'https://clinicaltrials.gov/api/v2/studies?query.term=androgenetic+alopecia+minoxidil&filter.overallStatus=RECRUITING&pageSize=10',
    );
    const data = await res.json();
    const studies = data?.studies || [];

    return studies
      .map(s => {
        const nctId = s?.protocolSection?.identificationModule?.nctId || '';
        return {
          nctId,
          title: s?.protocolSection?.identificationModule?.briefTitle || '',
          status: s?.protocolSection?.statusModule?.overallStatus || '',
          summary: (s?.protocolSection?.descriptionModule?.briefSummary || '').slice(0, 200),
          url: `https://clinicaltrials.gov/study/${nctId}`,
        };
      })
      .filter(t => t.title);
  } catch (e) {
    logger.error('Explore', 'ClinicalTrials error', e.message);
    return [];
  }
}

async function fetchReddit() {
  const queries = [
    { q: 'oral minoxidil before after results', sort: 'top', t: 'year' },
    { q: 'dutasteride regrowth progress', sort: 'top', t: 'year' },
    { q: 'minoxidil shedding telogen effluvium', sort: 'top', t: 'year' },
    { q: 'crown AGA norwood regrowth', sort: 'top', t: 'all' },
    { q: 'oral minoxidil side effects experience', sort: 'top', t: 'year' },
    { q: 'dutasteride vs finasteride results', sort: 'top', t: 'all' },
  ];

  const seen = new Set();
  const results = [];

  for (const { q, sort, t } of queries) {
    try {
      const encoded = encodeURIComponent(q);
      const url = `https://www.reddit.com/r/tressless/search.json?q=${encoded}&sort=${sort}&t=${t}&limit=8&restrict_sr=1&raw_json=1`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
          'Accept': 'application/json',
        },
      });
      if (!res.ok) {
        console.log('[Reddit] HTTP', res.status, 'for:', q);
        continue;
      }
      const data = await res.json();
      const posts = data?.data?.children || [];
      console.log('[Reddit]', q, '→', posts.length, 'posts');
      for (const post of posts) {
        const d = post?.data;
        if (!d?.title || seen.has(d.id)) continue;
        seen.add(d.id);
        results.push({
          id: d.id,
          title: d.title,
          score: d.score || 0,
          url: `https://www.reddit.com${d.permalink}`,
          excerpt: (d.selftext || '').slice(0, 400),
          numComments: d.num_comments || 0,
        });
      }
      await new Promise(r => setTimeout(r, 250));
    } catch (e) {
      console.log('[Reddit] error:', e.message);
    }
  }

  const REDDIT_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
  const addPosts = (children) => {
    for (const post of children || []) {
      const d = post?.data;
      if (!d?.title || seen.has(d.id)) continue;
      seen.add(d.id);
      results.push({
        id: d.id,
        title: d.title,
        score: d.score || 0,
        url: `https://www.reddit.com${d.permalink}`,
        excerpt: (d.selftext || '').slice(0, 400),
        numComments: d.num_comments || 0,
      });
    }
  };

  // Hot fallback
  try {
    const hotRes = await fetch('https://www.reddit.com/r/tressless/hot.json?limit=25&raw_json=1', {
      headers: { 'User-Agent': REDDIT_UA },
    });
    if (hotRes.ok) addPosts((await hotRes.json())?.data?.children);
  } catch (e) { console.log('[Reddit] hot fallback error:', e.message); }

  // Top all-time fallback
  if (results.length < 10) {
    try {
      const topRes = await fetch('https://www.reddit.com/r/tressless/top.json?t=year&limit=25&raw_json=1', {
        headers: { 'User-Agent': REDDIT_UA },
      });
      if (topRes.ok) addPosts((await topRes.json())?.data?.children);
    } catch (e) { console.log('[Reddit] top fallback error:', e.message); }
  }

  console.log('[Reddit] total unique posts:', results.length);
  return results.sort((a, b) => b.score - a.score).slice(0, 15);
}


function scoreItem(item, type) {
  let score = 0;
  const text = (item.title + ' ' + (item.excerpt || '') + ' ' + (item.summary || '')).toLowerCase();

  const highValue = ['oral minoxidil', 'dutasteride', 'crown', 'vertex', 'norwood', 'aga', 'androgenetic'];
  const medValue = ['minoxidil', 'finasteride', 'dht', 'hair loss', 'regrowth', 'alopecia', 'follicle'];
  const negValue = ['female', 'women', 'cicatricial', 'alopecia areata', 'traction'];

  highValue.forEach(kw => { if (text.includes(kw)) score += 3; });
  medValue.forEach(kw => { if (text.includes(kw)) score += 1; });
  negValue.forEach(kw => { if (text.includes(kw)) score -= 5; });

  if (type === 'pubmed' && item.pubdate) {
    const year = parseInt(item.pubdate.slice(0, 4));
    if (year >= 2023) score += 3;
    else if (year >= 2021) score += 1;
  }

  if (type === 'reddit') score += Math.min(item.score / 500, 3);

  return score;
}

async function analyzeWithClaude(apiKey, pubmedData, trialsData, redditData) {
  const userMsg = `You are analyzing hair loss research for Aditya Singh, 22, Pune, India.
His profile: Crown AGA Norwood ~3 vertex (hairline intact). Protocol: oral minoxidil 2.5mg daily + Novegrow topical 10% solution nightly + dutasteride 0.5mg Mon+Thu. Smokes ~5 cigarettes/day. No bloodwork done. Peak result Aug 2025: 90% crown regrowth. Phase 1 baseline Jun 2026. Target: 100% crown recovery Sep 2026.

PubMed papers (${pubmedData.length}):
${JSON.stringify(pubmedData.map(p => ({ title: p.title, journal: p.journal, pubdate: p.pubdate, url: p.url })))}

Recruiting clinical trials (${trialsData.length}):
${JSON.stringify(trialsData.map(t => ({ title: t.title, summary: t.summary, url: t.url })))}

Reddit r/tressless posts (${redditData.length}):
${JSON.stringify(redditData.map(r => ({ title: r.title, score: r.score, comments: r.numComments, url: r.url, excerpt: (r.excerpt || '').slice(0, 150) })))}

Select the 8 MOST RELEVANT items for Aditya's exact situation. Prioritize: oral minoxidil, dutasteride, crown AGA, shedding phases, smoking impact, bloodwork. Return ONLY a valid JSON array with no markdown, no code fences, no explanation:
[{"title":"...","source":"PubMed"|"ClinicalTrial"|"Reddit","summary":"2 sentence plain English summary of what this says","relevance":"HIGH"|"MEDIUM"|"LOW","relevance_reason":"1 sentence why this is specifically relevant to Aditya's protocol","action":"ask_doctor"|"add_to_protocol"|"monitor"|"informational","canAddToProtocol":false,"url":"...","readTime":"X min read"}]`;

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });

    const rawBody = await res.text();
    logger.debug('Explore', `Claude status: ${res.status}`);

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try { errMsg = JSON.parse(rawBody)?.error?.message || errMsg; } catch {}
      return { result: null, error: errMsg };
    }

    const data = JSON.parse(rawBody);
    const text = (data.content || []).filter(b => b.type === 'text').pop()?.text || '';
    const stripped = text.replace(/```[\w]*\n?/g, '').replace(/```/g, '').trim();
    const match = stripped.match(/\[[\s\S]*\]/);
    if (!match) {
      return { result: null, error: `No JSON array found. Got: "${stripped.slice(0, 200)}"` };
    }

    return { result: JSON.parse(match[0]), error: null };
  } catch (e) {
    return { result: null, error: e.message };
  }
}

export async function getCachedOrFreshExplore(forceRefresh = false) {
  const apiKey = await get('api_key', '');
  if (!apiKey) return { noApiKey: true };

  if (!forceRefresh) {
    try {
      const raw = await AsyncStorage.getItem(EXPLORE_LOCAL_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        const ageMs = Date.now() - new Date(cached.fetchedAt).getTime();
        if (ageMs < EXPLORE_CACHE_TTL_MS && cached.items?.length) {
          logger.debug('Explore', 'served from local cache');
          return { ...cached, fromCache: true };
        }
      }
    } catch {}
  }

  logger.info('Explore', 'fetching fresh data from all sources');
  const [pubmedData, trialsData, redditData] = await Promise.all([
    fetchPubMed(),
    fetchClinicalTrials(),
    fetchReddit(),
  ]);

  logger.info('Explore', `fetched: pubmed=${pubmedData.length}, trials=${trialsData.length}, reddit=${redditData.length}`);

  // Pre-filter with relevance scoring before sending to Claude
  const scoredPubmed = pubmedData
    .map(p => ({ ...p, _score: scoreItem(p, 'pubmed') }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 6);
  const scoredReddit = redditData
    .map(r => ({ ...r, _score: scoreItem(r, 'reddit') }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 8);

  const sources = {
    pubmed: pubmedData.length,
    trials: trialsData.length,
    reddit: redditData.length,
  };

  if (!pubmedData.length && !trialsData.length && !redditData.length) {
    return { apiError: true, errorDetail: 'All data sources failed. Check internet connection.' };
  }

  const { result: items, error } = await analyzeWithClaude(apiKey, scoredPubmed, trialsData, scoredReddit);
  if (!items) return { apiError: true, errorDetail: error };

  const fetchedAt = new Date().toISOString();
  const cacheData = { items, fetchedAt, sources };
  AsyncStorage.setItem(EXPLORE_LOCAL_KEY, JSON.stringify(cacheData)).catch(() => {});

  return { items, fetchedAt, sources, fromCache: false };
}
