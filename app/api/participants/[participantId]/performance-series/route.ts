import { NextResponse } from "next/server";
import { fetchParticipantPerformanceSeries } from "@/lib/queries";

export const dynamic = "force-dynamic";

function noStoreJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  return NextResponse.json(body, { ...init, headers });
}

export async function GET(
  _req: Request,
  { params }: { params: { participantId: string } },
) {
  try {
    const result = await fetchParticipantPerformanceSeries(params.participantId);
    if (result === null) {
      return noStoreJson({ error: "Participant not found" }, { status: 404 });
    }
    return noStoreJson({ ok: true, rows: result });
  } catch (err) {
    return noStoreJson(
      { error: err instanceof Error ? err.message : "Unexpected server error" },
      { status: 500 },
    );
  }
}
