import { DEFAULT_GAME_START_DATE, FX_PAIR_USDKRW } from "@/lib/constants";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type {
  StudyCallFeedbackInput,
  StudyCallFeedbackRow,
  StudyCallUpdateInput,
  StudyCallUpdateRow,
  StudySessionCompanyInput,
  StudySessionCompanyRow,
  StudySessionInput,
  StudySessionRow,
  StudyTrackerIdeaInput,
  StudyTrackerIdeaRow,
  StudyTrackerLinkedTradeRow,
} from "@/types/study-tracker";
import type {
  AuditLogInsert,
  CorporateActionRow,
  DailySnapshot,
  FxRateRow,
  Instrument,
  JobRunInsert,
  JobRunRow,
  OrderFillRow,
  OrderRow,
  ParticipantNotesBundle,
  ParticipantNoteLine,
  Participant,
  Portfolio,
  PriceRow,
  TradeRow,
} from "@/types/db";

function pickPortfolio(value: Portfolio[] | Portfolio | null | undefined): Portfolio | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

function toErrorWithMessage(
  err: { message?: string } | null,
  fallback: string,
): Error {
  const msg = err?.message?.trim();
  return new Error(msg && msg.length > 0 ? msg : fallback);
}

export async function getGameStartDate(): Promise<string> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("settings")
    .select("value_json")
    .eq("key", "GAME_START_DATE")
    .maybeSingle();
  if (error || !data) return DEFAULT_GAME_START_DATE;
  const value = data.value_json as { date?: string } | null;
  return value?.date ?? DEFAULT_GAME_START_DATE;
}

export async function getActiveInstruments() {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("instruments")
    .select("*")
    .eq("is_active", true);
  if (error) throw error;
  return (data ?? []) as Instrument[];
}

export async function getBenchmarkInstruments() {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("instruments")
    .select("*")
    .eq("is_benchmark", true)
    .eq("is_active", true);
  if (error) throw error;
  return (data ?? []) as Instrument[];
}

export async function getParticipantsWithPortfolios() {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("participants")
    .select("*, portfolios!inner(*)")
    .order("name", { ascending: true });
  if (error) throw error;

  type Row = Participant & { portfolios: Portfolio[] | Portfolio };
  const rows = (data ?? []) as Row[];
  const out: Array<{ participant: Participant; portfolio: Portfolio }> = [];
  for (const row of rows) {
    const portfolio = pickPortfolio(row.portfolios);
    if (!portfolio) continue;
    const { portfolios: _portfolios, ...participant } = row;
    out.push({ participant, portfolio });
  }
  return out;
}

export async function getTradesForPortfolio(
  portfolioId: string,
  date: string,
): Promise<TradeRow[]> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("trades")
    .select("*, instruments!inner(*)")
    .eq("portfolio_id", portfolioId)
    .lte("trade_date", date)
    .order("trade_date", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as TradeRow[];
}

export async function getCorporateActionsForInstruments(
  instrumentIds: string[],
  date: string,
): Promise<CorporateActionRow[]> {
  if (instrumentIds.length === 0) return [];
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("corporate_actions")
    .select("*")
    .in("instrument_id", instrumentIds)
    .lte("action_date", date)
    .order("action_date", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CorporateActionRow[];
}

export async function getPriceOnOrBefore(
  instrumentId: string,
  date: string,
): Promise<number | null> {
  const point = await getPricePointOnOrBefore(instrumentId, date);
  return point?.close ?? null;
}

export async function getPricePointOnOrBefore(
  instrumentId: string,
  date: string,
): Promise<{ date: string; close: number; source?: string } | null> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("prices")
    .select("date, close, source")
    .eq("instrument_id", instrumentId)
    .lte("date", date)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    date: data.date as string,
    close: Number(data.close),
    source: data.source ? String(data.source) : undefined,
  };
}

export async function getFxOnOrBefore(
  pair: string,
  date: string,
): Promise<number | null> {
  const point = await getFxPointOnOrBefore(pair, date);
  return point?.rate ?? null;
}

export async function getFxPointOnOrBefore(
  pair: string,
  date: string,
): Promise<{ date: string; rate: number } | null> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("fx_rates")
    .select("date, rate")
    .eq("pair", pair)
    .lte("date", date)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    date: data.date as string,
    rate: Number(data.rate),
  };
}

export async function upsertPrice(rows: PriceRow[]) {
  if (rows.length === 0) return;
  const supabase = getAdminSupabase();
  const { error } = await supabase
    .from("prices")
    .upsert(rows, { onConflict: "instrument_id,date", ignoreDuplicates: false });
  if (error) throw error;
}

export async function upsertFx(rows: FxRateRow[]) {
  if (rows.length === 0) return;
  const supabase = getAdminSupabase();
  const { error } = await supabase
    .from("fx_rates")
    .upsert(rows, { onConflict: "pair,date", ignoreDuplicates: false });
  if (error) throw error;
}

export async function upsertDailySnapshot(snapshot: DailySnapshot) {
  const supabase = getAdminSupabase();
  const { error } = await supabase
    .from("daily_snapshots")
    .upsert(snapshot, { onConflict: "participant_id,date", ignoreDuplicates: false });
  if (error) throw error;
}

export async function insertJobRun(row: JobRunInsert) {
  const supabase = getAdminSupabase();
  const { error } = await supabase.from("job_runs").insert(row);
  if (error) throw error;
}

export async function getLatestJobRuns(jobNames: string[]): Promise<JobRunRow[]> {
  if (jobNames.length === 0) return [];
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("job_runs")
    .select("*")
    .in("job_name", jobNames)
    .order("run_at", { ascending: false });
  if (error) throw error;

  const out: JobRunRow[] = [];
  const seen = new Set<string>();
  for (const row of (data ?? []) as JobRunRow[]) {
    if (seen.has(row.job_name)) continue;
    seen.add(row.job_name);
    out.push(row);
  }
  return out;
}

export async function insertAuditLog(row: AuditLogInsert) {
  const supabase = getAdminSupabase();
  const { error } = await supabase.from("audit_logs").insert(row);
  if (error) throw error;
}

export async function insertOrder(input: {
  portfolio_id: string;
  instrument_id: string;
  trade_date: string;
  side: "BUY" | "SELL" | "CLOSE";
  order_type: "MARKET" | "LIMIT" | "STOP";
  time_in_force: "DAY" | "GTC";
  requested_quantity: number;
  limit_price: number | null;
  stop_price: number | null;
  note: string | null;
  created_by: string;
  source?: string;
  status?: "PENDING" | "REJECTED" | "PARTIAL" | "FILLED" | "CANCELED";
  status_reason?: string | null;
}) {
  const supabase = getAdminSupabase();
  const row = {
    ...input,
    source: input.source ?? "api",
    filled_quantity: 0,
    status: input.status ?? "PENDING",
    status_reason: input.status_reason ?? null,
  };
  const { data, error } = await supabase
    .from("orders")
    .insert(row)
    .select("*")
    .maybeSingle();
  if (error || !data) throw error ?? new Error("Failed to insert order");
  return data as OrderRow;
}

export async function updateOrder(
  orderId: number,
  patch: Partial<{
    filled_quantity: number;
    status: "PENDING" | "REJECTED" | "PARTIAL" | "FILLED" | "CANCELED";
    status_reason: string | null;
  }>,
) {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("orders")
    .update(patch)
    .eq("id", orderId)
    .select("*")
    .maybeSingle();
  if (error || !data) throw error ?? new Error("Failed to update order");
  return data as OrderRow;
}

export async function insertOrderFill(input: {
  order_id: number;
  fill_date: string;
  quantity: number;
  price: number;
  fill_policy:
    | "MANUAL"
    | "CLOSE_ON_DATE"
    | "NEXT_OPEN_PROXY"
    | "LIMIT_TOUCH"
    | "STOP_TRIGGER"
    | "DELIST_PAYOUT";
  provider_used: string | null;
  price_source: "manual" | "provider" | "carry_forward" | "corporate_action";
}) {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("order_fills")
    .insert(input)
    .select("*")
    .maybeSingle();
  if (error || !data) throw error ?? new Error("Failed to insert fill");
  return data as OrderFillRow;
}

export async function getLatestSnapshotDate(): Promise<string | null> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("daily_snapshots")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.date ?? null;
}

export async function getSnapshotsByDate(date: string) {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("daily_snapshots")
    .select("*, participants!inner(name, color_tag)")
    .eq("date", date);
  if (error) throw error;
  return data ?? [];
}

export async function getParticipantById(participantId: string) {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("participants")
    .select("*, portfolios!inner(*)")
    .eq("id", participantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as Participant & { portfolios: Portfolio[] | Portfolio };
  const portfolio = pickPortfolio(row.portfolios);
  if (!portfolio) {
    throw new Error(`Portfolio not found for participant ${participantId}`);
  }
  return { participant: row, portfolio };
}

export async function getParticipantSnapshots(participantId: string, fromDate?: string) {
  const supabase = getAdminSupabase();
  let query = supabase
    .from("daily_snapshots")
    .select("*")
    .eq("participant_id", participantId)
    .order("date", { ascending: true });
  if (fromDate) query = query.gte("date", fromDate);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getTradesJournal(portfolioId: string) {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("trades")
    .select("*, instruments!inner(symbol, name, market, currency)")
    .eq("portfolio_id", portfolioId)
    .order("trade_date", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getLatestTradeDateForPortfolio(
  portfolioId: string,
): Promise<string | null> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("trades")
    .select("trade_date")
    .eq("portfolio_id", portfolioId)
    .order("trade_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.trade_date ? String(data.trade_date) : null;
}

export async function getBenchmarkPriceSeries(
  instrumentId: string,
  fromDate: string,
  toDate: string,
) {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("prices")
    .select("date, close")
    .eq("instrument_id", instrumentId)
    .gte("date", fromDate)
    .lte("date", toDate)
    .order("date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getBenchmarkByCode(code: "SPY" | "KOSPI") {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("instruments")
    .select("*")
    .eq("benchmark_code", code)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return (data as Instrument | null) ?? null;
}

export async function getInstrumentBySymbol(symbol: string) {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("instruments")
    .select("*")
    .eq("symbol", symbol)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return (data as Instrument | null) ?? null;
}

export async function getInstrumentBySymbolMarket(symbol: string, market: Instrument["market"]) {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("instruments")
    .select("*")
    .eq("symbol", symbol)
    .eq("market", market)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return (data as Instrument | null) ?? null;
}

export async function updateInstrumentMetadata(
  instrumentId: string,
  patch: Partial<Pick<Instrument, "name" | "provider_symbol">>,
) {
  if (Object.keys(patch).length === 0) return;
  const supabase = getAdminSupabase();
  const { error } = await supabase
    .from("instruments")
    .update(patch)
    .eq("id", instrumentId);
  if (error) throw error;
}

export async function getFxSeries(fromDate: string, toDate: string) {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("fx_rates")
    .select("date, rate")
    .eq("pair", FX_PAIR_USDKRW)
    .gte("date", fromDate)
    .lte("date", toDate)
    .order("date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getParticipantLatestSnapshot(participantId: string) {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("daily_snapshots")
    .select("*")
    .eq("participant_id", participantId)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getParticipantNotes(
  participantId: string,
): Promise<ParticipantNotesBundle> {
  const supabase = getAdminSupabase();

  const { data: noteData, error: noteError } = await supabase
    .from("participant_notes")
    .select("participant_id, market_note")
    .eq("participant_id", participantId)
    .maybeSingle();
  if (noteError) {
    const msg = noteError.message ?? "";
    if (msg.includes("participant_notes")) {
      return { participant_id: participantId, market_note: "", lines: [] };
    }
    throw toErrorWithMessage(noteError, "Failed to read participant notes");
  }

  const { data: lineData, error: lineError } = await supabase
    .from("participant_note_lines")
    .select("id, participant_id, sort_order, symbol, memo_text, created_at, updated_at")
    .eq("participant_id", participantId)
    .order("sort_order", { ascending: true });
  if (lineError) {
    const msg = lineError.message ?? "";
    if (msg.includes("participant_note_lines")) {
      return {
        participant_id: participantId,
        market_note: (noteData?.market_note as string | undefined) ?? "",
        lines: [],
      };
    }
    throw toErrorWithMessage(lineError, "Failed to read participant note lines");
  }

  return {
    participant_id: participantId,
    market_note: (noteData?.market_note as string | undefined) ?? "",
    lines: (lineData ?? []) as ParticipantNoteLine[],
  };
}

export async function upsertParticipantNotes(
  participantId: string,
  marketNote: string,
  lines: Array<{ symbol: string | null; memo_text: string }>,
): Promise<void> {
  const supabase = getAdminSupabase();

  const { error: noteError } = await supabase.from("participant_notes").upsert(
    {
      participant_id: participantId,
      market_note: marketNote,
    },
    { onConflict: "participant_id", ignoreDuplicates: false },
  );
  if (noteError) throw toErrorWithMessage(noteError, "Failed to save participant notes");

  const { error: deleteError } = await supabase
    .from("participant_note_lines")
    .delete()
    .eq("participant_id", participantId);
  if (deleteError) {
    throw toErrorWithMessage(deleteError, "Failed to replace participant note lines");
  }

  const cleanRows = lines
    .map((x, idx) => ({
      participant_id: participantId,
      sort_order: idx + 1,
      symbol: x.symbol?.trim() ? x.symbol.trim() : null,
      memo_text: x.memo_text.trim(),
    }))
    .filter((x) => x.symbol !== null || x.memo_text.length > 0);

  if (cleanRows.length === 0) {
    return;
  }

  const { error: insertError } = await supabase
    .from("participant_note_lines")
    .insert(cleanRows);
  if (insertError) {
    throw toErrorWithMessage(insertError, "Failed to insert participant note lines");
  }
}

export async function getStudyTrackerIdeas(): Promise<StudyTrackerIdeaRow[]> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("study_tracker_ideas")
    .select("*")
    .order("presented_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false });
  if (error) {
    throw toErrorWithMessage(error, "Failed to read study tracker ideas");
  }
  return (data ?? []) as StudyTrackerIdeaRow[];
}

export async function getStudyTrackerIdeaById(ideaId: number): Promise<StudyTrackerIdeaRow | null> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("study_tracker_ideas")
    .select("*")
    .eq("id", ideaId)
    .maybeSingle();
  if (error) {
    throw toErrorWithMessage(error, "Failed to read study tracker idea");
  }
  return (data as StudyTrackerIdeaRow | null) ?? null;
}

function normalizeStudyTrackerIdeaInput(input: StudyTrackerIdeaInput) {
  const isIncluded = Boolean(input.is_included);
  return {
    presented_at: input.presented_at ?? null,
    presenter: input.presenter.trim(),
    company_name: input.company_name.trim(),
    ticker: input.ticker.trim(),
    sector: input.sector?.trim() || null,
    pitch_price: input.pitch_price ?? null,
    target_price: input.target_price ?? null,
    current_target_price: input.current_target_price ?? null,
    target_status: input.target_status ?? null,
    target_updated_at: input.target_updated_at ?? null,
    target_note: input.target_note?.trim() || null,
    pitch_upside_pct: input.pitch_upside_pct ?? null,
    currency: input.currency ?? null,
    current_price: input.current_price ?? null,
    current_upside_pct: input.current_upside_pct ?? null,
    current_return_pct: input.current_return_pct ?? null,
    thesis: input.thesis?.trim() || null,
    trigger: input.trigger?.trim() || null,
    risk: input.risk?.trim() || null,
    style: input.style?.trim() || null,
    status: input.status?.trim() || null,
    entry_date: input.entry_date ?? null,
    exit_date: input.exit_date ?? null,
    close_return_pct: input.close_return_pct ?? null,
    note: input.note?.trim() || null,
    tracking_return_pct: input.tracking_return_pct ?? null,
    is_included: isIncluded,
    included_at: isIncluded ? input.included_at ?? null : null,
    included_price: isIncluded ? input.included_price ?? null : null,
    weight: isIncluded ? input.weight ?? null : null,
    position_status: isIncluded ? input.position_status ?? null : null,
    exited_at: isIncluded ? input.exited_at ?? null : null,
    exited_price: isIncluded ? input.exited_price ?? null : null,
    source_session_id: input.source_session_id ?? null,
    source_coverage_id: input.source_coverage_id ?? null,
    call_direction: input.call_direction ?? "neutral",
    conviction_score: input.conviction_score ?? null,
    invalidation_rule: input.invalidation_rule?.trim() || null,
    time_horizon: input.time_horizon?.trim() || null,
  };
}

export async function insertStudyTrackerIdea(
  input: StudyTrackerIdeaInput,
): Promise<StudyTrackerIdeaRow> {
  const supabase = getAdminSupabase();
  const row = normalizeStudyTrackerIdeaInput(input);
  const { data, error } = await supabase
    .from("study_tracker_ideas")
    .insert(row)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    throw toErrorWithMessage(error, "Failed to insert study tracker idea");
  }
  return data as StudyTrackerIdeaRow;
}

export async function updateStudyTrackerIdea(
  ideaId: number,
  input: StudyTrackerIdeaInput,
): Promise<StudyTrackerIdeaRow> {
  const supabase = getAdminSupabase();
  const row = normalizeStudyTrackerIdeaInput(input);
  const { data, error } = await supabase
    .from("study_tracker_ideas")
    .update(row)
    .eq("id", ideaId)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    throw toErrorWithMessage(error, "Failed to update study tracker idea");
  }
  return data as StudyTrackerIdeaRow;
}

export async function deleteStudyTrackerIdea(ideaId: number): Promise<void> {
  const supabase = getAdminSupabase();
  const { error } = await supabase
    .from("study_tracker_ideas")
    .delete()
    .eq("id", ideaId);
  if (error) {
    throw toErrorWithMessage(error, "Failed to delete study tracker idea");
  }
}

export async function getParticipantsList(): Promise<Array<{ id: string; name: string }>> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("participants")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) {
    throw toErrorWithMessage(error, "Failed to read participants");
  }
  return (data ?? []) as Array<{ id: string; name: string }>;
}

function normalizeStudySessionInput(input: StudySessionInput) {
  return {
    presented_at: input.presented_at,
    presenter: input.presenter.trim(),
    industry_name: input.industry_name.trim(),
    title: input.title.trim(),
    thesis: input.thesis?.trim() || null,
    anti_thesis: input.anti_thesis?.trim() || null,
    note: input.note?.trim() || null,
  };
}

function normalizeStudySessionCompanyInput(input: StudySessionCompanyInput) {
  return {
    session_id: input.session_id,
    company_name: input.company_name.trim(),
    ticker: input.ticker.trim(),
    sector: input.sector?.trim() || null,
    target_price: input.target_price ?? null,
    reference_price: input.reference_price ?? null,
    reference_price_date: input.reference_price_date ?? null,
    current_price: input.current_price ?? null,
    currency: input.currency ?? null,
    session_stance: input.session_stance ?? "neutral",
    summary_line: input.summary_line?.trim() || null,
    mention_reason: input.mention_reason?.trim() || null,
    checkpoint_note: input.checkpoint_note?.trim() || null,
    risk_note: input.risk_note?.trim() || null,
    follow_up_status: input.follow_up_status ?? "watching",
    next_event_date: input.next_event_date ?? null,
    note: input.note?.trim() || null,
  };
}

export async function getStudySessions(): Promise<StudySessionRow[]> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("study_sessions")
    .select("*")
    .order("presented_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false });
  if (error) {
    throw toErrorWithMessage(error, "Failed to read study sessions");
  }
  return (data ?? []) as StudySessionRow[];
}

export async function insertStudySession(input: StudySessionInput): Promise<StudySessionRow> {
  const supabase = getAdminSupabase();
  const row = normalizeStudySessionInput(input);
  const { data, error } = await supabase
    .from("study_sessions")
    .insert(row)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    throw toErrorWithMessage(error, "Failed to insert study session");
  }
  return data as StudySessionRow;
}

export async function updateStudySession(
  sessionId: number,
  input: StudySessionInput,
): Promise<StudySessionRow> {
  const supabase = getAdminSupabase();
  const row = normalizeStudySessionInput(input);
  const { data, error } = await supabase
    .from("study_sessions")
    .update(row)
    .eq("id", sessionId)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    throw toErrorWithMessage(error, "Failed to update study session");
  }
  return data as StudySessionRow;
}

export async function getStudySessionCompanies(): Promise<StudySessionCompanyRow[]> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("study_session_companies")
    .select("*")
    .order("session_id", { ascending: false })
    .order("id", { ascending: false });
  if (error) {
    throw toErrorWithMessage(error, "Failed to read study session companies");
  }
  return (data ?? []) as StudySessionCompanyRow[];
}

export async function insertStudySessionCompany(
  input: StudySessionCompanyInput,
): Promise<StudySessionCompanyRow> {
  const supabase = getAdminSupabase();
  const row = normalizeStudySessionCompanyInput(input);
  const { data, error } = await supabase
    .from("study_session_companies")
    .insert(row)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    throw toErrorWithMessage(error, "Failed to insert study session company");
  }
  return data as StudySessionCompanyRow;
}

export async function updateStudySessionCompany(
  companyId: number,
  input: StudySessionCompanyInput,
): Promise<StudySessionCompanyRow> {
  const supabase = getAdminSupabase();
  const row = normalizeStudySessionCompanyInput(input);
  const { data, error } = await supabase
    .from("study_session_companies")
    .update(row)
    .eq("id", companyId)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    throw toErrorWithMessage(error, "Failed to update study session company");
  }
  return data as StudySessionCompanyRow;
}

export async function deleteStudySessionCompany(companyId: number): Promise<void> {
  const supabase = getAdminSupabase();
  const { error } = await supabase
    .from("study_session_companies")
    .delete()
    .eq("id", companyId);
  if (error) {
    throw toErrorWithMessage(error, "Failed to delete study session company");
  }
}

export async function getStudyCallFeedbackRows(): Promise<StudyCallFeedbackRow[]> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("study_call_feedback")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    throw toErrorWithMessage(error, "Failed to read study call feedback");
  }
  return (data ?? []) as StudyCallFeedbackRow[];
}

export async function upsertStudyCallFeedback(
  ideaId: number,
  input: StudyCallFeedbackInput,
): Promise<StudyCallFeedbackRow> {
  const supabase = getAdminSupabase();
  const row = {
    idea_id: ideaId,
    participant_id: input.participant_id,
    stance: input.stance,
    note: input.note?.trim() || null,
  };
  const { data, error } = await supabase
    .from("study_call_feedback")
    .upsert(row, { onConflict: "idea_id,participant_id", ignoreDuplicates: false })
    .select("*")
    .maybeSingle();
  if (error || !data) {
    throw toErrorWithMessage(error, "Failed to save study call feedback");
  }
  return data as StudyCallFeedbackRow;
}

export async function getStudyCallUpdateRows(): Promise<StudyCallUpdateRow[]> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("study_call_updates")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    throw toErrorWithMessage(error, "Failed to read study call updates");
  }
  return (data ?? []) as StudyCallUpdateRow[];
}

export async function insertStudyCallUpdate(
  ideaId: number,
  input: StudyCallUpdateInput,
): Promise<StudyCallUpdateRow> {
  const supabase = getAdminSupabase();
  const row = {
    idea_id: ideaId,
    update_type: input.update_type ?? "update",
    title: input.title?.trim() || null,
    body: input.body.trim(),
    created_by: input.created_by?.trim() || null,
  };
  const { data, error } = await supabase
    .from("study_call_updates")
    .insert(row)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    throw toErrorWithMessage(error, "Failed to insert study call update");
  }
  return data as StudyCallUpdateRow;
}

export async function getStudyLinkedTrades(): Promise<StudyTrackerLinkedTradeRow[]> {
  const supabase = getAdminSupabase();
  const portfolioPairs = await getParticipantsWithPortfolios();
  const portfolioMap = new Map(
    portfolioPairs.map((row) => [
      row.portfolio.id,
      { participant_id: row.participant.id, participant_name: row.participant.name },
    ]),
  );

  const { data, error } = await supabase
    .from("trades")
    .select("id, source_idea_id, portfolio_id, trade_date, side, quantity, price, note, instruments(symbol)")
    .not("source_idea_id", "is", null)
    .order("trade_date", { ascending: false })
    .order("id", { ascending: false });
  if (error) {
    throw toErrorWithMessage(error, "Failed to read linked trades");
  }

  return (data ?? [])
    .map((row: any) => {
      const participant = portfolioMap.get(String(row.portfolio_id));
      if (!participant || row.source_idea_id === null || row.source_idea_id === undefined) return null;
      const instrument = Array.isArray(row.instruments) ? row.instruments[0] : row.instruments;
      return {
        id: Number(row.id),
        source_idea_id: Number(row.source_idea_id),
        portfolio_id: String(row.portfolio_id),
        trade_date: String(row.trade_date),
        side: row.side as "BUY" | "SELL" | "CLOSE",
        quantity: row.quantity,
        price: row.price,
        note: row.note ? String(row.note) : null,
        participant_id: participant.participant_id,
        participant_name: participant.participant_name,
        symbol: instrument?.symbol ? String(instrument.symbol) : null,
      };
    })
    .filter((row): row is StudyTrackerLinkedTradeRow => row !== null);
}
