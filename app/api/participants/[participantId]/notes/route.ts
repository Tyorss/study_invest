import { NextRequest, NextResponse } from "next/server";
import { getParticipantNotes, insertAuditLog, upsertParticipantNotes } from "@/lib/db";

type UpdatePayload = {
  market_note?: string;
  lines?: Array<{
    symbol?: string | null;
    memo_text?: string;
  }>;
};

function errorMessage(err: unknown, fallback: string) {
  if (err instanceof Error) {
    return err.message;
  }
  if (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as { message?: unknown }).message === "string"
  ) {
    return ((err as { message: string }).message || fallback).trim();
  }
  return fallback;
}

function withNotesHint(message: string) {
  const lower = message.toLowerCase();
  const isMissingNotesTables =
    (lower.includes("participant_notes") || lower.includes("participant_note_lines")) &&
    (lower.includes("does not exist") ||
      lower.includes("relation") ||
      lower.includes("42p01") ||
      lower.includes("schema cache") ||
      lower.includes("could not find table"));
  if (!isMissingNotesTables) return message;
  return `${message} (Run migrations/0002_participant_notes.sql in Supabase SQL editor.)`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { participantId: string } },
) {
  try {
    const bundle = await getParticipantNotes(params.participantId);
    return NextResponse.json({ ok: true, ...bundle });
  } catch (err) {
    return NextResponse.json(
      { error: withNotesHint(errorMessage(err, "Unknown error")) },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { participantId: string } },
) {
  try {
    const body = (await req.json()) as UpdatePayload;
    const marketNote = (body.market_note ?? "").toString();
    const lines = (body.lines ?? [])
      .slice(0, 100)
      .map((x) => ({
        symbol: x.symbol ? String(x.symbol) : null,
        memo_text: (x.memo_text ?? "").toString(),
      }));

    await upsertParticipantNotes(params.participantId, marketNote, lines);
    try {
      const actor = req.headers.get("x-actor")?.trim() || req.headers.get("x-user")?.trim() || "api";
      await insertAuditLog({
        entity_type: "NOTES",
        entity_id: params.participantId,
        action: "upsert",
        actor: actor.slice(0, 128),
        payload_json: {
          market_note_length: marketNote.length,
          lines: lines.length,
        },
      });
    } catch {
      // Note save should succeed even when audit sink is temporarily unavailable.
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: withNotesHint(errorMessage(err, "Unknown error")) },
      { status: 500 },
    );
  }
}
