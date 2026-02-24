import { LeaderboardInstrumentsTable } from "@/components/leaderboard-instruments-table";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { RankToggle } from "@/components/rank-toggle";
import { SummaryCards } from "@/components/summary-cards";
import { fetchLeaderboard } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams?: { rank?: string };
}) {
  const rank = searchParams?.rank === "sharpe" ? "sharpe" : "return";
  const { date, rows, instrumentRows } = await fetchLeaderboard(rank);

  return (
    <main className="space-y-5">
      <header className="panel p-5">
        <h1 className="text-2xl font-semibold tracking-tight">Paper Trading Competition</h1>
        <p className="mt-2 text-sm text-slate-600">
          Daily snapshots and analytics for 10 participants. Latest snapshot date:{" "}
          <span className="font-semibold">{date ?? "-"}</span>
        </p>
        <div className="mt-4">
          <RankToggle active={rank} />
        </div>
      </header>

      <SummaryCards rows={rows} />

      <LeaderboardTable rows={rows} rankBy={rank} />
      <LeaderboardInstrumentsTable rows={instrumentRows} />
    </main>
  );
}
