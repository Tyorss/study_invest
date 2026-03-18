import { NextRequest, NextResponse } from "next/server";
import { deleteStudySessionCompany, updateStudySessionCompany } from "@/lib/db";
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
    const company = await updateStudySessionCompany(companyId, input);
    return NextResponse.json({ ok: true, company });
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
