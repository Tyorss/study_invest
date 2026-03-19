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
    callDirection?: "long" | "neutral" | "short";
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
            call_direction: searchParams.callDirection ?? "neutral",
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
                홈으로 돌아가기
              </Link>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">스터디 정리</h1>
              <p className="mt-2 text-sm text-slate-600">
                스터디에서 다룬 종목을 정리하고 추적하는 화면입니다. 추적 수익률은 종목 등록 시점의 발표가와 현재가를 기준으로 계산됩니다.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                산업 발표와 커버리지 종목은 산업 발표 탭에서 따로 관리하고, 실제 편입 관리는 편입 포트폴리오에서 따로 확인합니다.
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
            홈으로 돌아가기
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">스터디 정리</h1>
          <StudyTrackerNav />
        </header>
        <section className="panel p-5">
          <div className="text-sm text-rose-700">{message}</div>
        </section>
      </main>
    );
  }
}
