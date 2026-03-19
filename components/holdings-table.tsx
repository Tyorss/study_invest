import { formatKrw, formatNum } from "@/lib/format";

export function HoldingsTable({ rows }: { rows: any[] }) {
  return (
    <div className="panel overflow-auto">
      <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">보유 종목</div>
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {["종목코드", "종목명", "시장", "통화", "수량", "평균단가", "현재가", "평가금액(원)", "평가손익(원)"].map(
              (heading) => (
                <th key={heading} className="whitespace-nowrap px-3 py-3 text-left font-semibold">
                  {heading}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const priceDigits = row.currency === "KRW" ? 0 : row.market === "US" ? 1 : 4;
            return (
              <tr key={`${row.symbol}-${row.market}`} className="border-t border-slate-200/70">
                <td className="px-3 py-3">{row.symbol}</td>
                <td className="px-3 py-3">{row.name}</td>
                <td className="px-3 py-3">{row.market}</td>
                <td className="px-3 py-3">{row.currency}</td>
                <td className="num px-3 py-3">{formatNum(row.quantity, 0)}</td>
                <td className="num px-3 py-3">{formatNum(row.avg_cost_local, priceDigits)}</td>
                <td
                  className={`num px-3 py-3 ${row.price_unavailable ? "font-medium text-rose-600" : ""}`}
                  title={row.price_unavailable ? "실시간 시세를 찾지 못해 평균단가로 대신 표시했습니다." : undefined}
                >
                  {formatNum(row.mark_local, priceDigits)}
                </td>
                <td className="px-3 py-3">{formatKrw(row.value_krw)}</td>
                <td className="px-3 py-3">{formatKrw(row.unrealized_pnl_krw)}</td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="px-3 py-10 text-center text-slate-500">
                현재 보유 종목이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
