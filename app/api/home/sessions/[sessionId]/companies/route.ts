import { NextRequest, NextResponse } from "next/server";
import { insertStudySessionCompany } from "@/lib/db";

function parseId(raw: string) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new Error("Invalid session id");
  return n;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  try {
    const sessionId = parseId(params.sessionId);
    const body = (await req.json()) as Record<string, unknown>;
    const company_name = ((body.company_name as string | undefined) || "새 기업").trim();
    const ticker = ((body.ticker as string | undefined) || "?").trim();
    const row = await insertStudySessionCompany({
      session_id: sessionId,
      company_name,
      ticker,
      session_stance: "neutral",
      follow_up_status: "waiting_event",
    });
    return NextResponse.json({ ok: true, id: row.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
