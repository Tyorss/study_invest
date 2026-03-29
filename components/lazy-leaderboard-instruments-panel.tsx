"use client";

import { useEffect, useState } from "react";
import { LeaderboardInstrumentsTable } from "@/components/leaderboard-instruments-table";
import type { LeaderboardInstrumentsRow } from "@/types/db";

type ResponseShape = {
  ok?: boolean;
  rows?: LeaderboardInstrumentsRow[];
  error?: string;
};

export function LazyLeaderboardInstrumentsPanel({
  rank,
}: {
  rank: "return" | "sharpe";
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<LeaderboardInstrumentsRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || rows !== null || loading) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ rank });
        const res = await fetch(`/api/home/leaderboard-instruments?${params.toString()}`);
        const json = (await res.json()) as ResponseShape;
        if (!res.ok || !json.ok) {
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }
        if (!cancelled) {
          setRows(json.rows ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "고급 데이터를 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [loading, open, rank, rows]);

  return (
    <details
      className="panel overflow-hidden"
      open={open}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900">
        고급 보기: 종목별 비중/수익 상위 현황
      </summary>
      <div className="border-t border-slate-200">
        {loading ? (
          <div className="px-4 py-8 text-sm text-slate-500">고급 데이터를 불러오는 중입니다.</div>
        ) : error ? (
          <div className="px-4 py-8 text-sm text-rose-700">{error}</div>
        ) : rows ? (
          <LeaderboardInstrumentsTable rows={rows} />
        ) : (
          <div className="px-4 py-8 text-sm text-slate-500">
            펼치면 참가자별 종목 통계를 불러옵니다.
          </div>
        )}
      </div>
    </details>
  );
}
