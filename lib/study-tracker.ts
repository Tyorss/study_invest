import {
  getBenchmarkByCode,
  getInstrumentBySymbol,
  getPricePointOnOrBefore,
  getStudyTrackerIdeas,
} from "@/lib/db";
import { todayInSeoul } from "@/lib/time";
import type {
  StudyTrackerBenchmarkCode,
  StudyTrackerData,
  StudyTrackerIdea,
  StudyTrackerIdeaRow,
  StudyTrackerPortfolioData,
  StudyTrackerPortfolioSummary,
  StudyTrackerSummary,
} from "@/types/study-tracker";

function toNumber(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function ratioFrom(endValue: number | null, startValue: number | null) {
  if (endValue === null || startValue === null || startValue <= 0) return null;
  return endValue / startValue - 1;
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

export function mapStudyTrackerIdea(row: StudyTrackerIdeaRow): StudyTrackerIdea {
  const pitchPrice = toNumber(row.pitch_price);
  const targetPrice = toNumber(row.target_price);
  const includedPrice = toNumber(row.included_price);
  const currentPrice = toNumber(row.current_price);
  const exitedPrice = toNumber(row.exited_price);
  const closeReturn = toNumber(row.close_return_pct);
  const currentReturn = ratioFrom(currentPrice, pitchPrice) ?? toNumber(row.current_return_pct);
  const currentUpside = ratioFrom(targetPrice, currentPrice) ?? toNumber(row.current_upside_pct);
  const pitchUpside = ratioFrom(targetPrice, pitchPrice) ?? toNumber(row.pitch_upside_pct);
  const inferredIncluded =
    Boolean(row.is_included) ||
    ((!row.included_at && !row.included_price && !row.position_status && !row.exited_at && !row.exited_price) &&
      (row.status === "편입" || row.status === "전량청산"));
  const positionStatus =
    row.position_status ?? (row.status === "전량청산" ? "closed" : inferredIncluded ? "active" : null);
  const resolvedIncludedPrice = inferredIncluded ? includedPrice ?? pitchPrice : null;
  const resolvedIncludedAt = inferredIncluded ? row.included_at ?? row.entry_date ?? row.presented_at : null;
  const resolvedExitedAt = positionStatus === "closed" ? row.exited_at ?? row.exit_date ?? null : null;
  const trackingReturn = closeReturn ?? currentReturn ?? toNumber(row.tracking_return_pct);

  return {
    id: row.id,
    presented_at: row.presented_at ?? null,
    presenter: row.presenter,
    company_name: row.company_name,
    ticker: row.ticker,
    sector: row.sector ?? null,
    pitch_price: pitchPrice,
    target_price: targetPrice,
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
    tracking_return_pct: trackingReturn,
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
  };
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

  return {
    totalIdeas: ideas.length,
    activeIdeas: ideas.filter((idea) => idea.status === "편입" || idea.status === "검토중").length,
    closedIdeas: ideas.filter((idea) => idea.status === "전량청산").length,
    avgTrackingReturnPct: average(trackingReturns),
    bestIdea: sortedByReturn[0] ?? null,
    worstIdea: sortedByReturn.at(-1) ?? null,
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

export async function fetchStudyTrackerData(): Promise<StudyTrackerData> {
  const rows = await getStudyTrackerIdeas();
  const ideas = rows.map(mapStudyTrackerIdea);

  return {
    ideas,
    statuses: sortUnique(ideas.map((idea) => idea.status)),
    sectors: sortUnique(ideas.map((idea) => idea.sector)),
    styles: sortUnique(ideas.map((idea) => idea.style)),
    summary: buildSummary(ideas),
  };
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
  const rows = await getStudyTrackerIdeas();
  const allIdeas = rows.map(mapStudyTrackerIdea).filter((idea) => idea.is_included);
  const period = determinePeriod(allIdeas, options?.fromDate, options?.toDate);
  const benchmark = options?.benchmark ?? "SPY";
  const ideas = allIdeas.filter((idea) => {
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
