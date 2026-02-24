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
  getGameStartDate,
  getParticipantsWithPortfolios,
  getPricePointOnOrBefore,
  insertJobRun,
  upsertDailySnapshot,
  upsertFx,
  upsertPrice,
} from "@/lib/db";
import { buildDailySnapshot, createValueCache } from "@/lib/engine/snapshot";
import { resolveMarketDataProviders } from "@/lib/providers";
import type { ProviderHandle } from "@/lib/providers";
import type { Instrument } from "@/types/db";
import { dateRange, yesterdayInSeoul } from "@/lib/time";

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

interface ProviderAttemptLog {
  provider: string;
  status: "success" | "error" | "unavailable";
  reason?: string;
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
  close: number | null;
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
      const close = await handle.provider.getDailyClose(
        instrument.symbol,
        instrument.market,
        targetDate,
        instrument.provider_symbol,
      );
      if (close !== null && Number.isFinite(close)) {
        attempts.push({ provider: providerName, status: "success" });
        return {
          close,
          usedProvider: providerName,
          attempts,
          finalReason: null,
        };
      }
      attempts.push({
        provider: providerName,
        status: "error",
        reason: "No close price returned",
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
  return { close: null, usedProvider: null, attempts, finalReason: last };
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

export async function updatePricesForDate(targetDate: string) {
  try {
    const requestedProviderRaw = buildRequestedProviderRaw();
    const providerResolution = resolveMarketDataProviders();
    const instruments = await getActiveInstruments();
    const rows: Array<{
      instrument_id: string;
      date: string;
      close: number;
      source: "provider" | "carry_forward";
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
      const live = await fetchPriceFromProviderChain(
        providerResolution.handles,
        inst,
        targetDate,
      );

      if (live.close !== null) {
        const used = live.usedProvider ?? "UNKNOWN";
        providerUsage[used] = (providerUsage[used] ?? 0) + 1;
        rows.push({
          instrument_id: inst.id,
          date: targetDate,
          close: live.close,
          source: "provider",
          provider_used: live.usedProvider,
        });
        continue;
      }

      const fallback = await getPricePointOnOrBefore(inst.id, targetDate);
      if (fallback) {
        rows.push({
          instrument_id: inst.id,
          date: targetDate,
          close: fallback.close,
          source: "carry_forward",
          provider_used: null,
        });
        warnings.push({
          symbol: inst.symbol,
          reason: live.finalReason ?? "All providers failed",
          fallback_date: fallback.date,
          fallback_close: fallback.close,
          provider_attempts: live.attempts,
        });
      } else {
        failures.push({
          symbol: inst.symbol,
          reason: live.finalReason ?? "No provider data and no historical fallback",
        });
      }
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

export async function runDailyPipeline(targetDate = yesterdayInSeoul()) {
  const prices = await updatePricesForDate(targetDate);
  const fx = await updateFxForDate(targetDate);
  const snapshots = await generateSnapshotsForDate(targetDate);
  return { targetDate, prices, fx, snapshots };
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
