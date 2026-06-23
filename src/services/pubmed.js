import { fetchWithTimeout } from '../utils/fetchTimeout';

const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const HEADERS = { 'User-Agent': 'HairRecoveryOS/1.0' };
export const DEFAULT_PUBMED_QUERY = 'androgenetic alopecia oral minoxidil dutasteride 2024 2025 2026';

export async function searchPubMed(query = DEFAULT_PUBMED_QUERY, maxResults = 10) {
  try {
    const searchRes = await fetchWithTimeout(
      `${BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${maxResults}&sort=date&retmode=json`,
      { headers: HEADERS },
      15000,
    );
    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    const ids = searchData.esearchresult?.idlist || [];
    if (ids.length === 0) return [];

    const summaryRes = await fetchWithTimeout(
      `${BASE}/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`,
      { headers: HEADERS },
      15000,
    );
    if (!summaryRes.ok) return [];
    const summaryData = await summaryRes.json();
    const uids = summaryData.result?.uids || [];

    return uids.map(uid => {
      const a = summaryData.result[uid];
      const authorList = a.authors || [];
      const authors = authorList.slice(0, 3).map(x => x.name).join(', ') + (authorList.length > 3 ? ' et al.' : '');
      return {
        id: uid,
        title: (a.title || 'Untitled').replace(/<[^>]+>/g, ''),
        source: 'PubMed',
        journal: a.fulljournalname || a.source || '',
        authors,
        pubDate: a.pubdate || '',
        url: `https://pubmed.ncbi.nlm.nih.gov/${uid}/`,
        relevance: 'HIGH',
        relevance_reason: 'Recent peer-reviewed study on androgenetic alopecia treatment.',
        action: 'informational',
        canAddToProtocol: false,
        summary: '',
        isPubMed: true,
      };
    });
  } catch {
    return [];
  }
}
