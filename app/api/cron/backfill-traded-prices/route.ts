import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { backfillTradedInstrumentPrices } from "@/lib/jobs/runner";
import { getGameStartDate } from "@/lib/db";
import { todayInSeoul } from "@/lib/time";

export const runtime = "nodejs";

function isValidDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

async function handle(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const targetDate = req.nextUrl.searchParams.get("date") ?? todayInSeoul();
    const startDate =
      req.nextUrl.searchParams.get("startDate") ?? (await getGameStartDate());

    if (!isValidDate(targetDate) || !isValidDate(startDate)) {
      return NextResponse.json(
        { error: "date and startDate must be YYYY-MM-DD" },
        { status: 400 },
      );
    }

    if (startDate > targetDate) {
      return NextResponse.json(
        { error: "startDate must be on or before date" },
        { status: 400 },
      );
    }

    const result = await backfillTradedInstrumentPrices(targetDate, { startDate });
    return NextResponse.json({ ok: true, targetDate, ...result });
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
