import Link from "next/link";
import { StudyTrackerNav } from "@/components/study-tracker-nav";
import { StudyTrackerPortfolioBoard } from "@/components/study-tracker-portfolio-board";
import { fetchStudyTrackerPortfolioData } from "@/lib/study-tracker";
import { withStudyTrackerHint } from "@/lib/study-tracker-payload";

export const dynamic = "force-dynamic";

export default async function StudyTrackerPortfolioPage({
  searchParams,
}: {
  searchParams?: { from?: string; to?: string; benchmark?: string };
}) {
  try {
    const benchmark =
      searchParams?.benchmark === "NASDAQ" ||
      searchParams?.benchmark === "SPY" ||
      searchParams?.benchmark === "KOSPI"
        ? searchParams.benchmark
        : undefined;
    const data = await fetchStudyTrackerPortfolioData({
      fromDate: searchParams?.from,
      toDate: searchParams?.to,
      benchmark,
    });

    return (
      <main className="space-y-5">
        <header className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link href="/" className="text-sm text-slate-500 hover:underline">
                Back to Leaderboard
              </Link>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">Included Portfolio</h1>
              <p className="mt-2 text-sm text-slate-600">
                실제로 편입했다고 가정한 종목만 모아서 편입가 기준 Portfolio Return을 추적합니다. Tracking Return은 현재가 기준입니다.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                상세 패널에서 편입일/편입가/청산값을 직접 수정할 수 있고, 현재가는 새로고침으로 다시 조회할 수 있습니다.
              </p>
            </div>
          </div>
          <StudyTrackerNav />
        </header>

        <StudyTrackerPortfolioBoard data={data} />
      </main>
    );
  } catch (err) {
    const message = withStudyTrackerHint(
      err instanceof Error ? err.message : "Failed to load included portfolio",
    );

    return (
      <main className="space-y-5">
        <header className="panel p-5">
          <Link href="/" className="text-sm text-slate-500 hover:underline">
            Back to Leaderboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Included Portfolio</h1>
          <StudyTrackerNav />
        </header>
        <section className="panel p-5">
          <div className="text-sm text-rose-700">{message}</div>
        </section>
      </main>
    );
  }
}
