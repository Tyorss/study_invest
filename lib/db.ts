import { DEFAULT_GAME_START_DATE, FX_PAIR_USDKRW } from "@/lib/constants";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type {
  AuditLogInsert,
  CorporateActionRow,
  DailySnapshot,
  FxRateRow,
  Instrument,
  JobRunInsert,
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
