import type { Market } from "@/types/db";

const KRX_HOLIDAYS_2026 = new Set([
  "2026-01-01",
  "2026-02-16",
  "2026-02-17",
  "2026-02-18",
  "2026-03-02",
  "2026-05-05",
  "2026-05-25",
  "2026-10-05",
  "2026-10-09",
  "2026-12-25",
]);

const US_HOLIDAYS_2026 = new Set([
  "2026-01-01",
  "2026-01-19",
  "2026-02-16",
  "2026-04-03",
  "2026-05-25",
  "2026-06-19",
  "2026-07-03",
  "2026-09-07",
  "2026-11-26",
  "2026-12-25",
]);

function parseHolidayEnv(name: string): Set<string> {
  const raw = process.env[name]?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((x) => x.trim())
      .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)),
  );
}

function marketTimezone(market: Market): string {
  return market === "US" ? "America/New_York" : "Asia/Seoul";
}

function marketSessionMinutes(market: Market): { open: number; close: number } {
  if (market === "US") {
    return { open: 9 * 60 + 30, close: 16 * 60 };
  }
  return { open: 9 * 60, close: 15 * 60 + 30 };
}

function datePartsInTz(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  function pick(type: string) {
    return Number(parts.find((p) => p.type === type)?.value ?? "0");
  }

  const y = pick("year");
  const m = pick("month");
  const d = pick("day");
  const hour = pick("hour");
  const minute = pick("minute");

  return {
    date: `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(
      2,
      "0",
    )}`,
    minutes: hour * 60 + minute,
  };
}

function isWeekend(date: string): boolean {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6;
}

export function isMarketHoliday(date: string, market: Market): boolean {
  const extra =
    market === "US" ? parseHolidayEnv("MARKET_HOLIDAYS_US") : parseHolidayEnv("MARKET_HOLIDAYS_KR");
  const builtIn = market === "US" ? US_HOLIDAYS_2026 : KRX_HOLIDAYS_2026;
  return builtIn.has(date) || extra.has(date);
}

export function isMarketBusinessDay(date: string, market: Market): boolean {
  if (isWeekend(date)) return false;
  if (isMarketHoliday(date, market)) return false;
  return true;
}

export function nextMarketBusinessDay(date: string, market: Market): string {
  const cur = new Date(`${date}T00:00:00Z`);
  for (let i = 0; i < 10; i += 1) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    const next = cur.toISOString().slice(0, 10);
    if (isMarketBusinessDay(next, market)) return next;
  }
  throw new Error(`Unable to find next business day from ${date} (${market})`);
}

export function validateMarketSession(params: {
  market: Market;
  tradeDate: string;
  orderType: "MARKET" | "LIMIT" | "STOP";
  now?: Date;
}): { ok: boolean; reason?: string; todayMarketDate: string; withinSession: boolean } {
  const now = params.now ?? new Date();
  const tz = marketTimezone(params.market);
  const nowParts = datePartsInTz(now, tz);
  const session = marketSessionMinutes(params.market);
  const withinSession = nowParts.minutes >= session.open && nowParts.minutes <= session.close;

  if (!isMarketBusinessDay(params.tradeDate, params.market)) {
    return {
      ok: false,
      reason: `trade_date ${params.tradeDate} is not a trading day for ${params.market}`,
      todayMarketDate: nowParts.date,
      withinSession,
    };
  }

  if (params.tradeDate > nowParts.date) {
    return {
      ok: false,
      reason: `trade_date ${params.tradeDate} cannot be in the future`,
      todayMarketDate: nowParts.date,
      withinSession,
    };
  }

  if (params.tradeDate === nowParts.date && params.orderType === "MARKET" && !withinSession) {
    return {
      ok: false,
      reason: `market is closed now (${params.market}); submit within regular session hours`,
      todayMarketDate: nowParts.date,
      withinSession,
    };
  }

  return {
    ok: true,
    todayMarketDate: nowParts.date,
    withinSession,
  };
}
