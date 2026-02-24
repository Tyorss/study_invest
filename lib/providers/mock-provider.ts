import type { Market } from "@/types/db";
import type { MarketDataProvider } from "@/lib/providers/types";

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function baseForSymbol(symbol: string, market: Market): number {
  const h = hash(`${market}:${symbol}`);
  if (market === "US") return 50 + (h % 450);
  if (symbol === "KS11") return 2500 + (h % 500);
  return 20_000 + (h % 200_000);
}

export class MockMarketDataProvider implements MarketDataProvider {
  async getDailyClose(symbol: string, market: Market, date: string) {
    const base = baseForSymbol(symbol, market);
    const day = hash(date) % 60;
    const seasonal = Math.sin(day / 6) * 0.02;
    const drift = (hash(`${symbol}:${date}`) % 200 - 100) / 10000;
    const price = base * (1 + seasonal + drift);
    return Math.max(price, 1);
  }

  async getFxRate(pair: string, date: string) {
    if (pair !== "USDKRW") return null;
    const day = hash(date) % 45;
    const noise = (hash(`fx:${date}`) % 100 - 50) / 100;
    return 1275 + day * 1.2 + noise;
  }
}
