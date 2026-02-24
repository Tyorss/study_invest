import Link from "next/link";
import { formatKrw, formatNum, formatPct } from "@/lib/format";
import type { LeaderboardRow } from "@/types/db";

export function LeaderboardTable({
  rows,
  rankBy,
}: {
  rows: LeaderboardRow[];
  rankBy: "return" | "sharpe";
}) {
  const sorted = [...rows].sort((a, b) => {
    if (rankBy === "sharpe") {
      return (b.sharpe_252 ?? Number.NEGATIVE_INFINITY) - (a.sharpe_252 ?? Number.NEGATIVE_INFINITY);
    }
    return b.total_return_pct - a.total_return_pct;
  });

  return (
    <div className="panel overflow-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {[
              "Rank",
              "Name",
              "Return",
              "Alpha_SPY",
              "Alpha_KOSPI",
              "Sharpe",
              "Vol",
              "MDD",
              "Beta(SPY)",
              "Beta(KOSPI)",
              "NAV",
              "Realized",
              "Unrealized",
            ].map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-3 text-left font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, idx) => (
            <tr key={row.participant_id} className="border-t border-slate-200/70 hover:bg-slate-50/80">
              <td className="num px-3 py-3">{idx + 1}</td>
              <td className="px-3 py-3 whitespace-nowrap">
                <Link
                  href={`/participants/${row.participant_id}`}
                  className="inline-flex items-center whitespace-nowrap hover:underline"
                >
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color_tag }} />
                  {row.participant_name}
                </Link>
              </td>
              <td className="num px-3 py-3">{formatPct(row.total_return_pct)}</td>
              <td className="num px-3 py-3">{formatPct(row.alpha_spy_pct)}</td>
              <td className="num px-3 py-3">{formatPct(row.alpha_kospi_pct)}</td>
              <td className="num px-3 py-3">{formatNum(row.sharpe_252, 3)}</td>
              <td className="num px-3 py-3">{formatNum(row.vol_ann_252, 3)}</td>
              <td className="num px-3 py-3">{formatPct(row.mdd_to_date)}</td>
              <td className="num px-3 py-3">{formatNum(row.beta_spy_252, 3)}</td>
              <td className="num px-3 py-3">{formatNum(row.beta_kospi_252, 3)}</td>
              <td className="px-3 py-3">{formatKrw(row.nav_krw)}</td>
              <td className="px-3 py-3">{formatKrw(row.realized_pnl_krw)}</td>
              <td className="px-3 py-3">{formatKrw(row.unrealized_pnl_krw)}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={13} className="px-3 py-10 text-center text-slate-500">
                No snapshots generated yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
