import { NextRequest, NextResponse } from "next/server";
import { upsertStudyCallFeedback } from "@/lib/db";
import {
  normalizeStudyCallFeedbackPayload,
  withStudyTrackerHint,
} from "@/lib/study-tracker-payload";

function parseIdeaId(raw: string) {
  const ideaId = Number(raw);
  if (!Number.isInteger(ideaId) || ideaId < 1) {
    throw new Error("Invalid idea id");
  }
  return ideaId;
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

export async function POST(
  req: NextRequest,
  { params }: { params: { ideaId: string } },
) {
  try {
    const ideaId = parseIdeaId(params.ideaId);
    const body = await req.json();
    const input = normalizeStudyCallFeedbackPayload(body);
    const feedback = await upsertStudyCallFeedback(ideaId, input);
    return NextResponse.json({ ok: true, feedback });
  } catch (err) {
    return NextResponse.json(
      { error: withStudyTrackerHint(errorMessage(err, "Unknown error")) },
      { status: 500 },
    );
  }
}
