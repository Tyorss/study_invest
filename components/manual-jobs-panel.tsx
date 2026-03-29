"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type JobName =
  | "run-daily"
  | "generate-snapshots"
  | "backfill-benchmarks"
  | "backfill-traded-prices";

type JobResult = {
  prices?: {
    status?: string;
    rows?: number;
    failures?: Array<unknown>;
  };
  benchmarks?: {
    status?: string;
    startDate?: string;
    rows?: number;
    failures?: Array<unknown>;
    warnings?: Array<unknown>;
  };
  tradedPrices?: {
    status?: string;
    startDate?: string;
    rows?: number;
    instrumentCount?: number;
    unresolvedTargets?: number;
    failures?: Array<unknown>;
    warnings?: Array<unknown>;
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
  studyTracker?: {
    status?: string;
    totalIdeas?: number;
    refreshedCount?: number;
    pricedCount?: number;
    warnings?: Array<unknown>;
    failures?: Array<unknown>;
  };
  freeTopics?: {
    status?: string;
    totalCompanies?: number;
    refreshedCount?: number;
    pricedCount?: number;
    warnings?: Array<unknown>;
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
  startDate?: string;
  result?: JobResult;
  error?: string;
};

function translateError(message: string) {
  if (message.includes("Unauthorized")) return "운영 비밀번호가 맞지 않습니다.";
  if (message.includes("ADMIN_JOB_SECRET is not configured"))
    return "서버에 운영 비밀번호가 설정되지 않았습니다.";
  if (message.includes("Invalid JSON body")) return "요청 형식이 올바르지 않습니다.";
  if (message.includes("Invalid job type")) return "실행할 작업 종류가 올바르지 않습니다.";
  if (message.includes("date must be YYYY-MM-DD")) return "날짜 형식은 YYYY-MM-DD여야 합니다.";
  if (message.includes("startDate must be YYYY-MM-DD"))
    return "시작일 형식은 YYYY-MM-DD여야 합니다.";
  if (message.includes("startDate must be on or before date"))
    return "시작일은 종료일보다 늦을 수 없습니다.";
  return message;
}

function buildSummary(
  job: JobName,
  targetDate: string,
  result: JobResult | undefined,
  startDate?: string,
) {
  if (!result) {
    return `${targetDate} 기준 작업이 완료되었습니다.`;
  }

  if (job === "run-daily") {
    const prices = result.prices;
    const benchmarks = result.benchmarks;
    const fx = result.fx;
    const snapshots = result.snapshots;
    const studyTracker = result.studyTracker;
    const freeTopics = result.freeTopics;
    return [
      `${targetDate} 기준 일일 업데이트를 실행했습니다.`,
      prices?.rows !== undefined ? `가격 ${prices.rows}건 처리` : null,
      benchmarks?.rows !== undefined ? `벤치마크 최신값 ${benchmarks.rows}건 반영` : null,
      fx?.status ? `환율 ${fx.status}` : null,
      snapshots?.successCount !== undefined ? `스냅샷 ${snapshots.successCount}명 반영` : null,
      studyTracker?.refreshedCount !== undefined
        ? `스터디 종목 ${studyTracker.refreshedCount}건 갱신`
        : null,
      studyTracker?.failures && studyTracker.failures.length > 0
        ? `미조회 ${studyTracker.failures.length}건`
        : null,
      freeTopics?.refreshedCount !== undefined
        ? `자유 종목 ${freeTopics.refreshedCount}건 갱신`
        : null,
      freeTopics?.failures && freeTopics.failures.length > 0
        ? `자유 종목 미조회 ${freeTopics.failures.length}건`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (job === "backfill-benchmarks") {
    return [
      `벤치마크 과거 데이터를 채웠습니다.`,
      startDate ? `${startDate} ~ ${targetDate}` : targetDate,
      result.benchmarks?.rows !== undefined
        ? `추가 ${result.benchmarks.rows}건`
        : null,
      result.benchmarks?.failures && result.benchmarks.failures.length > 0
        ? `실패 ${result.benchmarks.failures.length}건`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (job === "backfill-traded-prices") {
    return [
      `종목 과거 가격을 채웠습니다.`,
      startDate ? `${startDate} ~ ${targetDate}` : targetDate,
      result.tradedPrices?.instrumentCount !== undefined
        ? `대상 종목 ${result.tradedPrices.instrumentCount}개`
        : null,
      result.tradedPrices?.rows !== undefined
        ? `추가 ${result.tradedPrices.rows}건`
        : null,
      result.tradedPrices?.unresolvedTargets
        ? `미매핑 ${result.tradedPrices.unresolvedTargets}개`
        : null,
      result.tradedPrices?.failures && result.tradedPrices.failures.length > 0
        ? `실패 ${result.tradedPrices.failures.length}건`
        : null,
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
  defaultBenchmarkStartDate,
  defaultTradedPriceStartDate,
}: {
  defaultDailyDate: string;
  defaultSnapshotDate: string;
  defaultBenchmarkStartDate: string;
  defaultTradedPriceStartDate: string;
}) {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [dailyDate, setDailyDate] = useState(defaultDailyDate);
  const [snapshotDate, setSnapshotDate] = useState(defaultSnapshotDate);
  const [benchmarkStartDate, setBenchmarkStartDate] = useState(defaultBenchmarkStartDate);
  const [benchmarkEndDate, setBenchmarkEndDate] = useState(defaultDailyDate);
  const [tradedPriceStartDate, setTradedPriceStartDate] = useState(defaultTradedPriceStartDate);
  const [tradedPriceEndDate, setTradedPriceEndDate] = useState(defaultDailyDate);
  const [busyJob, setBusyJob] = useState<JobName | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runJob(job: JobName, date: string, startDate?: string) {
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
          startDate,
          secret,
        }),
      });
      const json = (await res.json()) as ManualJobResponse;
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }

      setMessage(buildSummary(job, json.targetDate ?? date, json.result, json.startDate ?? startDate));
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
          <p className="mt-1 text-xs text-slate-500">
            별도 설정이 있으면 <code>ADMIN_JOB_SECRET</code>를, 없으면 기존 <code>CRON_SECRET</code>를 사용합니다.
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

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="text-sm">
            <div className="mb-1 text-slate-600">벤치마크 백필 시작일</div>
            <input
              type="date"
              value={benchmarkStartDate}
              onChange={(e) => setBenchmarkStartDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">벤치마크 백필 종료일</div>
            <input
              type="date"
              value={benchmarkEndDate}
              onChange={(e) => setBenchmarkEndDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <button
            type="button"
            disabled={busyJob !== null}
            onClick={() => runJob("backfill-benchmarks", benchmarkEndDate, benchmarkStartDate)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60 xl:self-end"
          >
            {busyJob === "backfill-benchmarks" ? "실행 중..." : "벤치마크 과거 채우기"}
          </button>
        </div>

        <div className="text-xs text-slate-500">
          일일 업데이트는 당일 최신 가격, 환율, 스냅샷만 갱신합니다. 과거 SPY/KOSPI 비교 구간이
          비어 있으면 아래의 벤치마크 과거 채우기를 별도로 실행하세요.
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="text-sm">
            <div className="mb-1 text-slate-600">종목 가격 백필 시작일</div>
            <input
              type="date"
              value={tradedPriceStartDate}
              onChange={(e) => setTradedPriceStartDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">종목 가격 백필 종료일</div>
            <input
              type="date"
              value={tradedPriceEndDate}
              onChange={(e) => setTradedPriceEndDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <button
            type="button"
            disabled={busyJob !== null}
            onClick={() =>
              runJob("backfill-traded-prices", tradedPriceEndDate, tradedPriceStartDate)
            }
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60 xl:self-end"
          >
            {busyJob === "backfill-traded-prices" ? "실행 중..." : "종목 가격 채우기"}
          </button>
        </div>

        <div className="text-xs text-slate-500">
          이 작업은 실제 거래 종목에 더해 스터디 종목과 자유 종목에 연결되는 종목까지 함께 보고,
          선택한 기간의 일별 가격 히스토리를 채웁니다. 포트폴리오 비교 차트와 종목 추적 정확도를
          함께 보강할 때 사용하세요.
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
