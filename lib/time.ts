import { SEOUL_TIMEZONE } from "@/lib/constants";

function partsAt(timeZone: string, date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, m, d] = fmt.format(date).split("-");
  return { y: Number(y), m: Number(m), d: Number(d) };
}

export function todayInSeoul(date = new Date()): string {
  const p = partsAt(SEOUL_TIMEZONE, date);
  return `${p.y.toString().padStart(4, "0")}-${p.m
    .toString()
    .padStart(2, "0")}-${p.d.toString().padStart(2, "0")}`;
}

export function yesterdayInSeoul(date = new Date()): string {
  const p = partsAt(SEOUL_TIMEZONE, date);
  const utc = new Date(Date.UTC(p.y, p.m - 1, p.d));
  utc.setUTCDate(utc.getUTCDate() - 1);
  return utc.toISOString().slice(0, 10);
}

export function addDays(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dateRange(startIso: string, endIso: string): string[] {
  if (startIso > endIso) {
    return [];
  }
  const dates: string[] = [];
  let cur = startIso;
  while (cur <= endIso) {
    dates.push(cur);
    cur = addDays(cur, 1);
  }
  return dates;
}
