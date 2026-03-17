export interface StudyTrackerIdeaRow {
  id: number;
  seed_key: string | null;
  presented_at: string | null;
  presenter: string;
  company_name: string;
  ticker: string;
  sector: string | null;
  pitch_price: string | null;
  target_price: string | null;
  pitch_upside_pct: string | null;
  currency: "KRW" | "USD" | null;
  current_price: string | null;
  current_upside_pct: string | null;
  current_return_pct: string | null;
  thesis: string | null;
  trigger: string | null;
  risk: string | null;
  style: string | null;
  status: string | null;
  entry_date: string | null;
  exit_date: string | null;
  close_return_pct: string | null;
  note: string | null;
  tracking_return_pct: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface StudyTrackerIdea {
  id: number;
  presented_at: string | null;
  presenter: string;
  company_name: string;
  ticker: string;
  sector: string | null;
  pitch_price: number | null;
  target_price: number | null;
  pitch_upside_pct: number | null;
  currency: "KRW" | "USD" | null;
  current_price: number | null;
  current_upside_pct: number | null;
  current_return_pct: number | null;
  thesis: string | null;
  trigger: string | null;
  risk: string | null;
  style: string | null;
  status: string | null;
  entry_date: string | null;
  exit_date: string | null;
  close_return_pct: number | null;
  note: string | null;
  tracking_return_pct: number | null;
}

export interface StudyTrackerIdeaInput {
  presented_at?: string | null;
  presenter: string;
  company_name: string;
  ticker: string;
  sector?: string | null;
  pitch_price?: number | null;
  target_price?: number | null;
  pitch_upside_pct?: number | null;
  currency?: "KRW" | "USD" | null;
  current_price?: number | null;
  current_upside_pct?: number | null;
  current_return_pct?: number | null;
  thesis?: string | null;
  trigger?: string | null;
  risk?: string | null;
  style?: string | null;
  status?: string | null;
  entry_date?: string | null;
  exit_date?: string | null;
  close_return_pct?: number | null;
  note?: string | null;
  tracking_return_pct?: number | null;
}

export interface StudyTrackerSummary {
  totalIdeas: number;
  activeIdeas: number;
  closedIdeas: number;
  avgTrackingReturnPct: number | null;
  bestIdea: StudyTrackerIdea | null;
  worstIdea: StudyTrackerIdea | null;
}

export interface StudyTrackerData {
  ideas: StudyTrackerIdea[];
  statuses: string[];
  sectors: string[];
  styles: string[];
  summary: StudyTrackerSummary;
}
