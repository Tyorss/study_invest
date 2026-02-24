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

type TradeSide = "BUY" | "SELL" | "CLOSE";

type PatchPayload = {
  trade_date?: string;
  side?: TradeSide;
  quantity?: number;
  price?: number;
  note?: string | null;
  auto_rebuild?: boolean;
};

function parseTradeId(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function minDate(a: string, b: string) {
  return a <= b ? a : b;
}

async function ensureFxForDate(date: string): Promise<number | null> {
  let fx = await getFxOnOrBefore(FX_PAIR_USDKRW, date);
  if (fx !== null) return fx;
  await updateFxForDate(date);
  fx = await getFxOnOrBefore(FX_PAIR_USDKRW, date);
  return fx;
}

async function loadTradeOrNull(tradeId: number) {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("trades")
    .select("id, portfolio_id, instrument_id, trade_date, side, quantity, price, note, instruments!inner(currency)")
    .eq("id", tradeId)
    .maybeSingle();
  if (error) throw error;
  return data as
    | (Record<string, unknown> & {
        id: number;
        portfolio_id: string;
        instrument_id: string;
        trade_date: string;
        side: TradeSide;
        quantity: string | number;
        price: string | number;
        note: string | null;
        instruments: { currency?: string } | Array<{ currency?: string }>;
      })
    | null;
}

function pickCurrency(input: { currency?: string } | Array<{ currency?: string }>): string | null {
  if (Array.isArray(input)) return input[0]?.currency ?? null;
  return input?.currency ?? null;
}

async function runOptionalRebuild(startDate: string, autoRebuild: boolean) {
  if (!autoRebuild) {
    return null;
  }
  const latestSnapshotDate = await getLatestSnapshotDate();
  const endDate =
    latestSnapshotDate && latestSnapshotDate >= startDate ? latestSnapshotDate : startDate;

  const pricesRuns = await backfillPrices(startDate, endDate);
  const fxRuns = await backfillFx(startDate, endDate);
  const snapshotsRuns = await backfillSnapshots(startDate, endDate);

  return {
    start_date: startDate,
    end_date: endDate,
    prices_days: pricesRuns.length,
    fx_days: fxRuns.length,
    snapshots_days: snapshotsRuns.length,
  };
}

export async function PATCH(
  req: Request,
  { params }: { params: { tradeId: string } },
) {
  try {
    const tradeId = parseTradeId(params.tradeId);
    if (!tradeId) {
      return NextResponse.json({ error: "invalid tradeId" }, { status: 400 });
    }

    let body: PatchPayload;
    try {
      body = (await req.json()) as PatchPayload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const existing = await loadTradeOrNull(tradeId);
    if (!existing) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }

    const side = (body.side ?? existing.side) as TradeSide;
    if (!["BUY", "SELL", "CLOSE"].includes(side)) {
      return NextResponse.json({ error: "invalid side" }, { status: 400 });
    }

    const tradeDate = body.trade_date ?? existing.trade_date;
    if (!isIsoDate(tradeDate)) {
      return NextResponse.json({ error: "trade_date must be YYYY-MM-DD" }, { status: 400 });
    }

    const price = Number(body.price ?? existing.price);
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: "price must be > 0" }, { status: 400 });
    }

    let quantity = 0;
    if (side !== "CLOSE") {
      const rawQty = body.quantity ?? Number(existing.quantity);
      quantity = Number(rawQty);
      if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
        return NextResponse.json(
          { error: "quantity must be a positive integer" },
          { status: 400 },
        );
      }
    }

    const currency = pickCurrency(existing.instruments);
    if (currency === "USD") {
      const fx = await ensureFxForDate(tradeDate);
      if (!fx) {
        return NextResponse.json({ error: `Missing USDKRW FX for ${tradeDate}` }, { status: 400 });
      }
    }

    const note = body.note === undefined ? existing.note : body.note;
    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from("trades")
      .update({
        trade_date: tradeDate,
        side,
        quantity: side === "CLOSE" ? 0 : quantity,
        price,
        note: note ?? null,
      })
      .eq("id", tradeId)
      .select("*")
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to update trade" },
        { status: 400 },
      );
    }

    const rebuild = await runOptionalRebuild(
      minDate(existing.trade_date, tradeDate),
      body.auto_rebuild === true,
    );

    return NextResponse.json({ ok: true, trade: data, rebuild });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { tradeId: string } },
) {
  try {
    const tradeId = parseTradeId(params.tradeId);
    if (!tradeId) {
      return NextResponse.json({ error: "invalid tradeId" }, { status: 400 });
    }

    const existing = await loadTradeOrNull(tradeId);
    if (!existing) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }

    const supabase = getAdminSupabase();
    const { error } = await supabase.from("trades").delete().eq("id", tradeId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const url = new URL(req.url);
    const autoRebuild = url.searchParams.get("auto_rebuild") === "true";
    const rebuild = await runOptionalRebuild(existing.trade_date, autoRebuild);

    return NextResponse.json({ ok: true, deleted_id: tradeId, rebuild });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected server error" },
      { status: 500 },
    );
  }
}
