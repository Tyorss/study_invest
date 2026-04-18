import { NextRequest, NextResponse } from "next/server";
import { insertStudyCallUpdate } from "@/lib/db";

function parseId(raw: string) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new Error("Invalid idea id");
  return n;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { ideaId: string } },
) {
  try {
    const ideaId = parseId(params.ideaId);
    const body = (await req.json()) as Record<string, unknown>;
    const text = (body.body as string | undefined)?.trim();
    if (!text) {
      return NextResponse.json({ error: "body is required" }, { status: 400 });
    }
    const created_by = (body.created_by as string | undefined)?.trim() || null;
    const title = (body.title as string | undefined)?.trim() || null;
    const update_type = (body.update_type as string | undefined) ?? "update";
    if (!["update", "catalyst", "risk", "postmortem"].includes(update_type)) {
      return NextResponse.json({ error: "invalid update_type" }, { status: 400 });
    }
    await insertStudyCallUpdate(ideaId, {
      update_type: update_type as "update" | "catalyst" | "risk" | "postmortem",
      title,
      body: text,
      created_by,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
