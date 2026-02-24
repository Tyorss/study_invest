export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getOptionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export type MarketDataProviderName = "TWELVE" | "ALPHA" | "YAHOO";

export function hasNonEmptyEnv(name: string) {
  return Boolean(process.env[name]?.trim());
}

export interface ProviderParseResult {
  rawInput: string;
  providers: MarketDataProviderName[];
  invalidValues: string[];
}

function mapProviderToken(token: string): MarketDataProviderName | null {
  const t = token.trim().toUpperCase();
  if (!t) return null;
  if (t === "REAL") return "TWELVE";
  if (t === "TWELVE") return "TWELVE";
  if (t === "YAHOO") return "YAHOO";
  if (t === "ALPHA") return "ALPHA";
  return null;
}

function uniqueProviders(values: MarketDataProviderName[]) {
  const seen = new Set<MarketDataProviderName>();
  const out: MarketDataProviderName[] = [];
  for (const v of values) {
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export function parseRequestedMarketDataProviders(): ProviderParseResult {
  const chainRaw = process.env.MARKET_DATA_PROVIDERS?.trim();
  const singleRaw = process.env.MARKET_DATA_PROVIDER?.trim();
  const rawInput = chainRaw || singleRaw || "TWELVE";
  const tokens = rawInput.split(",").map((x) => x.trim()).filter(Boolean);

  const providers: MarketDataProviderName[] = [];
  const invalidValues: string[] = [];

  for (const token of tokens) {
    const mapped = mapProviderToken(token);
    if (mapped) {
      providers.push(mapped);
    } else {
      invalidValues.push(token);
    }
  }

  const normalized = uniqueProviders(providers);
  return {
    rawInput,
    providers: normalized.length ? normalized : ["TWELVE"],
    invalidValues,
  };
}
