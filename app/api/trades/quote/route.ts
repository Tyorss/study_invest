import { NextResponse } from "next/server";
import { getInstrumentBySymbolMarket, getPricePointOnOrBefore } from "@/lib/db";
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

    if (instrument) {
      const point = await getPricePointOnOrBefore(instrument.id, date);
      if (point) {
        return noStoreJson({
          ok: true,
          symbol,
          market,
          requested_date: date,
          effective_date: point.date,
          price: point.close,
          source: `stored:${point.source ?? "provider"}`,
          provider_symbol: instrument.provider_symbol,
          instrument_id: instrument.id,
          instrument_name: instrument.name,
        });
      }
    }

    const providerSymbol = instrument?.provider_symbol ?? defaultProviderSymbol(symbol, market);
    const providerResolution = resolveMarketDataProviders();
    const reasons: string[] = [];

    for (const handle of providerResolution.handles) {
      if (!handle.provider) {
        reasons.push(
          `[${handle.requestedProvider}] ${handle.initError ?? "Provider unavailable"}`,
        );
        continue;
      }

      try {
        const point = handle.provider.getDailyClosePoint
          ? await handle.provider.getDailyClosePoint(symbol, market, date, providerSymbol)
          : null;
        if (point && Number.isFinite(point.close)) {
          return noStoreJson({
            ok: true,
            symbol,
            market,
            requested_date: date,
            effective_date: point.date,
            price: point.close,
            source: `provider:${handle.requestedProvider}`,
            provider_symbol: providerSymbol,
            instrument_id: instrument?.id ?? null,
            instrument_name: instrument?.name ?? null,
          });
        }

        const close = await handle.provider.getDailyClose(symbol, market, date, providerSymbol);
        if (close !== null && Number.isFinite(close)) {
          return noStoreJson({
            ok: true,
            symbol,
            market,
            requested_date: date,
            effective_date: null,
            price: close,
            source: `provider:${handle.requestedProvider}`,
            provider_symbol: providerSymbol,
            instrument_id: instrument?.id ?? null,
            instrument_name: instrument?.name ?? null,
          });
        }

        reasons.push(`[${handle.requestedProvider}] No close price returned`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown provider error";
        reasons.push(`[${handle.requestedProvider}] ${message}`);
      }
    }

    return noStoreJson(
      {
        error:
          reasons.length > 0
            ? reasons.join(" | ")
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
