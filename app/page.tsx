import Link from "next/link";
import { LeaderboardInstrumentsTable } from "@/components/leaderboard-instruments-table";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { RankToggle } from "@/components/rank-toggle";
import { fetchLeaderboard, fetchMissingPriceOverview } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams?: { rank?: string };
}) {
  const rank = searchParams?.rank === "sharpe" ? "sharpe" : "return";
  const [{ date, rows, instrumentRows }, missingPriceOverview] = await Promise.all([
    fetchLeaderboard(rank),
    fetchMissingPriceOverview(),
  ]);
  const leader = [...rows].sort((a, b) => b.total_return_pct - a.total_return_pct)[0] ?? null;
  const avgReturn =
    rows.length > 0
      ? rows.reduce((sum, row) => sum + row.total_return_pct, 0) / rows.length
      : null;

  return (
    <main className="space-y-5">
      <header className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-slate-500">스터디 모의투자</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">투자 스터디 보드</h1>
            <p className="mt-2 text-sm text-slate-600">
              아래에서 먼저 내 이름을 누르고, 상세 페이지에서 거래를 입력하면 됩니다. 최신 평가 기준일은{" "}
              <span className="font-semibold">{date ?? "-"}</span>입니다.
            </p>
          </div>
        </div>
      </header>

      <section className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">시작 방법</h2>
            <ol className="mt-3 space-y-2 text-sm text-slate-600">
              <li>1. 아래 참가자 목록에서 본인 이름을 누릅니다.</li>
              <li>2. 상세 페이지에서 종목코드, 매수/매도, 수량, 가격만 입력합니다.</li>
              <li>3. 스터디 콜이나 포트폴리오 추적이 필요하면 스터디 트래커를 사용합니다.</li>
            </ol>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/study-tracker"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              스터디 트래커 보기
            </Link>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {rows.map((row) => (
            <Link
              key={row.participant_id}
              href={`/participants/${row.participant_id}`}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: row.color_tag }}
              />
              {row.participant_name}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="panel p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">참가자 수</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">{rows.length}명</div>
        </div>
        <div className="panel p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">현재 1위</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">
            {leader ? `${leader.participant_name} (${(leader.total_return_pct * 100).toFixed(2)}%)` : "-"}
          </div>
        </div>
        <div className="panel p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">평균 수익률</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">
            {avgReturn === null ? "-" : `${(avgReturn * 100).toFixed(2)}%`}
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">참가자 리더보드</h2>
            <p className="mt-1 text-sm text-slate-600">
              이름을 누르면 상세 페이지로 이동합니다. 기본 화면은 비교하기 쉽게 핵심 정보만 보여줍니다.
            </p>
          </div>
          <RankToggle active={rank} />
        </div>
      </section>

      <LeaderboardTable rows={rows} rankBy={rank} />

      <details className="panel overflow-hidden">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900">
          고급 보기: 종목별 비중/수익 상위 현황
        </summary>
        <div className="border-t border-slate-200">
          <LeaderboardInstrumentsTable rows={instrumentRows} />
        </div>
      </details>

      <div className="px-1 text-right">
        <div className="flex flex-wrap items-center justify-end gap-3 text-xs">
          <Link
            href="/admin/missing-prices"
            className={`hover:underline ${
              missingPriceOverview.uniqueCount > 0
                ? "font-medium text-rose-600 hover:text-rose-700"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            전체 미조회 종목 {missingPriceOverview.uniqueCount}개
          </Link>
          <Link href="/admin/jobs" className="text-slate-400 hover:text-slate-600 hover:underline">
            운영자용 업데이트 도구
          </Link>
        </div>
      </div>
    </main>
  );
}
