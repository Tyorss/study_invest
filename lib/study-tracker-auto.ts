import { resolveMarketDataProviders } from "@/lib/providers";
import { todayInSeoul } from "@/lib/time";
import type { Currency, Market } from "@/types/db";
import type { DailyClosePoint } from "@/lib/providers/types";
import type { StudySessionCompanyInput, StudyTrackerIdeaInput } from "@/types/study-tracker";

function ratioFrom(current: number | null | undefined, base: number | null | undefined) {
  if (current === null || current === undefined) return null;
  if (base === null || base === undefined || base <= 0) return null;
  return current / base - 1;
}

function inferStudyCallDirection(
  targetPrice: number | null | undefined,
  basePrice: number | null | undefined,
) {
  const diff = ratioFrom(targetPrice ?? null, basePrice ?? null);
  if (diff === null) return "neutral" as const;
  if (Math.abs(diff) <= 0.1) return "neutral" as const;
  return diff > 0 ? ("long" as const) : ("short" as const);
}

export function resolveStudyQuoteTarget(
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
  date?: string;
}): Promise<{ price: number | null; warning: string | null }> {
  const point = await fetchClosePointOnOrBefore({
    symbol: input.symbol,
    market: input.market,
    providerSymbol: input.providerSymbol,
    date: input.date ?? todayInSeoul(),
  });
  return { price: point.point?.close ?? null, warning: point.warning };
}

async function fetchClosePointOnOrBefore(input: {
  symbol: string;
  market: Market;
  providerSymbol?: string;
  date: string;
}): Promise<{ point: DailyClosePoint | null; warning: string | null }> {
  let resolved;
  try {
    resolved = resolveMarketDataProviders();
  } catch (err) {
    return {
      point: null,
      warning: err instanceof Error ? err.message : "Failed to load market data providers",
    };
  }

  const reasons: string[] = [];
  let availableProviders = 0;

  for (const handle of resolved.handles) {
    if (!handle.provider) {
      if (handle.initError) reasons.push(handle.initError);
      continue;
    }
    availableProviders += 1;

    try {
      const point =
        typeof handle.provider.getDailyClosePoint === "function"
          ? await handle.provider.getDailyClosePoint(
              input.symbol,
              input.market,
              input.date,
              input.providerSymbol,
            )
          : null;
      if (point !== null && Number.isFinite(point.close)) {
        return { point, warning: null };
      }
      if (point === null) {
        const close = await handle.provider.getDailyClose(
          input.symbol,
          input.market,
          input.date,
          input.providerSymbol,
        );
        if (close !== null && Number.isFinite(close)) {
          return {
            point: {
              date: input.date,
              close,
            },
            warning: null,
          };
        }
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
      point: null,
      warning:
        "Current price auto-update is unavailable because no market data provider is configured.",
    };
  }

  return {
    point: null,
    warning:
      reasons.length > 0
        ? `Current price auto-update failed. ${reasons.join(" | ")}`
        : "Current price auto-update failed.",
  };
}

export async function fetchStudyQuotePointOnOrBefore(input: {
  ticker: string;
  currency?: Currency | null;
  date: string;
}) {
  const quoteTarget = resolveStudyQuoteTarget(input.ticker, input.currency ?? null);
  if (!quoteTarget) {
    return {
      point: null as DailyClosePoint | null,
      warning: null,
      quoteTarget: null,
    };
  }

  const result = await fetchClosePointOnOrBefore({
    symbol: quoteTarget.symbol,
    market: quoteTarget.market,
    providerSymbol: quoteTarget.providerSymbol,
    date: input.date,
  });

  return {
    ...result,
    quoteTarget,
  };
}

export async function autoFillStudyTrackerIdea(
  input: StudyTrackerIdeaInput,
  options?: { quoteDate?: string; skipQuoteFetch?: boolean },
): Promise<{
  input: StudyTrackerIdeaInput;
  warning: string | null;
}> {
  const quoteTarget = resolveStudyQuoteTarget(input.ticker, input.currency ?? null);
  let currentPrice = input.current_price ?? null;
  let warning: string | null = null;
  let currency = input.currency ?? quoteTarget?.currency ?? null;

  if (quoteTarget && !options?.skipQuoteFetch) {
    const quote = await fetchCurrentPrice({
      ...quoteTarget,
      date: options?.quoteDate,
    });
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
  const effectiveTarget = input.current_target_price ?? input.target_price ?? null;
  const callDirection = input.call_direction ?? inferStudyCallDirection(effectiveTarget, input.pitch_price);

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
      call_direction: callDirection,
      target_status: input.target_status ?? null,
      current_target_price: input.current_target_price ?? null,
      target_updated_at: input.target_updated_at ?? null,
      target_note: input.target_note ?? null,
    },
    warning,
  };
}

export async function autoFillStudySessionCompany(input: StudySessionCompanyInput, presentedAt: string) {
  const quoteTarget = resolveStudyQuoteTarget(input.ticker, input.currency ?? null);
  if (!quoteTarget) {
    return { input, warning: null };
  }

  const [referenceQuote, currentQuote] = await Promise.all([
    fetchClosePointOnOrBefore({
      symbol: quoteTarget.symbol,
      market: quoteTarget.market,
      providerSymbol: quoteTarget.providerSymbol,
      date: presentedAt,
    }),
    fetchClosePointOnOrBefore({
      symbol: quoteTarget.symbol,
      market: quoteTarget.market,
      providerSymbol: quoteTarget.providerSymbol,
      date: todayInSeoul(),
    }),
  ]);

  const warnings = [referenceQuote.warning, currentQuote.warning].filter(
    (value): value is string => Boolean(value?.trim()),
  );

  return {
    input: {
      ...input,
      currency: input.currency ?? quoteTarget.currency ?? null,
      reference_price: input.reference_price ?? referenceQuote.point?.close ?? null,
      reference_price_date: input.reference_price_date ?? referenceQuote.point?.date ?? null,
      current_price: input.current_price ?? currentQuote.point?.close ?? null,
    },
    warning: warnings.length > 0 ? warnings.join(" | ") : null,
  };
}
