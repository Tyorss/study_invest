import { addDays, dateRange } from "@/lib/time";

export interface BenchmarkSeries {
  symbol: string;
  returnByDate: Record<string, number | null>;
}

interface PricePoint {
  date: string;
  close: number;
}

function buildCloseLookup(prices: PricePoint[]) {
  const map = new Map<string, number>();
  for (const p of prices) {
    map.set(p.date, p.close);
  }
  return map;
}

export function buildBenchmarkReturnByDate(
  symbol: string,
  startDate: string,
  endDate: string,
  rawPrices: { date: string; close: string | number }[],
): BenchmarkSeries {
  const prices = rawPrices
    .map((p) => ({ date: p.date, close: Number(p.close) }))
    .filter((p) => Number.isFinite(p.close))
    .sort((a, b) => a.date.localeCompare(b.date));

  const closeMap = buildCloseLookup(prices);
  const dates = dateRange(startDate, endDate);

  let lastClose: number | null = null;
  for (const p of prices) {
    if (p.date <= startDate) {
      lastClose = p.close;
    } else {
      break;
    }
  }
  const carriedClose = new Map<string, number | null>();
  for (const d of dates) {
    const c = closeMap.get(d);
    if (c !== undefined) lastClose = c;
    carriedClose.set(d, lastClose);
  }

  const base = carriedClose.get(startDate) ?? null;
  const returnByDate: Record<string, number | null> = {};

  for (const d of dates) {
    const c = carriedClose.get(d) ?? null;
    if (base === null || c === null || base === 0) {
      returnByDate[d] = null;
      continue;
    }
    returnByDate[d] = c / base - 1;
  }

  return { symbol, returnByDate };
}

export function benchmarkDailyReturns(
  dates: string[],
  cumulativeByDate: Record<string, number | null>,
): Array<number | null> {
  const result: Array<number | null> = [];
  for (let i = 1; i < dates.length; i += 1) {
    const prev = cumulativeByDate[dates[i - 1]];
    const cur = cumulativeByDate[dates[i]];
    if (prev === null || prev === undefined || cur === null || cur === undefined) {
      result.push(null);
      continue;
    }
    result.push((1 + cur) / (1 + prev) - 1);
  }
  return result;
}

export function oneDayBefore(date: string) {
  return addDays(date, -1);
}
