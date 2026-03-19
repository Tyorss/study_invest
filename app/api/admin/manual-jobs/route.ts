import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { generateSnapshotsForDate, runDailyPipeline } from "@/lib/jobs/runner";
import { todayInSeoul, yesterdayInSeoul } from "@/lib/time";

export const runtime = "nodejs";

type ManualJobName = "run-daily" | "generate-snapshots";

type Payload = {
  secret?: string;
  job?: ManualJobName;
  date?: string;
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
  if (job !== "run-daily" && job !== "generate-snapshots") {
    return NextResponse.json({ error: "Invalid job type" }, { status: 400 });
  }

  const targetDate =
    body?.date?.trim() || (job === "run-daily" ? yesterdayInSeoul() : todayInSeoul());
  if (!isValidDate(targetDate)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }

  try {
    if (job === "run-daily") {
      const result = await runDailyPipeline(targetDate);
      return NextResponse.json({ ok: true, job, targetDate, result });
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
