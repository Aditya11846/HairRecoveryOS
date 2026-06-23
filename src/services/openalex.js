import { fetchWithTimeout } from '../utils/fetchTimeout';

const BASE = 'https://api.openalex.org/works';
export const DEFAULT_OPENALEX_QUERY = 'dutasteride androgenetic alopecia minoxidil';
const FIELDS = 'id,title,publication_year,cited_by_count,open_access,doi,primary_location,authorships';

export async function searchOpenAlex(query = DEFAULT_OPENALEX_QUERY, perPage = 10, sortBy = 'cited_by_count:desc') {
  try {
    const params = new URLSearchParams({
      search: query,
      sort: sortBy,
      'per-page': String(perPage),
      filter: 'type:article',
      select: FIELDS,
    });
    const res = await fetchWithTimeout(`${BASE}?${params}`, {
      headers: {
        'User-Agent': 'HairRecoveryOS/1.0 (mailto:aditherealone@gmail.com)',
        Accept: 'application/json',
      },
    }, 15000);
    if (!res.ok) return [];
    const data = await res.json();
    const works = data.results || [];

    return works.map(w => {
      const authorships = w.authorships || [];
      const authors = authorships
        .slice(0, 3)
        .map(a => a.author?.display_name)
        .filter(Boolean)
        .join(', ') + (authorships.length > 3 ? ' et al.' : '');
      const journal = w.primary_location?.source?.display_name || '';
      const oaUrl   = w.open_access?.oa_url || '';
      const doiUrl  = w.doi || '';
      const citations = w.cited_by_count || 0;

      return {
        id: w.id,
        title: w.title || 'Untitled',
        source: 'OpenAlex',
        journal,
        authors,
        pubDate: String(w.publication_year || ''),
        citedBy: citations,
        isOpenAccess: w.open_access?.is_oa || false,
        url: oaUrl || doiUrl || '',
        relevance: citations > 50 ? 'HIGH' : citations > 10 ? 'MEDIUM' : 'LOW',
        relevance_reason: `Cited ${citations} times${w.open_access?.is_oa ? ' · Open access' : ''}.`,
        action: 'informational',
        canAddToProtocol: false,
        summary: '',
        isOpenAlex: true,
      };
    });
  } catch {
    return [];
  }
}
