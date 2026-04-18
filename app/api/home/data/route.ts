import { NextResponse } from "next/server";
import { fetchHomeData } from "@/lib/home-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchHomeData();
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
