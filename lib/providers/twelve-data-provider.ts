import type { Market } from "@/types/db";
import { getRequiredEnv } from "@/lib/env";
import type { MarketDataProvider } from "@/lib/providers/types";

const BASE_URL = "https://api.twelvedata.com";
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

function defaultSymbol(symbol: string, market: Market): string {
  if (market === "KR") return `${symbol}:KRX`;
  if (market === "INDEX" && symbol === "KS11") return "KS11";
  return symbol;
}

function uniqueSymbols(values: Array<string | undefined | null>) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const s = (v ?? "").trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function usAliases(symbol: string, market: Market): string[] {
  if (market !== "US") return [];
  return [
    symbol,
    `${symbol}:NASDAQ`,
    `${symbol}:NYSE`,
    `${symbol}:NYSEARCA`,
    `${symbol}:ARCA`,
    `${symbol}:AMEX`,
  ];
}

async function getJson(path: string, params: URLSearchParams) {
  const url = `${BASE_URL}${path}?${params.toString()}`;
  let lastError: unknown = null;

  for (let i = 0; i <= RETRY_DELAYS_MS.length; i += 1) {
    try {
      const res = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return null;
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

function extractDate(datetime: unknown): string | null {
  if (typeof datetime !== "string" || datetime.length < 10) return null;
  const date = datetime.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function parseDailyCloseOnOrBefore(
  json: Record<string, unknown>,
  targetDate: string,
): number | null {
  const values = json.values;
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  for (const item of values) {
    const row = item as Record<string, unknown>;
    const rowDate = extractDate(row.datetime);
    if (!rowDate) continue;
    if (rowDate > targetDate) continue;
    const close = Number(row.close);
    if (Number.isFinite(close)) {
      return close;
    }
  }
  return null;
}

export class TwelveDataProvider implements MarketDataProvider {
  private readonly apiKey: string;

  constructor() {
    this.apiKey = getRequiredEnv("TWELVE_DATA_API_KEY");
  }

  async getDailyClose(
    symbol: string,
    market: Market,
    date: string,
    providerSymbol?: string,
  ) {
    const defaults = [providerSymbol, defaultSymbol(symbol, market)];
    const ks11Aliases =
      market === "INDEX" && symbol === "KS11"
        ? ["KS11", "KOSPI", "KOSPI Composite Index"]
        : [];
    const candidates = uniqueSymbols([...defaults, ...usAliases(symbol, market), ...ks11Aliases]);
    let lastError: string | null = null;

    for (const candidate of candidates) {
      const params = new URLSearchParams({
        symbol: candidate,
        interval: "1day",
        end_date: date,
        order: "DESC",
        outputsize: "120",
        apikey: this.apiKey,
      });
      const json = await getJson("/time_series", params);
      if (!json) {
        lastError = `[TwelveData] No response for ${candidate}`;
        continue;
      }
      if (json.status === "error") {
        const msg =
          typeof json.message === "string" ? json.message : "Unknown provider error";
        lastError = `[TwelveData] ${candidate}: ${msg}`;
        continue;
      }
      const close = parseDailyCloseOnOrBefore(json, date);
      if (close !== null) {
        return close;
      }
      lastError = `[TwelveData] ${candidate}: no close on/before ${date}`;
    }

    if (lastError) {
      throw new Error(lastError);
    }
    return null;
  }

  async getFxRate(pair: string, date: string) {
    if (pair !== "USDKRW") return null;
    const params = new URLSearchParams({
      symbol: "USD/KRW",
      interval: "1day",
      end_date: date,
      order: "DESC",
      outputsize: "120",
      apikey: this.apiKey,
    });
    const json = await getJson("/time_series", params);
    if (!json) {
      throw new Error("[TwelveData] USD/KRW: no response");
    }
    if (json.status === "error") {
      const msg =
        typeof json.message === "string" ? json.message : "Unknown provider error";
      throw new Error(`[TwelveData] USD/KRW: ${msg}`);
    }
    return parseDailyCloseOnOrBefore(json, date);
  }
}
