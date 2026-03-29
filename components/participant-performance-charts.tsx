"use client";

import { useEffect, useMemo, useState } from "react";
import { IndexedNavChart } from "@/components/indexed-nav-chart";

type ChartPoint = {
  date: string;
  nav_indexed: number;
  spy_indexed: number | null;
  kospi_indexed: number | null;
  drawdown: number;
};

type SeriesResponse = {
  ok?: boolean;
  rows?: ChartPoint[];
  error?: string;
};

function shiftDate(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function clampDate(value: string, min: string, max: string) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function ParticipantPerformanceCharts({
  firstTradeDate,
  participantId,
  refreshToken = 0,
}: {
  firstTradeDate: string | null;
  participantId: string;
  refreshToken?: number;
}) {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(true);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showSpy, setShowSpy] = useState(false);
  const [showKospi, setShowKospi] = useState(false);

  const minDate = data[0]?.date ?? null;
  const maxDate = data[data.length - 1]?.date ?? null;

  useEffect(() => {
    let cancelled = false;

    async function loadSeries() {
      setSeriesLoading(true);
      setSeriesError(null);

      try {
        const res = await fetch(`/api/participants/${participantId}/performance-series`, {
          method: "GET",
        });
        const contentType = res.headers.get("content-type") ?? "";
        let json: SeriesResponse | null = null;
        if (contentType.includes("application/json")) {
          json = (await res.json()) as SeriesResponse;
        } else {
          const text = await res.text();
          throw new Error(
            text?.trim()
              ? `차트 API 응답이 JSON이 아닙니다. ${text.slice(0, 160)}`
              : `차트 API 응답 형식이 올바르지 않습니다. (HTTP ${res.status})`,
          );
        }
        if (!res.ok || !json.ok) {
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }
        if (cancelled) return;

        const rows = json.rows ?? [];
        setData(rows);
        const nextMin = rows[0]?.date ?? "";
        const nextMax = rows[rows.length - 1]?.date ?? "";
        if (nextMin && nextMax) {
          setStartDate((prev) =>
            prev ? clampDate(prev, nextMin, nextMax) : clampDate(firstTradeDate ?? nextMin, nextMin, nextMax),
          );
          setEndDate((prev) => (prev ? clampDate(prev, nextMin, nextMax) : nextMax));
        }
        setSeriesLoading(false);
      } catch (err) {
        if (cancelled) return;
        setSeriesLoading(false);
        setSeriesError(err instanceof Error ? err.message : "차트 데이터를 불러오지 못했습니다.");
        setData([]);
      }
    }

    void loadSeries();

    return () => {
      cancelled = true;
    };
  }, [firstTradeDate, participantId, refreshToken]);

  const filteredData = useMemo(() => {
    if (!startDate || !endDate) return data;
    return data.filter((point) => point.date >= startDate && point.date <= endDate);
  }, [data, endDate, startDate]);

  const rebasedData = useMemo(() => {
    const source = filteredData.length > 0 ? filteredData : data;
    if (source.length === 0) return source;
    const ordered = [...source].sort((a, b) => a.date.localeCompare(b.date));

    const navBase =
      ordered.find((point) => Number.isFinite(point.nav_indexed))?.nav_indexed ?? null;
    const spyBase = ordered.find((point) => point.spy_indexed !== null)?.spy_indexed ?? null;
    const kospiBase =
      ordered.find((point) => point.kospi_indexed !== null)?.kospi_indexed ?? null;

    return ordered.map((point, index) => ({
      ...point,
      date_ts: Date.parse(`${point.date}T00:00:00Z`),
      nav_indexed:
        navBase !== null && navBase !== 0
          ? (point.nav_indexed / navBase) * 100
          : point.nav_indexed,
      spy_indexed:
        point.spy_indexed !== null && spyBase !== null && spyBase !== 0
          ? (point.spy_indexed / spyBase) * 100
          : point.spy_indexed,
      kospi_indexed:
        point.kospi_indexed !== null && kospiBase !== null && kospiBase !== 0
          ? (point.kospi_indexed / kospiBase) * 100
          : point.kospi_indexed,
      drawdown: index === 0 ? 0 : point.drawdown,
    }));
  }, [data, filteredData]);

  function applyPreset(days: number | "all" | "first-trade") {
    if (!minDate || !maxDate) return;

    if (days === "all") {
      setStartDate(minDate);
      setEndDate(maxDate);
      return;
    }

    if (days === "first-trade") {
      setStartDate(clampDate(firstTradeDate ?? minDate, minDate, maxDate));
      setEndDate(maxDate);
      return;
    }

    setStartDate(clampDate(shiftDate(maxDate, -days + 1), minDate, maxDate));
    setEndDate(maxDate);
  }

  return (
    <section className="space-y-4">
      <div className="panel p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">성과 차트 기간</h3>
            <p className="mt-1 text-sm text-slate-600">
              기본 시작일은 첫 거래일입니다. 필요하면 기간을 직접 조정해 볼 수 있습니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyPreset("first-trade")}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              첫 거래일부터
            </button>
            <button
              type="button"
              onClick={() => applyPreset(30)}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              최근 1개월
            </button>
            <button
              type="button"
              onClick={() => applyPreset(90)}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              최근 3개월
            </button>
            <button
              type="button"
              onClick={() => applyPreset("all")}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              전체
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm">
            <div className="mb-1 text-slate-600">시작일</div>
            <input
              type="date"
              min={minDate ?? undefined}
              max={endDate || maxDate || undefined}
              value={startDate}
              onChange={(e) => {
                const next = e.target.value;
                setStartDate(next);
                if (endDate && next > endDate) {
                  setEndDate(next);
                }
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">종료일</div>
            <input
              type="date"
              min={startDate || minDate || undefined}
              max={maxDate ?? undefined}
              value={endDate}
              onChange={(e) => {
                const next = e.target.value;
                setEndDate(next);
                if (startDate && next < startDate) {
                  setStartDate(next);
                }
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
        </div>
      </div>

      {seriesLoading ? (
        <div className="panel p-4">
          <h3 className="text-base font-semibold text-slate-900">포트폴리오 비교</h3>
          <div className="mt-4 h-72 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            차트 데이터를 불러오는 중입니다.
          </div>
        </div>
      ) : seriesError ? (
        <div className="panel p-4">
          <h3 className="text-base font-semibold text-slate-900">포트폴리오 비교</h3>
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {seriesError}
          </div>
        </div>
      ) : (
        <IndexedNavChart
          data={rebasedData}
          showSpy={showSpy}
          showKospi={showKospi}
          onToggleSpy={() => setShowSpy((prev) => !prev)}
          onToggleKospi={() => setShowKospi((prev) => !prev)}
        />
      )}
    </section>
  );
}
