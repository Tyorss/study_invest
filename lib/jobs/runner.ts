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
  getGameStartDate,
  getParticipantsWithPortfolios,
  getPricePointOnOrBefore,
  getStudySessionCompanies,
  getStudyTrackerIdeas,
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
  mapStudySessionCompany,
  mapStudyTrackerIdea,
  toStudySessionCompanyInput,
  toStudyTrackerIdeaInput,
} from "@/lib/study-tracker";
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
        let usedPriceTable = false;
        let warning: string | null = null;
        const quoteTarget = resolveStudyQuoteTarget(idea.ticker, idea.currency);

        if (quoteTarget) {
          const instrument = await getInstrumentBySymbolMarket(quoteTarget.symbol, quoteTarget.market);
          if (instrument) {
            const pricePoint = await getPricePointOnOrBefore(instrument.id, targetDate);
            if (pricePoint) {
              seededPrice = pricePoint.close;
              usedPriceTable = true;
              if (pricePoint.date !== targetDate || pricePoint.source === "carry_forward") {
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
          if (providerQuote.point?.close !== null && providerQuote.point?.close !== undefined) {
            seededPrice = providerQuote.point.close;
            warning = null;
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
        let warning: string | null = null;
        const quoteTarget = resolveStudyQuoteTarget(company.ticker, company.currency);

        if (quoteTarget) {
          const instrument = await getInstrumentBySymbolMarket(quoteTarget.symbol, quoteTarget.market);
          if (instrument) {
            const pricePoint = await getPricePointOnOrBefore(instrument.id, targetDate);
            if (pricePoint) {
              seededPrice = pricePoint.close;
              if (pricePoint.date !== targetDate || pricePoint.source === "carry_forward") {
                warning = `${pricePoint.date} 기준 종가를 사용했습니다.`;
              }
            }
          }
        }

        if (seededPrice === null && quoteTarget) {
          const providerQuote = await fetchStudyQuotePointOnOrBefore({
            ticker: company.ticker,
            currency: company.currency,
            date: targetDate,
          });
          if (providerQuote.point?.close !== null && providerQuote.point?.close !== undefined) {
            seededPrice = providerQuote.point.close;
            warning = null;
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

export async function runDailyPipeline(targetDate = yesterdayInSeoul()) {
  const prices = await updatePricesForDate(targetDate);
  const fx = await updateFxForDate(targetDate);
  const snapshots = await generateSnapshotsForDate(targetDate);
  const studyTracker = await refreshStudyTrackerIdeasForDate(targetDate);
  const freeTopics = await refreshStudySessionCompaniesForDate(targetDate);
  return { targetDate, prices, fx, snapshots, studyTracker, freeTopics };
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
