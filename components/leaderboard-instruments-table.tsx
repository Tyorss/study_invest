import { formatKrw, formatPct } from "@/lib/format";
import type { LeaderboardInstrumentsRow, RankedInstrumentStat } from "@/types/db";

function renderStat(
  stats: RankedInstrumentStat[],
  index: number,
  formatter: (value: number) => string,
  mono = true,
) {
  const item = stats[index];
  if (!item) return "-";
  return (
    <>
      {item.label ?? item.symbol}{" "}
      <span className={mono ? "num" : undefined}>({formatter(item.value)})</span>
    </>
  );
}

export function LeaderboardInstrumentsTable({
  rows,
}: {
  rows: LeaderboardInstrumentsRow[];
}) {
  return (
    <div className="overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
        참가자별 상위 종목 현황
      </div>
      <div className="divide-y divide-slate-200 md:hidden">
        {rows.map((row) => (
          <div key={row.participant_id} className="space-y-3 p-4 text-sm">
            <div className="font-semibold text-slate-900">
              <span
                className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: row.color_tag }}
              />
              {row.participant_name}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-500">현금 비중</div>
                <div className="mt-1 font-medium text-slate-900">{formatPct(row.cash_ratio)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">20일 회전율</div>
                <div className="mt-1 font-medium text-slate-900">{formatPct(row.turnover_20d)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">수익률 상위</div>
                <div className="mt-1 text-slate-900">{renderStat(row.top_return, 0, formatPct)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">비중 상위</div>
                <div className="mt-1 text-slate-900">{renderStat(row.top_weight, 0, formatPct)}</div>
              </div>
              <div className="col-span-2">
                <div className="text-xs text-slate-500">평가손익 상위</div>
                <div className="mt-1 text-slate-900">{renderStat(row.top_unrealized, 0, formatKrw, false)}</div>
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-10 text-center text-slate-500">표시할 종목 데이터가 없습니다.</div>}
      </div>
      <div className="hidden overflow-auto md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {[
                "참가자",
                "현금 비중",
                "20일 회전율",
                "수익률 상위 1",
                "수익률 상위 2",
                "수익률 상위 3",
                "비중 상위 1",
                "비중 상위 2",
                "평가손익 상위 1",
                "평가손익 상위 2",
              ].map((heading) => (
                <th key={heading} className="whitespace-nowrap px-3 py-3 text-left font-semibold">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.participant_id} className="border-t border-slate-200/70">
                <td className="whitespace-nowrap px-3 py-3">
                  <span
                    className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: row.color_tag }}
                  />
                  {row.participant_name}
                </td>
                <td className="num whitespace-nowrap px-3 py-3">{formatPct(row.cash_ratio)}</td>
                <td className="num whitespace-nowrap px-3 py-3">{formatPct(row.turnover_20d)}</td>
                <td className="whitespace-nowrap px-3 py-3">{renderStat(row.top_return, 0, formatPct)}</td>
                <td className="whitespace-nowrap px-3 py-3">{renderStat(row.top_return, 1, formatPct)}</td>
                <td className="whitespace-nowrap px-3 py-3">{renderStat(row.top_return, 2, formatPct)}</td>
                <td className="whitespace-nowrap px-3 py-3">{renderStat(row.top_weight, 0, formatPct)}</td>
                <td className="whitespace-nowrap px-3 py-3">{renderStat(row.top_weight, 1, formatPct)}</td>
                <td className="whitespace-nowrap px-3 py-3">{renderStat(row.top_unrealized, 0, formatKrw, false)}</td>
                <td className="whitespace-nowrap px-3 py-3">{renderStat(row.top_unrealized, 1, formatKrw, false)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-slate-500">
                  표시할 종목 데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
