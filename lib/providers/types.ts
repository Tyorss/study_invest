import type { Market } from "@/types/db";

export interface MarketDataProvider {
  getDailyClose(
    symbol: string,
    market: Market,
    date: string,
    providerSymbol?: string,
  ): Promise<number | null>;
  getFxRate(pair: string, date: string): Promise<number | null>;
}
