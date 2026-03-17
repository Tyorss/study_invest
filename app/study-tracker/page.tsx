import Link from "next/link";
import { StudyTrackerBoard } from "@/components/study-tracker-board";
import { fetchStudyTrackerData } from "@/lib/study-tracker";
import { withStudyTrackerHint } from "@/lib/study-tracker-payload";

export const dynamic = "force-dynamic";

export default async function StudyTrackerPage() {
  try {
    const data = await fetchStudyTrackerData();

    return (
      <main className="space-y-5">
        <header className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link href="/" className="text-sm text-slate-500 hover:underline">
                Back to Leaderboard
              </Link>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">Study Tracker</h1>
              <p className="mt-2 text-sm text-slate-600">
                Browser view of the study idea workbook seed. From here on, we manage additions and
                edits inside the page.
              </p>
            </div>
          </div>
        </header>

        <StudyTrackerBoard data={data} />
      </main>
    );
  } catch (err) {
    const message = withStudyTrackerHint(
      err instanceof Error ? err.message : "Failed to load study tracker",
    );
    return (
      <main className="space-y-5">
        <header className="panel p-5">
          <Link href="/" className="text-sm text-slate-500 hover:underline">
            Back to Leaderboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Study Tracker</h1>
        </header>
        <section className="panel p-5">
          <div className="text-sm text-rose-700">{message}</div>
        </section>
      </main>
    );
  }
}
