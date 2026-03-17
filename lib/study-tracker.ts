import { getStudyTrackerIdeas } from "@/lib/db";
import type {
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
  const includedPrice = toNumber(row.included_price);
  const currentPrice = toNumber(row.current_price);
  const exitedPrice = toNumber(row.exited_price);
  const positionStatus = row.position_status ?? null;

  return {
    id: row.id,
    presented_at: row.presented_at ?? null,
    presenter: row.presenter,
    company_name: row.company_name,
    ticker: row.ticker,
    sector: row.sector ?? null,
    pitch_price: toNumber(row.pitch_price),
    target_price: toNumber(row.target_price),
    pitch_upside_pct: toNumber(row.pitch_upside_pct),
    currency: row.currency ?? null,
    current_price: currentPrice,
    current_upside_pct: toNumber(row.current_upside_pct),
    current_return_pct: toNumber(row.current_return_pct),
    thesis: row.thesis ?? null,
    trigger: row.trigger ?? null,
    risk: row.risk ?? null,
    style: row.style ?? null,
    status: row.status ?? null,
    entry_date: row.entry_date ?? null,
    exit_date: row.exit_date ?? null,
    close_return_pct: toNumber(row.close_return_pct),
    note: row.note ?? null,
    tracking_return_pct: toNumber(row.tracking_return_pct),
    is_included: Boolean(row.is_included),
    included_at: row.included_at ?? null,
    included_price: includedPrice,
    weight: toNumber(row.weight),
    position_status: positionStatus,
    exited_at: row.exited_at ?? null,
    exited_price: exitedPrice,
    portfolio_return_pct: computeStudyTrackerPortfolioReturn({
      is_included: Boolean(row.is_included),
      included_price: includedPrice,
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

export async function fetchStudyTrackerPortfolioData(): Promise<StudyTrackerPortfolioData> {
  const rows = await getStudyTrackerIdeas();
  const ideas = rows.map(mapStudyTrackerIdea).filter((idea) => idea.is_included);

  return {
    ideas,
    presenters: sortUnique(ideas.map((idea) => idea.presenter)),
    summary: buildPortfolioSummary(ideas),
  };
}
