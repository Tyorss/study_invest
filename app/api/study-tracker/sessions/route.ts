import { NextRequest, NextResponse } from "next/server";
import { getStudySessions, insertStudySession } from "@/lib/db";
import { normalizeStudySessionPayload, withStudyTrackerHint } from "@/lib/study-tracker-payload";

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

export async function GET() {
  try {
    const sessions = await getStudySessions();
    return NextResponse.json({ ok: true, sessions });
  } catch (err) {
    return NextResponse.json(
      { error: withStudyTrackerHint(errorMessage(err, "Unknown error")) },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = normalizeStudySessionPayload(body);
    const session = await insertStudySession(input);
    return NextResponse.json({ ok: true, session });
  } catch (err) {
    return NextResponse.json(
      { error: withStudyTrackerHint(errorMessage(err, "Unknown error")) },
      { status: 500 },
    );
  }
}
