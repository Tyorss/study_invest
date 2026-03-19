import { NextRequest, NextResponse } from "next/server";
import {
  deleteStudyTrackerIdea,
  getStudyTrackerIdeaById,
  insertStudyCallUpdate,
  updateStudyTrackerIdea,
} from "@/lib/db";
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

function formatTargetValue(value: number | null, currency: "KRW" | "USD" | null) {
  if (value === null) return "-";
  if (currency === "KRW") return `₩${Math.round(value).toLocaleString("ko-KR")}`;
  if (currency === "USD") return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return value.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

function buildTargetUpdateBody(before: ReturnType<typeof mapStudyTrackerIdea>, after: ReturnType<typeof mapStudyTrackerIdea>) {
  const lines = [
    `초기 목표가: ${formatTargetValue(before.target_price, before.currency)} -> ${formatTargetValue(after.target_price, after.currency)}`,
    `현재 목표가: ${formatTargetValue(before.current_target_price, before.currency)} -> ${formatTargetValue(after.current_target_price, after.currency)}`,
    `목표 상태: ${(before.target_status ?? "active")} -> ${(after.target_status ?? "active")}`,
  ];

  if ((after.target_note ?? "").trim()) {
    lines.push(`메모: ${after.target_note}`);
  }

  return lines.join("\n");
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { ideaId: string } },
) {
  try {
    const ideaId = parseIdeaId(params.ideaId);
    const body = await req.json();
    const existingRow = await getStudyTrackerIdeaById(ideaId);
    if (!existingRow) {
      return NextResponse.json({ error: "Idea not found" }, { status: 404 });
    }
    const input = normalizeStudyTrackerIdeaPayload(body);
    const existingIdea = mapStudyTrackerIdea(existingRow);
    const targetFieldsChanged =
      input.target_price !== existingIdea.target_price ||
      input.current_target_price !== existingIdea.current_target_price ||
      input.target_status !== existingIdea.target_status ||
      input.target_note !== existingIdea.target_note;
    if (targetFieldsChanged) {
      input.target_updated_at = new Date().toISOString();
    }
    const enriched = await autoFillStudyTrackerIdea(input);
    const row = await updateStudyTrackerIdea(ideaId, enriched.input);
    const updatedIdea = mapStudyTrackerIdea(row);
    if (targetFieldsChanged) {
      await insertStudyCallUpdate(ideaId, {
        update_type: "update",
        title: "목표가 업데이트",
        body: buildTargetUpdateBody(existingIdea, updatedIdea),
        created_by: input.presenter?.trim() || existingIdea.presenter,
      });
    }
    return NextResponse.json({
      ok: true,
      idea: updatedIdea,
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
