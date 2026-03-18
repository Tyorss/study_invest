import Link from "next/link";
import { StudyTrackerNav } from "@/components/study-tracker-nav";
import { StudyTrackerBoard } from "@/components/study-tracker-board";
import { fetchStudyTrackerData } from "@/lib/study-tracker";
import { withStudyTrackerHint } from "@/lib/study-tracker-payload";

export const dynamic = "force-dynamic";

export default async function StudyTrackerPage({
  searchParams,
}: {
  searchParams?: {
    compose?: string;
    sourceSessionId?: string;
    sourceCoverageId?: string;
    presenter?: string;
    companyName?: string;
    ticker?: string;
    sector?: string;
    callDirection?: "long" | "watch" | "avoid";
    sourceSessionLabel?: string;
    sourceCoverageLabel?: string;
  };
}) {
  try {
    const data = await fetchStudyTrackerData();
    const initialComposer =
      searchParams?.compose === "1"
        ? {
            presenter: searchParams.presenter ?? "",
            company_name: searchParams.companyName ?? "",
            ticker: searchParams.ticker ?? "",
            sector: searchParams.sector ?? "",
            call_direction: searchParams.callDirection ?? "long",
            source_session_id: searchParams.sourceSessionId
              ? Number(searchParams.sourceSessionId)
              : null,
            source_coverage_id: searchParams.sourceCoverageId
              ? Number(searchParams.sourceCoverageId)
              : null,
            sourceSessionLabel: searchParams.sourceSessionLabel,
            sourceCoverageLabel: searchParams.sourceCoverageLabel,
          }
        : null;

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
                Actionable call만 비교하는 보드입니다. Tracking Return은 call date 기준 발표가 대비 현재가로 계산됩니다.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                산업 발표와 커버리지 종목은 Sessions 탭에서 따로 관리하고, 이 페이지는 실제 콜 성과만 다룹니다.
              </p>
            </div>
          </div>
          <StudyTrackerNav />
        </header>

        <StudyTrackerBoard data={data} initialComposer={initialComposer} />
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
