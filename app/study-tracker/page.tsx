import { AllIdeasBoard } from "@/components/all-ideas-board";
import { fetchHomeData } from "@/lib/home-data";
import type { HomeIdea } from "@/lib/home-data";

export const dynamic = "force-dynamic";

export default async function StudyTrackerPage() {
  let ideas: HomeIdea[] = [];
  let error: string | null = null;
  try {
    const data = await fetchHomeData();
    ideas = [...data.topPicks, ...data.watchlist, ...data.studyIdeas];
  } catch (err) {
    error = err instanceof Error ? err.message : "데이터 로드 실패";
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#fff", color: "#171717", padding: "40px 24px", fontFamily: "'Pretendard Variable', -apple-system, sans-serif" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ padding: "14px 18px", background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#991b1b", fontSize: "0.9rem" }}>
            {error}
          </div>
        </div>
      </div>
    );
  }

  return <AllIdeasBoard initialIdeas={ideas} />;
}
