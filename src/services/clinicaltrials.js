import { fetchWithTimeout } from '../utils/fetchTimeout';

const BASE = 'https://clinicaltrials.gov/api/v2/studies';
export const DEFAULT_TRIALS_QUERY = 'androgenetic alopecia minoxidil dutasteride';

const STATUS_MAP = {
  RECRUITING:                  { label: 'Recruiting',    color: '#30D158' },
  ACTIVE_NOT_RECRUITING:       { label: 'Active',        color: '#FF9F0A' },
  ENROLLING_BY_INVITATION:     { label: 'Invite Only',   color: '#3B82F6' },
  NOT_YET_RECRUITING:          { label: 'Starting Soon', color: '#06B6D4' },
  COMPLETED:                   { label: 'Completed',     color: '#8E8E93' },
  TERMINATED:                  { label: 'Terminated',    color: '#FF453A' },
  WITHDRAWN:                   { label: 'Withdrawn',     color: '#FF453A' },
  SUSPENDED:                   { label: 'Suspended',     color: '#FF9F0A' },
  UNKNOWN:                     { label: 'Unknown',       color: '#3A3A3C' },
};

export function getTrialStatus(status) {
  return STATUS_MAP[status] || STATUS_MAP.UNKNOWN;
}

export async function searchClinicalTrials(query = DEFAULT_TRIALS_QUERY, pageSize = 15) {
  try {
    const params = new URLSearchParams({
      'query.term': query,
      pageSize: String(pageSize),
      format: 'json',
      sort: 'LastUpdatePostDate:desc',
    });
    const res = await fetchWithTimeout(`${BASE}?${params}`, {
      headers: { 'User-Agent': 'HairRecoveryOS/1.0' },
    }, 15000);
    if (!res.ok) return [];
    const data = await res.json();
    const studies = data.studies || [];

    return studies.map(s => {
      const proto  = s.protocolSection || {};
      const id     = proto.identificationModule || {};
      const status = proto.statusModule || {};
      const desc   = proto.descriptionModule || {};
      const design = proto.designModule || {};
      const arms   = proto.armsInterventionsModule || {};
      const locs   = proto.contactsLocationsModule?.locations || [];
      const sponsor = proto.sponsorCollaboratorsModule?.leadSponsor?.name || '';
      const countries = [...new Set(locs.map(l => l.country).filter(Boolean))].slice(0, 3);
      const interventions = (arms.interventions || []).map(i => i.name).slice(0, 4);
      const phases = design.phases || [];

      return {
        id: id.nctId,
        title: id.briefTitle || id.officialTitle || 'Untitled',
        source: 'ClinicalTrial',
        nctId: id.nctId,
        status: status.overallStatus || 'UNKNOWN',
        startDate: status.startDateStruct?.date || '',
        completionDate: status.completionDateStruct?.date || '',
        summary: (desc.briefSummary || '').replace(/\s+/g, ' ').slice(0, 350),
        interventions,
        phases,
        countries,
        sponsor,
        url: `https://clinicaltrials.gov/study/${id.nctId}`,
        relevance: 'HIGH',
        relevance_reason: 'Active clinical research directly related to your treatment area.',
        action: 'informational',
        canAddToProtocol: false,
        summary_display: '',
        isTrial: true,
      };
    });
  } catch {
    return [];
  }
}
