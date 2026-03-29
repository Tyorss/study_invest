import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  backfillTradedInstrumentPrices,
  ensureBenchmarkHistory,
  generateSnapshotsForDate,
  runDailyPipeline,
} from "@/lib/jobs/runner";
import { todayInSeoul } from "@/lib/time";

export const runtime = "nodejs";

type ManualJobName =
  | "run-daily"
  | "generate-snapshots"
  | "backfill-benchmarks"
  | "backfill-traded-prices";

type Payload = {
  secret?: string;
  job?: ManualJobName;
  date?: string;
  startDate?: string;
};

function isValidDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function secretsMatch(provided: string, expected: string) {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function POST(req: NextRequest) {
  let body: Payload | null = null;

  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const configuredSecret =
    process.env.ADMIN_JOB_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  if (!configuredSecret) {
    return NextResponse.json({ error: "ADMIN_JOB_SECRET is not configured" }, { status: 500 });
  }

  const providedSecret = body?.secret?.trim() ?? "";
  if (!providedSecret || !secretsMatch(providedSecret, configuredSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = body?.job;
  if (
    job !== "run-daily" &&
    job !== "generate-snapshots" &&
    job !== "backfill-benchmarks" &&
    job !== "backfill-traded-prices"
  ) {
    return NextResponse.json({ error: "Invalid job type" }, { status: 400 });
  }

  const targetDate = body?.date?.trim() || todayInSeoul();
  if (!isValidDate(targetDate)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  const startDate = body?.startDate?.trim() || "";
  if (job === "backfill-benchmarks" || job === "backfill-traded-prices") {
    if (!startDate || !isValidDate(startDate)) {
      return NextResponse.json({ error: "startDate must be YYYY-MM-DD" }, { status: 400 });
    }
    if (startDate > targetDate) {
      return NextResponse.json(
        { error: "startDate must be on or before date" },
        { status: 400 },
      );
    }
  }

  try {
    if (job === "run-daily") {
      const result = await runDailyPipeline(targetDate);
      return NextResponse.json({ ok: true, job, targetDate, result });
    }

    if (job === "backfill-benchmarks") {
      const result = await ensureBenchmarkHistory(targetDate, { startDate });
      return NextResponse.json({
        ok: true,
        job,
        targetDate,
        startDate,
        result: { benchmarks: result },
      });
    }

    if (job === "backfill-traded-prices") {
      const result = await backfillTradedInstrumentPrices(targetDate, { startDate });
      return NextResponse.json({
        ok: true,
        job,
        targetDate,
        startDate,
        result: { tradedPrices: result },
      });
    }

    const result = await generateSnapshotsForDate(targetDate);
    return NextResponse.json({ ok: true, job, targetDate, result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
