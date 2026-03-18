import { resolveMarketDataProviders } from "@/lib/providers";
import { todayInSeoul } from "@/lib/time";
import type { Currency, Market } from "@/types/db";
import type { StudyTrackerIdeaInput } from "@/types/study-tracker";

function ratioFrom(current: number | null | undefined, base: number | null | undefined) {
  if (current === null || current === undefined) return null;
  if (base === null || base === undefined || base <= 0) return null;
  return current / base - 1;
}

function inferQuoteTarget(
  ticker: string,
  currency: Currency | null | undefined,
): {
  symbol: string;
  market: Market;
  providerSymbol?: string;
  currency: Currency | null;
} | null {
  const raw = ticker.trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();

  if (upper === "KS11" || upper === "KOSPI") {
    return {
      symbol: "KS11",
      market: "INDEX",
      providerSymbol: "KOSPI",
      currency: "KRW",
    };
  }

  if (upper.startsWith("KRX:")) {
    const symbol = upper.slice(4).trim();
    if (!symbol) return null;
    return {
      symbol,
      market: "KR",
      providerSymbol: `${symbol}:KRX`,
      currency: "KRW",
    };
  }

  if (upper.startsWith("KOSDAQ:")) {
    const symbol = upper.slice(7).trim();
    if (!symbol) return null;
    return {
      symbol,
      market: "KR",
      providerSymbol: `${symbol}:KOSDAQ`,
      currency: "KRW",
    };
  }

  if (/^\d{6}$/.test(raw)) {
    return {
      symbol: raw,
      market: "KR",
      providerSymbol: `${raw}:KRX`,
      currency: "KRW",
    };
  }

  return {
    symbol: upper,
    market: "US",
    providerSymbol: upper,
    currency: currency ?? "USD",
  };
}

async function fetchCurrentPrice(input: {
  symbol: string;
  market: Market;
  providerSymbol?: string;
}): Promise<{ price: number | null; warning: string | null }> {
  let resolved;
  try {
    resolved = resolveMarketDataProviders();
  } catch (err) {
    return {
      price: null,
      warning: err instanceof Error ? err.message : "Failed to load market data providers",
    };
  }

  const targetDate = todayInSeoul();
  const reasons: string[] = [];
  let availableProviders = 0;

  for (const handle of resolved.handles) {
    if (!handle.provider) {
      if (handle.initError) reasons.push(handle.initError);
      continue;
    }
    availableProviders += 1;

    try {
      const close = await handle.provider.getDailyClose(
        input.symbol,
        input.market,
        targetDate,
        input.providerSymbol,
      );
      if (close !== null && Number.isFinite(close)) {
        return { price: close, warning: null };
      }
      reasons.push(`[${handle.requestedProvider}] No close price returned`);
    } catch (err) {
      reasons.push(
        `[${handle.requestedProvider}] ${err instanceof Error ? err.message : "Unknown quote error"}`,
      );
    }
  }

  if (availableProviders === 0) {
    return {
      price: null,
      warning:
        "Current price auto-update is unavailable because no market data provider is configured.",
    };
  }

  return {
    price: null,
    warning:
      reasons.length > 0
        ? `Current price auto-update failed. ${reasons.join(" | ")}`
        : "Current price auto-update failed.",
  };
}

export async function autoFillStudyTrackerIdea(input: StudyTrackerIdeaInput): Promise<{
  input: StudyTrackerIdeaInput;
  warning: string | null;
}> {
  const quoteTarget = inferQuoteTarget(input.ticker, input.currency ?? null);
  let currentPrice = input.current_price ?? null;
  let warning: string | null = null;
  let currency = input.currency ?? quoteTarget?.currency ?? null;

  if (quoteTarget) {
    const quote = await fetchCurrentPrice(quoteTarget);
    if (quote.price !== null) {
      currentPrice = quote.price;
    } else if (!currentPrice && quote.warning) {
      warning = quote.warning;
    }
  }

  const pitchUpside = ratioFrom(input.target_price ?? null, input.pitch_price ?? null);
  const currentUpside = ratioFrom(input.target_price ?? null, currentPrice);
  const currentReturn = ratioFrom(currentPrice, input.pitch_price ?? null);
  const trackingReturn = currentReturn;
  const isIncluded = Boolean(input.is_included);
  const includedAt = isIncluded
    ? input.included_at ?? input.entry_date ?? input.presented_at ?? null
    : null;
  const includedPrice = isIncluded
    ? input.included_price ?? currentPrice ?? input.pitch_price ?? null
    : null;
  const positionStatus = isIncluded
    ? input.position_status ?? (input.exited_at || input.exited_price ? "closed" : "active")
    : null;

  return {
    input: {
      ...input,
      currency,
      current_price: currentPrice,
      pitch_upside_pct: pitchUpside,
      current_upside_pct: currentUpside,
      current_return_pct: currentReturn,
      tracking_return_pct: trackingReturn,
      is_included: isIncluded,
      included_at: includedAt,
      included_price: includedPrice,
      weight: isIncluded ? input.weight ?? null : null,
      position_status: positionStatus,
      exited_at: isIncluded ? input.exited_at ?? null : null,
      exited_price: isIncluded ? input.exited_price ?? null : null,
    },
    warning,
  };
}
