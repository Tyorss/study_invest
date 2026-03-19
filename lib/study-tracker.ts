import {
  getBenchmarkByCode,
  getInstrumentBySymbol,
  getParticipantsList,
  getPricePointOnOrBefore,
  getStudyCallFeedbackRows,
  getStudyCallUpdateRows,
  getStudyLinkedTrades,
  getStudySessionCompanies,
  getStudySessions,
  getStudyTrackerIdeas,
} from "@/lib/db";
import { todayInSeoul } from "@/lib/time";
import type {
  StudyCallFeedback,
  StudyCallUpdate,
  StudySession,
  StudySessionCompany,
  StudySessionCompanyInput,
  StudySessionCompanyRow,
  StudySessionData,
  StudySessionRow,
  StudyTrackerBenchmarkCode,
  StudyTrackerData,
  StudyTrackerIdea,
  StudyTrackerIdeaInput,
  StudyTrackerIdeaRow,
  StudyTrackerLinkedTrade,
  StudyTrackerPortfolioData,
  StudyTrackerPortfolioSummary,
  StudyTrackerSummary,
} from "@/types/study-tracker";

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function ratioFrom(endValue: number | null, startValue: number | null) {
  if (endValue === null || startValue === null || startValue <= 0) return null;
  return endValue / startValue - 1;
}

function inferCallDirection(
  targetPrice: number | null,
  basePrice: number | null,
  storedDirection: string | null,
) {
  const diff = ratioFrom(targetPrice, basePrice);
  if (diff !== null) {
    if (Math.abs(diff) <= 0.1) return "neutral" as const;
    return diff > 0 ? ("long" as const) : ("short" as const);
  }
  if (storedDirection === "long" || storedDirection === "neutral" || storedDirection === "short") {
    return storedDirection;
  }
  return "neutral" as const;
}

function resolveEffectiveTargetStatus(
  targetStatus: string | null,
): "active" | "target_hit" | "revising" | "upgraded" | "downgraded" | "trim_or_hold" | "closed" | "invalidated" {
  if (
    targetStatus === "active" ||
    targetStatus === "target_hit" ||
    targetStatus === "revising" ||
    targetStatus === "upgraded" ||
    targetStatus === "downgraded" ||
    targetStatus === "trim_or_hold" ||
    targetStatus === "closed" ||
    targetStatus === "invalidated"
  ) {
    return targetStatus;
  }
  return "active";
}

export function computeStudyTrackerPortfolioReturn(idea: {
  is_included: boolean;
  included_price: number | null;
  current_price: number | null;
  exited_price: number | null;
  position_status: "active" | "closed" | null;
}) {
  if (!idea.is_included) return null;
  const basis = idea.included_price;
  const mark =
    idea.position_status === "closed" ? idea.exited_price ?? null : idea.current_price ?? null;
  return ratioFrom(mark, basis);
}

function sortUnique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((v): v is string => Boolean(v?.trim())).map((v) => v.trim()))].sort(
    (a, b) => a.localeCompare(b, "ko-KR"),
  );
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeWeight(weight: number | null) {
  return weight !== null && Number.isFinite(weight) && weight > 0 ? weight : 1;
}

export function mapStudySessionCompany(row: StudySessionCompanyRow): StudySessionCompany {
  return {
    id: row.id,
    session_id: row.session_id,
    company_name: row.company_name,
    ticker: row.ticker,
    sector: row.sector ?? null,
    target_price: toNumber(row.target_price),
    reference_price: toNumber(row.reference_price),
    reference_price_date: row.reference_price_date ?? null,
    current_price: toNumber(row.current_price),
    currency: row.currency ?? null,
    session_stance: row.session_stance,
    mention_reason: row.mention_reason ?? null,
    follow_up_status: row.follow_up_status,
    next_event_date: row.next_event_date ?? null,
    note: row.note ?? null,
    converted_call_count: 0,
  };
}

export function mapStudySession(row: StudySessionRow): StudySession {
  return {
    id: row.id,
    presented_at: row.presented_at,
    presenter: row.presenter,
    industry_name: row.industry_name,
    title: row.title,
    thesis: row.thesis ?? null,
    anti_thesis: row.anti_thesis ?? null,
    note: row.note ?? null,
    companies: [],
    covered_count: 0,
    converted_count: 0,
    adoption_count: 0,
  };
}

export function toStudySessionCompanyInput(company: StudySessionCompany): StudySessionCompanyInput {
  return {
    session_id: company.session_id,
    company_name: company.company_name,
    ticker: company.ticker,
    sector: company.sector,
    target_price: company.target_price,
    reference_price: company.reference_price,
    reference_price_date: company.reference_price_date,
    current_price: company.current_price,
    currency: company.currency,
    session_stance: company.session_stance,
    mention_reason: company.mention_reason,
    follow_up_status: company.follow_up_status,
    next_event_date: company.next_event_date,
    note: company.note,
  };
}

function mapLinkedTrade(row: Awaited<ReturnType<typeof getStudyLinkedTrades>>[number]): StudyTrackerLinkedTrade {
  return {
    id: row.id,
    source_idea_id: row.source_idea_id,
    participant_id: row.participant_id,
    participant_name: row.participant_name,
    trade_date: row.trade_date,
    side: row.side,
    quantity: Number(row.quantity),
    price: Number(row.price),
    note: row.note ?? null,
    symbol: row.symbol ?? null,
  };
}

export function mapStudyTrackerIdea(row: StudyTrackerIdeaRow): StudyTrackerIdea {
  const pitchPrice = toNumber(row.pitch_price);
  const targetPrice = toNumber(row.target_price);
  const currentTargetPrice = toNumber(row.current_target_price);
  const effectiveTargetPrice = currentTargetPrice ?? targetPrice;
  const effectiveTargetStatus = resolveEffectiveTargetStatus(row.target_status);
  const includedPrice = toNumber(row.included_price);
  const currentPrice = toNumber(row.current_price);
  const exitedPrice = toNumber(row.exited_price);
  const closeReturn = toNumber(row.close_return_pct);
  const currentReturn = ratioFrom(currentPrice, pitchPrice);
  const currentUpside = ratioFrom(effectiveTargetPrice, currentPrice);
  const pitchUpside = ratioFrom(targetPrice, pitchPrice);
  const remainingUpside = ratioFrom(effectiveTargetPrice, currentPrice);
  const inferredIncluded =
    Boolean(row.is_included) ||
    ((!row.included_at &&
      !row.included_price &&
      !row.position_status &&
      !row.exited_at &&
      !row.exited_price) &&
      (row.status === "편입" || row.status === "전량청산"));
  const positionStatus =
    row.position_status ??
    (row.status === "전량청산" ? "closed" : inferredIncluded ? "active" : null);
  const resolvedIncludedPrice = inferredIncluded ? includedPrice ?? pitchPrice : null;
  const resolvedIncludedAt = inferredIncluded
    ? row.included_at ?? row.entry_date ?? row.presented_at
    : null;
  const resolvedExitedAt =
    positionStatus === "closed" ? row.exited_at ?? row.exit_date ?? null : null;
  const needsTargetUpdate =
    currentPrice !== null &&
    effectiveTargetPrice !== null &&
    currentPrice >= effectiveTargetPrice &&
    effectiveTargetStatus === "active";

  return {
    id: row.id,
    presented_at: row.presented_at ?? null,
    presenter: row.presenter,
    company_name: row.company_name,
    ticker: row.ticker,
    sector: row.sector ?? null,
    pitch_price: pitchPrice,
    target_price: targetPrice,
    current_target_price: currentTargetPrice,
    effective_target_price: effectiveTargetPrice,
    target_status: row.target_status ?? null,
    effective_target_status: effectiveTargetStatus,
    target_updated_at: row.target_updated_at ?? null,
    target_note: row.target_note ?? null,
    remaining_upside_pct: remainingUpside,
    needs_target_update: needsTargetUpdate,
    pitch_upside_pct: pitchUpside,
    currency: row.currency ?? null,
    current_price: currentPrice,
    current_upside_pct: currentUpside,
    current_return_pct: currentReturn,
    thesis: row.thesis ?? null,
    trigger: row.trigger ?? null,
    risk: row.risk ?? null,
    style: row.style ?? null,
    status: row.status ?? null,
    entry_date: row.entry_date ?? null,
    exit_date: row.exit_date ?? null,
    close_return_pct: closeReturn,
    note: row.note ?? null,
    tracking_return_pct: currentReturn,
    is_included: inferredIncluded,
    included_at: resolvedIncludedAt,
    included_price: resolvedIncludedPrice,
    weight: toNumber(row.weight),
    position_status: positionStatus,
    exited_at: resolvedExitedAt,
    exited_price: exitedPrice,
    portfolio_return_pct: computeStudyTrackerPortfolioReturn({
      is_included: inferredIncluded,
      included_price: resolvedIncludedPrice,
      current_price: currentPrice,
      exited_price: exitedPrice,
      position_status: positionStatus,
    }),
    source_session_id: row.source_session_id ?? null,
    source_coverage_id: row.source_coverage_id ?? null,
    call_direction: inferCallDirection(effectiveTargetPrice, pitchPrice, row.call_direction),
    conviction_score: row.conviction_score ?? null,
    invalidation_rule: row.invalidation_rule ?? null,
    time_horizon: row.time_horizon ?? null,
    source_session: null,
    source_coverage: null,
    feedbacks: [],
    updates: [],
    linked_trades: [],
    feedback_count: 0,
    update_count: 0,
    linked_trade_count: 0,
    adoption_count: 0,
  };
}

export function toStudyTrackerIdeaInput(idea: StudyTrackerIdea): StudyTrackerIdeaInput {
  return {
    presented_at: idea.presented_at,
    presenter: idea.presenter,
    company_name: idea.company_name,
    ticker: idea.ticker,
    sector: idea.sector,
    pitch_price: idea.pitch_price,
    target_price: idea.target_price,
    current_target_price: idea.current_target_price,
    target_status: idea.target_status,
    target_updated_at: idea.target_updated_at,
    target_note: idea.target_note,
    pitch_upside_pct: idea.pitch_upside_pct,
    currency: idea.currency,
    current_price: idea.current_price,
    current_upside_pct: idea.current_upside_pct,
    current_return_pct: idea.current_return_pct,
    thesis: idea.thesis,
    trigger: idea.trigger,
    risk: idea.risk,
    style: idea.style,
    status: idea.status,
    entry_date: idea.entry_date,
    exit_date: idea.exit_date,
    close_return_pct: idea.close_return_pct,
    note: idea.note,
    tracking_return_pct: idea.tracking_return_pct,
    is_included: idea.is_included,
    included_at: idea.included_at,
    included_price: idea.included_price,
    weight: idea.weight,
    position_status: idea.position_status,
    exited_at: idea.exited_at,
    exited_price: idea.exited_price,
    source_session_id: idea.source_session_id,
    source_coverage_id: idea.source_coverage_id,
    call_direction: idea.call_direction,
    conviction_score: idea.conviction_score,
    invalidation_rule: idea.invalidation_rule,
    time_horizon: idea.time_horizon,
  };
}

async function loadStudyTrackerContext() {
  const [
    ideaRows,
    sessionRows,
    companyRows,
    feedbackRows,
    updateRows,
    linkedTradeRows,
    participants,
  ] = await Promise.all([
    getStudyTrackerIdeas(),
    getStudySessions(),
    getStudySessionCompanies(),
    getStudyCallFeedbackRows(),
    getStudyCallUpdateRows(),
    getStudyLinkedTrades(),
    getParticipantsList(),
  ]);

  const participantMap = new Map(participants.map((row) => [row.id, row.name]));
  const sessionMap = new Map<number, StudySession>();
  for (const row of sessionRows) {
    sessionMap.set(row.id, mapStudySession(row));
  }

  const companyMap = new Map<number, StudySessionCompany>();
  for (const row of companyRows) {
    const company = mapStudySessionCompany(row);
    companyMap.set(company.id, company);
    const session = sessionMap.get(company.session_id);
    if (session) {
      session.companies.push(company);
    }
  }

  const ideas = ideaRows.map(mapStudyTrackerIdea);
  const ideaMap = new Map(ideas.map((idea) => [idea.id, idea]));

  for (const idea of ideas) {
    if (idea.source_session_id !== null) {
      idea.source_session = sessionMap.get(idea.source_session_id) ?? null;
    }
    if (idea.source_coverage_id !== null) {
      const coverage = companyMap.get(idea.source_coverage_id) ?? null;
      idea.source_coverage = coverage;
      if (coverage) {
        coverage.converted_call_count += 1;
      }
    }
  }

  for (const row of feedbackRows) {
    const idea = ideaMap.get(row.idea_id);
    if (!idea) continue;
    const feedback: StudyCallFeedback = {
      id: row.id,
      participant_id: row.participant_id,
      participant_name: participantMap.get(row.participant_id) ?? row.participant_id,
      stance: row.stance,
      note: row.note ?? null,
      created_at: row.created_at,
    };
    idea.feedbacks.push(feedback);
  }

  for (const row of updateRows) {
    const idea = ideaMap.get(row.idea_id);
    if (!idea) continue;
    const update: StudyCallUpdate = {
      id: row.id,
      update_type: row.update_type,
      title: row.title ?? null,
      body: row.body,
      created_by: row.created_by ?? null,
      created_at: row.created_at,
    };
    idea.updates.push(update);
  }

  for (const row of linkedTradeRows) {
    const idea = ideaMap.get(row.source_idea_id);
    if (!idea) continue;
    idea.linked_trades.push(mapLinkedTrade(row));
  }

  for (const idea of ideas) {
    idea.feedbacks.sort((a, b) => b.created_at.localeCompare(a.created_at));
    idea.updates.sort((a, b) => b.created_at.localeCompare(a.created_at));
    idea.linked_trades.sort((a, b) => b.trade_date.localeCompare(a.trade_date));
    idea.feedback_count = idea.feedbacks.length;
    idea.update_count = idea.updates.length;
    idea.linked_trade_count = idea.linked_trades.length;
    idea.adoption_count = new Set(idea.linked_trades.map((trade) => trade.participant_id)).size;
  }

  for (const session of sessionMap.values()) {
    session.companies.sort((a, b) => a.company_name.localeCompare(b.company_name, "ko-KR"));
    session.covered_count = session.companies.length;
    const callsFromSession = ideas.filter((idea) => idea.source_session_id === session.id);
    session.converted_count = callsFromSession.length;
    session.adoption_count = new Set(
      callsFromSession.flatMap((idea) => idea.linked_trades.map((trade) => trade.participant_id)),
    ).size;
  }

  return {
    ideas,
    sessions: [...sessionMap.values()].sort((a, b) => {
      if (a.presented_at === b.presented_at) return b.id - a.id;
      return b.presented_at.localeCompare(a.presented_at);
    }),
    participants,
  };
}

function buildSummary(ideas: StudyTrackerIdea[]): StudyTrackerSummary {
  const trackingReturns = ideas
    .map((idea) => idea.tracking_return_pct)
    .filter((value): value is number => value !== null);
  const sortedByReturn = [...ideas]
    .filter((idea) => idea.tracking_return_pct !== null)
    .sort(
      (a, b) =>
        (b.tracking_return_pct ?? Number.NEGATIVE_INFINITY) -
        (a.tracking_return_pct ?? Number.NEGATIVE_INFINITY),
    );
  const mostFollowedCall = [...ideas].sort((a, b) => b.adoption_count - a.adoption_count)[0] ?? null;
  const mostDiscussedCall = [...ideas].sort((a, b) => b.feedback_count - a.feedback_count)[0] ?? null;

  return {
    totalIdeas: ideas.length,
    activeIdeas: ideas.filter((idea) => idea.status === "편입" || idea.status === "검토중").length,
    closedIdeas: ideas.filter((idea) => idea.status === "전량청산").length,
    avgTrackingReturnPct: average(trackingReturns),
    bestIdea: sortedByReturn[0] ?? null,
    worstIdea: sortedByReturn.at(-1) ?? null,
    adoptedCalls: ideas.filter((idea) => idea.adoption_count > 0).length,
    mostFollowedCall,
    mostDiscussedCall,
    callsFromSessions: ideas.filter((idea) => idea.source_session_id !== null).length,
  };
}

function buildPortfolioSummary(ideas: StudyTrackerIdea[]): StudyTrackerPortfolioSummary {
  const included = ideas.filter((idea) => idea.is_included);
  const valid = included.filter((idea) => idea.portfolio_return_pct !== null);
  const returns = valid
    .map((idea) => idea.portfolio_return_pct)
    .filter((value): value is number => value !== null);

  const totalWeight = valid.reduce((sum, idea) => sum + normalizeWeight(idea.weight), 0);
  const weighted = valid.map((idea) => {
    const weight = normalizeWeight(idea.weight);
    const contribution =
      totalWeight > 0 && idea.portfolio_return_pct !== null
        ? (idea.portfolio_return_pct * weight) / totalWeight
        : Number.NEGATIVE_INFINITY;
    return { idea, contribution };
  });

  const sortedByContribution = [...weighted].sort((a, b) => b.contribution - a.contribution);

  return {
    includedIdeas: included.length,
    portfolioReturnPct:
      totalWeight > 0
        ? valid.reduce((sum, idea) => {
            const weight = normalizeWeight(idea.weight);
            return sum + ((idea.portfolio_return_pct ?? 0) * weight) / totalWeight;
          }, 0)
        : null,
    avgPositionReturnPct: average(returns),
    bestContributor: sortedByContribution[0]?.idea ?? null,
    worstContributor: sortedByContribution.at(-1)?.idea ?? null,
  };
}

function buildSessionSummary(sessions: StudySessionData["sessions"]): StudySessionData["summary"] {
  const sortedByConversion = [...sessions].sort((a, b) => b.converted_count - a.converted_count);
  return {
    totalSessions: sessions.length,
    totalCoveredCompanies: sessions.reduce((sum, session) => sum + session.covered_count, 0),
    totalConvertedCalls: sessions.reduce((sum, session) => sum + session.converted_count, 0),
    topSessionByConversion: sortedByConversion[0] ?? null,
  };
}

export async function fetchStudyTrackerData(): Promise<StudyTrackerData> {
  const { ideas, participants } = await loadStudyTrackerContext();

  return {
    ideas,
    statuses: sortUnique(ideas.map((idea) => idea.status)),
    sectors: sortUnique(ideas.map((idea) => idea.sector)),
    styles: sortUnique(ideas.map((idea) => idea.style)),
    presenters: sortUnique(ideas.map((idea) => idea.presenter)),
    participants,
    summary: buildSummary(ideas),
  };
}

export async function fetchStudySessionData(): Promise<StudySessionData> {
  const { sessions, participants } = await loadStudyTrackerContext();
  return {
    sessions,
    participants,
    summary: buildSessionSummary(sessions),
  };
}

export async function fetchStudyTrackerCallOptions() {
  const rows = await getStudyTrackerIdeas();
  return rows.map((row) => ({
    id: row.id,
    label: [row.ticker, row.company_name, row.presenter, row.presented_at]
      .filter(Boolean)
      .join(" | "),
  }));
}

const BENCHMARK_LABELS: Record<StudyTrackerBenchmarkCode, string> = {
  NASDAQ: "Nasdaq (QQQ)",
  SPY: "SPY",
  KOSPI: "KOSPI",
};

async function getBenchmarkInstrument(code: StudyTrackerBenchmarkCode) {
  if (code === "SPY") return getBenchmarkByCode("SPY");
  if (code === "KOSPI") return getBenchmarkByCode("KOSPI");
  return getInstrumentBySymbol("QQQ");
}

async function getBenchmarkReturnPct(
  code: StudyTrackerBenchmarkCode,
  fromDate: string,
  toDate: string,
) {
  const instrument = await getBenchmarkInstrument(code);
  if (!instrument) return null;
  const [fromPoint, toPoint] = await Promise.all([
    getPricePointOnOrBefore(instrument.id, fromDate),
    getPricePointOnOrBefore(instrument.id, toDate),
  ]);
  if (!fromPoint || !toPoint || fromPoint.close <= 0) return null;
  return toPoint.close / fromPoint.close - 1;
}

function determinePeriod(ideas: StudyTrackerIdea[], fromDate?: string, toDate?: string) {
  const includedDates = ideas
    .map((idea) => idea.included_at)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => a.localeCompare(b));
  const fallbackFrom = includedDates[0] ?? todayInSeoul();
  const fallbackTo = todayInSeoul();
  return {
    from: fromDate ?? fallbackFrom,
    to: toDate ?? fallbackTo,
  };
}

export async function fetchStudyTrackerPortfolioData(options?: {
  fromDate?: string;
  toDate?: string;
  benchmark?: StudyTrackerBenchmarkCode;
}): Promise<StudyTrackerPortfolioData> {
  const { ideas: allIdeas } = await loadStudyTrackerContext();
  const includedIdeas = allIdeas.filter((idea) => idea.is_included);
  const period = determinePeriod(includedIdeas, options?.fromDate, options?.toDate);
  const benchmark = options?.benchmark ?? "SPY";
  const ideas = includedIdeas.filter((idea) => {
    if (!idea.included_at) return true;
    return idea.included_at >= period.from && idea.included_at <= period.to;
  });
  const summary = buildPortfolioSummary(ideas);
  const benchmarkReturnPct = await getBenchmarkReturnPct(benchmark, period.from, period.to);

  return {
    ideas,
    presenters: sortUnique(ideas.map((idea) => idea.presenter)),
    summary,
    benchmark,
    benchmarkLabel: BENCHMARK_LABELS[benchmark],
    benchmarkReturnPct,
    excessReturnPct:
      summary.portfolioReturnPct !== null && benchmarkReturnPct !== null
        ? summary.portfolioReturnPct - benchmarkReturnPct
        : null,
    periodFrom: period.from,
    periodTo: period.to,
  };
}
