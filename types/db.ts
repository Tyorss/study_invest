export type Market = "KR" | "US" | "INDEX";
export type Currency = "KRW" | "USD";
export type TradeSide = "BUY" | "SELL" | "CLOSE";
export type OrderType = "MARKET" | "LIMIT" | "STOP";
export type OrderStatus = "PENDING" | "REJECTED" | "PARTIAL" | "FILLED" | "CANCELED";
export type TimeInForce = "DAY" | "GTC";
export type FillPolicy =
  | "MANUAL"
  | "CLOSE_ON_DATE"
  | "NEXT_OPEN_PROXY"
  | "LIMIT_TOUCH"
  | "STOP_TRIGGER"
  | "DELIST_PAYOUT";
export type CorporateActionType = "SPLIT" | "DIVIDEND" | "DELIST";

export interface Participant {
  id: string;
  name: string;
  color_tag: string;
  starting_cash_krw: string;
}

export interface Portfolio {
  id: string;
  participant_id: string;
  base_currency: Currency;
  is_active: boolean;
}

export interface Instrument {
  id: string;
  symbol: string;
  name: string;
  market: Market;
  currency: Currency;
  asset_type: string;
  provider_symbol: string;
  is_active: boolean;
  is_benchmark: boolean;
  benchmark_code: "SPY" | "KOSPI" | null;
}

export interface TradeRow {
  id: number;
  portfolio_id: string;
  instrument_id: string;
  order_id: number | null;
  fill_id: number | null;
  trade_date: string;
  side: TradeSide;
  quantity: string;
  price: string;
  fee_rate: string | null;
  slippage_bps: string | null;
  execution_policy: FillPolicy | null;
  price_source: "manual" | "provider" | "carry_forward" | "corporate_action" | null;
  note: string | null;
  created_at: string;
  instruments: Instrument;
}

export interface OrderRow {
  id: number;
  portfolio_id: string;
  instrument_id: string;
  trade_date: string;
  side: TradeSide;
  order_type: OrderType;
  time_in_force: TimeInForce;
  requested_quantity: string;
  filled_quantity: string;
  limit_price: string | null;
  stop_price: string | null;
  status: OrderStatus;
  status_reason: string | null;
  note: string | null;
  created_by: string;
  source: string;
  submitted_at: string;
  created_at: string;
  updated_at: string;
}

export interface OrderFillRow {
  id: number;
  order_id: number;
  fill_date: string;
  quantity: string;
  price: string;
  fill_policy: FillPolicy;
  provider_used: string | null;
  price_source: "manual" | "provider" | "carry_forward" | "corporate_action";
  created_at: string;
}

export interface CorporateActionRow {
  id: number;
  instrument_id: string;
  action_date: string;
  action_type: CorporateActionType;
  split_from: string | null;
  split_to: string | null;
  cash_per_share: string | null;
  payout_price: string | null;
  note: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface PriceRow {
  instrument_id: string;
  date: string;
  close: string;
  source?: string;
}

export interface FxRateRow {
  pair: string;
  date: string;
  rate: string;
  source?: string;
}

export interface DailySnapshot {
  participant_id: string;
  portfolio_id: string;
  date: string;
  nav_krw: number;
  cash_krw: number;
  holdings_value_krw: number;
  realized_pnl_krw: number;
  unrealized_pnl_krw: number;
  total_return_pct: number;
  spy_return_pct: number | null;
  kospi_return_pct: number | null;
  alpha_spy_pct: number | null;
  alpha_kospi_pct: number | null;
  ret_daily: number | null;
  vol_ann_252: number | null;
  sharpe_252: number | null;
  mdd_to_date: number;
  beta_spy_252: number | null;
  beta_kospi_252: number | null;
}

export interface SnapshotSeriesPoint {
  date: string;
  nav_krw: number;
  total_return_pct: number;
  spy_return_pct: number | null;
  kospi_return_pct: number | null;
  ret_daily: number | null;
}

export interface LeaderboardRow {
  participant_id: string;
  participant_name: string;
  color_tag: string;
  date: string;
  nav_krw: number;
  cash_krw: number;
  holdings_value_krw: number;
  realized_pnl_krw: number;
  unrealized_pnl_krw: number;
  total_return_pct: number;
  spy_return_pct: number | null;
  kospi_return_pct: number | null;
  alpha_spy_pct: number | null;
  alpha_kospi_pct: number | null;
  sharpe_252: number | null;
  vol_ann_252: number | null;
  mdd_to_date: number;
  beta_spy_252: number | null;
  beta_kospi_252: number | null;
  cash_ratio: number | null;
  turnover_20d: number | null;
}

export interface RankedInstrumentStat {
  symbol: string;
  value: number;
}

export interface LeaderboardInstrumentsRow {
  participant_id: string;
  participant_name: string;
  color_tag: string;
  cash_ratio: number | null;
  turnover_20d: number | null;
  top_return: RankedInstrumentStat[];
  top_weight: RankedInstrumentStat[];
  top_unrealized: RankedInstrumentStat[];
}

export interface JobRunInsert {
  job_name: string;
  target_date: string;
  status: "success" | "partial" | "failed";
  error_message: string | null;
  metrics_json: Record<string, unknown>;
}

export interface AuditLogInsert {
  entity_type: "ORDER" | "FILL" | "TRADE" | "CORP_ACTION" | "NOTES" | "SYSTEM";
  entity_id: string;
  action: string;
  actor: string;
  payload_json: Record<string, unknown>;
}

export interface ParticipantNoteLine {
  id?: number;
  participant_id: string;
  sort_order: number;
  symbol: string | null;
  memo_text: string;
  created_at?: string;
  updated_at?: string;
}

export interface ParticipantNotesBundle {
  participant_id: string;
  market_note: string;
  lines: ParticipantNoteLine[];
}
