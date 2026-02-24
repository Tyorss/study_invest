import {
  hasNonEmptyEnv,
  parseRequestedMarketDataProviders,
  type MarketDataProviderName,
} from "@/lib/env";
import { TwelveDataProvider } from "@/lib/providers/twelve-data-provider";
import { YahooMarketDataProvider } from "@/lib/providers/yahoo-provider";
import type { MarketDataProvider } from "@/lib/providers/types";

export interface ProviderHandle {
  requestedProvider: MarketDataProviderName;
  provider: MarketDataProvider | null;
  initError: string | null;
}

export interface ProviderRegistryResolution {
  rawInput: string;
  invalidValues: string[];
  handles: ProviderHandle[];
}

let cached: ProviderRegistryResolution | null = null;

function buildProviderHandle(requestedProvider: MarketDataProviderName): ProviderHandle {
  if (requestedProvider === "TWELVE") {
    if (!hasNonEmptyEnv("TWELVE_DATA_API_KEY")) {
      return {
        requestedProvider,
        provider: null,
        initError: "TWELVE_DATA_API_KEY is missing for TWELVE provider.",
      };
    }
    return {
      requestedProvider,
      provider: new TwelveDataProvider(),
      initError: null,
    };
  }

  if (requestedProvider === "YAHOO") {
    return {
      requestedProvider,
      provider: new YahooMarketDataProvider(),
      initError: null,
    };
  }

  return {
    requestedProvider,
    provider: null,
    initError: `Provider '${requestedProvider}' is not implemented yet.`,
  };
}

export function resolveMarketDataProviders(): ProviderRegistryResolution {
  if (cached) return cached;
  const parsed = parseRequestedMarketDataProviders();
  if (parsed.invalidValues.length > 0) {
    throw new Error(
      `[MarketDataProvider] Invalid provider token(s): ${parsed.invalidValues.join(
        ", ",
      )}. Allowed values: TWELVE, YAHOO, ALPHA (REAL alias = TWELVE).`,
    );
  }
  const handles = parsed.providers.map(buildProviderHandle);

  cached = {
    rawInput: parsed.rawInput,
    invalidValues: parsed.invalidValues,
    handles,
  };
  return cached;
}

export function getMarketDataProvider(): MarketDataProvider {
  const resolved = resolveMarketDataProviders();
  const first = resolved.handles.find((h) => h.provider !== null)?.provider;
  if (!first) {
    const reasons = resolved.handles
      .map((h) => `${h.requestedProvider}: ${h.initError ?? "no provider instance"}`)
      .join("; ");
    throw new Error(`[MarketDataProvider] No available providers. ${reasons}`);
  }
  return first;
}
