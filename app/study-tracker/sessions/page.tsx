import Link from "next/link";
import { StudySessionsBoard } from "@/components/study-sessions-board";
import { StudyTrackerNav } from "@/components/study-tracker-nav";
import { fetchStudySessionData } from "@/lib/study-tracker";
import { withStudyTrackerHint } from "@/lib/study-tracker-payload";

export const dynamic = "force-dynamic";

export default async function StudyTrackerSessionsPage() {
  try {
    const data = await fetchStudySessionData();

    return (
      <main className="space-y-5">
        <header className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link href="/" className="text-sm text-slate-500 hover:underline">
                Back to Leaderboard
              </Link>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">Study Sessions</h1>
              <p className="mt-2 text-sm text-slate-600">
                산업 발표와 커버리지 종목을 보관하는 리서치 레이어입니다. 여기서 언급된 종목은 바로 성과판 평가 대상이 아니고,
                실제 콜로 전환될 때만 Actionable Calls 보드로 넘어갑니다.
              </p>
            </div>
          </div>
          <StudyTrackerNav />
        </header>

        <StudySessionsBoard data={data} />
      </main>
    );
  } catch (err) {
    const message = withStudyTrackerHint(
      err instanceof Error ? err.message : "Failed to load study sessions",
    );

    return (
      <main className="space-y-5">
        <header className="panel p-5">
          <Link href="/" className="text-sm text-slate-500 hover:underline">
            Back to Leaderboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Study Sessions</h1>
          <StudyTrackerNav />
        </header>
        <section className="panel p-5">
          <div className="text-sm text-rose-700">{message}</div>
        </section>
      </main>
    );
  }
}
