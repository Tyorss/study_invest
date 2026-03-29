import { NextResponse } from "next/server";
import { fetchParticipantSections } from "@/lib/queries";

export async function GET(
  _request: Request,
  { params }: { params: { participantId: string } },
) {
  try {
    const data = await fetchParticipantSections(params.participantId);
    if (!data) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        ok: true,
        latestSnapshot: data.latestSnapshot,
        holdings: data.holdings,
        trades: data.trades,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to load participant sections",
      },
      { status: 500 },
    );
  }
}
