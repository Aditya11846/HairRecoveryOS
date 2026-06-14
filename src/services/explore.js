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
  try {
    const queries = ['oral+minoxidil+results', 'dutasteride+regrowth', 'crown+aga+progress'];
    const seen = new Set();
    const results = [];

    for (const q of queries) {
      try {
        const res = await fetch(
          `https://www.reddit.com/r/tressless/search.json?q=${q}&sort=top&t=year&limit=5&restrict_sr=1`,
          { headers: { 'User-Agent': 'HairRecoveryOS/1.0' } },
        );
        const data = await res.json();
        const posts = data?.data?.children || [];

        for (const post of posts) {
          const d = post.data;
          const url = `https://reddit.com${d.permalink}`;
          if (!seen.has(url) && d.title) {
            seen.add(url);
            results.push({
              title: d.title,
              score: d.score || 0,
              url,
              excerpt: (d.selftext || '').slice(0, 200),
            });
          }
        }
      } catch {}
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 10);
  } catch (e) {
    logger.error('Explore', 'Reddit error', e.message);
    return [];
  }
}

async function analyzeWithClaude(apiKey, pubmedData, trialsData, redditData) {
  const userMsg = `Aditya's profile: 22yo male, crown AGA Norwood ~3, on oral minoxidil 2.5mg daily + Novegrow topical 10% solution nightly + dutasteride 0.5mg Mon/Thu. Smokes ~5/day. No bloodwork yet. Phase 1 baseline Jun 2026.

PubMed papers (${pubmedData.length}):
${JSON.stringify(pubmedData.map(p => ({ title: p.title, journal: p.journal, pubdate: p.pubdate, url: p.url })))}

Recruiting clinical trials (${trialsData.length}):
${JSON.stringify(trialsData.map(t => ({ title: t.title, summary: t.summary, url: t.url })))}

Reddit r/tressless posts (${redditData.length}):
${JSON.stringify(redditData.map(r => ({ title: r.title, score: r.score, url: r.url })))}

Analyze this raw data and return the 5 MOST RELEVANT items as a JSON array. Return ONLY the JSON, no markdown, no code fences:
[{"title":"...","source":"PubMed"|"ClinicalTrial"|"Reddit","summary":"2 sentences based on the actual data","relevance":"HIGH"|"MEDIUM"|"LOW","relevance_reason":"1 sentence specific to this profile","action":"ask_doctor"|"add_to_protocol"|"monitor"|"informational","canAddToProtocol":false,"url":"..."}]`;

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

  const sources = { pubmed: pubmedData.length, trials: trialsData.length, reddit: redditData.length };

  if (!pubmedData.length && !trialsData.length && !redditData.length) {
    return { apiError: true, errorDetail: 'All data sources failed. Check internet connection.' };
  }

  const { result: items, error } = await analyzeWithClaude(apiKey, pubmedData, trialsData, redditData);
  if (!items) return { apiError: true, errorDetail: error };

  const fetchedAt = new Date().toISOString();
  const cacheData = { items, fetchedAt, sources };
  AsyncStorage.setItem(EXPLORE_LOCAL_KEY, JSON.stringify(cacheData)).catch(() => {});

  return { items, fetchedAt, sources, fromCache: false };
}
