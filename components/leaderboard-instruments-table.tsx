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
      {item.symbol}{" "}
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
    <div className="panel overflow-auto">
      <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">
        Instrument Leaderboard (Top1/2/3 by Return, Weight, Unrealized PnL)
      </div>
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {[
              "Name",
              "Cash Ratio",
              "Turnover20D",
              "Rtn Top1",
              "Rtn Top2",
              "Rtn Top3",
              "Wgt Top1",
              "Wgt Top2",
              "Wgt Top3",
              "PnL Top1",
              "PnL Top2",
              "PnL Top3",
            ].map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-3 text-left font-semibold">
                {h}
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
              <td className="whitespace-nowrap px-3 py-3">
                {renderStat(row.top_return, 0, formatPct)}
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                {renderStat(row.top_return, 1, formatPct)}
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                {renderStat(row.top_return, 2, formatPct)}
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                {renderStat(row.top_weight, 0, formatPct)}
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                {renderStat(row.top_weight, 1, formatPct)}
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                {renderStat(row.top_weight, 2, formatPct)}
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                {renderStat(row.top_unrealized, 0, formatKrw, false)}
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                {renderStat(row.top_unrealized, 1, formatKrw, false)}
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                {renderStat(row.top_unrealized, 2, formatKrw, false)}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={12} className="px-3 py-10 text-center text-slate-500">
                No instrument ranking data.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
