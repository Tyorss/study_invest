import { NextResponse } from "next/server";
import { fetchParticipantContributionBreakdown } from "@/lib/queries";

export const dynamic = "force-dynamic";

function noStoreJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  return NextResponse.json(body, { ...init, headers });
}

export async function GET(
  req: Request,
  { params }: { params: { participantId: string } },
) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = (searchParams.get("start") ?? "").trim();
    const endDate = (searchParams.get("end") ?? "").trim();

    if (!startDate || !endDate) {
      return noStoreJson({ error: "start and end are required" }, { status: 400 });
    }

    const result = await fetchParticipantContributionBreakdown(
      params.participantId,
      startDate,
      endDate,
    );

    if (!result) {
      return noStoreJson({ error: "Participant not found" }, { status: 404 });
    }

    return noStoreJson({ ok: true, ...result });
  } catch (err) {
    return noStoreJson(
      { error: err instanceof Error ? err.message : "Unexpected server error" },
      { status: 500 },
    );
  }
}
