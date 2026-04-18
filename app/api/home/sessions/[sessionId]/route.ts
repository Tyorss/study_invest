import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminSupabase } from "@/lib/supabase/admin";

const ALLOWED_FIELDS = new Set([
  "industry_name",
  "title",
  "presenter",
  "presented_at",
  "thesis",
  "anti_thesis",
  "note",
  "summary_md",
]);

function parseId(raw: string) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new Error("Invalid session id");
  return n;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  try {
    const sessionId = parseId(params.sessionId);
    const body = (await req.json()) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (!ALLOWED_FIELDS.has(k)) continue;
      if (typeof v === "string") {
        const trimmed = v.trim();
        patch[k] = trimmed.length === 0 ? null : trimmed;
      } else {
        patch[k] = v;
      }
    }
    if ("summary_md" in patch) {
      patch.summary_updated_at = new Date().toISOString();
    }
    const supabase = getAdminSupabase();
    const { error } = await supabase
      .from("study_sessions")
      .update(patch)
      .eq("id", sessionId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    revalidatePath("/");
    revalidatePath("/industries/[industryId]", "page");
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
