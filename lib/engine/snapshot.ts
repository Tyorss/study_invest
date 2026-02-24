import {
  DEFAULTS,
  DEFAULT_GAME_START_DATE,
  FX_PAIR_USDKRW,
  STARTING_CASH_KRW,
} from "@/lib/constants";
import {
  getFxOnOrBefore,
  getParticipantSnapshots,
  getPriceOnOrBefore,
  getTradesForPortfolio,
} from "@/lib/db";
import { benchmarkDailyReturns } from "@/lib/benchmarks";
import { mean, olsBeta, rollingWindow, sampleStdDev } from "@/lib/stats";
import type { DailySnapshot, Instrument, Participant, Portfolio } from "@/types/db";

interface PositionState {
  instrument: Instrument;
  quantity: number;
  avg_cost_local: number;
}

interface PortfolioState {
  cash_krw: number;
  realized_pnl_krw: number;
  holdings_value_krw: number;
  unrealized_pnl_krw: number;
  nav_krw: number;
  positions: PositionState[];
}

interface BenchmarksCtx {
  spyReturnByDate: Record<string, number | null>;
  kospiReturnByDate: Record<string, number | null>;
}

class ValueCache {
  private readonly price = new Map<string, number | null>();
  private readonly fx = new Map<string, number | null>();

  async priceOnOrBefore(instrumentId: string, date: string): Promise<number | null> {
    const key = `${instrumentId}:${date}`;
    if (this.price.has(key)) return this.price.get(key) ?? null;
    const value = await getPriceOnOrBefore(instrumentId, date);
    this.price.set(key, value);
    return value;
  }

  async fxOnOrBefore(date: string): Promise<number | null> {
    const key = `${FX_PAIR_USDKRW}:${date}`;
    if (this.fx.has(key)) return this.fx.get(key) ?? null;
    const value = await getFxOnOrBefore(FX_PAIR_USDKRW, date);
    this.fx.set(key, value);
    return value;
  }
}

function marketDefaults() {
  return { feeRate: 0, slippageBps: 0 };
}

function calcVolSharpe(returns: number[]) {
  if (returns.length < DEFAULTS.MIN_OBS) {
    return { vol: null, sharpe: null };
  }
  const std = sampleStdDev(returns);
  if (std === 0) return { vol: 0, sharpe: null };
  const vol = std * Math.sqrt(252);
  const sharpe = (mean(returns) * 252) / (std * Math.sqrt(252));
  return { vol, sharpe };
}

function calcMdd(navSeries: number[]) {
  let peak = Number.NEGATIVE_INFINITY;
  let minDrawdown = 0;
  for (const nav of navSeries) {
    if (nav > peak) peak = nav;
    const dd = nav / peak - 1;
    if (dd < minDrawdown) minDrawdown = dd;
  }
  return minDrawdown;
}

export async function rebuildPortfolioState(
  portfolio: Portfolio,
  participant: Participant,
  snapshotDate: string,
  cache: ValueCache,
): Promise<PortfolioState> {
  const trades = await getTradesForPortfolio(portfolio.id, snapshotDate);
  const startingCash = Number(participant.starting_cash_krw ?? STARTING_CASH_KRW);

  let cashKrw = startingCash;
  let realizedPnlKrw = 0;
  const positions = new Map<string, PositionState>();

  for (const trade of trades) {
    const instrument = trade.instruments;
    const defaults = marketDefaults();
    const feeRate = trade.fee_rate ? Number(trade.fee_rate) : defaults.feeRate;
    const slippageBps = trade.slippage_bps
      ? Number(trade.slippage_bps)
      : defaults.slippageBps;
    const side = trade.side;

    const existing = positions.get(instrument.id);
    const prevQty = existing?.quantity ?? 0;

    let qty = Number(trade.quantity);
    if (side === "CLOSE") {
      qty = prevQty;
    }

    if (!(qty > 0)) {
      throw new Error(`Invalid quantity for trade ${trade.id}`);
    }

    if ((side === "SELL" || side === "CLOSE") && qty > prevQty + 1e-9) {
      throw new Error(`Sell/CLOSE exceeds position for trade ${trade.id}`);
    }

    const px = Number(trade.price);
    const effectivePrice =
      side === "BUY" ? px * (1 + slippageBps / 10_000) : px * (1 - slippageBps / 10_000);

    const notionalLocal = qty * effectivePrice;
    const feeLocal = notionalLocal * feeRate;
    const isUsd = instrument.currency === "USD";
    const fx = isUsd ? await cache.fxOnOrBefore(trade.trade_date) : 1;
    if (isUsd && !fx) {
      throw new Error(`Missing USDKRW FX for ${trade.trade_date}`);
    }
    const fxRate = fx ?? 1;

    if (side === "BUY") {
      const grossLocal = notionalLocal + feeLocal;
      const grossKrw = grossLocal * fxRate;
      if (cashKrw - grossKrw < -1e-6) {
        throw new Error(`Insufficient cash for trade ${trade.id}`);
      }
      cashKrw -= grossKrw;

      const nextQty = prevQty + qty;
      const prevCostLocal = (existing?.avg_cost_local ?? 0) * prevQty;
      const avg = (prevCostLocal + grossLocal) / nextQty;
      positions.set(instrument.id, {
        instrument,
        quantity: nextQty,
        avg_cost_local: avg,
      });
    } else {
      const netLocal = notionalLocal - feeLocal;
      const netKrw = netLocal * fxRate;
      cashKrw += netKrw;

      const avgCost = existing?.avg_cost_local ?? 0;
      const realizedLocal = netLocal - avgCost * qty;
      realizedPnlKrw += realizedLocal * fxRate;

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
  let unrealizedPnlKrw = 0;
  const outPositions: PositionState[] = [];

  for (const pos of positions.values()) {
    const px =
      (await cache.priceOnOrBefore(pos.instrument.id, snapshotDate)) ?? pos.avg_cost_local;
    const isUsd = pos.instrument.currency === "USD";
    const fx = isUsd ? await cache.fxOnOrBefore(snapshotDate) : 1;
    if (isUsd && !fx) {
      throw new Error(`Missing USDKRW FX for ${snapshotDate}`);
    }
    const fxRate = fx ?? 1;

    const valueLocal = pos.quantity * px;
    const costLocal = pos.quantity * pos.avg_cost_local;
    holdingsValueKrw += valueLocal * fxRate;
    unrealizedPnlKrw += (valueLocal - costLocal) * fxRate;
    outPositions.push(pos);
  }

  const nav = cashKrw + holdingsValueKrw;

  return {
    cash_krw: cashKrw,
    realized_pnl_krw: realizedPnlKrw,
    holdings_value_krw: holdingsValueKrw,
    unrealized_pnl_krw: unrealizedPnlKrw,
    nav_krw: nav,
    positions: outPositions,
  };
}

async function computeRiskMetrics(
  participantId: string,
  date: string,
  navToday: number,
  benchmarks: BenchmarksCtx,
  gameStartDate: string,
  startingCash: number,
) {
  const past = await getParticipantSnapshots(participantId, gameStartDate);
  const history = past.filter((s) => s.date < date);

  const dates = history.map((x) => x.date);
  const navSeries = history.map((x) => Number(x.nav_krw));

  if ((history.length === 0 || history[0].date > gameStartDate) && date > gameStartDate) {
    dates.unshift(gameStartDate);
    navSeries.unshift(startingCash);
  }

  dates.push(date);
  navSeries.push(navToday);
  const retSeries: number[] = [];
  for (let i = 1; i < navSeries.length; i += 1) {
    retSeries.push(navSeries[i] / navSeries[i - 1] - 1);
  }

  const retDaily = retSeries.length ? retSeries[retSeries.length - 1] : null;
  const retWindow = rollingWindow(retSeries, DEFAULTS.ROLLING_WINDOW);
  const { vol, sharpe } = calcVolSharpe(retWindow);
  const mdd = calcMdd(navSeries);

  const spyDaily = benchmarkDailyReturns(dates, benchmarks.spyReturnByDate);
  const kospiDaily = benchmarkDailyReturns(dates, benchmarks.kospiReturnByDate);

  function betaFor(benchDaily: Array<number | null>) {
    const p: number[] = [];
    const b: number[] = [];
    for (let i = 0; i < retSeries.length; i += 1) {
      const rb = benchDaily[i];
      if (rb === null || rb === undefined) continue;
      p.push(retSeries[i]);
      b.push(rb);
    }
    const wp = rollingWindow(p, DEFAULTS.ROLLING_WINDOW);
    const wb = rollingWindow(b, DEFAULTS.ROLLING_WINDOW);
    if (wp.length < DEFAULTS.MIN_OBS || wb.length < DEFAULTS.MIN_OBS) {
      return null;
    }
    return olsBeta(wp, wb);
  }

  return {
    ret_daily: retDaily,
    vol_ann_252: vol,
    sharpe_252: sharpe,
    mdd_to_date: mdd,
    beta_spy_252: betaFor(spyDaily),
    beta_kospi_252: betaFor(kospiDaily),
  };
}

export async function buildDailySnapshot(params: {
  participant: Participant;
  portfolio: Portfolio;
  date: string;
  benchmarks: BenchmarksCtx;
  gameStartDate?: string;
  cache?: ValueCache;
}) {
  const gameStartDate = params.gameStartDate ?? DEFAULT_GAME_START_DATE;
  const cache = params.cache ?? new ValueCache();

  const state = await rebuildPortfolioState(
    params.portfolio,
    params.participant,
    params.date,
    cache,
  );

  const startingCash = Number(params.participant.starting_cash_krw ?? STARTING_CASH_KRW);
  const totalReturn = state.nav_krw / startingCash - 1;
  const spyRet = params.benchmarks.spyReturnByDate[params.date] ?? null;
  const kospiRet = params.benchmarks.kospiReturnByDate[params.date] ?? null;

  const risk = await computeRiskMetrics(
    params.participant.id,
    params.date,
    state.nav_krw,
    params.benchmarks,
    gameStartDate,
    startingCash,
  );

  const snapshot: DailySnapshot = {
    participant_id: params.participant.id,
    portfolio_id: params.portfolio.id,
    date: params.date,
    nav_krw: state.nav_krw,
    cash_krw: state.cash_krw,
    holdings_value_krw: state.holdings_value_krw,
    realized_pnl_krw: state.realized_pnl_krw,
    unrealized_pnl_krw: state.unrealized_pnl_krw,
    total_return_pct: totalReturn,
    spy_return_pct: spyRet,
    kospi_return_pct: kospiRet,
    alpha_spy_pct: spyRet === null ? null : totalReturn - spyRet,
    alpha_kospi_pct: kospiRet === null ? null : totalReturn - kospiRet,
    ret_daily: risk.ret_daily,
    vol_ann_252: risk.vol_ann_252,
    sharpe_252: risk.sharpe_252,
    mdd_to_date: risk.mdd_to_date,
    beta_spy_252: risk.beta_spy_252,
    beta_kospi_252: risk.beta_kospi_252,
  };

  return {
    snapshot,
    positions: state.positions.map((p) => ({
      instrument_id: p.instrument.id,
      symbol: p.instrument.symbol,
      name: p.instrument.name,
      market: p.instrument.market,
      currency: p.instrument.currency,
      quantity: p.quantity,
      avg_cost_local: p.avg_cost_local,
    })),
  };
}

export function createValueCache() {
  return new ValueCache();
}
