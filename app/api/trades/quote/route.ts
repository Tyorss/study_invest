import { NextResponse } from "next/server";
import { getInstrumentBySymbolMarket, getPricePointOnOrBefore } from "@/lib/db";
import {
  fetchBestClosePointFromProviderChain,
  isExactPricePoint,
  pickPreferredClosePoint,
} from "@/lib/market-data";
import { lookupInstrumentNameWithPython } from "@/lib/providers/python-market-data-provider";
import { resolveMarketDataProviders } from "@/lib/providers";
import type { Market } from "@/types/db";

export const dynamic = "force-dynamic";

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

async function resolveInstrumentName(params: {
  symbol: string;
  market: Market;
  providerSymbol: string;
  fallbackName: string | null;
}) {
  if (params.market === "KR" && /^\d{6}$/.test(params.symbol)) {
    try {
      const name = await lookupInstrumentNameWithPython(
        "fdr",
        params.symbol,
        params.market,
        params.providerSymbol,
      );
      if (name) return name;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown instrument name lookup error";
      console.error(
        `[quote] failed to resolve instrument name for ${params.symbol}: ${message}`,
      );
    }
  }

  return params.fallbackName;
}

function noStoreJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  return NextResponse.json(body, { ...init, headers });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const symbolInput = (searchParams.get("symbol") ?? "").trim();
    const marketInput = (searchParams.get("market") ?? "").trim().toUpperCase();
    const date = (searchParams.get("date") ?? "").trim();

    if (!symbolInput) {
      return noStoreJson({ error: "symbol is required" }, { status: 400 });
    }
    if (!["KR", "US", "INDEX"].includes(marketInput)) {
      return noStoreJson({ error: "market must be KR, US, or INDEX" }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return noStoreJson({ error: "date must be YYYY-MM-DD" }, { status: 400 });
    }

    const market = marketInput as Market;
    const symbol = normalizeSymbol(symbolInput, market);
    const instrument = await getInstrumentBySymbolMarket(symbol, market);
    const storedPoint = instrument ? await getPricePointOnOrBefore(instrument.id, date) : null;
    const providerSymbol = instrument?.provider_symbol ?? defaultProviderSymbol(symbol, market);
    const instrumentName = await resolveInstrumentName({
      symbol,
      market,
      providerSymbol,
      fallbackName: instrument?.name ?? null,
    });

    if (instrument && isExactPricePoint(storedPoint, date)) {
      return noStoreJson({
        ok: true,
        symbol,
        market,
        requested_date: date,
        effective_date: storedPoint!.date,
        price: storedPoint!.close,
        source: `stored:${storedPoint!.source ?? "provider"}`,
        provider_symbol: instrument.provider_symbol,
        instrument_id: instrument.id,
        instrument_name: instrumentName,
      });
    }

    const providerResolution = resolveMarketDataProviders();
    const live = await fetchBestClosePointFromProviderChain(providerResolution.handles, {
      symbol,
      market,
      date,
      providerSymbol,
    });

    const preferredPoint = pickPreferredClosePoint(
      date,
      storedPoint,
      live.point
        ? {
            ...live.point,
            source: "provider",
          }
        : null,
    );

    if (preferredPoint && preferredPoint === storedPoint) {
      return noStoreJson({
        ok: true,
        symbol,
        market,
        requested_date: date,
        effective_date: storedPoint.date,
        price: storedPoint.close,
        source: `stored:${storedPoint.source ?? "provider"}`,
        provider_symbol: providerSymbol,
        instrument_id: instrument?.id ?? null,
        instrument_name: instrumentName,
      });
    }

    if (preferredPoint && live.point && Number.isFinite(preferredPoint.close)) {
      return noStoreJson({
        ok: true,
        symbol,
        market,
        requested_date: date,
        effective_date: preferredPoint.date,
        price: preferredPoint.close,
        source: `provider:${live.usedProvider ?? "unknown"}`,
        provider_symbol: providerSymbol,
        instrument_id: instrument?.id ?? null,
        instrument_name: instrumentName,
      });
    }

    if (storedPoint) {
      return noStoreJson({
        ok: true,
        symbol,
        market,
        requested_date: date,
        effective_date: storedPoint.date,
        price: storedPoint.close,
        source: `stored:${storedPoint.source ?? "provider"}`,
        provider_symbol: providerSymbol,
        instrument_id: instrument?.id ?? null,
        instrument_name: instrumentName,
      });
    }

    return noStoreJson(
      {
        error:
          live.attempts.length > 0
            ? live.attempts
                .filter((attempt) => attempt.reason)
                .map((attempt) => `[${attempt.provider}] ${attempt.reason}`)
                .join(" | ")
            : `No price found for ${symbol} on or before ${date}`,
      },
      { status: 404 },
    );
  } catch (err) {
    return noStoreJson(
      {
        error: err instanceof Error ? err.message : "Unexpected server error",
      },
      { status: 500 },
    );
  }
}
