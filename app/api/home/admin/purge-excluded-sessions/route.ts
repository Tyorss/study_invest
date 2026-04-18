// One-off admin endpoint: permanently delete study_sessions rows whose
// industry_name matches the excluded list (스테이블 코인, 삼성전기, etc).
// Not linked from UI — call manually via POST.
import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

const EXCLUDED_NAMES_CONTAINS = ["스테이블 코인", "스테이블코인", "삼성전기", "노머스"];

export async function POST() {
  try {
    const supabase = getAdminSupabase();
    const { data: rows, error: readErr } = await supabase
      .from("study_sessions")
      .select("id, industry_name");
    if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

    const targets = (rows ?? []).filter((r) =>
      EXCLUDED_NAMES_CONTAINS.some((n) => (r.industry_name as string).includes(n)),
    );
    if (targets.length === 0) {
      return NextResponse.json({ ok: true, deleted: [], message: "nothing to delete" });
    }

    const ids = targets.map((t) => t.id);
    const { error: delErr } = await supabase
      .from("study_sessions")
      .delete()
      .in("id", ids);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, deleted: targets });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "unknown" }, { status: 500 });
  }
}
