import type {
  StudyCallFeedbackInput,
  StudyCallUpdateInput,
  StudySessionCompanyInput,
  StudySessionInput,
  StudyTrackerIdeaInput,
} from "@/types/study-tracker";

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

function parseOptionalBoolean(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${field} must be true or false`);
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
  if (missingTable) {
    return "스터디 트래커 기본 테이블이 아직 생성되지 않았습니다. Supabase SQL Editor에서 migrations/0004_study_tracker.sql을 먼저 실행해 주세요.";
  }

  const missingPortfolioColumns =
    lower.includes("study_tracker_ideas") &&
    (lower.includes("is_included") ||
      lower.includes("included_at") ||
      lower.includes("included_price") ||
      lower.includes("position_status") ||
      lower.includes("exited_at") ||
      lower.includes("exited_price") ||
      lower.includes("weight"));
  if (missingPortfolioColumns) {
    return "편입 포트폴리오용 컬럼이 아직 생성되지 않았습니다. Supabase SQL Editor에서 migrations/0005_study_tracker_portfolio.sql을 실행해 주세요.";
  }

  const missingSessionTables =
    (lower.includes("study_sessions") ||
      lower.includes("study_session_companies") ||
      lower.includes("study_call_feedback") ||
      lower.includes("study_call_updates") ||
      lower.includes("source_session_id") ||
      lower.includes("source_coverage_id") ||
      lower.includes("source_idea_id")) &&
    (lower.includes("does not exist") ||
      lower.includes("relation") ||
      lower.includes("42p01") ||
      lower.includes("schema cache") ||
      lower.includes("could not find"));
  if (missingSessionTables) {
    return "산업 발표/피드백/연결 거래용 테이블이 아직 생성되지 않았습니다. Supabase SQL Editor에서 migrations/0006_study_sessions_and_call_links.sql을 실행해 주세요.";
  }

  return message;
}

export function normalizeStudyTrackerIdeaPayload(payload: unknown): StudyTrackerIdeaInput {
  const body = (payload ?? {}) as Record<string, unknown>;
  const currency = parseOptionalString(body.currency);
  if (currency !== null && currency !== "KRW" && currency !== "USD") {
    throw new Error("currency must be KRW or USD");
  }

  const currentReturn = parseOptionalNumber(body.current_return_pct, "current_return_pct");
  const closeReturn = parseOptionalNumber(body.close_return_pct, "close_return_pct");
  const positionStatus = parseOptionalString(body.position_status);
  if (positionStatus !== null && positionStatus !== "active" && positionStatus !== "closed") {
    throw new Error("position_status must be active or closed");
  }
  const callDirection = parseOptionalString(body.call_direction);
  if (callDirection !== null && !["long", "avoid", "watch"].includes(callDirection)) {
    throw new Error("call_direction must be long, avoid, or watch");
  }
  const weight = parseOptionalNumber(body.weight, "weight");
  if (weight !== null && weight <= 0) {
    throw new Error("weight must be greater than 0");
  }
  const convictionScore = parseOptionalNumber(body.conviction_score, "conviction_score");
  if (
    convictionScore !== null &&
    (!Number.isInteger(convictionScore) || convictionScore < 1 || convictionScore > 5)
  ) {
    throw new Error("conviction_score must be an integer between 1 and 5");
  }

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
    tracking_return_pct: currentReturn,
    is_included: parseOptionalBoolean(body.is_included, "is_included"),
    included_at: parseOptionalDate(body.included_at, "included_at"),
    included_price: parseOptionalNumber(body.included_price, "included_price"),
    weight,
    position_status: positionStatus as "active" | "closed" | null,
    exited_at: parseOptionalDate(body.exited_at, "exited_at"),
    exited_price: parseOptionalNumber(body.exited_price, "exited_price"),
    source_session_id: parseOptionalNumber(body.source_session_id, "source_session_id"),
    source_coverage_id: parseOptionalNumber(body.source_coverage_id, "source_coverage_id"),
    call_direction: callDirection as "long" | "avoid" | "watch" | null,
    conviction_score: convictionScore,
    invalidation_rule: parseOptionalString(body.invalidation_rule),
    time_horizon: parseOptionalString(body.time_horizon),
  };
}

export function normalizeStudySessionPayload(payload: unknown): StudySessionInput {
  const body = (payload ?? {}) as Record<string, unknown>;
  return {
    presented_at: parseRequiredString(parseOptionalDate(body.presented_at, "presented_at"), "presented_at"),
    presenter: parseRequiredString(body.presenter, "presenter"),
    industry_name: parseRequiredString(body.industry_name, "industry_name"),
    title: parseRequiredString(body.title, "title"),
    thesis: parseOptionalString(body.thesis),
    anti_thesis: parseOptionalString(body.anti_thesis),
    note: parseOptionalString(body.note),
  };
}

export function normalizeStudySessionCompanyPayload(
  payload: unknown,
  sessionId?: number,
): StudySessionCompanyInput {
  const body = (payload ?? {}) as Record<string, unknown>;
  const sessionStance = parseOptionalString(body.session_stance);
  if (sessionStance !== null && !["bullish", "watch", "neutral", "avoid"].includes(sessionStance)) {
    throw new Error("session_stance must be bullish, watch, neutral, or avoid");
  }
  const followUpStatus = parseOptionalString(body.follow_up_status);
  if (
    followUpStatus !== null &&
    !["waiting_event", "ready_for_call", "dropped", "converted"].includes(followUpStatus)
  ) {
    throw new Error("follow_up_status is invalid");
  }
  const parsedSessionId = parseOptionalNumber(body.session_id, "session_id");
  const resolvedSessionId = sessionId ?? parsedSessionId;
  if (!resolvedSessionId || !Number.isInteger(resolvedSessionId) || resolvedSessionId < 1) {
    throw new Error("session_id is required");
  }
  return {
    session_id: resolvedSessionId,
    company_name: parseRequiredString(body.company_name, "company_name"),
    ticker: parseRequiredString(body.ticker, "ticker"),
    sector: parseOptionalString(body.sector),
    session_stance: (sessionStance as "bullish" | "watch" | "neutral" | "avoid" | null) ?? "watch",
    mention_reason: parseOptionalString(body.mention_reason),
    follow_up_status:
      (followUpStatus as "waiting_event" | "ready_for_call" | "dropped" | "converted" | null) ??
      "waiting_event",
    next_event_date: parseOptionalDate(body.next_event_date, "next_event_date"),
    note: parseOptionalString(body.note),
  };
}

export function normalizeStudyCallFeedbackPayload(payload: unknown): StudyCallFeedbackInput {
  const body = (payload ?? {}) as Record<string, unknown>;
  const stance = parseRequiredString(body.stance, "stance");
  if (!["agree", "neutral", "disagree"].includes(stance)) {
    throw new Error("stance must be agree, neutral, or disagree");
  }
  return {
    participant_id: parseRequiredString(body.participant_id, "participant_id"),
    stance: stance as "agree" | "neutral" | "disagree",
    note: parseOptionalString(body.note),
  };
}

export function normalizeStudyCallUpdatePayload(payload: unknown): StudyCallUpdateInput {
  const body = (payload ?? {}) as Record<string, unknown>;
  const updateType = parseOptionalString(body.update_type);
  if (
    updateType !== null &&
    !["update", "catalyst", "risk", "postmortem"].includes(updateType)
  ) {
    throw new Error("update_type must be update, catalyst, risk, or postmortem");
  }
  return {
    update_type: (updateType as "update" | "catalyst" | "risk" | "postmortem" | null) ?? "update",
    title: parseOptionalString(body.title),
    body: parseRequiredString(body.body, "body"),
    created_by: parseOptionalString(body.created_by),
  };
}
