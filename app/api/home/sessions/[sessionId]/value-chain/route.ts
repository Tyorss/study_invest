import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminSupabase } from "@/lib/supabase/admin";

function parseId(raw: string) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new Error("Invalid session id");
  return n;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  try {
    const sessionId = parseId(params.sessionId);
    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from("study_session_value_chains")
      .select("layers, nodes, edges, companies, updated_at")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? null);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "unknown" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  try {
    const sessionId = parseId(params.sessionId);
    const body = (await req.json()) as {
      layers?: unknown;
      nodes?: unknown;
      edges?: unknown;
      companies?: unknown;
    };
    const row = {
      session_id: sessionId,
      layers: body.layers ?? [],
      nodes: body.nodes ?? [],
      edges: body.edges ?? [],
      companies: body.companies ?? {},
    };
    const supabase = getAdminSupabase();
    const { error } = await supabase
      .from("study_session_value_chains")
      .upsert(row, { onConflict: "session_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    revalidatePath("/industries/[industryId]", "page");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "unknown" }, { status: 500 });
  }
}
