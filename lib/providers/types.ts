import type { Market } from "@/types/db";

export interface DailyClosePoint {
  date: string;
  close: number;
}

export interface MarketDataProvider {
  getDailyClose(
    symbol: string,
    market: Market,
    date: string,
    providerSymbol?: string,
  ): Promise<number | null>;
  getDailyClosePoint?(
    symbol: string,
    market: Market,
    date: string,
    providerSymbol?: string,
  ): Promise<DailyClosePoint | null>;
  getFxRate(pair: string, date: string): Promise<number | null>;
}
