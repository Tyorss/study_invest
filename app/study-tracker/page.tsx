import Link from "next/link";
import { StudyTrackerNav } from "@/components/study-tracker-nav";
import { StudyTrackerBoard } from "@/components/study-tracker-board";
import { fetchStudyTrackerData } from "@/lib/study-tracker";
import { withStudyTrackerHint } from "@/lib/study-tracker-payload";

export const dynamic = "force-dynamic";

export default async function StudyTrackerPage() {
  try {
    const data = await fetchStudyTrackerData();

    return (
      <main className="space-y-5">
        <header className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link href="/" className="text-sm text-slate-500 hover:underline">
                Back to Leaderboard
              </Link>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">Study Tracker</h1>
              <p className="mt-2 text-sm text-slate-600">
                전체 발표 아이디어를 비교하는 보드입니다. 수익률은 발표일/발표가 기준의 Tracking Return입니다.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                현재가는 저장된 시장 데이터 기준이며, 상세 패널 또는 일괄 새로고침으로 실제 시세를 다시 확인할 수 있습니다.
              </p>
            </div>
          </div>
          <StudyTrackerNav />
        </header>

        <StudyTrackerBoard data={data} />
      </main>
    );
  } catch (err) {
    const message = withStudyTrackerHint(
      err instanceof Error ? err.message : "Failed to load study tracker",
    );
    return (
      <main className="space-y-5">
        <header className="panel p-5">
          <Link href="/" className="text-sm text-slate-500 hover:underline">
            Back to Leaderboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Study Tracker</h1>
          <StudyTrackerNav />
        </header>
        <section className="panel p-5">
          <div className="text-sm text-rose-700">{message}</div>
        </section>
      </main>
    );
  }
}
