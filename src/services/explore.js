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
    const queries = [
      'oral+minoxidil+results',
      'dutasteride+regrowth',
      'crown+aga+progress',
      'minoxidil+shedding+phase',
      'oral+minoxidil+side+effects',
      'norwood+3+recovery',
    ];
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

async function fetchDermNetNZ() {
  try {
    const res = await fetch(
      'https://dermnetnz.org/search?q=androgenetic+alopecia',
      { headers: { 'User-Agent': 'HairRecoveryOS/1.0' } },
    );
    const html = await res.text();

    const keywords = ['alopecia', 'minoxidil', 'hair loss', 'dutasteride'];
    const linkRegex = /href="(\/topics\/[^"]+)"[^>]*>([^<]+)</g;
    const results = [];
    const seen = new Set();
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      const path = match[1];
      const title = match[2].trim();
      if (!title || seen.has(path)) continue;
      const textLower = (path + ' ' + title).toLowerCase();
      if (keywords.some(kw => textLower.includes(kw))) {
        seen.add(path);
        results.push({
          title,
          url: `https://dermnetnz.org${path}`,
          excerpt: '',
          source: 'DermNet',
        });
        if (results.length >= 5) break;
      }
    }

    return results;
  } catch (e) {
    logger.error('Explore', 'DermNet error', e.message);
    return [];
  }
}

function fetchYouTubeTranscripts() {
  const YOUTUBE_STATIC = [
    {
      title: 'Oral Minoxidil for Hair Loss — Dr. Dray',
      url: 'https://www.youtube.com/watch?v=oBMQxbGIssc',
      excerpt: 'Dermatologist explains oral minoxidil mechanism, dosing, side effects vs topical',
      source: 'YouTube',
    },
    {
      title: 'Dutasteride vs Finasteride — Which is More Effective?',
      url: 'https://www.youtube.com/watch?v=3mA3JeKrELs',
      excerpt: 'Head-to-head comparison of DHT inhibitors for AGA, RCT evidence reviewed',
      source: 'YouTube',
    },
    {
      title: 'Why Consistency Matters More Than Protocol Strength',
      url: 'https://www.youtube.com/watch?v=Qk7FjKxBkEI',
      excerpt: 'Hair cycling, why stopping and starting causes telogen effluvium resets',
      source: 'YouTube',
    },
  ];
  return YOUTUBE_STATIC;
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

async function analyzeWithClaude(apiKey, pubmedData, trialsData, redditData, youtubeData, dermnetData) {
  const userMsg = `Aditya's profile: 22yo male, crown AGA Norwood ~3 vertex. Protocol: oral minoxidil 2.5mg daily, Novegrow 10% solution nightly, dutasteride 0.5mg Mon+Thu. Smokes ~5 cigarettes/day. No bloodwork done. Phase 1 baseline Jun 2026. Target: 100% crown recovery by Sep 2026.

Key questions he wants answered:
- Is shedding in shower a reliable indicator of loss progression?
- Should isotretinoin (Tretiva) be applied before minoxidil for better absorption?
- What's the real impact of smoking on minoxidil efficacy?

PubMed papers (${pubmedData.length}): ${JSON.stringify(pubmedData.map(p => ({ title: p.title, journal: p.journal, pubdate: p.pubdate, url: p.url })))}
Recruiting trials (${trialsData.length}): ${JSON.stringify(trialsData.map(t => ({ title: t.title, summary: t.summary, url: t.url })))}
Reddit r/tressless (${redditData.length}): ${JSON.stringify(redditData.map(r => ({ title: r.title, score: r.score, url: r.url, excerpt: r.excerpt })))}
YouTube references (${youtubeData.length}): ${JSON.stringify(youtubeData)}
DermNet articles (${dermnetData.length}): ${JSON.stringify(dermnetData.map(d => ({ title: d.title, url: d.url })))}

Analyze all data. Return the 8 MOST RELEVANT items as a JSON array. Return ONLY valid JSON, no markdown, no fences:
[{"title":"...","source":"PubMed"|"ClinicalTrial"|"Reddit"|"YouTube"|"DermNet","summary":"2 sentence plain-English explanation of what this actually says","relevance":"HIGH"|"MEDIUM"|"LOW","relevance_reason":"1 sentence specific to Aditya's exact protocol","action":"ask_doctor"|"add_to_protocol"|"monitor"|"informational","canAddToProtocol":false,"url":"...","readTime":"X min read"}]`;

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
  const [pubmedData, trialsData, redditData, youtubeData, dermnetData] = await Promise.all([
    fetchPubMed(),
    fetchClinicalTrials(),
    fetchReddit(),
    fetchYouTubeTranscripts(),
    fetchDermNetNZ(),
  ]);

  logger.info('Explore', `fetched: pubmed=${pubmedData.length}, trials=${trialsData.length}, reddit=${redditData.length}, youtube=${youtubeData.length}, dermnet=${dermnetData.length}`);

  // Pre-filter with relevance scoring before sending to Claude
  const scoredPubmed = pubmedData
    .map(p => ({ ...p, _score: scoreItem(p, 'pubmed') }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 6);
  const scoredReddit = redditData
    .map(r => ({ ...r, _score: scoreItem(r, 'reddit') }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 6);

  const sources = {
    pubmed: pubmedData.length,
    trials: trialsData.length,
    reddit: redditData.length,
    youtube: youtubeData.length,
  };

  if (!pubmedData.length && !trialsData.length && !redditData.length) {
    return { apiError: true, errorDetail: 'All data sources failed. Check internet connection.' };
  }

  const { result: items, error } = await analyzeWithClaude(apiKey, scoredPubmed, trialsData, scoredReddit, youtubeData, dermnetData);
  if (!items) return { apiError: true, errorDetail: error };

  const fetchedAt = new Date().toISOString();
  const cacheData = { items, fetchedAt, sources };
  AsyncStorage.setItem(EXPLORE_LOCAL_KEY, JSON.stringify(cacheData)).catch(() => {});

  return { items, fetchedAt, sources, fromCache: false };
}
