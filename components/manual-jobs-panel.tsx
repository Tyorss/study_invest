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

function translateError(message: string) {
  if (message.includes("Unauthorized")) return "운영 비밀번호가 맞지 않습니다.";
  if (message.includes("CRON_SECRET is not configured")) return "서버에 운영 비밀번호가 설정되지 않았습니다.";
  if (message.includes("Invalid JSON body")) return "요청 형식이 올바르지 않습니다.";
  if (message.includes("Invalid job type")) return "실행할 작업 종류가 올바르지 않습니다.";
  if (message.includes("date must be YYYY-MM-DD")) return "날짜 형식은 YYYY-MM-DD여야 합니다.";
  return message;
}

function buildSummary(job: JobName, targetDate: string, result: JobResult | undefined) {
  if (!result) {
    return `${targetDate} 기준 작업이 완료되었습니다.`;
  }

  if (job === "run-daily") {
    const prices = result.prices;
    const fx = result.fx;
    const snapshots = result.snapshots;
    return [
      `${targetDate} 기준 일일 업데이트를 실행했습니다.`,
      prices?.rows !== undefined ? `가격 ${prices.rows}건 처리` : null,
      fx?.status ? `환율 ${fx.status}` : null,
      snapshots?.successCount !== undefined ? `스냅샷 ${snapshots.successCount}명 반영` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  return [
    `${targetDate} 기준 스냅샷을 다시 만들었습니다.`,
    result.successCount !== undefined ? `${result.successCount}명 반영` : null,
  ]
    .filter(Boolean)
    .join(" · ");
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
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }

      setMessage(buildSummary(job, json.targetDate ?? date, json.result));
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "작업 실행에 실패했습니다.";
      setError(translateError(message));
    } finally {
      setBusyJob(null);
    }
  }

  return (
    <section className="panel p-5">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">운영자용 업데이트 도구</h2>
          <p className="mt-1 text-sm text-slate-600">
            일반 사용자용 화면이 아니라 운영자가 가격, 환율, 스냅샷을 수동으로 다시 돌릴 때 사용하는 메뉴입니다.
          </p>
        </div>

        <label className="text-sm">
          <div className="mb-1 text-slate-600">운영 비밀번호</div>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="운영 비밀번호 입력"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
        </label>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
          <label className="text-sm">
            <div className="mb-1 text-slate-600">일일 업데이트 기준일</div>
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
            {busyJob === "run-daily" ? "실행 중..." : "일일 업데이트 실행"}
          </button>

          <label className="text-sm">
            <div className="mb-1 text-slate-600">스냅샷 기준일</div>
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
            {busyJob === "generate-snapshots" ? "실행 중..." : "스냅샷 다시 만들기"}
          </button>
        </div>

        <div className="text-xs text-slate-500">
          일일 업데이트 실행은 가격, 환율, 스냅샷을 모두 갱신합니다. 스냅샷 다시 만들기는 거래 수정 후
          리더보드와 상세 화면을 빠르게 다시 맞출 때 사용합니다.
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
