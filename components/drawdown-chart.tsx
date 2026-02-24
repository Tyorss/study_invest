"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = {
  date: string;
  drawdown: number;
};

export function DrawdownChart({ data }: { data: Point[] }) {
  return (
    <div className="panel p-4">
      <h3 className="text-base font-semibold text-slate-900">Drawdown</h3>
      <div className="mt-4 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" hide />
            <YAxis tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`} />
            <Tooltip formatter={(v) => `${(Number(v) * 100).toFixed(2)}%`} />
            <Area type="monotone" dataKey="drawdown" stroke="#ef4444" fill="#fecaca" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
