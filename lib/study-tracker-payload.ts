import type { StudyTrackerIdeaInput } from "@/types/study-tracker";

function parseOptionalString(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function parseRequiredString(value: unknown, field: string) {
  const text = parseOptionalString(value);
  if (!text) {
    throw new Error(`${field} is required`);
  }
  return text;
}

function parseOptionalNumber(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`${field} must be a valid number`);
  }
  return n;
}

function parseOptionalDate(value: unknown, field: string) {
  const text = parseOptionalString(value);
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error(`${field} must be YYYY-MM-DD`);
  }
  return text;
}

export function withStudyTrackerHint(message: string) {
  const lower = message.toLowerCase();
  const missingTable =
    lower.includes("study_tracker_ideas") &&
    (lower.includes("does not exist") ||
      lower.includes("relation") ||
      lower.includes("42p01") ||
      lower.includes("schema cache") ||
      lower.includes("could not find table"));
  if (!missingTable) return message;
  return `${message} (Run migrations/0004_study_tracker.sql in Supabase SQL editor.)`;
}

export function normalizeStudyTrackerIdeaPayload(payload: unknown): StudyTrackerIdeaInput {
  const body = (payload ?? {}) as Record<string, unknown>;
  const currency = parseOptionalString(body.currency);
  if (currency !== null && currency !== "KRW" && currency !== "USD") {
    throw new Error("currency must be KRW or USD");
  }

  const currentReturn = parseOptionalNumber(body.current_return_pct, "current_return_pct");
  const closeReturn = parseOptionalNumber(body.close_return_pct, "close_return_pct");
  const trackingReturn = parseOptionalNumber(body.tracking_return_pct, "tracking_return_pct");

  return {
    presented_at: parseOptionalDate(body.presented_at, "presented_at"),
    presenter: parseRequiredString(body.presenter, "presenter"),
    company_name: parseRequiredString(body.company_name, "company_name"),
    ticker: parseRequiredString(body.ticker, "ticker"),
    sector: parseOptionalString(body.sector),
    pitch_price: parseOptionalNumber(body.pitch_price, "pitch_price"),
    target_price: parseOptionalNumber(body.target_price, "target_price"),
    pitch_upside_pct: parseOptionalNumber(body.pitch_upside_pct, "pitch_upside_pct"),
    currency: currency as "KRW" | "USD" | null,
    current_price: parseOptionalNumber(body.current_price, "current_price"),
    current_upside_pct: parseOptionalNumber(body.current_upside_pct, "current_upside_pct"),
    current_return_pct: currentReturn,
    thesis: parseOptionalString(body.thesis),
    trigger: parseOptionalString(body.trigger),
    risk: parseOptionalString(body.risk),
    style: parseOptionalString(body.style),
    status: parseOptionalString(body.status),
    entry_date: parseOptionalDate(body.entry_date, "entry_date"),
    exit_date: parseOptionalDate(body.exit_date, "exit_date"),
    close_return_pct: closeReturn,
    note: parseOptionalString(body.note),
    tracking_return_pct: trackingReturn ?? closeReturn ?? currentReturn,
  };
}
