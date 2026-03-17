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
  is_included: boolean | null;
  included_at: string | null;
  included_price: string | null;
  weight: string | null;
  position_status: "active" | "closed" | null;
  exited_at: string | null;
  exited_price: string | null;
  created_at?: string;
  updated_at?: string;
}

export type StudyTrackerPositionStatus = "active" | "closed";

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
  is_included: boolean;
  included_at: string | null;
  included_price: number | null;
  weight: number | null;
  position_status: StudyTrackerPositionStatus | null;
  exited_at: string | null;
  exited_price: number | null;
  portfolio_return_pct: number | null;
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
  is_included?: boolean | null;
  included_at?: string | null;
  included_price?: number | null;
  weight?: number | null;
  position_status?: StudyTrackerPositionStatus | null;
  exited_at?: string | null;
  exited_price?: number | null;
}

export interface StudyTrackerSummary {
  totalIdeas: number;
  activeIdeas: number;
  closedIdeas: number;
  avgTrackingReturnPct: number | null;
  bestIdea: StudyTrackerIdea | null;
  worstIdea: StudyTrackerIdea | null;
}

export interface StudyTrackerPortfolioSummary {
  includedIdeas: number;
  portfolioReturnPct: number | null;
  avgPositionReturnPct: number | null;
  bestContributor: StudyTrackerIdea | null;
  worstContributor: StudyTrackerIdea | null;
}

export interface StudyTrackerData {
  ideas: StudyTrackerIdea[];
  statuses: string[];
  sectors: string[];
  styles: string[];
  summary: StudyTrackerSummary;
}

export interface StudyTrackerPortfolioData {
  ideas: StudyTrackerIdea[];
  presenters: string[];
  summary: StudyTrackerPortfolioSummary;
}
