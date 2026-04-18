// One-off: apply migrations/0012_fix_industry_dates.sql via Supabase service role.
// Run with: npx tsx scripts/fix-industry-dates.ts
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

function loadEnv(file: string) {
  const raw = fs.readFileSync(file, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv(path.join(__dirname, "..", ".env.local"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key, { auth: { persistSession: false } });

const updates: Array<{ industry_name: string; presented_at: string; presenter: string; title: string }> = [
  { industry_name: "방산",       presented_at: "2025-08-26", presenter: "스터디",  title: "방산 산업 발표" },
  { industry_name: "조선",       presented_at: "2025-10-27", presenter: "이동훈",  title: "조선 산업 발표" },
  { industry_name: "반도체",     presented_at: "2025-12-29", presenter: "한주영",  title: "반도체 산업 발표" },
  { industry_name: "소프트웨어", presented_at: "2026-02-09", presenter: "스터디",  title: "소프트웨어 산업 발표" },
  { industry_name: "화장품",     presented_at: "2026-03-30", presenter: "스터디",  title: "화장품 산업 발표" },
];

async function main() {
  for (const u of updates) {
    const { error, count } = await supabase
      .from("study_sessions")
      .update({ presented_at: u.presented_at, presenter: u.presenter, title: u.title }, { count: "exact" })
      .eq("industry_name", u.industry_name);
    if (error) {
      console.error(`FAIL ${u.industry_name}: ${error.message}`);
    } else {
      console.log(`OK   ${u.industry_name} -> ${u.presented_at} (${u.presenter}), rows=${count}`);
    }
  }
}

main();
