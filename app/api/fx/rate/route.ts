import { NextResponse } from "next/server";
import { FX_PAIR_USDKRW } from "@/lib/constants";
import { getFxPointOnOrBefore } from "@/lib/db";
import { updateFxForDate } from "@/lib/jobs/runner";

function todayLocalIsoDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const requestedDate = (url.searchParams.get("date") || todayLocalIsoDate()).trim();
    if (!isIsoDate(requestedDate)) {
      return NextResponse.json(
        { error: "date must be YYYY-MM-DD" },
        { status: 400 },
      );
    }

    let point = await getFxPointOnOrBefore(FX_PAIR_USDKRW, requestedDate);
    let source: "cache" | "provider" = "cache";
    if (!point) {
      await updateFxForDate(requestedDate);
      point = await getFxPointOnOrBefore(FX_PAIR_USDKRW, requestedDate);
      source = "provider";
    }

    if (!point) {
      return NextResponse.json(
        { error: `Missing USDKRW FX on or before ${requestedDate}` },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      pair: FX_PAIR_USDKRW,
      requested_date: requestedDate,
      effective_date: point.date,
      rate: point.rate,
      source,
    });
  } catch (err) {
    return NextResponse.json(
      { error: errorMessage(err, "Unknown error") },
      { status: 500 },
    );
  }
}
