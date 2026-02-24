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
  nav_indexed: number;
  spy_indexed: number | null;
  kospi_indexed: number | null;
};

export function IndexedNavChart({ data }: { data: Point[] }) {
  return (
    <div className="panel p-4">
      <h3 className="text-base font-semibold text-slate-900">Indexed NAV vs SPY vs KOSPI</h3>
      <div className="mt-4 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" hide />
            <YAxis domain={["auto", "auto"]} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="nav_indexed"
              name="Portfolio"
              stroke="#0f172a"
              strokeWidth={2.5}
              dot={false}
            />
            <Line type="monotone" dataKey="spy_indexed" name="SPY" stroke="#0ea5a4" dot={false} />
            <Line type="monotone" dataKey="kospi_indexed" name="KOSPI" stroke="#2563eb" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
