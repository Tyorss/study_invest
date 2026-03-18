import { NextRequest, NextResponse } from "next/server";
import { updateStudySession } from "@/lib/db";
import { normalizeStudySessionPayload, withStudyTrackerHint } from "@/lib/study-tracker-payload";

function parseSessionId(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) {
    throw new Error("Invalid session id");
  }
  return id;
}

function errorMessage(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  try {
    const sessionId = parseSessionId(params.sessionId);
    const body = await req.json();
    const input = normalizeStudySessionPayload(body);
    const session = await updateStudySession(sessionId, input);
    return NextResponse.json({ ok: true, session });
  } catch (err) {
    return NextResponse.json(
      { error: withStudyTrackerHint(errorMessage(err, "Unknown error")) },
      { status: 500 },
    );
  }
}
