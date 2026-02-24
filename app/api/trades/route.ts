import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { FX_PAIR_USDKRW } from "@/lib/constants";
import { getFxOnOrBefore, getLatestSnapshotDate } from "@/lib/db";
import {
  backfillFx,
  backfillPrices,
  backfillSnapshots,
  updateFxForDate,
} from "@/lib/jobs/runner";
import { resolveMarketDataProviders } from "@/lib/providers";
import type { ProviderHandle } from "@/lib/providers";
import { createValueCache, rebuildPortfolioState } from "@/lib/engine/snapshot";
import type { Instrument, Market, Participant, Portfolio } from "@/types/db";

type Payload = {
  portfolio_id: string;
  instrument_id?: string;
  symbol?: string;
  market?: Market;
  instrument_name?: string;
  trade_date: string;
  side: "BUY" | "SELL" | "CLOSE";
  quantity?: number;
  price: number;
  fee_rate?: number | null;
  slippage_bps?: number | null;
  note?: string | null;
  auto_rebuild?: boolean;
};

function validate(body: Partial<Payload>): string | null {
  if (!body.portfolio_id) return "portfolio_id is required";
  if (!body.instrument_id && !body.symbol) return "instrument_id or symbol is required";
  if (!body.instrument_id && !body.market) return "market is required when symbol is used";
  if (body.market && !["KR", "US", "INDEX"].includes(body.market)) return "invalid market";
  if (!body.trade_date) return "trade_date is required";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.trade_date)) return "trade_date must be YYYY-MM-DD";
  if (!body.side || !["BUY", "SELL", "CLOSE"].includes(body.side)) return "invalid side";
  if (body.side !== "CLOSE") {
    const qty = Number(body.quantity);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
      return "quantity must be a positive integer";
    }
  }
  if (!(body.price && Number.isFinite(Number(body.price)) && Number(body.price) > 0)) {
    return "price must be > 0";
  }
  return null;
}

function normalizeSymbol(symbol: string, market: Market): string {
  const raw = symbol.trim();
  if (!raw) return raw;
  if (market === "KR") return raw;
  return raw.toUpperCase();
}

function defaultProviderSymbol(symbol: string, market: Market): string {
  if (market === "KR") return `${symbol}:KRX`;
  if (market === "INDEX" && symbol === "KS11") return "KOSPI";
  return symbol;
}

function defaultCurrency(market: Market): "KRW" | "USD" {
  return market === "US" ? "USD" : "KRW";
}

function marketDefaults() {
  return { feeRate: 0, slippageBps: 0 };
}

function errorMessage(err: unknown, fallback: string) {
  if (err instanceof Error) {
    return err.message;
  }
  if (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as { message?: unknown }).message === "string"
  ) {
    return ((err as { message: string }).message || fallback).trim();
  }
  return fallback;
}

async function validateSymbolWithProviders(input: {
  symbol: string;
  market: Market;
  providerSymbol: string;
  tradeDate: string;
}): Promise<{ ok: boolean; reason: string | null }> {
  const providerResolution = resolveMarketDataProviders();
  const handles: ProviderHandle[] = providerResolution.handles;
  let availableProviders = 0;
  const reasons: string[] = [];

  for (const handle of handles) {
    if (!handle.provider) {
      reasons.push(
        `[${handle.requestedProvider}] ${
          handle.initError ?? "Provider is unavailable"
        }`,
      );
      continue;
    }
    availableProviders += 1;

    try {
      const close = await handle.provider.getDailyClose(
        input.symbol,
        input.market,
        input.tradeDate,
        input.providerSymbol,
      );
      if (close !== null && Number.isFinite(close)) {
        return { ok: true, reason: null };
      }
      reasons.push(`[${handle.requestedProvider}] No close price returned`);
    } catch (err) {
      reasons.push(
        `[${handle.requestedProvider}] ${errorMessage(err, "Unknown provider error")}`,
      );
    }
  }

  if (availableProviders === 0) {
    return {
      ok: false,
      reason:
        "No market data provider is available to validate symbol lookup. Check MARKET_DATA_PROVIDERS/TWELVE_DATA_API_KEY.",
    };
  }

  return {
    ok: false,
    reason: reasons.length > 0 ? reasons.join(" | ") : "All providers returned no data",
  };
}

async function loadPortfolioContext(
  portfolioId: string,
): Promise<{ portfolio: Portfolio; participant: Participant }> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("portfolios")
    .select("id, participant_id, base_currency, is_active, participants!inner(id, name, color_tag, starting_cash_krw)")
    .eq("id", portfolioId)
    .maybeSingle();
  if (error || !data) {
    throw new Error("Portfolio not found");
  }

  const row = data as any;
  const participantRaw = Array.isArray(row.participants) ? row.participants[0] : row.participants;
  if (!participantRaw) {
    throw new Error("Participant not found for portfolio");
  }

  const portfolio: Portfolio = {
    id: String(row.id),
    participant_id: String(row.participant_id),
    base_currency: row.base_currency,
    is_active: Boolean(row.is_active),
  };
  const participant: Participant = {
    id: String(participantRaw.id),
    name: String(participantRaw.name),
    color_tag: String(participantRaw.color_tag),
    starting_cash_krw: String(participantRaw.starting_cash_krw),
  };
  return { portfolio, participant };
}

async function loadInstrumentById(instrumentId: string): Promise<Instrument> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("instruments")
    .select("*")
    .eq("id", instrumentId)
    .maybeSingle();
  if (error || !data) {
    throw new Error("Instrument not found");
  }
  return data as Instrument;
}

async function ensureFxForDate(date: string): Promise<number | null> {
  let fx = await getFxOnOrBefore(FX_PAIR_USDKRW, date);
  if (fx !== null) return fx;
  await updateFxForDate(date);
  fx = await getFxOnOrBefore(FX_PAIR_USDKRW, date);
  return fx;
}

async function validateByPortfolioRules(input: {
  portfolio: Portfolio;
  participant: Participant;
  instrument: Instrument;
  body: Partial<Payload>;
}): Promise<{ qty: number }> {
  const { portfolio, participant, instrument, body } = input;
  const state = await rebuildPortfolioState(
    portfolio,
    participant,
    body.trade_date as string,
    createValueCache(),
  );
  const pos = state.positions.find((p) => p.instrument.id === instrument.id);
  const prevQty = pos?.quantity ?? 0;
  const side = body.side as "BUY" | "SELL" | "CLOSE";

  const qty = side === "CLOSE" ? prevQty : Number(body.quantity);
  if (!(qty > 0)) {
    throw new Error(side === "CLOSE" ? "No position to CLOSE" : "quantity must be > 0");
  }
  if ((side === "SELL" || side === "CLOSE") && qty > prevQty + 1e-9) {
    throw new Error("SELL/CLOSE cannot exceed current position");
  }

  if (side === "BUY") {
    const defaults = marketDefaults();
    const feeRate =
      body.fee_rate === null || body.fee_rate === undefined
        ? defaults.feeRate
        : Number(body.fee_rate);
    const slippageBps =
      body.slippage_bps === null || body.slippage_bps === undefined
        ? defaults.slippageBps
        : Number(body.slippage_bps);

    const px = Number(body.price);
    const effectivePrice = px * (1 + slippageBps / 10_000);
    const notionalLocal = qty * effectivePrice;
    const feeLocal = notionalLocal * feeRate;
    const isUsd = instrument.currency === "USD";
    const fxRate = isUsd ? await ensureFxForDate(body.trade_date as string) : 1;
    if (isUsd && !fxRate) {
      throw new Error(`Missing USDKRW FX for ${body.trade_date}`);
    }
    const grossKrw = (notionalLocal + feeLocal) * (fxRate ?? 1);
    if (state.cash_krw - grossKrw < -1e-6) {
      throw new Error("BUY cannot make cash negative");
    }
  }

  return { qty };
}

async function resolveInstrumentId(
  body: Partial<Payload>,
): Promise<{ instrumentId: string; created: boolean; warnings: string[] }> {
  const supabase = getAdminSupabase();
  const warnings: string[] = [];

  if (body.instrument_id) {
    return { instrumentId: body.instrument_id, created: false, warnings };
  }

  const market = body.market as Market;
  const symbol = normalizeSymbol(body.symbol as string, market);
  const tradeDate = body.trade_date as string;

  const { data: existing, error: existingError } = await supabase
    .from("instruments")
    .select("id")
    .eq("symbol", symbol)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.id) {
    return { instrumentId: String(existing.id), created: false, warnings };
  }

  const providerSymbol = defaultProviderSymbol(symbol, market);
  const lookup = await validateSymbolWithProviders({
    symbol,
    market,
    providerSymbol,
    tradeDate,
  });
  if (!lookup.ok) {
    throw new Error(
      `Symbol '${symbol}' is not verifiable for market '${market}' on ${tradeDate}. ${
        lookup.reason ?? "Provider lookup failed."
      }`,
    );
  }

  const insertRow = {
    symbol,
    name: body.instrument_name?.trim() || symbol,
    market,
    currency: defaultCurrency(market),
    asset_type: market === "INDEX" ? "INDEX" : "EQUITY",
    provider_symbol: providerSymbol,
    is_active: true,
    is_benchmark: false,
    benchmark_code: null,
  };

  const { data: inserted, error: insertError } = await supabase
    .from("instruments")
    .insert(insertRow)
    .select("id")
    .maybeSingle();
  if (insertError) {
    const { data: after, error: afterError } = await supabase
      .from("instruments")
      .select("id")
      .eq("symbol", symbol)
      .maybeSingle();
    if (afterError || !after?.id) {
      throw insertError;
    }
    return { instrumentId: String(after.id), created: false, warnings };
  }

  return { instrumentId: String(inserted?.id), created: true, warnings };
}

export async function POST(req: Request) {
  try {
    let body: Partial<Payload>;
    try {
      body = (await req.json()) as Partial<Payload>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }
    const error = validate(body);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const { instrumentId, created, warnings } = await resolveInstrumentId(body);
    const { portfolio, participant } = await loadPortfolioContext(body.portfolio_id as string);
    const instrument = await loadInstrumentById(instrumentId);

    if (instrument.currency === "USD") {
      const fx = await ensureFxForDate(body.trade_date as string);
      if (!fx) {
        return NextResponse.json(
          { error: `Missing USDKRW FX for ${body.trade_date}` },
          { status: 400 },
        );
      }
    }

    let qty = Number(body.quantity);
    try {
      const validated = await validateByPortfolioRules({
        portfolio,
        participant,
        instrument,
        body,
      });
      qty = validated.qty;
    } catch (err) {
      return NextResponse.json(
        { error: errorMessage(err, "Trade validation failed") },
        { status: 400 },
      );
    }

    const supabase = getAdminSupabase();
    const row = {
      portfolio_id: body.portfolio_id,
      instrument_id: instrumentId,
      trade_date: body.trade_date,
      side: body.side,
      quantity: body.side === "CLOSE" ? 0 : qty,
      price: body.price,
      fee_rate: body.fee_rate ?? null,
      slippage_bps: body.slippage_bps ?? null,
      note: body.note ?? null,
    };
    const { data, error: insertError } = await supabase
      .from("trades")
      .insert(row)
      .select("*")
      .maybeSingle();
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    const autoRebuild = body.auto_rebuild === true;
    let rebuild: {
      start_date: string;
      end_date: string;
      prices_days: number;
      fx_days: number;
      snapshots_days: number;
    } | null = null;

    if (autoRebuild) {
      const tradeDate = body.trade_date as string;
      const latestSnapshotDate = await getLatestSnapshotDate();
      const endDate =
        latestSnapshotDate && latestSnapshotDate >= tradeDate ? latestSnapshotDate : tradeDate;

      const pricesRuns = await backfillPrices(tradeDate, endDate);
      const fxRuns = await backfillFx(tradeDate, endDate);
      const snapshotRuns = await backfillSnapshots(tradeDate, endDate);

      rebuild = {
        start_date: tradeDate,
        end_date: endDate,
        prices_days: pricesRuns.length,
        fx_days: fxRuns.length,
        snapshots_days: snapshotRuns.length,
      };
    }

    return NextResponse.json({
      ok: true,
      trade: data,
      instrument_created: created,
      warnings,
      rebuild,
    });
  } catch (err) {
    return NextResponse.json(
      { error: errorMessage(err, "Unexpected server error") },
      { status: 500 },
    );
  }
}
