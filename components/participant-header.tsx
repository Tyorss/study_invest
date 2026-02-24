import { formatKrw, formatNum, formatPct } from "@/lib/format";

export function ParticipantHeader({ snapshot }: { snapshot: any }) {
  const items = [
    ["NAV", formatKrw(snapshot?.nav_krw)],
    ["Cash", formatKrw(snapshot?.cash_krw)],
    ["Return", formatPct(snapshot?.total_return_pct)],
    ["SPY Return", formatPct(snapshot?.spy_return_pct)],
    ["KOSPI Return", formatPct(snapshot?.kospi_return_pct)],
    ["Alpha_SPY", formatPct(snapshot?.alpha_spy_pct)],
    ["Alpha_KOSPI", formatPct(snapshot?.alpha_kospi_pct)],
    ["Sharpe", formatNum(snapshot?.sharpe_252, 3)],
    ["Vol", formatNum(snapshot?.vol_ann_252, 3)],
    ["MDD", formatPct(snapshot?.mdd_to_date)],
    ["Beta(SPY)", formatNum(snapshot?.beta_spy_252, 3)],
    ["Beta(KOSPI)", formatNum(snapshot?.beta_kospi_252, 3)],
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
      {items.map(([label, value]) => {
        const valueClass = label === "NAV" || label === "Cash" ? "metric-value mt-1" : "metric-value num mt-1";
        return (
          <div key={label} className="panel p-4">
            <div className="metric">{label}</div>
            <div className={valueClass}>{value}</div>
          </div>
        );
      })}
    </div>
  );
}
