import { NextRequest, NextResponse } from "next/server";
import { getStudyTrackerIdeas, insertStudyTrackerIdea } from "@/lib/db";
import {
  normalizeStudyTrackerIdeaPayload,
  withStudyTrackerHint,
} from "@/lib/study-tracker-payload";
import { autoFillStudyTrackerIdea } from "@/lib/study-tracker-auto";
import { mapStudyTrackerIdea } from "@/lib/study-tracker";

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
    const rows = await getStudyTrackerIdeas();
    return NextResponse.json({ ok: true, ideas: rows.map(mapStudyTrackerIdea) });
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
    const input = normalizeStudyTrackerIdeaPayload(body);
    if (
      input.current_target_price !== null ||
      input.target_status !== null ||
      (input.target_note ?? "").trim()
    ) {
      input.target_updated_at = input.target_updated_at ?? new Date().toISOString();
    }
    const enriched = await autoFillStudyTrackerIdea(input);
    const row = await insertStudyTrackerIdea(enriched.input);
    return NextResponse.json({
      ok: true,
      idea: mapStudyTrackerIdea(row),
      warning: enriched.warning ?? undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { error: withStudyTrackerHint(errorMessage(err, "Unknown error")) },
      { status: 500 },
    );
  }
}
