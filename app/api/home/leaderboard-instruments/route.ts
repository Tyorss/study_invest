import { NextRequest, NextResponse } from "next/server";
import { fetchLeaderboard } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const rank = req.nextUrl.searchParams.get("rank") === "sharpe" ? "sharpe" : "return";
    const result = await fetchLeaderboard(rank, { includeInstrumentRows: true });
    const headers = new Headers();
    headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=300");
    return NextResponse.json(
      {
        ok: true,
        rows: result.instrumentRows,
      },
      { headers },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected server error" },
      { status: 500 },
    );
  }
}
