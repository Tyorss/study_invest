import {
  getStudyCallUpdateRows,
  getStudyLinkedTrades,
  getStudySessionCompanies,
  getStudySessions,
  getStudyTrackerIdeas,
} from "@/lib/db";
import { computeStudyTrackerPortfolioReturn, mapStudyTrackerIdea } from "@/lib/study-tracker";
import type {
  StudyCallUpdate,
  StudyCallUpdateRow,
  StudySessionCompanyRow,
  StudySessionRow,
  StudyTrackerIdeaCategory,
  StudyTrackerIdeaRow,
} from "@/types/study-tracker";

export interface HomeIdea {
  id: number;
  category: StudyTrackerIdeaCategory;
  company_name: string;
  ticker: string;
  presenter: string;
  presented_at: string | null;
  sector: string | null;
  thesis: string | null;
  trigger: string | null;
  risk: string | null;
  style: string | null;
  note: string | null;
  status: string | null;
  position_status: "active" | "closed" | null;
  currency: "KRW" | "USD" | null;
  pitch_price: number | null;
  included_price: number | null;
  current_price: number | null;
  exited_price: number | null;
  return_pct: number | null; // 현재 수익률
  updates: HomeUpdate[];
  updated_at: string | null;
}

export interface HomeUpdate {
  id: number;
  idea_id: number | null;
  company_id: number | null;
  body: string;
  title: string | null;
  created_by: string | null;
  created_at: string;
  source_type: "pick" | "watchlist" | "company";
  source_name: string;
  parent_name: string | null; // 산업명 (company 업데이트인 경우)
}

export interface HomeIndustryCompany {
  id: number;
  session_id: number;
  company_name: string;
  ticker: string;
  sector: string | null;
  session_stance: string;
  follow_up_status: string;
  mention_reason: string | null;
  note: string | null;
}

export interface HomeIndustry {
  id: number;
  presented_at: string;
  presenter: string;
  industry_name: string;
  title: string;
  thesis: string | null;
  anti_thesis: string | null;
  note: string | null;
  summary_md: string | null;
  companies: HomeIndustryCompany[];
  ideas: HomeIdea[]; // study_tracker_ideas mapped by sector
}

// industry_name -> acceptable sector values in study_tracker_ideas
const INDUSTRY_SECTOR_ALIASES: Record<string, string[]> = {
  방산: ["방산"],
  조선: ["조선"],
  반도체: ["반도체"],
  소프트웨어: ["소프트웨어", "IT"],
  화장품: ["화장품"],
  소비재: ["소비재", "경기소비재"],
};

// Companies hidden from industry sections (they remain in Top Picks / Watchlist).
const INDUSTRY_EXCLUDED_COMPANIES = ["스테이블 코인", "스테이블코인", "삼성전기", "노머스"];

function isExcludedFromIndustry(companyName: string) {
  return INDUSTRY_EXCLUDED_COMPANIES.some((name) => companyName.includes(name));
}

export interface HomeData {
  topPicks: HomeIdea[];
  watchlist: HomeIdea[];
  studyIdeas: HomeIdea[]; // category='study' 이면서 top_pick 아직 아닌 종목들 (Top Pick 승격 후보)
  industries: HomeIndustry[];
  recentUpdates: HomeUpdate[];
  hasRecentActivity: boolean; // 최근 2주 내 업데이트가 하나라도 있는지
  lastSyncedAt: string;
}

function toIdea(
  row: StudyTrackerIdeaRow,
  updatesByIdea: Map<number, StudyCallUpdateRow[]>,
): HomeIdea {
  const mapped = mapStudyTrackerIdea(row);
  const categoryRaw = (row.category ?? "study") as StudyTrackerIdeaCategory;
  const category: StudyTrackerIdeaCategory =
    categoryRaw === "top_pick" || categoryRaw === "watchlist" ? categoryRaw : "study";
  const returnPct = computeStudyTrackerPortfolioReturn({
    is_included: mapped.is_included ?? false,
    included_price: mapped.included_price,
    current_price: mapped.current_price,
    exited_price: mapped.exited_price,
    position_status: mapped.position_status,
  });
  // Fallback: use pitch_price -> current_price if not included yet
  const fallbackReturn =
    returnPct === null && mapped.pitch_price !== null && mapped.current_price !== null && mapped.pitch_price > 0
      ? mapped.current_price / mapped.pitch_price - 1
      : null;

  const rawUpdates = updatesByIdea.get(row.id) ?? [];
  const updates: HomeUpdate[] = rawUpdates.map((u) => ({
    id: u.id,
    idea_id: u.idea_id,
    company_id: null,
    body: u.body,
    title: u.title,
    created_by: u.created_by,
    created_at: u.created_at as unknown as string,
    source_type: category === "watchlist" ? "watchlist" : "pick",
    source_name: row.company_name,
    parent_name: null,
  }));

  return {
    id: row.id,
    category,
    company_name: row.company_name,
    ticker: row.ticker,
    presenter: row.presenter,
    presented_at: mapped.presented_at,
    sector: row.sector,
    thesis: mapped.thesis,
    trigger: mapped.trigger,
    risk: mapped.risk,
    style: mapped.style,
    note: mapped.note,
    status: mapped.status,
    position_status: mapped.position_status,
    currency: mapped.currency,
    pitch_price: mapped.pitch_price,
    included_price: mapped.included_price,
    current_price: mapped.current_price,
    exited_price: mapped.exited_price,
    return_pct: returnPct ?? fallbackReturn,
    updates,
    updated_at: (row.updated_at as unknown as string) ?? null,
  };
}

export async function fetchHomeData(): Promise<HomeData> {
  const [ideaRows, sessionRows, companyRows, updateRows] = await Promise.all([
    getStudyTrackerIdeas(),
    getStudySessions(),
    getStudySessionCompanies(),
    getStudyCallUpdateRows(),
  ]);

  const updatesByIdea = new Map<number, StudyCallUpdateRow[]>();
  for (const u of updateRows) {
    const arr = updatesByIdea.get(u.idea_id) ?? [];
    arr.push(u);
    updatesByIdea.set(u.idea_id, arr);
  }

  const ideas = ideaRows.map((row) => toIdea(row, updatesByIdea));
  const topPicks = ideas.filter((i) => i.category === "top_pick");
  const watchlist = ideas.filter((i) => i.category === "watchlist");
  const studyIdeas = ideas.filter((i) => i.category === "study");

  const sessionsById = new Map<number, StudySessionRow>();
  for (const s of sessionRows) sessionsById.set(s.id, s);

  const companiesBySession = new Map<number, StudySessionCompanyRow[]>();
  for (const c of companyRows) {
    const arr = companiesBySession.get(c.session_id) ?? [];
    arr.push(c);
    companiesBySession.set(c.session_id, arr);
  }

  const industries: HomeIndustry[] = sessionRows
    .slice()
    .filter((s) => !isExcludedFromIndustry(s.industry_name))
    .sort((a, b) => (a.presented_at < b.presented_at ? 1 : -1))
    .map((s) => {
      const aliases = INDUSTRY_SECTOR_ALIASES[s.industry_name] ?? [s.industry_name];
      const industryIdeas = ideas.filter(
        (idea) =>
          idea.sector !== null &&
          aliases.includes(idea.sector) &&
          !isExcludedFromIndustry(idea.company_name),
      );
      return {
        id: s.id,
        presented_at: s.presented_at,
        presenter: s.presenter,
        industry_name: s.industry_name,
        title: s.title,
        thesis: s.thesis,
        anti_thesis: s.anti_thesis,
        note: s.note,
        summary_md: (s as StudySessionRow & { summary_md?: string | null }).summary_md ?? null,
        companies: (companiesBySession.get(s.id) ?? [])
          .filter((c) => !isExcludedFromIndustry(c.company_name))
          .map((c) => ({
            id: c.id,
            session_id: c.session_id,
            company_name: c.company_name,
            ticker: c.ticker,
            sector: c.sector,
            session_stance: c.session_stance,
            follow_up_status: c.follow_up_status,
            mention_reason: c.mention_reason,
            note: c.note,
          })),
        ideas: industryIdeas,
      };
    });

  // Recent updates feed: only updates from the last 7 days; if nothing in last
  // 14 days the feed is hidden entirely.
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const allUpdates = ideas.flatMap((i) => i.updates);
  const hasRecentActivity = allUpdates.some(
    (u) => now - new Date(u.created_at).getTime() <= 14 * ONE_DAY_MS,
  );
  const recentUpdates = allUpdates
    .filter((u) => now - new Date(u.created_at).getTime() <= 7 * ONE_DAY_MS)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return {
    topPicks,
    watchlist,
    studyIdeas,
    industries,
    recentUpdates,
    hasRecentActivity,
    lastSyncedAt: new Date().toISOString(),
  };
}

// Re-export for client convenience
export type { StudyCallUpdate };

// silence unused import warning for potential Stage 2 use
export const _unusedHomeImports = { getStudyLinkedTrades };
