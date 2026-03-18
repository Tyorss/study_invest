export type StudyTrackerPositionStatus = "active" | "closed";
export type StudyCallDirection = "long" | "avoid" | "watch";
export type StudySessionStance = "bullish" | "watch" | "neutral" | "avoid";
export type StudySessionFollowUpStatus =
  | "waiting_event"
  | "ready_for_call"
  | "dropped"
  | "converted";
export type StudyCallFeedbackStance = "agree" | "neutral" | "disagree";
export type StudyCallUpdateType = "update" | "catalyst" | "risk" | "postmortem";

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
  position_status: StudyTrackerPositionStatus | null;
  exited_at: string | null;
  exited_price: string | null;
  source_session_id: number | null;
  source_coverage_id: number | null;
  call_direction: StudyCallDirection | null;
  conviction_score: number | null;
  invalidation_rule: string | null;
  time_horizon: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface StudySessionRow {
  id: number;
  presented_at: string;
  presenter: string;
  industry_name: string;
  title: string;
  thesis: string | null;
  anti_thesis: string | null;
  note: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface StudySessionCompanyRow {
  id: number;
  session_id: number;
  company_name: string;
  ticker: string;
  sector: string | null;
  session_stance: StudySessionStance;
  mention_reason: string | null;
  follow_up_status: StudySessionFollowUpStatus;
  next_event_date: string | null;
  note: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface StudyCallFeedbackRow {
  id: number;
  idea_id: number;
  participant_id: string;
  stance: StudyCallFeedbackStance;
  note: string | null;
  created_at: string;
  updated_at?: string;
}

export interface StudyCallUpdateRow {
  id: number;
  idea_id: number;
  update_type: StudyCallUpdateType;
  title: string | null;
  body: string;
  created_by: string | null;
  created_at: string;
  updated_at?: string;
}

export interface StudyTrackerLinkedTradeRow {
  id: number;
  source_idea_id: number;
  portfolio_id: string;
  trade_date: string;
  side: "BUY" | "SELL" | "CLOSE";
  quantity: string | number;
  price: string | number;
  note: string | null;
  participant_id: string;
  participant_name: string;
  symbol: string | null;
}

export interface StudyCallFeedback {
  id: number;
  participant_id: string;
  participant_name: string;
  stance: StudyCallFeedbackStance;
  note: string | null;
  created_at: string;
}

export interface StudyCallUpdate {
  id: number;
  update_type: StudyCallUpdateType;
  title: string | null;
  body: string;
  created_by: string | null;
  created_at: string;
}

export interface StudyTrackerLinkedTrade {
  id: number;
  source_idea_id: number;
  participant_id: string;
  participant_name: string;
  trade_date: string;
  side: "BUY" | "SELL" | "CLOSE";
  quantity: number;
  price: number;
  note: string | null;
  symbol: string | null;
}

export interface StudySessionCompany {
  id: number;
  session_id: number;
  company_name: string;
  ticker: string;
  sector: string | null;
  session_stance: StudySessionStance;
  mention_reason: string | null;
  follow_up_status: StudySessionFollowUpStatus;
  next_event_date: string | null;
  note: string | null;
  converted_call_count: number;
}

export interface StudySession {
  id: number;
  presented_at: string;
  presenter: string;
  industry_name: string;
  title: string;
  thesis: string | null;
  anti_thesis: string | null;
  note: string | null;
  companies: StudySessionCompany[];
  covered_count: number;
  converted_count: number;
  adoption_count: number;
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
  is_included: boolean;
  included_at: string | null;
  included_price: number | null;
  weight: number | null;
  position_status: StudyTrackerPositionStatus | null;
  exited_at: string | null;
  exited_price: number | null;
  portfolio_return_pct: number | null;
  source_session_id: number | null;
  source_coverage_id: number | null;
  call_direction: StudyCallDirection;
  conviction_score: number | null;
  invalidation_rule: string | null;
  time_horizon: string | null;
  source_session: StudySession | null;
  source_coverage: StudySessionCompany | null;
  feedbacks: StudyCallFeedback[];
  updates: StudyCallUpdate[];
  linked_trades: StudyTrackerLinkedTrade[];
  feedback_count: number;
  update_count: number;
  linked_trade_count: number;
  adoption_count: number;
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
  source_session_id?: number | null;
  source_coverage_id?: number | null;
  call_direction?: StudyCallDirection | null;
  conviction_score?: number | null;
  invalidation_rule?: string | null;
  time_horizon?: string | null;
}

export interface StudySessionInput {
  presented_at: string;
  presenter: string;
  industry_name: string;
  title: string;
  thesis?: string | null;
  anti_thesis?: string | null;
  note?: string | null;
}

export interface StudySessionCompanyInput {
  session_id: number;
  company_name: string;
  ticker: string;
  sector?: string | null;
  session_stance?: StudySessionStance | null;
  mention_reason?: string | null;
  follow_up_status?: StudySessionFollowUpStatus | null;
  next_event_date?: string | null;
  note?: string | null;
}

export interface StudyCallFeedbackInput {
  participant_id: string;
  stance: StudyCallFeedbackStance;
  note?: string | null;
}

export interface StudyCallUpdateInput {
  update_type?: StudyCallUpdateType | null;
  title?: string | null;
  body: string;
  created_by?: string | null;
}

export interface StudyTrackerSummary {
  totalIdeas: number;
  activeIdeas: number;
  closedIdeas: number;
  avgTrackingReturnPct: number | null;
  bestIdea: StudyTrackerIdea | null;
  worstIdea: StudyTrackerIdea | null;
  adoptedCalls: number;
  mostFollowedCall: StudyTrackerIdea | null;
  mostDiscussedCall: StudyTrackerIdea | null;
  callsFromSessions: number;
}

export interface StudyTrackerPortfolioSummary {
  includedIdeas: number;
  portfolioReturnPct: number | null;
  avgPositionReturnPct: number | null;
  bestContributor: StudyTrackerIdea | null;
  worstContributor: StudyTrackerIdea | null;
}

export interface StudySessionSummary {
  totalSessions: number;
  totalCoveredCompanies: number;
  totalConvertedCalls: number;
  topSessionByConversion: StudySession | null;
}

export type StudyTrackerBenchmarkCode = "NASDAQ" | "SPY" | "KOSPI";

export interface StudyCallOption {
  id: number;
  label: string;
}

export interface StudyTrackerData {
  ideas: StudyTrackerIdea[];
  statuses: string[];
  sectors: string[];
  styles: string[];
  presenters: string[];
  participants: Array<{ id: string; name: string }>;
  summary: StudyTrackerSummary;
}

export interface StudyTrackerPortfolioData {
  ideas: StudyTrackerIdea[];
  presenters: string[];
  summary: StudyTrackerPortfolioSummary;
  benchmark: StudyTrackerBenchmarkCode;
  benchmarkLabel: string;
  benchmarkReturnPct: number | null;
  excessReturnPct: number | null;
  periodFrom: string;
  periodTo: string;
}

export interface StudySessionData {
  sessions: StudySession[];
  participants: Array<{ id: string; name: string }>;
  summary: StudySessionSummary;
}
