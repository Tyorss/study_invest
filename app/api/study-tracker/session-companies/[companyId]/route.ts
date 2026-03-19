import { NextRequest, NextResponse } from "next/server";
import { deleteStudySessionCompany, updateStudySessionCompany } from "@/lib/db";
import { autoFillStudySessionCompany } from "@/lib/study-tracker-auto";
import { mapStudySessionCompany } from "@/lib/study-tracker";
import {
  normalizeStudySessionCompanyPayload,
  withStudyTrackerHint,
} from "@/lib/study-tracker-payload";

function parseCompanyId(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) {
    throw new Error("Invalid company id");
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
  { params }: { params: { companyId: string } },
) {
  try {
    const companyId = parseCompanyId(params.companyId);
    const body = await req.json();
    const input = normalizeStudySessionCompanyPayload(body);
    const presentedAt =
      typeof body?.presented_at === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.presented_at)
        ? body.presented_at
        : null;
    const enriched = presentedAt ? await autoFillStudySessionCompany(input, presentedAt) : { input, warning: null };
    const company = await updateStudySessionCompany(companyId, enriched.input);
    return NextResponse.json({
      ok: true,
      company: mapStudySessionCompany(company),
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
  { params }: { params: { companyId: string } },
) {
  try {
    const companyId = parseCompanyId(params.companyId);
    await deleteStudySessionCompany(companyId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: withStudyTrackerHint(errorMessage(err, "Unknown error")) },
      { status: 500 },
    );
  }
}
