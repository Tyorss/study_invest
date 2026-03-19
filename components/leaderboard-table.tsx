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
            {["순위", "참가자", "누적 수익률", rankBy === "sharpe" ? "샤프" : "랭킹 기준", "총 자산", "평가손익", "실현손익", "바로가기"].map(
              (heading) => (
                <th key={heading} className="whitespace-nowrap px-3 py-3 text-left font-semibold">
                  {heading}
                </th>
              ),
            )}
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
                  <span
                    className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: row.color_tag }}
                  />
                  {row.participant_name}
                </Link>
              </td>
              <td className="num px-3 py-3">{formatPct(row.total_return_pct)}</td>
              <td className="num px-3 py-3">
                {rankBy === "sharpe" ? formatNum(row.sharpe_252, 3) : formatPct(row.total_return_pct)}
              </td>
              <td className="px-3 py-3">{formatKrw(row.nav_krw)}</td>
              <td className="px-3 py-3">{formatKrw(row.unrealized_pnl_krw)}</td>
              <td className="px-3 py-3">{formatKrw(row.realized_pnl_krw)}</td>
              <td className="px-3 py-3">
                <Link
                  href={`/participants/${row.participant_id}`}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  상세 보기
                </Link>
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                아직 생성된 평가 데이터가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
