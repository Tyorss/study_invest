import { getStudyTrackerIdeas } from "@/lib/db";
import type {
  StudyTrackerData,
  StudyTrackerIdea,
  StudyTrackerIdeaRow,
  StudyTrackerSummary,
} from "@/types/study-tracker";

function toNumber(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function mapStudyTrackerIdea(row: StudyTrackerIdeaRow): StudyTrackerIdea {
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
    current_price: toNumber(row.current_price),
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
