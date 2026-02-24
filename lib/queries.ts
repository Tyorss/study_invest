import { buildBenchmarkReturnByDate } from "@/lib/benchmarks";
import {
  getBenchmarkByCode,
  getParticipantNotes,
  getBenchmarkPriceSeries,
  getParticipantsWithPortfolios,
  getGameStartDate,
  getParticipantById,
  getParticipantLatestSnapshot,
  getParticipantSnapshots,
  getTradesForPortfolio,
  getPriceOnOrBefore,
  getTradesJournal,
  getFxOnOrBefore,
} from "@/lib/db";
import { createValueCache, rebuildPortfolioState } from "@/lib/engine/snapshot";
import { addDays } from "@/lib/time";
import type { LeaderboardInstrumentsRow, LeaderboardRow, RankedInstrumentStat } from "@/types/db";

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
  items: Array<{ symbol: string; value: number | null }>,
): RankedInstrumentStat[] {
  return items
    .filter((x): x is { symbol: string; value: number } => x.value !== null)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((x) => ({ symbol: x.symbol, value: x.value }));
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
      .map((x) => String(x.latestSnapshot.date))
      .sort((a, b) => a.localeCompare(b))
      .at(-1) ?? null;

  const cache = createValueCache();

  const computed = await Promise.all(
    withSnapshot.map(async ({ participant, portfolio, latestSnapshot }) => {
      const snapshotDate = String(latestSnapshot.date);
      const totalReturn = Number(latestSnapshot.total_return_pct);
      const spyReturn = toNumOrNull(latestSnapshot.spy_return_pct);
      const kospiReturn = toNumOrNull(latestSnapshot.kospi_return_pct);
      const alphaSpyRaw = toNumOrNull(latestSnapshot.alpha_spy_pct);
      const alphaKospiRaw = toNumOrNull(latestSnapshot.alpha_kospi_pct);
      const alphaSpy = alphaSpyRaw ?? (spyReturn === null ? null : totalReturn - spyReturn);
      const alphaKospi =
        alphaKospiRaw ?? (kospiReturn === null ? null : totalReturn - kospiReturn);

      const navKrw = Number(latestSnapshot.nav_krw);
      const cashKrw = Number(latestSnapshot.cash_krw);
      const holdingsKrw = Number(latestSnapshot.holdings_value_krw);

      let turnover20d: number | null = null;
      let topReturn: RankedInstrumentStat[] = [];
      let topWeight: RankedInstrumentStat[] = [];
      let topUnrealized: RankedInstrumentStat[] = [];
      const state = await rebuildPortfolioState(
        portfolio,
        participant,
        snapshotDate,
        cache,
      );
      turnover20d = await computeTurnover20d({
        portfolioId: portfolio.id,
        date: snapshotDate,
        navKrw,
        cache,
      });

      const returnItems: Array<{ symbol: string; value: number | null }> = [];
      const weightItems: Array<{ symbol: string; value: number | null }> = [];
      const unrealizedItems: Array<{ symbol: string; value: number | null }> = [];

      for (const p of state.positions) {
        const close =
          (await cache.priceOnOrBefore(p.instrument.id, snapshotDate)) ?? p.avg_cost_local;
        const isUsd = p.instrument.currency === "USD";
        const fx = isUsd ? await cache.fxOnOrBefore(snapshotDate) : 1;
        if (isUsd && !fx) continue;
        const fxRate = fx ?? 1;
        const valueKrw = p.quantity * close * fxRate;
        const costKrw = p.quantity * p.avg_cost_local * fxRate;
        const ret = p.avg_cost_local > 0 ? close / p.avg_cost_local - 1 : null;
        const weight = navKrw > 0 ? valueKrw / navKrw : null;
        const unrealized = valueKrw - costKrw;

        returnItems.push({ symbol: p.instrument.symbol, value: ret });
        weightItems.push({ symbol: p.instrument.symbol, value: weight });
        unrealizedItems.push({ symbol: p.instrument.symbol, value: unrealized });
      }

      topReturn = top3Stats(returnItems);
      topWeight = top3Stats(weightItems);
      topUnrealized = top3Stats(unrealizedItems);

      const leaderboardRow: LeaderboardRow = {
        participant_id: participant.id,
        participant_name: participant.name,
        color_tag: participant.color_tag,
        date: snapshotDate,
        nav_krw: navKrw,
        cash_krw: cashKrw,
        holdings_value_krw: holdingsKrw,
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
  const trades = await getTradesJournal(pair.portfolio.id);
  const notes = await getParticipantNotes(participantId);

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
      const close =
        (await valuationCache.priceOnOrBefore(p.instrument.id, resolvedValuationDate)) ??
        p.avg_cost_local;
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
