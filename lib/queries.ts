import { buildBenchmarkReturnByDate } from "@/lib/benchmarks";
import {
  getBenchmarkByCode,
  getLatestJobRuns,
  getParticipantNotes,
  getParticipantById,
  getStudySessionCompanies,
  getStudyTrackerIdeas,
  getBenchmarkPriceSeries,
  getParticipantsWithPortfolios,
  getGameStartDate,
  getParticipantLatestSnapshot,
  getLatestTradeDateForPortfolio,
  getParticipantSnapshots,
  getTradesForPortfolio,
  getPricePointOnOrBefore,
  getPriceOnOrBefore,
  getTradesJournal,
  getFxOnOrBefore,
  updateInstrumentMetadata,
  upsertPrice,
} from "@/lib/db";
import { createValueCache, rebuildPortfolioState } from "@/lib/engine/snapshot";
import {
  fetchBestClosePointFromProviderChain,
  isExactPricePoint,
  pickPreferredClosePoint,
} from "@/lib/market-data";
import { resolveMarketDataProviders } from "@/lib/providers";
import { lookupInstrumentNameWithPython } from "@/lib/providers/python-market-data-provider";
import { addDays, dateRange } from "@/lib/time";
import type {
  Instrument,
  LeaderboardInstrumentsRow,
  LeaderboardRow,
  Market,
  MissingPriceHoldingRow,
  Participant,
  Portfolio,
  RankedInstrumentStat,
  TradeRow,
} from "@/types/db";

function toNumOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

function top3Stats(
  items: Array<{ symbol: string; label?: string; value: number | null }>,
): RankedInstrumentStat[] {
  return items
    .filter((x): x is { symbol: string; label?: string; value: number } => x.value !== null)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((x) => ({ symbol: x.symbol, label: x.label, value: x.value }));
}

function resolveUsableMarkPrice(price: number | null, fallback: number) {
  if (!Number.isFinite(price ?? NaN) || (price ?? 0) <= 0) {
    return { value: fallback, isFallback: true };
  }
  return { value: price as number, isFallback: false };
}

function defaultProviderSymbol(symbol: string, market: Market) {
  if (market === "KR") return `${symbol}:KRX`;
  if (market === "INDEX" && symbol === "KS11") return "KOSPI";
  return symbol;
}

function benchmarkHistorySeedStart(endDate: string) {
  return `${String(Number(endDate.slice(0, 4)) - 1)}-10-01`;
}

async function getUsableInstrumentPricePoint(
  instrument: Instrument,
  date: string,
): Promise<{ close: number | null; isFallback: boolean; refreshed: boolean }> {
  const storedPoint = await getPricePointOnOrBefore(instrument.id, date);
  if (isExactPricePoint(storedPoint, date) && Number(storedPoint?.close ?? 0) > 0) {
    return { close: Number(storedPoint!.close), isFallback: false, refreshed: false };
  }

  let livePoint:
    | {
        date: string;
        close: number;
        source?: string | null;
      }
    | null = null;

  try {
    const providerResolution = resolveMarketDataProviders();
    const live = await fetchBestClosePointFromProviderChain(providerResolution.handles, {
      symbol: instrument.symbol,
      market: instrument.market,
      date,
      providerSymbol: instrument.provider_symbol ?? defaultProviderSymbol(instrument.symbol, instrument.market),
    });
    if (live.point && Number.isFinite(live.point.close) && live.point.close > 0) {
      livePoint = {
        date: live.point.date,
        close: live.point.close,
        source: "provider",
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown provider resolution error";
    console.error(
      `[participant-detail] single-price refresh failed for ${instrument.symbol} (${date}): ${message}`,
    );
  }

  const preferredPoint = pickPreferredClosePoint(date, storedPoint, livePoint);
  if (!preferredPoint || !Number.isFinite(preferredPoint.close) || preferredPoint.close <= 0) {
    return { close: null, isFallback: true, refreshed: false };
  }

  const shouldPersist =
    !storedPoint ||
    preferredPoint.date > storedPoint.date ||
    preferredPoint.close !== storedPoint.close ||
    preferredPoint.source !== storedPoint.source;

  if (shouldPersist) {
    await upsertPrice([
      {
        instrument_id: instrument.id,
        date,
        close: String(preferredPoint.close),
        source:
          preferredPoint.date === date
            ? preferredPoint.source ?? "provider"
            : "carry_forward",
      },
    ]);
  }

  return {
    close: preferredPoint.close,
    isFallback: preferredPoint.date !== date,
    refreshed: shouldPersist,
  };
}

async function resolveCanonicalKrInstrumentName(instrument: Instrument): Promise<string | null> {
  if (instrument.market !== "KR" || !/^\d{6}$/.test(instrument.symbol)) {
    return null;
  }

  try {
    const name = await lookupInstrumentNameWithPython(
      "fdr",
      instrument.symbol,
      instrument.market,
      instrument.provider_symbol ?? defaultProviderSymbol(instrument.symbol, instrument.market),
    );
    return name?.trim() || null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown instrument name lookup error";
    console.error(
      `[instrument-name] failed to resolve ${instrument.symbol}: ${message}`,
    );
    return null;
  }
}

function isSuspiciousKrInstrumentName(instrument: Instrument) {
  if (instrument.market !== "KR" || !/^\d{6}$/.test(instrument.symbol)) return false;
  const name = instrument.name?.trim() ?? "";
  if (!name) return true;
  if (name === instrument.symbol) return true;
  if (/[A-Za-z]/.test(name) && !/[가-힣]/.test(name)) return true;
  return false;
}

async function repairKoreanInstrumentMetadata(instruments: Instrument[]) {
  const unique = new Map<string, Instrument>();
  for (const instrument of instruments) {
    if (!isSuspiciousKrInstrumentName(instrument)) continue;
    unique.set(instrument.id, instrument);
  }

  const repairedNames = new Map<string, string>();
  for (const instrument of unique.values()) {
    const canonicalName = await resolveCanonicalKrInstrumentName(instrument);
    if (!canonicalName) continue;
    repairedNames.set(instrument.id, canonicalName);
    if (canonicalName !== instrument.name) {
      await updateInstrumentMetadata(instrument.id, { name: canonicalName });
    }
  }

  return repairedNames;
}

async function buildParticipantChartSeries(params: {
  portfolio: Portfolio;
  participant: Participant;
  tradeRows: TradeRow[];
  startDate: string;
  endDate: string;
}) {
  const chartDates = dateRange(params.startDate, params.endDate).filter((date) => !isWeekend(date));
  if (chartDates.length === 0) return [];

  const cache = createValueCache();
  const startingCash = Number(params.participant.starting_cash_krw);
  const positions = new Map<
    string,
    {
      instrument: Instrument;
      quantity: number;
      avg_cost_local: number;
    }
  >();

  let tradeIndex = 0;
  let cashKrw = startingCash;
  let peak = Number.NEGATIVE_INFINITY;
  const out: Array<{
    date: string;
    nav_indexed: number;
    drawdown: number;
  }> = [];

  const orderedTrades = [...params.tradeRows].sort((a, b) => {
    return (
      a.trade_date.localeCompare(b.trade_date) ||
      String(a.created_at).localeCompare(String(b.created_at)) ||
      Number(a.id) - Number(b.id)
    );
  });

  for (const date of chartDates) {
    while (tradeIndex < orderedTrades.length && orderedTrades[tradeIndex].trade_date <= date) {
      const trade = orderedTrades[tradeIndex];
      tradeIndex += 1;

      const instrument = trade.instruments;
      const existing = positions.get(instrument.id);
      const prevQty = existing?.quantity ?? 0;
      let qty = Number(trade.quantity);
      if (trade.side === "CLOSE") {
        qty = prevQty;
      }
      if (!(qty > 0)) continue;

      const px = Number(trade.price);
      const feeRate = trade.fee_rate ? Number(trade.fee_rate) : 0;
      const slippageBps = trade.slippage_bps ? Number(trade.slippage_bps) : 0;
      const effectivePrice =
        trade.side === "BUY"
          ? px * (1 + slippageBps / 10_000)
          : px * (1 - slippageBps / 10_000);
      const notionalLocal = qty * effectivePrice;
      const feeLocal = notionalLocal * feeRate;
      const isUsd = instrument.currency === "USD";
      const fx = isUsd ? await cache.fxOnOrBefore(trade.trade_date) : 1;
      const fxRate = fx ?? 1;

      if (trade.side === "BUY") {
        cashKrw -= (notionalLocal + feeLocal) * fxRate;
        const nextQty = prevQty + qty;
        const prevCostLocal = (existing?.avg_cost_local ?? 0) * prevQty;
        const avg = nextQty === 0 ? 0 : (prevCostLocal + notionalLocal + feeLocal) / nextQty;
        positions.set(instrument.id, {
          instrument,
          quantity: nextQty,
          avg_cost_local: avg,
        });
      } else {
        cashKrw += (notionalLocal - feeLocal) * fxRate;
        const avgCost = existing?.avg_cost_local ?? 0;
        const nextQty = prevQty - qty;
        if (nextQty <= 1e-9) {
          positions.delete(instrument.id);
        } else {
          positions.set(instrument.id, {
            instrument,
            quantity: nextQty,
            avg_cost_local: avgCost,
          });
        }
      }
    }

    let holdingsValueKrw = 0;
    for (const pos of positions.values()) {
      const usablePoint = await getUsableInstrumentPricePoint(pos.instrument, date);
      const mark = resolveUsableMarkPrice(usablePoint.close, pos.avg_cost_local).value;
      const fx =
        pos.instrument.currency === "USD"
          ? await cache.fxOnOrBefore(date)
          : 1;
      const fxRate = fx ?? 1;
      holdingsValueKrw += pos.quantity * mark * fxRate;
    }

    const nav = cashKrw + holdingsValueKrw;
    if (nav > peak) peak = nav;

    out.push({
      date,
      nav_indexed: startingCash === 0 ? 100 : (nav / startingCash) * 100,
      drawdown: peak === 0 ? 0 : nav / peak - 1,
    });
  }

  return out;
}

async function ensureBenchmarkRowsForDates(instrument: Instrument, dates: string[]) {
  if (dates.length === 0) return false;

  let refreshed = false;
  for (const date of dates) {
    const usablePoint = await getUsableInstrumentPricePoint(instrument, date);
    if (usablePoint.refreshed) refreshed = true;
  }
  return refreshed;
}

async function computeTurnover20d(params: {
  portfolioId: string;
  date: string;
  navKrw: number;
  cache: ReturnType<typeof createValueCache>;
}) {
  const { portfolioId, date, navKrw, cache } = params;
  if (!(navKrw > 0)) return null;

  const windowStart = addDays(date, -19);
  const trades = await getTradesForPortfolio(portfolioId, date);
  const posQty = new Map<string, number>();
  let turnoverNotionalKrw = 0;

  for (const trade of trades) {
    const instrument = trade.instruments;
    const prevQty = posQty.get(instrument.id) ?? 0;
    const qty = trade.side === "CLOSE" ? prevQty : Number(trade.quantity);
    if (!(qty > 0)) continue;

    if (trade.trade_date >= windowStart) {
      const isUsd = instrument.currency === "USD";
      const fx = isUsd ? await cache.fxOnOrBefore(trade.trade_date) : 1;
      if (isUsd && !fx) continue;
      const notionalLocal = qty * Number(trade.price);
      turnoverNotionalKrw += notionalLocal * (fx ?? 1);
    }

    if (trade.side === "BUY") {
      posQty.set(instrument.id, prevQty + qty);
    } else {
      const next = prevQty - qty;
      if (next <= 1e-9) {
        posQty.delete(instrument.id);
      } else {
        posQty.set(instrument.id, next);
      }
    }
  }

  return turnoverNotionalKrw / navKrw;
}

export async function fetchLeaderboard(sortBy: "return" | "sharpe" = "return") {
  const participantRows = await getParticipantsWithPortfolios();
  if (participantRows.length === 0) {
    return {
      date: null,
      rows: [] as LeaderboardRow[],
      instrumentRows: [] as LeaderboardInstrumentsRow[],
    };
  }

  const latestByParticipant = await Promise.all(
    participantRows.map(async (row) => ({
      ...row,
      latestSnapshot: await getParticipantLatestSnapshot(row.participant.id),
      latestTradeDate: await getLatestTradeDateForPortfolio(row.portfolio.id),
    })),
  );

  const withSnapshot = latestByParticipant.filter(
    (x): x is (typeof latestByParticipant)[number] & { latestSnapshot: any } =>
      Boolean(x.latestSnapshot),
  );
  if (withSnapshot.length === 0) {
    return {
      date: null,
      rows: [] as LeaderboardRow[],
      instrumentRows: [] as LeaderboardInstrumentsRow[],
    };
  }

  const latestDate =
    withSnapshot
      .map((x) =>
        [String(x.latestSnapshot.date), x.latestTradeDate]
          .filter((v): v is string => Boolean(v))
          .sort((a, b) => a.localeCompare(b))
          .at(-1),
      )
      .filter((v): v is string => Boolean(v))
      .sort((a, b) => a.localeCompare(b))
      .at(-1) ?? null;

  const gameStartDate = await getGameStartDate();
  const cache = createValueCache();

  let spyByDate: Record<string, number | null> = {};
  let kospiByDate: Record<string, number | null> = {};
  try {
    if (latestDate) {
      const [spy, kospi] = await Promise.all([
        getBenchmarkByCode("SPY"),
        getBenchmarkByCode("KOSPI"),
      ]);

      if (spy && kospi) {
        const [spyPrices, kospiPrices] = await Promise.all([
          getBenchmarkPriceSeries(spy.id, "1900-01-01", latestDate),
          getBenchmarkPriceSeries(kospi.id, "1900-01-01", latestDate),
        ]);
        spyByDate = buildBenchmarkReturnByDate(
          "SPY",
          gameStartDate,
          latestDate,
          spyPrices,
        ).returnByDate;
        kospiByDate = buildBenchmarkReturnByDate(
          "KOSPI",
          gameStartDate,
          latestDate,
          kospiPrices,
        ).returnByDate;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown benchmark error";
    console.error(`[leaderboard] benchmark lookup failed: ${msg}`);
  }

  const computed = await Promise.all(
    withSnapshot.map(async ({ participant, portfolio, latestSnapshot, latestTradeDate }) => {
      const snapshotDate = String(latestSnapshot.date);
      const valuationDate =
        [snapshotDate, latestTradeDate]
          .filter((v): v is string => Boolean(v))
          .sort((a, b) => a.localeCompare(b))
          .at(-1) ?? snapshotDate;
      const startingCash = Number(participant.starting_cash_krw);

      let totalReturn = Number(latestSnapshot.total_return_pct);
      let navKrw = Number(latestSnapshot.nav_krw);
      let cashKrw = Number(latestSnapshot.cash_krw);
      let holdingsKrw = Number(latestSnapshot.holdings_value_krw);
      let realizedPnlKrw = Number(latestSnapshot.realized_pnl_krw);
      let unrealizedPnlKrw = Number(latestSnapshot.unrealized_pnl_krw);

      let turnover20d: number | null = null;
      let topReturn: RankedInstrumentStat[] = [];
      let topWeight: RankedInstrumentStat[] = [];
      let topUnrealized: RankedInstrumentStat[] = [];
      let state: Awaited<ReturnType<typeof rebuildPortfolioState>> | null = null;
      let stateDate = valuationDate;

      try {
        state = await rebuildPortfolioState(
          portfolio,
          participant,
          valuationDate,
          cache,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown valuation error";
        console.error(
          `[leaderboard] live valuation failed for ${participant.id} (${valuationDate}): ${msg}`,
        );
      }

      if (!state && snapshotDate !== valuationDate) {
        try {
          state = await rebuildPortfolioState(
            portfolio,
            participant,
            snapshotDate,
            cache,
          );
          stateDate = snapshotDate;
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : "Unknown snapshot valuation error";
          console.error(
            `[leaderboard] snapshot valuation failed for ${participant.id} (${snapshotDate}): ${msg}`,
          );
        }
      }

      if (state) {
        let refreshedExactPrice = false;
        for (const position of state.positions) {
          const usablePoint = await getUsableInstrumentPricePoint(
            position.instrument,
            valuationDate,
          );
          if (usablePoint.refreshed && usablePoint.close !== null && !usablePoint.isFallback) {
            refreshedExactPrice = true;
          }
        }

        if (refreshedExactPrice) {
          try {
            state = await rebuildPortfolioState(
              portfolio,
              participant,
              valuationDate,
              createValueCache(),
            );
            stateDate = valuationDate;
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown refreshed valuation error";
            console.error(
              `[leaderboard] refreshed valuation failed for ${participant.id} (${valuationDate}): ${msg}`,
            );
          }
        }
      }

      if (state) {
        navKrw = state.nav_krw;
        cashKrw = state.cash_krw;
        holdingsKrw = state.holdings_value_krw;
        realizedPnlKrw = state.realized_pnl_krw;
        unrealizedPnlKrw = state.unrealized_pnl_krw;
        totalReturn = startingCash === 0 ? 0 : navKrw / startingCash - 1;
      }

      try {
        turnover20d = await computeTurnover20d({
          portfolioId: portfolio.id,
          date: valuationDate,
          navKrw,
          cache,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown turnover error";
        console.error(
          `[leaderboard] turnover calc failed for ${participant.id} (${valuationDate}): ${msg}`,
        );
      }

      const returnItems: Array<{ symbol: string; label: string; value: number | null }> = [];
      const weightItems: Array<{ symbol: string; label: string; value: number | null }> = [];
      const unrealizedItems: Array<{ symbol: string; label: string; value: number | null }> = [];

      for (const p of state?.positions ?? []) {
        const resolvedMark = resolveUsableMarkPrice(
          await cache.priceOnOrBefore(p.instrument.id, stateDate),
          p.avg_cost_local,
        );
        const close = resolvedMark.value;
        const isUsd = p.instrument.currency === "USD";
        const fx = isUsd ? await cache.fxOnOrBefore(stateDate) : 1;
        if (isUsd && !fx) continue;
        const fxRate = fx ?? 1;
        const valueKrw = p.quantity * close * fxRate;
        const costKrw = p.quantity * p.avg_cost_local * fxRate;
        const ret = p.avg_cost_local > 0 ? close / p.avg_cost_local - 1 : null;
        const weight = navKrw > 0 ? valueKrw / navKrw : null;
        const unrealized = valueKrw - costKrw;

        const label = p.instrument.name || p.instrument.symbol;
        returnItems.push({ symbol: p.instrument.symbol, label, value: ret });
        weightItems.push({ symbol: p.instrument.symbol, label, value: weight });
        unrealizedItems.push({ symbol: p.instrument.symbol, label, value: unrealized });
      }

      topReturn = top3Stats(returnItems);
      topWeight = top3Stats(weightItems);
      topUnrealized = top3Stats(unrealizedItems);

      const spyReturn =
        spyByDate[valuationDate] ?? toNumOrNull(latestSnapshot.spy_return_pct);
      const kospiReturn =
        kospiByDate[valuationDate] ?? toNumOrNull(latestSnapshot.kospi_return_pct);
      const alphaSpyRaw = toNumOrNull(latestSnapshot.alpha_spy_pct);
      const alphaKospiRaw = toNumOrNull(latestSnapshot.alpha_kospi_pct);
      const alphaSpy =
        spyReturn === null ? alphaSpyRaw : totalReturn - spyReturn;
      const alphaKospi =
        kospiReturn === null ? alphaKospiRaw : totalReturn - kospiReturn;

      const leaderboardRow: LeaderboardRow = {
        participant_id: participant.id,
        participant_name: participant.name,
        color_tag: participant.color_tag,
        date: valuationDate,
        nav_krw: navKrw,
        cash_krw: cashKrw,
        holdings_value_krw: holdingsKrw,
        realized_pnl_krw: realizedPnlKrw,
        unrealized_pnl_krw: unrealizedPnlKrw,
        total_return_pct: totalReturn,
        spy_return_pct: spyReturn,
        kospi_return_pct: kospiReturn,
        alpha_spy_pct: alphaSpy,
        alpha_kospi_pct: alphaKospi,
        sharpe_252: toNumOrNull(latestSnapshot.sharpe_252),
        vol_ann_252: toNumOrNull(latestSnapshot.vol_ann_252),
        mdd_to_date: Number(latestSnapshot.mdd_to_date),
        beta_spy_252: toNumOrNull(latestSnapshot.beta_spy_252),
        beta_kospi_252: toNumOrNull(latestSnapshot.beta_kospi_252),
        cash_ratio: navKrw > 0 ? cashKrw / navKrw : null,
        turnover_20d: turnover20d,
      };

      const instrumentsRow: LeaderboardInstrumentsRow = {
        participant_id: participant.id,
        participant_name: participant.name,
        color_tag: participant.color_tag,
        cash_ratio: navKrw > 0 ? cashKrw / navKrw : null,
        turnover_20d: turnover20d,
        top_return: topReturn,
        top_weight: topWeight,
        top_unrealized: topUnrealized,
      };

      return { leaderboardRow, instrumentsRow };
    }),
  );

  const rows: LeaderboardRow[] = computed.map((x) => x.leaderboardRow);
  const instrumentRows: LeaderboardInstrumentsRow[] = computed.map(
    (x) => x.instrumentsRow,
  );

  const sorted = rows.sort((a, b) => {
    if (sortBy === "sharpe") {
      return (b.sharpe_252 ?? Number.NEGATIVE_INFINITY) - (a.sharpe_252 ?? Number.NEGATIVE_INFINITY);
    }
    return b.total_return_pct - a.total_return_pct;
  });

  const order = new Map(sorted.map((x, idx) => [x.participant_id, idx] as const));
  const sortedInstrumentRows = [...instrumentRows].sort(
    (a, b) =>
      (order.get(a.participant_id) ?? Number.POSITIVE_INFINITY) -
      (order.get(b.participant_id) ?? Number.POSITIVE_INFINITY),
  );

  return { date: latestDate, rows: sorted, instrumentRows: sortedInstrumentRows };
}

export async function fetchParticipantDetail(participantId: string) {
  const pair = await getParticipantById(participantId);
  if (!pair) return null;
  const gameStartDate = await getGameStartDate();
  const latestSnapshot = await getParticipantLatestSnapshot(participantId);
  const snapshots = await getParticipantSnapshots(participantId, gameStartDate);
  const [tradeRows, studyIdeas] = await Promise.all([
    getTradesJournal(pair.portfolio.id),
    getStudyTrackerIdeas(),
  ]);
  const notes = await getParticipantNotes(participantId);
  const latestSnapshotDate = latestSnapshot?.date ? String(latestSnapshot.date) : null;
  const latestTradeDate = tradeRows[0]?.trade_date ? String(tradeRows[0].trade_date) : null;
  const valuationDate = [latestSnapshotDate, latestTradeDate]
    .filter((x): x is string => Boolean(x))
    .sort((a, b) => a.localeCompare(b))
    .at(-1) ?? null;

  const studyCallOptions = studyIdeas.map((idea) => ({
    id: idea.id,
    label: [idea.ticker, idea.company_name, idea.presenter, idea.presented_at]
      .filter(Boolean)
      .join(" | "),
  }));
  const ideaMap = new Map(
    studyIdeas.map((idea) => [
      idea.id,
      {
        id: idea.id,
        ticker: idea.ticker,
        company_name: idea.company_name,
        presenter: idea.presenter,
        presented_at: idea.presented_at,
      },
    ]),
  );
  const trades = tradeRows.map((trade: any) => ({
    ...trade,
    source_idea_id:
      trade.source_idea_id === null || trade.source_idea_id === undefined
        ? null
        : Number(trade.source_idea_id),
    linked_call:
      trade.source_idea_id === null || trade.source_idea_id === undefined
        ? null
        : ideaMap.get(Number(trade.source_idea_id)) ?? null,
  }));

  const valuationCache = createValueCache();
  let resolvedValuationDate = valuationDate;
  let liveState: Awaited<ReturnType<typeof rebuildPortfolioState>> | null = null;
  let repairedInstrumentNames = new Map<string, string>();

  if (resolvedValuationDate) {
    try {
      liveState = await rebuildPortfolioState(
        pair.portfolio,
        pair.participant,
        resolvedValuationDate,
        valuationCache,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown valuation error";
      console.error(
        `[participant-detail] live valuation failed for ${participantId} (${resolvedValuationDate}): ${msg}`,
      );
      if (latestSnapshotDate && latestSnapshotDate !== resolvedValuationDate) {
        try {
          liveState = await rebuildPortfolioState(
            pair.portfolio,
            pair.participant,
            latestSnapshotDate,
            valuationCache,
          );
          resolvedValuationDate = latestSnapshotDate;
        } catch (fallbackErr) {
          const fallbackMsg =
            fallbackErr instanceof Error ? fallbackErr.message : "Unknown fallback valuation error";
          console.error(
            `[participant-detail] fallback valuation failed for ${participantId} (${latestSnapshotDate}): ${fallbackMsg}`,
          );
          liveState = null;
          resolvedValuationDate = latestSnapshotDate;
        }
      }
    }
  }

  if (liveState) {
    repairedInstrumentNames = await repairKoreanInstrumentMetadata(
      liveState.positions.map((position) => position.instrument),
    );
  }

  let holdings: any[] = [];
  if (resolvedValuationDate && liveState) {
    holdings = [];
    for (const p of liveState.positions) {
      const usablePoint = await getUsableInstrumentPricePoint(p.instrument, resolvedValuationDate);
      const resolvedMark = resolveUsableMarkPrice(usablePoint.close, p.avg_cost_local);
      const close = resolvedMark.value;
      const fx =
        p.instrument.currency === "USD"
          ? await valuationCache.fxOnOrBefore(resolvedValuationDate)
          : 1;
      const fxRate = fx ?? 1;
      const valueKrw = p.quantity * close * fxRate;
      const pnlKrw = (close - p.avg_cost_local) * p.quantity * fxRate;
      holdings.push({
        symbol: p.instrument.symbol,
        name: repairedInstrumentNames.get(p.instrument.id) ?? p.instrument.name,
        market: p.instrument.market,
        currency: p.instrument.currency,
        quantity: p.quantity,
        avg_cost_local: p.avg_cost_local,
        mark_local: close,
        price_unavailable: usablePoint.close === null || resolvedMark.isFallback,
        value_krw: valueKrw,
        unrealized_pnl_krw: pnlKrw,
      });
    }
  }

  let spy: Awaited<ReturnType<typeof getBenchmarkByCode>> = null;
  let kospi: Awaited<ReturnType<typeof getBenchmarkByCode>> = null;
  try {
    [spy, kospi] = await Promise.all([
      getBenchmarkByCode("SPY"),
      getBenchmarkByCode("KOSPI"),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown benchmark error";
    console.error(`[participant-detail] benchmark lookup failed: ${msg}`);
  }

  let spyByDate: Record<string, number | null> = {};
  let kospiByDate: Record<string, number | null> = {};
  const benchmarkEndDate = resolvedValuationDate ?? latestSnapshotDate;
  if (benchmarkEndDate && spy && kospi) {
    await Promise.all([
      getUsableInstrumentPricePoint(spy, benchmarkEndDate),
      getUsableInstrumentPricePoint(kospi, benchmarkEndDate),
    ]);

    const [spyPrices, kospiPrices] = await Promise.all([
      getBenchmarkPriceSeries(spy.id, "1900-01-01", benchmarkEndDate),
      getBenchmarkPriceSeries(kospi.id, "1900-01-01", benchmarkEndDate),
    ]);
    spyByDate = buildBenchmarkReturnByDate(
      "SPY",
      gameStartDate,
      benchmarkEndDate,
      spyPrices,
    ).returnByDate;
    kospiByDate = buildBenchmarkReturnByDate(
      "KOSPI",
      gameStartDate,
      benchmarkEndDate,
      kospiPrices,
    ).returnByDate;
  }

  let normalizedLatestSnapshot: any = null;
  if (resolvedValuationDate && liveState) {
    const startingCash = Number(pair.participant.starting_cash_krw);
    const totalReturn = startingCash === 0 ? 0 : liveState.nav_krw / startingCash - 1;
    const spyReturn = spyByDate[resolvedValuationDate] ?? null;
    const kospiReturn = kospiByDate[resolvedValuationDate] ?? null;
    const alphaSpy = spyReturn === null ? null : totalReturn - spyReturn;
    const alphaKospi = kospiReturn === null ? null : totalReturn - kospiReturn;
    const isOfficialSnapshotDate =
      latestSnapshot !== null && latestSnapshotDate === resolvedValuationDate;

    normalizedLatestSnapshot = {
      ...latestSnapshot,
      date: resolvedValuationDate,
      nav_krw: liveState.nav_krw,
      cash_krw: liveState.cash_krw,
      holdings_value_krw: liveState.holdings_value_krw,
      realized_pnl_krw: liveState.realized_pnl_krw,
      unrealized_pnl_krw: liveState.unrealized_pnl_krw,
      total_return_pct: totalReturn,
      spy_return_pct: spyReturn,
      kospi_return_pct: kospiReturn,
      alpha_spy_pct: alphaSpy,
      alpha_kospi_pct: alphaKospi,
      sharpe_252:
        isOfficialSnapshotDate && latestSnapshot ? toNumOrNull(latestSnapshot.sharpe_252) : null,
      vol_ann_252:
        isOfficialSnapshotDate && latestSnapshot ? toNumOrNull(latestSnapshot.vol_ann_252) : null,
      mdd_to_date:
        isOfficialSnapshotDate && latestSnapshot ? Number(latestSnapshot.mdd_to_date) : null,
      beta_spy_252:
        isOfficialSnapshotDate && latestSnapshot ? toNumOrNull(latestSnapshot.beta_spy_252) : null,
      beta_kospi_252:
        isOfficialSnapshotDate && latestSnapshot
          ? toNumOrNull(latestSnapshot.beta_kospi_252)
          : null,
    };
  } else if (latestSnapshot) {
    const latestDateKey = latestSnapshot.date as string;
    const totalReturn = Number(latestSnapshot.total_return_pct);
    const spyReturn =
      toNumOrNull(latestSnapshot.spy_return_pct) ?? (spyByDate[latestDateKey] ?? null);
    const kospiReturn =
      toNumOrNull(latestSnapshot.kospi_return_pct) ?? (kospiByDate[latestDateKey] ?? null);
    const alphaSpyRaw = toNumOrNull(latestSnapshot.alpha_spy_pct);
    const alphaKospiRaw = toNumOrNull(latestSnapshot.alpha_kospi_pct);
    const alphaSpy = alphaSpyRaw ?? (spyReturn === null ? null : totalReturn - spyReturn);
    const alphaKospi =
      alphaKospiRaw ?? (kospiReturn === null ? null : totalReturn - kospiReturn);

    normalizedLatestSnapshot = {
      ...latestSnapshot,
      nav_krw: Number(latestSnapshot.nav_krw),
      cash_krw: Number(latestSnapshot.cash_krw),
      holdings_value_krw: Number(latestSnapshot.holdings_value_krw),
      realized_pnl_krw: Number(latestSnapshot.realized_pnl_krw),
      unrealized_pnl_krw: Number(latestSnapshot.unrealized_pnl_krw),
      total_return_pct: totalReturn,
      spy_return_pct: spyReturn,
      kospi_return_pct: kospiReturn,
      alpha_spy_pct: alphaSpy,
      alpha_kospi_pct: alphaKospi,
      sharpe_252: toNumOrNull(latestSnapshot.sharpe_252),
      vol_ann_252: toNumOrNull(latestSnapshot.vol_ann_252),
      mdd_to_date: Number(latestSnapshot.mdd_to_date),
      beta_spy_252: toNumOrNull(latestSnapshot.beta_spy_252),
      beta_kospi_252: toNumOrNull(latestSnapshot.beta_kospi_252),
    };
  }

  return {
    participant: pair.participant,
    portfolio: pair.portfolio,
    latestSnapshot: normalizedLatestSnapshot,
    snapshots: snapshots.map((s: any) => ({
      ...s,
      nav_krw: Number(s.nav_krw),
      cash_krw: Number(s.cash_krw),
      holdings_value_krw: Number(s.holdings_value_krw),
      realized_pnl_krw: Number(s.realized_pnl_krw),
      unrealized_pnl_krw: Number(s.unrealized_pnl_krw),
      total_return_pct: Number(s.total_return_pct),
      ret_daily: s.ret_daily === null ? null : Number(s.ret_daily),
      mdd_to_date: Number(s.mdd_to_date),
    })),
    holdings,
    notes,
    studyCallOptions,
    trades: trades.map((t: any) => ({
      ...t,
      quantity: Number(t.quantity),
      price: Number(t.price),
      fee_rate: t.fee_rate === null ? null : Number(t.fee_rate),
      slippage_bps: t.slippage_bps === null ? null : Number(t.slippage_bps),
    })),
  };
}

export async function fetchParticipantPerformanceSeries(participantId: string) {
  const pair = await getParticipantById(participantId);
  if (!pair) return null;

  const [latestSnapshot, latestTradeDate] = await Promise.all([
    getParticipantLatestSnapshot(participantId),
    getLatestTradeDateForPortfolio(pair.portfolio.id),
  ]);

  const latestSnapshotDate = latestSnapshot?.date ? String(latestSnapshot.date) : null;
  const benchmarkEndDate = [latestSnapshotDate, latestTradeDate]
    .filter((x): x is string => Boolean(x))
    .sort((a, b) => a.localeCompare(b))
    .at(-1) ?? null;
  if (!benchmarkEndDate) return [];

  const tradeRows = await getTradesForPortfolio(pair.portfolio.id, benchmarkEndDate);
  const chartStartDate =
    tradeRows[0]?.trade_date
      ? String(tradeRows[0].trade_date)
      : latestSnapshotDate ?? benchmarkEndDate;
  if (!chartStartDate) return [];
  const seriesStartDate =
    benchmarkHistorySeedStart(benchmarkEndDate) < chartStartDate
      ? benchmarkHistorySeedStart(benchmarkEndDate)
      : chartStartDate;

  let spy: Awaited<ReturnType<typeof getBenchmarkByCode>> = null;
  let kospi: Awaited<ReturnType<typeof getBenchmarkByCode>> = null;
  try {
    [spy, kospi] = await Promise.all([
      getBenchmarkByCode("SPY"),
      getBenchmarkByCode("KOSPI"),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown benchmark error";
    console.error(`[participant-chart] benchmark lookup failed: ${msg}`);
  }

  let spyByDate: Record<string, number | null> = {};
  let kospiByDate: Record<string, number | null> = {};
  if (spy && kospi) {
    const chartDates = dateRange(seriesStartDate, benchmarkEndDate).filter((date) => !isWeekend(date));
    let [spyPrices, kospiPrices] = await Promise.all([
      getBenchmarkPriceSeries(spy.id, "1900-01-01", benchmarkEndDate),
      getBenchmarkPriceSeries(kospi.id, "1900-01-01", benchmarkEndDate),
    ]);

    const spyExactDates = new Set(spyPrices.map((row) => String(row.date)));
    const kospiExactDates = new Set(kospiPrices.map((row) => String(row.date)));
    const missingSpyDates = chartDates.filter((date) => !spyExactDates.has(date));
    const missingKospiDates = chartDates.filter((date) => !kospiExactDates.has(date));

    const [spyRefreshed, kospiRefreshed] = await Promise.all([
      ensureBenchmarkRowsForDates(spy, missingSpyDates),
      ensureBenchmarkRowsForDates(kospi, missingKospiDates),
    ]);

    if (spyRefreshed || kospiRefreshed) {
      [spyPrices, kospiPrices] = await Promise.all([
        getBenchmarkPriceSeries(spy.id, "1900-01-01", benchmarkEndDate),
        getBenchmarkPriceSeries(kospi.id, "1900-01-01", benchmarkEndDate),
      ]);
    }

    spyByDate = buildBenchmarkReturnByDate(
      "SPY",
      seriesStartDate,
      benchmarkEndDate,
      spyPrices,
    ).returnByDate;
    kospiByDate = buildBenchmarkReturnByDate(
      "KOSPI",
      seriesStartDate,
      benchmarkEndDate,
      kospiPrices,
    ).returnByDate;
  }

  const chartSeries = await buildParticipantChartSeries({
    portfolio: pair.portfolio,
    participant: pair.participant,
    tradeRows,
    startDate: seriesStartDate,
    endDate: benchmarkEndDate,
  });

  return chartSeries.map((row) => ({
    ...row,
    spy_indexed:
      spyByDate[row.date] === null || spyByDate[row.date] === undefined
        ? null
        : 100 * (1 + spyByDate[row.date]!),
    kospi_indexed:
      kospiByDate[row.date] === null || kospiByDate[row.date] === undefined
        ? null
        : 100 * (1 + kospiByDate[row.date]!),
  }));
}

export async function fetchParticipantContributionBreakdown(
  participantId: string,
  startDate: string,
  endDate: string,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new Error("startDate/endDate must be YYYY-MM-DD");
  }
  if (startDate > endDate) {
    throw new Error("startDate must be on or before endDate");
  }

  const pair = await getParticipantById(participantId);
  if (!pair) return null;

  const cache = createValueCache();
  const [startState, endState, trades] = await Promise.all([
    rebuildPortfolioState(pair.portfolio, pair.participant, startDate, cache),
    rebuildPortfolioState(pair.portfolio, pair.participant, endDate, cache),
    getTradesForPortfolio(pair.portfolio.id, endDate),
  ]);

  const startNav = startState.nav_krw;

  type Pos = {
    instrument: Instrument;
    quantity: number;
    avg_cost_local: number;
  };

  const startPositions = new Map<string, Pos>(
    startState.positions.map((position) => [position.instrument.id, position]),
  );
  const rollingPositions = new Map<string, Pos>(
    startState.positions.map((position) => [position.instrument.id, { ...position }]),
  );
  const endPositions = new Map<string, Pos>(
    endState.positions.map((position) => [position.instrument.id, position]),
  );

  const netInvestmentByInstrument = new Map<
    string,
    { instrument: Instrument; net_investment_krw: number }
  >();

  for (const trade of trades.filter((row) => row.trade_date > startDate && row.trade_date <= endDate)) {
    const instrument = trade.instruments;
    const existing = rollingPositions.get(instrument.id);
    const prevQty = existing?.quantity ?? 0;

    let qty = Number(trade.quantity);
    if (trade.side === "CLOSE") {
      qty = prevQty;
    }
    if (!(qty > 0)) continue;

    const feeRate = trade.fee_rate ? Number(trade.fee_rate) : 0;
    const slippageBps = trade.slippage_bps ? Number(trade.slippage_bps) : 0;
    const px = Number(trade.price);
    const effectivePrice =
      trade.side === "BUY"
        ? px * (1 + slippageBps / 10_000)
        : px * (1 - slippageBps / 10_000);
    const notionalLocal = qty * effectivePrice;
    const feeLocal = notionalLocal * feeRate;
    const fx = instrument.currency === "USD" ? await cache.fxOnOrBefore(trade.trade_date) : 1;
    const fxRate = fx ?? 1;

    const currentFlow = netInvestmentByInstrument.get(instrument.id) ?? {
      instrument,
      net_investment_krw: 0,
    };

    if (trade.side === "BUY") {
      const grossLocal = notionalLocal + feeLocal;
      currentFlow.net_investment_krw += grossLocal * fxRate;

      const nextQty = prevQty + qty;
      const prevCostLocal = (existing?.avg_cost_local ?? 0) * prevQty;
      const avg = (prevCostLocal + grossLocal) / nextQty;
      rollingPositions.set(instrument.id, {
        instrument,
        quantity: nextQty,
        avg_cost_local: avg,
      });
    } else {
      const netLocal = notionalLocal - feeLocal;
      currentFlow.net_investment_krw -= netLocal * fxRate;

      const avgCost = existing?.avg_cost_local ?? 0;
      const nextQty = prevQty - qty;
      if (nextQty <= 1e-9) {
        rollingPositions.delete(instrument.id);
      } else {
        rollingPositions.set(instrument.id, {
          instrument,
          quantity: nextQty,
          avg_cost_local: avgCost,
        });
      }
    }

    netInvestmentByInstrument.set(instrument.id, currentFlow);
  }

  const instrumentIds = new Set<string>([
    ...startPositions.keys(),
    ...endPositions.keys(),
    ...netInvestmentByInstrument.keys(),
  ]);

  const rows = await Promise.all(
    [...instrumentIds].map(async (instrumentId) => {
      const startPosition = startPositions.get(instrumentId) ?? null;
      const endPosition = endPositions.get(instrumentId) ?? null;
      const flow = netInvestmentByInstrument.get(instrumentId) ?? null;
      const instrument =
        startPosition?.instrument ?? endPosition?.instrument ?? flow?.instrument ?? null;
      if (!instrument) return null;

      const startMark = startPosition
        ? resolveUsableMarkPrice(
            (await getUsableInstrumentPricePoint(instrument, startDate)).close,
            startPosition.avg_cost_local,
          ).value
        : 0;
      const endMark = endPosition
        ? resolveUsableMarkPrice(
            (await getUsableInstrumentPricePoint(instrument, endDate)).close,
            endPosition.avg_cost_local,
          ).value
        : 0;

      const startFx =
        instrument.currency === "USD" ? (await cache.fxOnOrBefore(startDate)) ?? 1 : 1;
      const endFx =
        instrument.currency === "USD" ? (await cache.fxOnOrBefore(endDate)) ?? 1 : 1;

      const startValueKrw = (startPosition?.quantity ?? 0) * startMark * startFx;
      const endValueKrw = (endPosition?.quantity ?? 0) * endMark * endFx;
      const pnlKrw = endValueKrw - startValueKrw - (flow?.net_investment_krw ?? 0);
      const contributionPct = startNav > 0 ? pnlKrw / startNav : null;

      return {
        instrument_id: instrument.id,
        symbol: instrument.symbol,
        label: instrument.name || instrument.symbol,
        pnl_krw: pnlKrw,
        contribution_pct: contributionPct,
      };
    }),
  );

  const validRows = rows
    .filter(
      (row): row is NonNullable<(typeof rows)[number]> =>
        row !== null && Number.isFinite(row.pnl_krw),
    )
    .sort((a, b) => b.pnl_krw - a.pnl_krw);

  return {
    participant_id: pair.participant.id,
    start_date: startDate,
    end_date: endDate,
    start_nav_krw: startNav,
    top: validRows.slice(0, 5),
    bottom: [...validRows].sort((a, b) => a.pnl_krw - b.pnl_krw).slice(0, 5),
  };
}

export async function fetchMissingPriceHoldings(): Promise<MissingPriceHoldingRow[]> {
  const participantRows = await getParticipantsWithPortfolios();
  if (participantRows.length === 0) return [];

  const cache = createValueCache();
  const missingRows = await Promise.all(
    participantRows.map(async ({ participant, portfolio }) => {
      const [latestSnapshot, latestTradeDate] = await Promise.all([
        getParticipantLatestSnapshot(participant.id),
        getLatestTradeDateForPortfolio(portfolio.id),
      ]);

      const snapshotDate = latestSnapshot ? String(latestSnapshot.date) : null;
      const valuationDate =
        [snapshotDate, latestTradeDate]
          .filter((value): value is string => Boolean(value))
          .sort((a, b) => a.localeCompare(b))
          .at(-1) ?? null;

      if (!valuationDate) return [] as MissingPriceHoldingRow[];

      let liveState: Awaited<ReturnType<typeof rebuildPortfolioState>> | null = null;
      let resolvedValuationDate = valuationDate;

      try {
        liveState = await rebuildPortfolioState(portfolio, participant, valuationDate, cache);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown valuation error";
        console.error(
          `[missing-prices] live valuation failed for ${participant.id} (${valuationDate}): ${msg}`,
        );

        if (snapshotDate && snapshotDate !== valuationDate) {
          try {
            liveState = await rebuildPortfolioState(portfolio, participant, snapshotDate, cache);
            resolvedValuationDate = snapshotDate;
          } catch (fallbackErr) {
            const fallbackMsg =
              fallbackErr instanceof Error
                ? fallbackErr.message
                : "Unknown fallback valuation error";
            console.error(
              `[missing-prices] fallback valuation failed for ${participant.id} (${snapshotDate}): ${fallbackMsg}`,
            );
            liveState = null;
          }
        }
      }

      if (!liveState) return [] as MissingPriceHoldingRow[];

      const rows: MissingPriceHoldingRow[] = [];
      for (const position of liveState.positions) {
        const resolvedMark = resolveUsableMarkPrice(
          await cache.priceOnOrBefore(position.instrument.id, resolvedValuationDate),
          position.avg_cost_local,
        );

        if (!resolvedMark.isFallback) continue;

        rows.push({
          participant_id: participant.id,
          participant_name: participant.name,
          color_tag: participant.color_tag,
          valuation_date: resolvedValuationDate,
          symbol: position.instrument.symbol,
          name: position.instrument.name,
          market: position.instrument.market,
          currency: position.instrument.currency,
          quantity: position.quantity,
          avg_cost_local: position.avg_cost_local,
          fallback_mark_local: resolvedMark.value,
        });
      }

      return rows;
    }),
  );

  return missingRows
    .flat()
    .sort((a, b) =>
      a.participant_name.localeCompare(b.participant_name, "ko-KR") ||
      a.symbol.localeCompare(b.symbol, "ko-KR"),
    );
}

export type MissingPriceItem = {
  source: "portfolio" | "study_tracker" | "free_topic";
  source_label: string;
  symbol: string;
  name: string;
  market: Market | null;
  currency: "KRW" | "USD" | null;
  owner_id: string | null;
  owner_label: string | null;
  valuation_date: string | null;
  fallback_value: number | null;
  reason: string | null;
};

function parseFailureList(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export async function fetchMissingPriceOverview(): Promise<{
  uniqueCount: number;
  items: MissingPriceItem[];
}> {
  const [holdingRows, trackerRows, sessionRows, latestRuns] = await Promise.all([
    fetchMissingPriceHoldings(),
    getStudyTrackerIdeas(),
    getStudySessionCompanies(),
    getLatestJobRuns([
      "refresh_study_tracker_prices",
      "refresh_study_session_company_prices",
    ]),
  ]);

  const trackerMap = new Map(
    trackerRows.map((row) => [
      Number(row.id),
      {
        symbol: row.ticker,
        name: row.company_name,
        market: /^\d{6}$/.test(row.ticker.replace(/^KRX:|^KOSDAQ:/, "")) ? ("KR" as const) : ("US" as const),
        currency: row.currency ?? null,
      },
    ]),
  );

  const sessionMap = new Map(
    sessionRows.map((row) => [
      Number(row.id),
      {
        symbol: row.ticker,
        name: row.company_name,
        market: /^\d{6}$/.test(row.ticker.replace(/^KRX:|^KOSDAQ:/, "")) ? ("KR" as const) : ("US" as const),
        currency: row.currency ?? null,
      },
    ]),
  );

  const trackerRun = latestRuns.find((row) => row.job_name === "refresh_study_tracker_prices");
  const freeTopicRun = latestRuns.find((row) => row.job_name === "refresh_study_session_company_prices");

  const items: MissingPriceItem[] = holdingRows.map((row) => ({
    source: "portfolio",
    source_label: "보유 종목",
    symbol: row.symbol,
    name: row.name,
    market: row.market,
    currency: row.currency,
    owner_id: row.participant_id,
    owner_label: row.participant_name,
    valuation_date: row.valuation_date,
    fallback_value: row.fallback_mark_local,
    reason: "실제 시세를 찾지 못해 평균단가로 계산 중입니다.",
  }));

  for (const failure of parseFailureList(trackerRun?.metrics_json?.failure_details)) {
    const ideaId = Number((failure as { idea_id?: unknown }).idea_id);
    const ticker = String((failure as { ticker?: unknown }).ticker ?? "");
    const reason =
      typeof (failure as { reason?: unknown }).reason === "string"
        ? (failure as { reason: string }).reason
        : null;
    const meta = trackerMap.get(ideaId);
    items.push({
      source: "study_tracker",
      source_label: "스터디 정리",
      symbol: meta?.symbol ?? ticker,
      name: meta?.name ?? ticker,
      market: meta?.market ?? null,
      currency: meta?.currency ?? null,
      owner_id: null,
      owner_label: null,
      valuation_date: trackerRun?.target_date ?? null,
      fallback_value: null,
      reason,
    });
  }

  for (const failure of parseFailureList(freeTopicRun?.metrics_json?.failure_details)) {
    const companyId = Number((failure as { company_id?: unknown }).company_id);
    const ticker = String((failure as { ticker?: unknown }).ticker ?? "");
    const reason =
      typeof (failure as { reason?: unknown }).reason === "string"
        ? (failure as { reason: string }).reason
        : null;
    const meta = sessionMap.get(companyId);
    items.push({
      source: "free_topic",
      source_label: "자유 종목",
      symbol: meta?.symbol ?? ticker,
      name: meta?.name ?? ticker,
      market: meta?.market ?? null,
      currency: meta?.currency ?? null,
      owner_id: null,
      owner_label: null,
      valuation_date: freeTopicRun?.target_date ?? null,
      fallback_value: null,
      reason,
    });
  }

  const uniqueCount = new Set(
    items
      .map((item) => `${item.market ?? "-"}:${item.symbol.trim().toUpperCase()}`)
      .filter((value) => value.length > 0),
  ).size;

  return {
    uniqueCount,
    items: items.sort(
      (a, b) =>
        a.symbol.localeCompare(b.symbol, "ko-KR") ||
        a.source_label.localeCompare(b.source_label, "ko-KR"),
    ),
  };
}
