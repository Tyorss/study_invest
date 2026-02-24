import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runDailyPipeline } from "@/lib/jobs/runner";
import { yesterdayInSeoul } from "@/lib/time";

export const runtime = "nodejs";

async function handle(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const targetDate = req.nextUrl.searchParams.get("date") ?? yesterdayInSeoul();
    const result = await runDailyPipeline(targetDate);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}
