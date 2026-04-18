import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminSupabase } from "@/lib/supabase/admin";

const ALLOWED_FIELDS = new Set([
  "company_name",
  "ticker",
  "sector",
  "session_stance",
  "follow_up_status",
  "mention_reason",
  "note",
]);

function parseId(raw: string) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new Error("Invalid company id");
  return n;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { companyId: string } },
) {
  try {
    const companyId = parseId(params.companyId);
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
    const supabase = getAdminSupabase();
    const { error } = await supabase
      .from("study_session_companies")
      .update(patch)
      .eq("id", companyId);
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { companyId: string } },
) {
  try {
    const companyId = parseId(params.companyId);
    const supabase = getAdminSupabase();
    const { error } = await supabase
      .from("study_session_companies")
      .delete()
      .eq("id", companyId);
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
