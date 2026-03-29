import {
  BENCHMARK_KOSPI,
  BENCHMARK_SPY,
  FX_PAIR_USDKRW,
} from "@/lib/constants";
import { buildBenchmarkReturnByDate } from "@/lib/benchmarks";
import {
  getActiveInstruments,
  getBenchmarkByCode,
  getBenchmarkPriceSeries,
  getFxPointOnOrBefore,
  getInstrumentBySymbolMarket,
  getPriceSeries,
  getGameStartDate,
  getParticipantsWithPortfolios,
  getPricePointOnOrBefore,
  getStudySessionCompanies,
  getStudyTrackerIdeas,
  getTradedInstrumentsThroughDate,
  insertJobRun,
  upsertDailySnapshot,
  upsertFx,
  upsertPrice,
  updateStudySessionCompany,
  updateStudyTrackerIdea,
} from "@/lib/db";
import { buildDailySnapshot, createValueCache } from "@/lib/engine/snapshot";
import { resolveMarketDataProviders } from "@/lib/providers";
import type { ProviderHandle } from "@/lib/providers";
import {
  autoFillStudyTrackerIdea,
  fetchStudyQuotePointOnOrBefore,
  resolveStudyQuoteTarget,
} from "@/lib/study-tracker-auto";
import {
  fetchBestClosePointFromProviderChain,
  isExactPricePoint,
  pickPreferredClosePoint,
  type ProviderAttemptLog,
} from "@/lib/market-data";
import {
  mapStudySessionCompany,
  mapStudyTrackerIdea,
  toStudySessionCompanyInput,
  toStudyTrackerIdeaInput,
} from "@/lib/study-tracker";
import type { Instrument } from "@/types/db";
import { dateRange, todayInSeoul } from "@/lib/time";

function benchmarkHistorySeedStart(endDate: string) {
  return `${String(Number(endDate.slice(0, 4)) - 1)}-10-01`;
}

function isWeekend(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

function hasPositiveClose(row: { close: string | number | null | undefined }) {
  const close = Number(row.close);
  return Number.isFinite(close) && close > 0;
}

async function logJob(
  job_name: string,
  target_date: string,
  status: "success" | "partial" | "failed",
  metrics_json: Record<string, unknown>,
  error_message: string | null = null,
) {
  try {
    await insertJobRun({
      job_name,
      target_date,
      status,
      error_message,
      metrics_json,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown job log error";
    console.error(`[job_runs] failed to write log for ${job_name} ${target_date}: ${message}`);
  }
}

function buildRequestedProviderRaw() {
  return (
    process.env.MARKET_DATA_PROVIDERS?.trim() ??
    process.env.MARKET_DATA_PROVIDER?.trim() ??
    "TWELVE"
  );
}

async function fetchPriceFromProviderChain(
  handles: ProviderHandle[],
  instrument: Instrument,
  targetDate: string,
): Promise<{
  point: { date: string; close: number } | null;
  close: number | null;
  usedProvider: string | null;
  attempts: ProviderAttemptLog[];
  finalReason: string | null;
}> {
  const live = await fetchBestClosePointFromProviderChain(handles, {
    symbol: instrument.symbol,
    market: instrument.market,
    date: targetDate,
    providerSymbol: instrument.provider_symbol,
  });

  return {
    point: live.point ? { date: live.point.date, close: live.point.close } : null,
    close: live.point?.close ?? null,
    usedProvider: live.usedProvider,
    attempts: live.attempts,
    finalReason: live.finalReason,
  };
}

async function fetchFxFromProviderChain(
  handles: ProviderHandle[],
  pair: string,
  targetDate: string,
): Promise<{
  rate: number | null;
  usedProvider: string | null;
  attempts: ProviderAttemptLog[];
  finalReason: string | null;
}> {
  const attempts: ProviderAttemptLog[] = [];

  for (const handle of handles) {
    const providerName = handle.requestedProvider;
    if (!handle.provider) {
      attempts.push({
        provider: providerName,
        status: "unavailable",
        reason: handle.initError ?? "Provider is unavailable",
      });
      continue;
    }

    try {
      const rate = await handle.provider.getFxRate(pair, targetDate);
      if (rate !== null && Number.isFinite(rate)) {
        attempts.push({ provider: providerName, status: "success" });
        return {
          rate,
          usedProvider: providerName,
          attempts,
          finalReason: null,
        };
      }
      attempts.push({
        provider: providerName,
        status: "error",
        reason: "No FX rate returned",
      });
    } catch (err) {
      attempts.push({
        provider: providerName,
        status: "error",
        reason: err instanceof Error ? err.message : "Unknown provider error",
      });
    }
  }

  let last: string | null = null;
  for (let i = attempts.length - 1; i >= 0; i -= 1) {
    const reason = attempts[i]?.reason;
    if (reason) {
      last = reason;
      break;
    }
  }
  return { rate: null, usedProvider: null, attempts, finalReason: last };
}

async function collectPriceHistoryBackfillInstruments(targetDate: string) {
  const [tradedInstruments, studyIdeaRows, sessionCompanyRows] = await Promise.all([
    getTradedInstrumentsThroughDate(targetDate),
    getStudyTrackerIdeas(),
    getStudySessionCompanies(),
  ]);

  const byId = new Map<string, Instrument>();
  const unresolvedTargets: Array<{ ticker: string; market: string; source: string }> = [];

  for (const instrument of tradedInstruments) {
    byId.set(instrument.id, instrument);
  }

  const quoteTargets = new Map<string, { symbol: string; market: Instrument["market"] }>();

  for (const row of studyIdeaRows) {
    const target = resolveStudyQuoteTarget(row.ticker, row.currency);
    if (!target) continue;
    quoteTargets.set(`${target.market}:${target.symbol}`, {
      symbol: target.symbol,
      market: target.market,
    });
  }

  for (const row of sessionCompanyRows) {
    const target = resolveStudyQuoteTarget(row.ticker, row.currency);
    if (!target) continue;
    quoteTargets.set(`${target.market}:${target.symbol}`, {
      symbol: target.symbol,
      market: target.market,
    });
  }

  for (const target of quoteTargets.values()) {
    const instrument = await getInstrumentBySymbolMarket(target.symbol, target.market);
    if (instrument) {
      byId.set(instrument.id, instrument);
    } else {
      unresolvedTargets.push({
        ticker: target.symbol,
        market: target.market,
        source: "study_or_free_idea",
      });
    }
  }

  return {
    instruments: [...byId.values()],
    unresolvedTargets,
  };
}

export async function updatePricesForDate(targetDate: string) {
  try {
    const requestedProviderRaw = buildRequestedProviderRaw();
    const providerResolution = resolveMarketDataProviders();
    const instruments = await getActiveInstruments();
    const rows: Array<{
      instrument_id: string;
      date: string;
      close: number;
      source: string;
      provider_used: string | null;
    }> = [];
    const failures: Array<{ symbol: string; reason: string }> = [];
    const warnings: Array<{
      symbol: string;
      reason: string;
      fallback_date: string;
      fallback_close: number;
      provider_attempts: ProviderAttemptLog[];
    }> = [];
    const providerUsage: Record<string, number> = {};

    for (const inst of instruments) {
      const storedPoint = await getPricePointOnOrBefore(inst.id, targetDate);

      if (isExactPricePoint(storedPoint, targetDate)) {
        rows.push({
          instrument_id: inst.id,
          date: targetDate,
          close: storedPoint!.close,
          source: storedPoint!.source ?? "provider",
          provider_used: null,
        });
        continue;
      }

      const live = await fetchPriceFromProviderChain(
        providerResolution.handles,
        inst,
        targetDate,
      );

      const livePoint = live.point
        ? {
            ...live.point,
            source: "provider",
          }
        : null;

      const preferredPoint = pickPreferredClosePoint(targetDate, storedPoint, livePoint);

      if (preferredPoint) {
        const usingLivePoint = preferredPoint === livePoint;
        const isExact = isExactPricePoint(preferredPoint, targetDate);
        if (usingLivePoint && live.usedProvider) {
          providerUsage[live.usedProvider] = (providerUsage[live.usedProvider] ?? 0) + 1;
        }

        rows.push({
          instrument_id: inst.id,
          date: targetDate,
          close: preferredPoint.close,
          source: isExact
            ? usingLivePoint
              ? "provider"
              : preferredPoint.source ?? "provider"
            : "carry_forward",
          provider_used: usingLivePoint && isExact ? live.usedProvider : null,
        });

        if (!isExact) {
          warnings.push({
            symbol: inst.symbol,
            reason:
              live.finalReason ??
              `${preferredPoint.date} 기준 저장 종가를 사용했습니다.`,
            fallback_date: preferredPoint.date,
            fallback_close: preferredPoint.close,
            provider_attempts: live.attempts,
          });
        }
        continue;
      }

      failures.push({
        symbol: inst.symbol,
        reason: live.finalReason ?? "No provider data and no historical fallback",
      });
    }

    if (rows.length > 0) {
      await upsertPrice(
        rows.map((x) => ({
          instrument_id: x.instrument_id,
          date: x.date,
          close: String(x.close),
          source: x.source,
        })),
      );
    }

    const status =
      failures.length === 0 && warnings.length === 0
        ? "success"
        : failures.length < instruments.length
          ? "partial"
          : "failed";

    const errorMessage =
      failures.length > 0
        ? `Failed symbols: ${failures.length}`
        : warnings.length > 0
          ? `Warnings (carry-forward): ${warnings.length}`
          : null;

    await logJob(
      "update_prices",
      targetDate,
      status,
      {
        requested_provider: requestedProviderRaw,
        configured_chain: providerResolution.handles.map((h) => h.requestedProvider),
        invalid_provider_tokens: providerResolution.invalidValues,
        fallback_used: warnings.length > 0,
        total_instruments: instruments.length,
        succeeded: rows.length,
        failed: failures.length,
        warnings: warnings.length,
        provider_usage: providerUsage,
        warning_details: warnings,
        failures,
      },
      errorMessage,
    );

    return { rows: rows.length, failures, warnings, status };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await logJob("update_prices", targetDate, "failed", { fatal: true }, msg);
    return {
      rows: 0,
      failures: [{ symbol: "*", reason: msg }],
      warnings: [] as Array<{
        symbol: string;
        reason: string;
        fallback_date: string;
        fallback_close: number;
        provider_attempts: ProviderAttemptLog[];
      }>,
      status: "failed" as const,
    };
  }
}

export async function updateFxForDate(targetDate: string) {
  try {
    const requestedProviderRaw = buildRequestedProviderRaw();
    const providerResolution = resolveMarketDataProviders();

    let status: "success" | "partial" | "failed" = "success";
    let failure: string | null = null;
    let warning: string | null = null;
    let rate: number | null = null;
    let usedProvider: string | null = null;
    let providerAttempts: ProviderAttemptLog[] = [];

    const live = await fetchFxFromProviderChain(
      providerResolution.handles,
      FX_PAIR_USDKRW,
      targetDate,
    );
    providerAttempts = live.attempts;

    if (live.rate !== null) {
      rate = live.rate;
      usedProvider = live.usedProvider;
      await upsertFx([
        {
          pair: FX_PAIR_USDKRW,
          date: targetDate,
          rate: String(rate),
          source: "provider",
        },
      ]);
    } else {
      const fallback = await getFxPointOnOrBefore(FX_PAIR_USDKRW, targetDate);
      if (fallback) {
        rate = fallback.rate;
        status = "partial";
        warning = `Carry-forward FX from ${fallback.date}`;
        await upsertFx([
          {
            pair: FX_PAIR_USDKRW,
            date: targetDate,
            rate: String(fallback.rate),
            source: "carry_forward",
          },
        ]);
      } else {
        status = "failed";
        failure = live.finalReason ?? "No FX rate returned and no historical fallback";
      }
    }

    await logJob(
      "update_fx",
      targetDate,
      status,
      {
        requested_provider: requestedProviderRaw,
        configured_chain: providerResolution.handles.map((h) => h.requestedProvider),
        invalid_provider_tokens: providerResolution.invalidValues,
        used_provider: usedProvider,
        fallback_used: status === "partial",
        fallback_reason: warning ?? live.finalReason,
        pair: FX_PAIR_USDKRW,
        rate,
        provider_attempts: providerAttempts,
      },
      failure ?? warning,
    );

    return { status, rate, failure, warning };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await logJob("update_fx", targetDate, "failed", { fatal: true }, msg);
    return {
      status: "failed" as const,
      rate: null,
      failure: msg,
      warning: null,
    };
  }
}

export async function ensureBenchmarkHistory(
  targetDate: string,
  options?: { startDate?: string },
) {
  try {
    const requestedProviderRaw = buildRequestedProviderRaw();
    const providerResolution = resolveMarketDataProviders();
    const [spy, kospi] = await Promise.all([
      getBenchmarkByCode("SPY"),
      getBenchmarkByCode("KOSPI"),
    ]);

    const instruments = [spy, kospi].filter((x): x is Instrument => Boolean(x));
    if (instruments.length === 0) {
      return {
        status: "failed" as const,
        startDate: benchmarkHistorySeedStart(targetDate),
        rows: 0,
        warnings: [] as Array<{ symbol: string; date: string; reason: string }>,
        failures: [{ symbol: "*", date: targetDate, reason: "Benchmark instruments are missing" }],
      };
    }

    const startDate = options?.startDate ?? benchmarkHistorySeedStart(targetDate);
    const weekdays = dateRange(startDate, targetDate).filter((date) => !isWeekend(date));
    const rows: Array<{
      instrument_id: string;
      date: string;
      close: number;
      source: string;
    }> = [];
    const warnings: Array<{ symbol: string; date: string; reason: string }> = [];
    const failures: Array<{ symbol: string; date: string; reason: string }> = [];
    const providerUsage: Record<string, number> = {};

    const existingByInstrument = new Map<string, Set<string>>();
    for (const instrument of instruments) {
      const prices = await getBenchmarkPriceSeries(instrument.id, startDate, targetDate);
      existingByInstrument.set(
        instrument.id,
        new Set(prices.filter(hasPositiveClose).map((row) => String(row.date))),
      );
    }

    for (const instrument of instruments) {
      const existingDates = existingByInstrument.get(instrument.id) ?? new Set<string>();

      for (const date of weekdays) {
        if (existingDates.has(date)) continue;

        const storedPoint = await getPricePointOnOrBefore(instrument.id, date);
        const live = await fetchPriceFromProviderChain(
          providerResolution.handles,
          instrument,
          date,
        );
        const livePoint = live.point
          ? {
              ...live.point,
              source: "provider",
            }
          : null;
        const preferredPoint = pickPreferredClosePoint(date, storedPoint, livePoint);

        if (!preferredPoint) {
          failures.push({
            symbol: instrument.symbol,
            date,
            reason: live.finalReason ?? "No provider data and no historical fallback",
          });
          continue;
        }

        const usingLivePoint = preferredPoint === livePoint;
        const isExact = isExactPricePoint(preferredPoint, date);
        if (usingLivePoint && live.usedProvider) {
          providerUsage[live.usedProvider] = (providerUsage[live.usedProvider] ?? 0) + 1;
        }

        rows.push({
          instrument_id: instrument.id,
          date,
          close: preferredPoint.close,
          source: isExact
            ? usingLivePoint
              ? "provider"
              : preferredPoint.source ?? "provider"
            : "carry_forward",
        });

        if (!isExact) {
          warnings.push({
            symbol: instrument.symbol,
            date,
            reason:
              live.finalReason ?? `${preferredPoint.date} 기준 종가를 사용했습니다.`,
          });
        }
      }
    }

    if (rows.length > 0) {
      await upsertPrice(
        rows.map((row) => ({
          instrument_id: row.instrument_id,
          date: row.date,
          close: String(row.close),
          source: row.source,
        })),
      );
    }

    const totalMissing = rows.length + failures.length;
    const status =
      failures.length === 0 && warnings.length === 0
        ? "success"
        : failures.length < Math.max(totalMissing, 1)
          ? "partial"
          : "failed";

    await logJob(
      "ensure_benchmark_history",
      targetDate,
      status,
      {
        start_date: startDate,
        end_date: targetDate,
        requested_provider: requestedProviderRaw,
        configured_chain: providerResolution.handles.map((h) => h.requestedProvider),
        invalid_provider_tokens: providerResolution.invalidValues,
        instruments: instruments.map((instrument) => instrument.symbol),
        filled_rows: rows.length,
        failures: failures.length,
        warnings: warnings.length,
        provider_usage: providerUsage,
        warning_details: warnings,
        failure_details: failures,
      },
      failures.length > 0 ? `Failed benchmark dates: ${failures.length}` : null,
    );

    return {
      status,
      startDate,
      rows: rows.length,
      warnings,
      failures,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await logJob("ensure_benchmark_history", targetDate, "failed", { fatal: true }, msg);
    return {
      status: "failed" as const,
      startDate: benchmarkHistorySeedStart(targetDate),
      rows: 0,
      warnings: [] as Array<{ symbol: string; date: string; reason: string }>,
      failures: [{ symbol: "*", date: targetDate, reason: msg }],
    };
  }
}

export async function backfillTradedInstrumentPrices(
  targetDate: string,
  options?: { startDate?: string },
) {
  try {
    const requestedProviderRaw = buildRequestedProviderRaw();
    const providerResolution = resolveMarketDataProviders();
    const startDate = options?.startDate ?? (await getGameStartDate());
    const { instruments, unresolvedTargets } =
      await collectPriceHistoryBackfillInstruments(targetDate);

    if (instruments.length === 0) {
      return {
        status: "success" as const,
        startDate,
        rows: 0,
        warnings: [] as Array<{ symbol: string; date: string; reason: string }>,
        failures: [] as Array<{ symbol: string; date: string; reason: string }>,
        instrumentCount: 0,
        unresolvedTargets: 0,
      };
    }

    const weekdays = dateRange(startDate, targetDate).filter((date) => !isWeekend(date));
    const rows: Array<{
      instrument_id: string;
      date: string;
      close: number;
      source: string;
    }> = [];
    const warnings: Array<{ symbol: string; date: string; reason: string }> = [];
    const failures: Array<{ symbol: string; date: string; reason: string }> = [];
    const providerUsage: Record<string, number> = {};

    const existingByInstrument = new Map<string, Set<string>>();
    for (const instrument of instruments) {
      const prices = await getPriceSeries(instrument.id, startDate, targetDate);
      existingByInstrument.set(
        instrument.id,
        new Set(prices.filter(hasPositiveClose).map((row) => String(row.date))),
      );
    }

    for (const instrument of instruments) {
      const existingDates = existingByInstrument.get(instrument.id) ?? new Set<string>();

      for (const date of weekdays) {
        if (existingDates.has(date)) continue;

        const storedPoint = await getPricePointOnOrBefore(instrument.id, date);
        const live = await fetchPriceFromProviderChain(
          providerResolution.handles,
          instrument,
          date,
        );
        const livePoint = live.point
          ? {
              ...live.point,
              source: "provider",
            }
          : null;
        const preferredPoint = pickPreferredClosePoint(date, storedPoint, livePoint);

        if (!preferredPoint) {
          failures.push({
            symbol: instrument.symbol,
            date,
            reason: live.finalReason ?? "No provider data and no historical fallback",
          });
          continue;
        }

        const usingLivePoint = preferredPoint === livePoint;
        const isExact = isExactPricePoint(preferredPoint, date);
        if (usingLivePoint && live.usedProvider) {
          providerUsage[live.usedProvider] = (providerUsage[live.usedProvider] ?? 0) + 1;
        }

        rows.push({
          instrument_id: instrument.id,
          date,
          close: preferredPoint.close,
          source: isExact
            ? usingLivePoint
              ? "provider"
              : preferredPoint.source ?? "provider"
            : "carry_forward",
        });

        if (!isExact) {
          warnings.push({
            symbol: instrument.symbol,
            date,
            reason:
              live.finalReason ?? `${preferredPoint.date} 기준 종가를 사용했습니다.`,
          });
        }
      }
    }

    if (rows.length > 0) {
      await upsertPrice(
        rows.map((row) => ({
          instrument_id: row.instrument_id,
          date: row.date,
          close: String(row.close),
          source: row.source,
        })),
      );
    }

    const totalMissing = rows.length + failures.length;
    const status =
      failures.length === 0 && warnings.length === 0
        ? "success"
        : failures.length < Math.max(totalMissing, 1)
          ? "partial"
          : "failed";

    await logJob(
      "backfill_traded_prices",
      targetDate,
      status,
      {
        start_date: startDate,
        end_date: targetDate,
        requested_provider: requestedProviderRaw,
        configured_chain: providerResolution.handles.map((h) => h.requestedProvider),
        invalid_provider_tokens: providerResolution.invalidValues,
        instruments: instruments.map((instrument) => instrument.symbol),
        instrument_count: instruments.length,
        unresolved_targets: unresolvedTargets,
        filled_rows: rows.length,
        failures: failures.length,
        warnings: warnings.length,
        provider_usage: providerUsage,
        warning_details: warnings,
        failure_details: failures,
      },
      failures.length > 0 ? `Failed traded price dates: ${failures.length}` : null,
    );

    return {
      status,
      startDate,
      rows: rows.length,
      warnings,
      failures,
      instrumentCount: instruments.length,
      unresolvedTargets: unresolvedTargets.length,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await logJob("backfill_traded_prices", targetDate, "failed", { fatal: true }, msg);
    return {
      status: "failed" as const,
      startDate: options?.startDate ?? (await getGameStartDate()),
      rows: 0,
      warnings: [] as Array<{ symbol: string; date: string; reason: string }>,
      failures: [{ symbol: "*", date: targetDate, reason: msg }],
      instrumentCount: 0,
      unresolvedTargets: 0,
    };
  }
}

async function buildBenchmarkContext(startDate: string, endDate: string) {
  const spy = await getBenchmarkByCode("SPY");
  const kospi = await getBenchmarkByCode("KOSPI");

  if (!spy) {
    throw new Error("SPY benchmark instrument missing.");
  }
  if (!kospi) {
    throw new Error("KOSPI benchmark instrument missing.");
  }

  const [spyPrices, kospiPrices] = await Promise.all([
    getBenchmarkPriceSeries(spy.id, "1900-01-01", endDate),
    getBenchmarkPriceSeries(kospi.id, "1900-01-01", endDate),
  ]);

  const spySeries = buildBenchmarkReturnByDate(BENCHMARK_SPY, startDate, endDate, spyPrices);
  const kospiSeries = buildBenchmarkReturnByDate(
    BENCHMARK_KOSPI,
    startDate,
    endDate,
    kospiPrices,
  );

  return {
    spyReturnByDate: spySeries.returnByDate,
    kospiReturnByDate: kospiSeries.returnByDate,
  };
}

export async function generateSnapshotsForDate(targetDate: string) {
  try {
    const gameStartDate = await getGameStartDate();
    if (targetDate < gameStartDate) {
      const reason = `target_date (${targetDate}) is before GAME_START_DATE (${gameStartDate})`;
      await logJob(
        "generate_snapshots",
        targetDate,
        "failed",
        { game_start_date: gameStartDate },
        reason,
      );
      return { status: "failed" as const, successCount: 0, failures: [{ participant_id: "-", reason }] };
    }
    const participants = await getParticipantsWithPortfolios();
    const benchmarks = await buildBenchmarkContext(gameStartDate, targetDate);
    const cache = createValueCache();

    const failures: Array<{ participant_id: string; reason: string }> = [];
    let successCount = 0;

    for (const row of participants) {
      try {
        const { snapshot } = await buildDailySnapshot({
          participant: row.participant,
          portfolio: row.portfolio,
          date: targetDate,
          benchmarks,
          gameStartDate,
          cache,
        });
        await upsertDailySnapshot(snapshot);
        successCount += 1;
      } catch (err) {
        failures.push({
          participant_id: row.participant.id,
          reason: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const status =
      failures.length === 0
        ? "success"
        : failures.length < participants.length
          ? "partial"
          : "failed";

    await logJob(
      "generate_snapshots",
      targetDate,
      status,
      {
        participants: participants.length,
        succeeded: successCount,
        failed: failures.length,
        failures,
      },
      failures.length ? `Failed participants: ${failures.length}` : null,
    );

    return { status, successCount, failures };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await logJob("generate_snapshots", targetDate, "failed", { fatal: true }, msg);
    return {
      status: "failed" as const,
      successCount: 0,
      failures: [{ participant_id: "*", reason: msg }],
    };
  }
}

export async function refreshStudyTrackerIdeasForDate(targetDate: string) {
  try {
    const rows = await getStudyTrackerIdeas();
    const ideas = rows.map(mapStudyTrackerIdea);
    const warnings: Array<{ idea_id: number; ticker: string; reason: string }> = [];
    const failures: Array<{ idea_id: number; ticker: string; reason: string }> = [];
    let refreshedCount = 0;
    let pricedCount = 0;

    for (const idea of ideas) {
      try {
        let seededPrice: number | null = null;
        let seededPoint: { date: string; close: number; source?: string } | null = null;
        let usedPriceTable = false;
        let warning: string | null = null;
        const quoteTarget = resolveStudyQuoteTarget(idea.ticker, idea.currency);

        if (quoteTarget) {
          const instrument = await getInstrumentBySymbolMarket(quoteTarget.symbol, quoteTarget.market);
          if (instrument) {
            const pricePoint = await getPricePointOnOrBefore(instrument.id, targetDate);
            if (pricePoint) {
              seededPoint = pricePoint;
              seededPrice = pricePoint.close;
              usedPriceTable = isExactPricePoint(pricePoint, targetDate);
              if (!usedPriceTable) {
                warning = `${pricePoint.date} 기준 종가를 사용했습니다.`;
              }
            }
          }
        }

        if (!usedPriceTable && quoteTarget) {
          const providerQuote = await fetchStudyQuotePointOnOrBefore({
            ticker: idea.ticker,
            currency: idea.currency,
            date: targetDate,
          });
          const chosenPoint = pickPreferredClosePoint(
            targetDate,
            seededPoint,
            providerQuote.point,
          );
          if (chosenPoint?.close !== null && chosenPoint?.close !== undefined) {
            seededPrice = chosenPoint.close;
            warning = chosenPoint.date < targetDate ? `${chosenPoint.date} 기준 종가를 사용했습니다.` : null;
          } else if (providerQuote.warning) {
            warning = providerQuote.warning;
          }
        }

        const enriched = await autoFillStudyTrackerIdea(
          {
            ...toStudyTrackerIdeaInput(idea),
            current_price: seededPrice ?? idea.current_price,
          },
          {
            quoteDate: targetDate,
            skipQuoteFetch: true,
          },
        );

        await updateStudyTrackerIdea(idea.id, enriched.input);
        refreshedCount += 1;

        if (enriched.input.current_price !== null) {
          pricedCount += 1;
        } else {
          failures.push({
            idea_id: idea.id,
            ticker: idea.ticker,
            reason: enriched.warning ?? warning ?? "현재가를 찾지 못했습니다.",
          });
        }

        const finalWarning = enriched.warning ?? warning;
        if (finalWarning) {
          warnings.push({
            idea_id: idea.id,
            ticker: idea.ticker,
            reason: finalWarning,
          });
        }
      } catch (err) {
        failures.push({
          idea_id: idea.id,
          ticker: idea.ticker,
          reason: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const status =
      failures.length === 0 && warnings.length === 0
        ? "success"
        : failures.length < ideas.length
          ? "partial"
          : "failed";

    await logJob(
      "refresh_study_tracker_prices",
      targetDate,
      status,
      {
        total_ideas: ideas.length,
        refreshed: refreshedCount,
        priced: pricedCount,
        warnings: warnings.length,
        failures: failures.length,
        warning_details: warnings,
        failure_details: failures,
      },
      failures.length > 0 ? `Failed ideas: ${failures.length}` : warnings.length > 0 ? `Warnings: ${warnings.length}` : null,
    );

    return {
      status,
      totalIdeas: ideas.length,
      refreshedCount,
      pricedCount,
      warnings,
      failures,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await logJob("refresh_study_tracker_prices", targetDate, "failed", { fatal: true }, msg);
    return {
      status: "failed" as const,
      totalIdeas: 0,
      refreshedCount: 0,
      pricedCount: 0,
      warnings: [] as Array<{ idea_id: number; ticker: string; reason: string }>,
      failures: [{ idea_id: 0, ticker: "*", reason: msg }],
    };
  }
}

export async function refreshStudySessionCompaniesForDate(targetDate: string) {
  try {
    const rows = await getStudySessionCompanies();
    const companies = rows.map(mapStudySessionCompany);
    const warnings: Array<{ company_id: number; ticker: string; reason: string }> = [];
    const failures: Array<{ company_id: number; ticker: string; reason: string }> = [];
    let refreshedCount = 0;
    let pricedCount = 0;

    for (const company of companies) {
      try {
        let seededPrice: number | null = null;
        let seededPoint: { date: string; close: number; source?: string } | null = null;
        let warning: string | null = null;
        let usedExactPriceTable = false;
        const quoteTarget = resolveStudyQuoteTarget(company.ticker, company.currency);

        if (quoteTarget) {
          const instrument = await getInstrumentBySymbolMarket(quoteTarget.symbol, quoteTarget.market);
          if (instrument) {
            const pricePoint = await getPricePointOnOrBefore(instrument.id, targetDate);
            if (pricePoint) {
              seededPoint = pricePoint;
              seededPrice = pricePoint.close;
              usedExactPriceTable = isExactPricePoint(pricePoint, targetDate);
              if (!usedExactPriceTable) {
                warning = `${pricePoint.date} 기준 종가를 사용했습니다.`;
              }
            }
          }
        }

        if (!usedExactPriceTable && quoteTarget) {
          const providerQuote = await fetchStudyQuotePointOnOrBefore({
            ticker: company.ticker,
            currency: company.currency,
            date: targetDate,
          });
          const chosenPoint = pickPreferredClosePoint(
            targetDate,
            seededPoint,
            providerQuote.point,
          );
          if (chosenPoint?.close !== null && chosenPoint?.close !== undefined) {
            seededPrice = chosenPoint.close;
            warning = chosenPoint.date < targetDate ? `${chosenPoint.date} 기준 종가를 사용했습니다.` : null;
          } else if (providerQuote.warning) {
            warning = providerQuote.warning;
          }
        }

        await updateStudySessionCompany(company.id, {
          ...toStudySessionCompanyInput(company),
          current_price: seededPrice ?? company.current_price,
        });
        refreshedCount += 1;

        if ((seededPrice ?? company.current_price) !== null) {
          pricedCount += 1;
        } else {
          failures.push({
            company_id: company.id,
            ticker: company.ticker,
            reason: warning ?? "현재가를 찾지 못했습니다.",
          });
        }

        if (warning) {
          warnings.push({
            company_id: company.id,
            ticker: company.ticker,
            reason: warning,
          });
        }
      } catch (err) {
        failures.push({
          company_id: company.id,
          ticker: company.ticker,
          reason: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const status =
      failures.length === 0 && warnings.length === 0
        ? "success"
        : failures.length < companies.length
          ? "partial"
          : "failed";

    await logJob(
      "refresh_study_session_company_prices",
      targetDate,
      status,
      {
        total_companies: companies.length,
        refreshed: refreshedCount,
        priced: pricedCount,
        warnings: warnings.length,
        failures: failures.length,
        warning_details: warnings,
        failure_details: failures,
      },
      failures.length > 0 ? `Failed companies: ${failures.length}` : warnings.length > 0 ? `Warnings: ${warnings.length}` : null,
    );

    return {
      status,
      totalCompanies: companies.length,
      refreshedCount,
      pricedCount,
      warnings,
      failures,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await logJob("refresh_study_session_company_prices", targetDate, "failed", { fatal: true }, msg);
    return {
      status: "failed" as const,
      totalCompanies: 0,
      refreshedCount: 0,
      pricedCount: 0,
      warnings: [] as Array<{ company_id: number; ticker: string; reason: string }>,
      failures: [{ company_id: 0, ticker: "*", reason: msg }],
    };
  }
}

export async function runDailyPipeline(targetDate = todayInSeoul()) {
  const prices = await updatePricesForDate(targetDate);
  const fx = await updateFxForDate(targetDate);
  const benchmarks = await ensureBenchmarkHistory(targetDate, {
    startDate: targetDate,
  });
  const snapshots = await generateSnapshotsForDate(targetDate);
  const studyTracker = await refreshStudyTrackerIdeasForDate(targetDate);
  const freeTopics = await refreshStudySessionCompaniesForDate(targetDate);
  return { targetDate, prices, fx, benchmarks, snapshots, studyTracker, freeTopics };
}

export async function backfillPrices(startDate: string, endDate: string) {
  const out = [];
  for (const d of dateRange(startDate, endDate)) {
    out.push(await updatePricesForDate(d));
  }
  return out;
}

export async function backfillFx(startDate: string, endDate: string) {
  const out = [];
  for (const d of dateRange(startDate, endDate)) {
    out.push(await updateFxForDate(d));
  }
  return out;
}

export async function backfillSnapshots(startDate: string, endDate: string) {
  const out = [];
  for (const d of dateRange(startDate, endDate)) {
    out.push(await generateSnapshotsForDate(d));
  }
  return out;
}
