export type Priority = 'critical' | 'positive' | 'informational';
export type Relevance = 'HIGH' | 'MEDIUM' | 'LOW';
export type Action = 'ask_doctor' | 'add_to_protocol' | 'monitor' | 'informational';
export type Source = 'PubMed' | 'Reddit' | 'ClinicalTrial' | 'NewProduct' | 'Technique';

export interface CheckIn {
  oralMinoxidil: boolean | null;
  topicalMinoxidil: boolean | null;
  dutasteride: boolean | null;
  redLightComb: boolean | null;
  cigarettes: number;
  sleep: number;
  stress: number;
  sheddingNoticed: boolean | null;
  notes: string;
  customValues: Record<string, boolean | null>;
  date: string;
  savedAt: string;
  synced: boolean;
}

export interface Insight {
  priority: Priority;
  title: string;
  body: string;
}

export interface ResearchItem {
  title: string;
  source: Source;
  summary: string;
  relevance: Relevance;
  relevance_reason: string;
  action: Action;
  canAddToProtocol: boolean;
  url: string;
}

export interface CustomProtocol {
  id: string;
  name: string;
  source: string;
  active: boolean;
  added_at: string;
}
