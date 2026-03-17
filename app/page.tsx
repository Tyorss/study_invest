import { ManualJobsPanel } from "@/components/manual-jobs-panel";
import { LeaderboardInstrumentsTable } from "@/components/leaderboard-instruments-table";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { RankToggle } from "@/components/rank-toggle";
import { SummaryCards } from "@/components/summary-cards";
import { fetchLeaderboard } from "@/lib/queries";
import { todayInSeoul, yesterdayInSeoul } from "@/lib/time";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams?: { rank?: string };
}) {
  const rank = searchParams?.rank === "sharpe" ? "sharpe" : "return";
  const { date, rows, instrumentRows } = await fetchLeaderboard(rank);
  const snapshotDefaultDate = todayInSeoul();
  const dailyDefaultDate = yesterdayInSeoul();

  return (
    <main className="space-y-5">
      <header className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Paper Trading Competition</h1>
            <p className="mt-2 text-sm text-slate-600">
              Daily snapshots and analytics for 10 participants. Latest valuation date:{" "}
              <span className="font-semibold">{date ?? "-"}</span>
            </p>
          </div>
          <Link
            href="/study-tracker"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Open Study Tracker
          </Link>
        </div>
        <div className="mt-4">
          <RankToggle active={rank} />
        </div>
      </header>

      <ManualJobsPanel
        defaultDailyDate={dailyDefaultDate}
        defaultSnapshotDate={snapshotDefaultDate}
      />

      <SummaryCards rows={rows} />

      <LeaderboardTable rows={rows} rankBy={rank} />
      <LeaderboardInstrumentsTable rows={instrumentRows} />
    </main>
  );
}
