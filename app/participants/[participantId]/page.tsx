import Link from "next/link";
import { notFound } from "next/navigation";
import { DrawdownChart } from "@/components/drawdown-chart";
import { HoldingsTable } from "@/components/holdings-table";
import { IndexedNavChart } from "@/components/indexed-nav-chart";
import { ParticipantHeader } from "@/components/participant-header";
import { ParticipantNotesEditor } from "@/components/participant-notes-editor";
import { TradeEntryForm } from "@/components/trade-entry-form";
import { TradesTable } from "@/components/trades-table";
import { fetchParticipantDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ParticipantDetailPage({
  params,
}: {
  params: { participantId: string };
}) {
  const data = await fetchParticipantDetail(params.participantId);
  if (!data) notFound();

  return (
    <main className="space-y-5">
      <header className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/" className="text-sm text-slate-500 hover:underline">
              Back to Leaderboard
            </Link>
            <h1 className="mt-2 text-2xl font-semibold">{data.participant.name}</h1>
          </div>
          <Link
            href={`/api/participants/${data.participant.id}/export`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Export CSV (Trades + Snapshots)
          </Link>
        </div>
      </header>

      <ParticipantHeader snapshot={data.latestSnapshot} />
      <TradeEntryForm portfolioId={data.portfolio.id} />

      <ParticipantNotesEditor
        participantId={data.participant.id}
        initialMarketNote={data.notes.market_note}
        initialLines={data.notes.lines}
      />

      <HoldingsTable rows={data.holdings} />
      <TradesTable rows={data.trades} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <IndexedNavChart data={data.chartSeries} />
        <DrawdownChart data={data.chartSeries} />
      </div>
    </main>
  );
}
