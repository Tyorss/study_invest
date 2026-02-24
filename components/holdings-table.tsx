import { formatKrw, formatNum } from "@/lib/format";

export function HoldingsTable({ rows }: { rows: any[] }) {
  return (
    <div className="panel overflow-auto">
      <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">Holdings</div>
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {[
              "Symbol",
              "Name",
              "Market",
              "Currency",
              "Quantity",
              "Avg Cost",
              "Mark",
              "Value (KRW)",
              "Unrealized (KRW)",
            ].map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-3 text-left font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const priceDigits = r.currency === "KRW" ? 0 : r.market === "US" ? 1 : 4;
            return (
              <tr key={`${r.symbol}-${r.market}`} className="border-t border-slate-200/70">
                <td className="px-3 py-3">{r.symbol}</td>
                <td className="px-3 py-3">{r.name}</td>
                <td className="px-3 py-3">{r.market}</td>
                <td className="px-3 py-3">{r.currency}</td>
                <td className="num px-3 py-3">{formatNum(r.quantity, 0)}</td>
                <td className="num px-3 py-3">{formatNum(r.avg_cost_local, priceDigits)}</td>
                <td className="num px-3 py-3">{formatNum(r.mark_local, priceDigits)}</td>
                <td className="px-3 py-3">{formatKrw(r.value_krw)}</td>
                <td className="px-3 py-3">{formatKrw(r.unrealized_pnl_krw)}</td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="px-3 py-10 text-center text-slate-500">
                No holdings
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
