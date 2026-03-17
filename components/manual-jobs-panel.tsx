"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type JobName = "run-daily" | "generate-snapshots";

type JobResult = {
  prices?: {
    status?: string;
    rows?: number;
    failures?: Array<unknown>;
  };
  fx?: {
    status?: string;
    rate?: number | null;
    failure?: string | null;
    warning?: string | null;
  };
  snapshots?: {
    status?: string;
    successCount?: number;
    failures?: Array<unknown>;
  };
  status?: string;
  successCount?: number;
  failures?: Array<unknown>;
};

type ManualJobResponse = {
  ok?: boolean;
  job?: JobName;
  targetDate?: string;
  result?: JobResult;
  error?: string;
};

function buildSummary(job: JobName, targetDate: string, result: JobResult | undefined) {
  if (!result) {
    return `${job} finished for ${targetDate}.`;
  }

  if (job === "run-daily") {
    const prices = result.prices;
    const fx = result.fx;
    const snapshots = result.snapshots;
    return [
      `Run daily finished for ${targetDate}.`,
      `Prices: ${prices?.status ?? "-"}`,
      prices?.rows !== undefined ? `rows=${prices.rows}` : null,
      fx?.status ? `FX: ${fx.status}` : null,
      snapshots?.status
        ? `Snapshots: ${snapshots.status}${snapshots.successCount !== undefined ? ` (${snapshots.successCount})` : ""}`
        : null,
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [
    `Snapshots regenerated for ${targetDate}.`,
    result.status ? `status=${result.status}` : null,
    result.successCount !== undefined ? `successCount=${result.successCount}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export function ManualJobsPanel({
  defaultDailyDate,
  defaultSnapshotDate,
}: {
  defaultDailyDate: string;
  defaultSnapshotDate: string;
}) {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [dailyDate, setDailyDate] = useState(defaultDailyDate);
  const [snapshotDate, setSnapshotDate] = useState(defaultSnapshotDate);
  const [busyJob, setBusyJob] = useState<JobName | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runJob(job: JobName, date: string) {
    setBusyJob(job);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/manual-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          job,
          date,
          secret,
        }),
      });
      const json = (await res.json()) as ManualJobResponse;
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `Failed to run ${job} (HTTP ${res.status})`);
      }

      setMessage(buildSummary(job, json.targetDate ?? date, json.result));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run manual update");
    } finally {
      setBusyJob(null);
    }
  }

  return (
    <section className="panel p-5">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Manual Update</h2>
          <p className="mt-1 text-sm text-slate-600">
            Use this when we want to rerun the pipeline immediately after manual trades or a failed
            daily job. The secret is checked server-side and never read back into the page.
          </p>
        </div>

        <label className="text-sm">
          <div className="mb-1 text-slate-600">CRON Secret</div>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Enter CRON secret"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
        </label>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Run Daily Date</div>
            <input
              type="date"
              value={dailyDate}
              onChange={(e) => setDailyDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <button
            type="button"
            disabled={busyJob !== null}
            onClick={() => runJob("run-daily", dailyDate)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 xl:self-end"
          >
            {busyJob === "run-daily" ? "Running..." : "Run Daily"}
          </button>

          <label className="text-sm">
            <div className="mb-1 text-slate-600">Snapshot Date</div>
            <input
              type="date"
              value={snapshotDate}
              onChange={(e) => setSnapshotDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <button
            type="button"
            disabled={busyJob !== null}
            onClick={() => runJob("generate-snapshots", snapshotDate)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60 xl:self-end"
          >
            {busyJob === "generate-snapshots" ? "Running..." : "Generate Snapshots"}
          </button>
        </div>

        <div className="text-xs text-slate-500">
          `Run Daily` updates prices, FX, and snapshots. `Generate Snapshots` is the fast rerun for
          leaderboard/detail refresh after trade edits.
        </div>

        {(message || error) && (
          <div
            className={`rounded-lg border px-3 py-2 text-sm ${
              error
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error ?? message}
          </div>
        )}
      </div>
    </section>
  );
}
