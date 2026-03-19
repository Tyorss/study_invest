import { formatKrw, formatNum, formatPct } from "@/lib/format";

export function ParticipantHeader({ snapshot }: { snapshot: any }) {
  const basicItems = [
    ["총 자산", formatKrw(snapshot?.nav_krw)],
    ["현금", formatKrw(snapshot?.cash_krw)],
    ["누적 수익률", formatPct(snapshot?.total_return_pct)],
    ["SPY 대비", formatPct(snapshot?.alpha_spy_pct)],
  ];

  const advancedItems = [
    ["SPY 수익률", formatPct(snapshot?.spy_return_pct)],
    ["KOSPI 수익률", formatPct(snapshot?.kospi_return_pct)],
    ["KOSPI 대비", formatPct(snapshot?.alpha_kospi_pct)],
    ["샤프", formatNum(snapshot?.sharpe_252, 3)],
    ["변동성", formatNum(snapshot?.vol_ann_252, 3)],
    ["MDD", formatPct(snapshot?.mdd_to_date)],
    ["베타(SPY)", formatNum(snapshot?.beta_spy_252, 3)],
    ["베타(KOSPI)", formatNum(snapshot?.beta_kospi_252, 3)],
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {basicItems.map(([label, value]) => {
          const valueClass = label === "총 자산" || label === "현금" ? "metric-value mt-1" : "metric-value num mt-1";
          return (
            <div key={label} className="panel p-4">
              <div className="metric">{label}</div>
              <div className={valueClass}>{value}</div>
            </div>
          );
        })}
      </div>

      <details className="panel p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">고급 성과 지표 보기</summary>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {advancedItems.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 p-3">
              <div className="text-xs text-slate-500">{label}</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
