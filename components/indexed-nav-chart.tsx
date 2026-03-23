"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = {
  date: string;
  date_ts?: number;
  nav_indexed: number;
  spy_indexed: number | null;
  kospi_indexed: number | null;
};

function isoDateFromValue(value: string | number) {
  return typeof value === "number"
    ? new Date(value).toISOString().slice(0, 10)
    : String(value);
}

function formatAxisDate(value: string | number) {
  return isoDateFromValue(value).slice(5);
}

export function IndexedNavChart({
  data,
  showSpy,
  showKospi,
  onToggleSpy,
  onToggleKospi,
}: {
  data: Point[];
  showSpy: boolean;
  showKospi: boolean;
  onToggleSpy: () => void;
  onToggleKospi: () => void;
}) {
  const ordered = [...data].sort(
    (a, b) => (a.date_ts ?? Date.parse(`${a.date}T00:00:00Z`)) - (b.date_ts ?? Date.parse(`${b.date}T00:00:00Z`)),
  );
  const tickCount = Math.min(Math.max(ordered.length, 2), 6);

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">포트폴리오 비교</h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onToggleSpy}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              showSpy
                ? "border-teal-500 bg-teal-50 text-teal-700"
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            SPY
          </button>
          <button
            type="button"
            onClick={onToggleKospi}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              showKospi
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            KOSPI
          </button>
        </div>
      </div>
      <div className="mt-4 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={ordered}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date_ts"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={formatAxisDate}
              tickCount={tickCount}
              minTickGap={24}
              interval="preserveStartEnd"
            />
            <YAxis domain={["auto", "auto"]} />
            <Tooltip labelFormatter={(value) => isoDateFromValue(value)} />
            <Legend />
            <Line
              type="linear"
              dataKey="nav_indexed"
              name="내 포트폴리오"
              stroke="#0f172a"
              strokeWidth={2.5}
              dot={false}
              connectNulls
            />
            {showSpy ? (
              <Line
                type="linear"
                dataKey="spy_indexed"
                name="SPY"
                stroke="#0ea5a4"
                dot={false}
                connectNulls
              />
            ) : null}
            {showKospi ? (
              <Line
                type="linear"
                dataKey="kospi_indexed"
                name="KOSPI"
                stroke="#2563eb"
                dot={false}
                connectNulls
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
