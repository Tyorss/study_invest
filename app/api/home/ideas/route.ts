import { NextRequest, NextResponse } from "next/server";
import { insertStudyTrackerIdea } from "@/lib/db";
import { todayInSeoul } from "@/lib/time";
import type { StudyTrackerIdeaCategory } from "@/types/study-tracker";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const category = body.category as StudyTrackerIdeaCategory | undefined;
    if (category !== "top_pick" && category !== "watchlist" && category !== "study") {
      return NextResponse.json({ error: "category must be top_pick, watchlist, or study" }, { status: 400 });
    }
    const company_name = (body.company_name as string) || "(이름 없음)";
    const ticker = (body.ticker as string) || "?";
    const presenter = (body.presenter as string) || "미정";
    const row = await insertStudyTrackerIdea({
      category,
      company_name,
      ticker,
      presenter,
      presented_at: todayInSeoul(),
      call_direction: "neutral",
    });
    return NextResponse.json({ ok: true, id: row.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
