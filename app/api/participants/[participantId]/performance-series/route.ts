import { NextResponse } from "next/server";
import { fetchParticipantPerformanceSeries } from "@/lib/queries";

export const dynamic = "force-dynamic";

function seriesJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "public, s-maxage=15, stale-while-revalidate=120");
  return NextResponse.json(body, { ...init, headers });
}

export async function GET(
  _req: Request,
  { params }: { params: { participantId: string } },
) {
  try {
    const result = await fetchParticipantPerformanceSeries(params.participantId);
    if (result === null) {
      return seriesJson({ error: "Participant not found" }, { status: 404 });
    }
    return seriesJson({ ok: true, rows: result });
  } catch (err) {
    return seriesJson(
      { error: err instanceof Error ? err.message : "Unexpected server error" },
      { status: 500 },
    );
  }
}
