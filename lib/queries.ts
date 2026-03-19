import { buildBenchmarkReturnByDate } from "@/lib/benchmarks";
import {
  getBenchmarkByCode,
  getLatestJobRuns,
  getParticipantNotes,
  getStudySessionCompanies,
  getStudyTrackerIdeas,
  getBenchmarkPriceSeries,
  getParticipantsWithPortfolios,
  getGameStartDate,
  getParticipantById,
  getParticipantLatestSnapshot,
  getLatestTradeDateForPortfolio,
  getParticipantSnapshots,
  getTradesForPortfolio,
  getPriceOnOrBefore,
  getTradesJournal,
  getFxOnOrBefore,
} from "@/lib/db";
import { createValueCache, rebuildPortfolioState } from "@/lib/engine/snapshot";
import { addDays } from "@/lib/time";
import type {
  LeaderboardInstrumentsRow,
  LeaderboardRow,
  Market,
  MissingPriceHoldingRow,
  RankedInstrumentStat,
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

  const latestSnapshotDate = latestSnapshot?.date ? String(latestSnapshot.date) : null;
  const latestTradeDate = trades[0]?.trade_date ? String(trades[0].trade_date) : null;
  const valuationDate = [latestSnapshotDate, latestTradeDate]
    .filter((x): x is string => Boolean(x))
    .sort((a, b) => a.localeCompare(b))
    .at(-1) ?? null;

  const valuationCache = createValueCache();
  let resolvedValuationDate = valuationDate;
  let liveState: Awaited<ReturnType<typeof rebuildPortfolioState>> | null = null;

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

  let holdings: any[] = [];
  if (resolvedValuationDate && liveState) {
    holdings = [];
    for (const p of liveState.positions) {
      const resolvedMark = resolveUsableMarkPrice(
        await valuationCache.priceOnOrBefore(p.instrument.id, resolvedValuationDate),
        p.avg_cost_local,
      );
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
        name: p.instrument.name,
        market: p.instrument.market,
        currency: p.instrument.currency,
        quantity: p.quantity,
        avg_cost_local: p.avg_cost_local,
        mark_local: close,
        price_unavailable: resolvedMark.isFallback,
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

  const navBase = Number(pair.participant.starting_cash_krw);
  let peak = Number.NEGATIVE_INFINITY;
  const chartSeries = snapshots
    .filter((s: any) => !isWeekend(String(s.date)))
    .map((s: any) => {
    const d = s.date as string;
    const nav = Number(s.nav_krw);
    if (nav > peak) peak = nav;
    const drawdown = nav / peak - 1;
    const indexedNav = navBase === 0 ? 100 : (nav / navBase) * 100;
    const indexedSpy = spyByDate[d] === null || spyByDate[d] === undefined ? null : 100 * (1 + spyByDate[d]!);
    const indexedKospi =
      kospiByDate[d] === null || kospiByDate[d] === undefined ? null : 100 * (1 + kospiByDate[d]!);
    return {
      date: d,
      nav_indexed: indexedNav,
      spy_indexed: indexedSpy,
      kospi_indexed: indexedKospi,
      drawdown,
    };
    });

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
    chartSeries,
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
