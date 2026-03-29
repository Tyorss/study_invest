import Link from "next/link";
import { notFound } from "next/navigation";
import { ParticipantDetailShell } from "@/components/participant-detail-shell";
import { ParticipantNotesEditor } from "@/components/participant-notes-editor";
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
              홈으로 돌아가기
            </Link>
            <h1 className="mt-2 text-2xl font-semibold">{data.participant.name}</h1>
            <p className="mt-2 text-sm text-slate-600">
              아래에서 거래를 입력하고, 보유 종목과 성과를 확인할 수 있습니다.
            </p>
          </div>
          <Link
            href={`/api/participants/${data.participant.id}/export`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            거래/스냅샷 내려받기
          </Link>
        </div>
      </header>

      <ParticipantDetailShell
        participantId={data.participant.id}
        portfolioId={data.portfolio.id}
        studyCallOptions={data.studyCallOptions}
        initialLatestSnapshot={data.latestSnapshot}
        initialHoldings={data.holdings}
        initialTrades={data.trades}
      />

      <ParticipantNotesEditor
        participantId={data.participant.id}
        initialMarketNote={data.notes.market_note}
        initialLines={data.notes.lines}
      />
    </main>
  );
}
