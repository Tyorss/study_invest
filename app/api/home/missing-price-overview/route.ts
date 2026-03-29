import { NextResponse } from "next/server";
import { fetchMissingPriceOverview } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await fetchMissingPriceOverview();
    const headers = new Headers();
    headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=300");
    return NextResponse.json(
      {
        ok: true,
        uniqueCount: result.uniqueCount,
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
