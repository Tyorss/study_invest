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
                홈으로 돌아가기
              </Link>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">자유 종목</h1>
              <p className="mt-2 text-sm text-slate-600">
                스터디와 무관하게 자유롭게 종목 의견을 올리고 정리하는 공간입니다. 관심 종목, 메모, 관점을 편하게 남겨둘 수 있습니다.
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
            홈으로 돌아가기
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">자유 종목</h1>
          <StudyTrackerNav />
        </header>
        <section className="panel p-5">
          <div className="text-sm text-rose-700">{message}</div>
        </section>
      </main>
    );
  }
}
