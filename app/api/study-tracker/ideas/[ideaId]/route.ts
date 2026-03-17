import { NextRequest, NextResponse } from "next/server";
import { deleteStudyTrackerIdea, updateStudyTrackerIdea } from "@/lib/db";
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

function parseIdeaId(raw: string) {
  const ideaId = Number(raw);
  if (!Number.isInteger(ideaId) || ideaId < 1) {
    throw new Error("Invalid idea id");
  }
  return ideaId;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { ideaId: string } },
) {
  try {
    const ideaId = parseIdeaId(params.ideaId);
    const body = await req.json();
    const input = normalizeStudyTrackerIdeaPayload(body);
    const enriched = await autoFillStudyTrackerIdea(input);
    const row = await updateStudyTrackerIdea(ideaId, enriched.input);
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { ideaId: string } },
) {
  try {
    const ideaId = parseIdeaId(params.ideaId);
    await deleteStudyTrackerIdea(ideaId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: withStudyTrackerHint(errorMessage(err, "Unknown error")) },
      { status: 500 },
    );
  }
}
