import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminSupabase } from "@/lib/supabase/admin";

const ALLOWED_FIELDS = new Set([
  "company_name",
  "ticker",
  "presenter",
  "sector",
  "thesis",
  "trigger",
  "risk",
  "note",
  "status",
  "category",
  "position_status",
  "currency",
  "pitch_price",
  "current_price",
  "included_price",
  "is_included",
  "presented_at",
  "style",
]);

function parseId(raw: string) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new Error("Invalid idea id");
  return n;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { ideaId: string } },
) {
  try {
    const ideaId = parseId(params.ideaId);
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
    // Sync is_included with position_status
    if ("position_status" in patch) {
      patch.is_included = patch.position_status === "active" || patch.position_status === "closed";
      if (patch.position_status === "closed" && !patch.exited_at) {
        patch.exited_at = new Date().toISOString().slice(0, 10);
      }
    }
    const supabase = getAdminSupabase();
    const { error } = await supabase
      .from("study_tracker_ideas")
      .update(patch)
      .eq("id", ideaId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    revalidatePath("/");
    revalidatePath("/study-tracker");
    revalidatePath("/industries/[industryId]", "page");
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { ideaId: string } },
) {
  try {
    const ideaId = parseId(params.ideaId);
    const supabase = getAdminSupabase();
    const { error } = await supabase
      .from("study_tracker_ideas")
      .delete()
      .eq("id", ideaId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    revalidatePath("/");
    revalidatePath("/study-tracker");
    revalidatePath("/industries/[industryId]", "page");
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
