import type { Market } from "@/types/db";
import type { MarketDataProvider } from "@/lib/providers/types";

const BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const RETRY_DELAYS_MS = [300, 900];

function isTransientFetchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const text = err.message.toLowerCase();
  return (
    text.includes("econnreset") ||
    text.includes("und_err_socket") ||
    text.includes("fetch failed") ||
    text.includes("socket")
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toUnixSeconds(dateIso: string, addDays: number) {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + addDays);
  return Math.floor(d.getTime() / 1000);
}

function dateInTimeZone(epochMs: number, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(epochMs));
}

function unique(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const s = v.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function symbolCandidates(symbol: string, market: Market): string[] {
  if (market === "US") {
    return unique([symbol, symbol.toUpperCase()]);
  }
  if (market === "KR") {
    return unique([`${symbol}.KS`, `${symbol}.KQ`, symbol]);
  }
  if (market === "INDEX" && symbol === "KS11") {
    return unique(["^KS11", "KS11"]);
  }
  return unique([symbol]);
}

async function fetchChart(symbol: string, targetDate: string) {
  const period1 = toUnixSeconds(targetDate, -180);
  const period2 = toUnixSeconds(targetDate, 2);
  const url =
    `${BASE_URL}/${encodeURIComponent(symbol)}` +
    `?interval=1d&period1=${period1}&period2=${period2}&events=div,splits`;
  let lastError: unknown = null;

  for (let i = 0; i <= RETRY_DELAYS_MS.length; i += 1) {
    try {
      const res = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        return null;
      }
      return (await res.json()) as Record<string, unknown>;
    } catch (err) {
      lastError = err;
      const shouldRetry = i < RETRY_DELAYS_MS.length && isTransientFetchError(err);
      if (!shouldRetry) {
        throw err;
      }
      await sleep(RETRY_DELAYS_MS[i]);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown fetch error");
}

function parseCloseOnOrBefore(
  json: Record<string, unknown>,
  targetDate: string,
): number | null {
  const chart = json.chart as Record<string, unknown> | undefined;
  const result = Array.isArray(chart?.result) ? chart?.result?.[0] : null;
  if (!result || typeof result !== "object") return null;

  const ts = Array.isArray((result as any).timestamp)
    ? ((result as any).timestamp as unknown[])
    : [];
  const quote = (result as any).indicators?.quote?.[0];
  const close = Array.isArray(quote?.close) ? (quote.close as unknown[]) : [];
  const exchangeTz =
    ((result as any).meta?.exchangeTimezoneName as string | undefined) ?? "UTC";

  const n = Math.min(ts.length, close.length);
  for (let i = n - 1; i >= 0; i -= 1) {
    const epoch = Number(ts[i]);
    const c = Number(close[i]);
    if (!Number.isFinite(epoch) || !Number.isFinite(c)) continue;
    const d = dateInTimeZone(epoch * 1000, exchangeTz);
    if (d <= targetDate) {
      return c;
    }
  }
  return null;
}

export class YahooMarketDataProvider implements MarketDataProvider {
  async getDailyClose(symbol: string, market: Market, date: string) {
    const candidates = symbolCandidates(symbol, market);
    let lastError: string | null = null;

    for (const candidate of candidates) {
      const json = await fetchChart(candidate, date);
      if (!json) {
        lastError = `[Yahoo] No response for ${candidate}`;
        continue;
      }
      const close = parseCloseOnOrBefore(json, date);
      if (close !== null && Number.isFinite(close)) {
        return close;
      }
      lastError = `[Yahoo] ${candidate}: no close on/before ${date}`;
    }

    if (lastError) {
      throw new Error(lastError);
    }
    return null;
  }

  async getFxRate(pair: string, date: string) {
    if (pair !== "USDKRW") return null;
    const json = await fetchChart("KRW=X", date);
    if (!json) {
      throw new Error("[Yahoo] KRW=X: no response");
    }
    const close = parseCloseOnOrBefore(json, date);
    if (close === null || !Number.isFinite(close)) {
      throw new Error(`[Yahoo] KRW=X: no close on/before ${date}`);
    }
    return close;
  }
}
