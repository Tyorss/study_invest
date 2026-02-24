import { formatNum, formatPct } from "@/lib/format";
import type { LeaderboardRow } from "@/types/db";

interface Props {
  rows: LeaderboardRow[];
}

function top3Names(rows: LeaderboardRow[], key: keyof LeaderboardRow, asc = false) {
  const sorted = [...rows].sort((a, b) => {
    const avRaw = a[key];
    const bvRaw = b[key];
    const av =
      avRaw === null || avRaw === undefined
        ? asc
          ? Number.POSITIVE_INFINITY
          : Number.NEGATIVE_INFINITY
        : Number(avRaw);
    const bv =
      bvRaw === null || bvRaw === undefined
        ? asc
          ? Number.POSITIVE_INFINITY
          : Number.NEGATIVE_INFINITY
        : Number(bvRaw);
    return asc ? av - bv : bv - av;
  });
  return sorted.slice(0, 3).map((x) => x.participant_name).join(", ") || "-";
}

export function SummaryCards({ rows }: Props) {
  const lowestMdd = [...rows].sort((a, b) => b.mdd_to_date - a.mdd_to_date)[0];
  const lowestVol = [...rows].sort(
    (a, b) => (a.vol_ann_252 ?? 9e9) - (b.vol_ann_252 ?? 9e9),
  )[0];
  const lowestBeta = [...rows].sort(
    (a, b) => Math.abs(a.beta_spy_252 ?? 9e9) - Math.abs(b.beta_spy_252 ?? 9e9),
  )[0];

  const cards = [
    { title: "Top3 Return", value: top3Names(rows, "total_return_pct") },
    { title: "Top3 Sharpe", value: top3Names(rows, "sharpe_252") },
    {
      title: "Lowest MDD",
      value: `${lowestMdd?.participant_name ?? "-"} (${formatPct(lowestMdd?.mdd_to_date)})`,
    },
    {
      title: "Lowest Vol",
      value: `${lowestVol?.participant_name ?? "-"} (${formatNum(lowestVol?.vol_ann_252, 3)})`,
    },
    {
      title: "Lowest Beta",
      value: `${lowestBeta?.participant_name ?? "-"} (${formatNum(lowestBeta?.beta_spy_252, 3)})`,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
      {cards.map((c) => (
        <div key={c.title} className="panel p-4">
          <div className="metric">{c.title}</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

