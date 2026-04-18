import { fetchHomeData, type HomeData } from "@/lib/home-data";
import { StudyTrackerHome } from "@/components/study-tracker-home";

export const dynamic = "force-dynamic";

const EMPTY_DATA: HomeData = {
  topPicks: [],
  watchlist: [],
  studyIdeas: [],
  industries: [],
  recentUpdates: [],
  hasRecentActivity: false,
  lastSyncedAt: new Date().toISOString(),
};

export default async function Home() {
  let data = EMPTY_DATA;
  let dbError: string | null = null;
  try {
    data = await fetchHomeData();
  } catch (err) {
    dbError = err instanceof Error ? err.message : "데이터 로드 실패";
  }
  return <StudyTrackerHome initialData={data} dbError={dbError} />;
}
