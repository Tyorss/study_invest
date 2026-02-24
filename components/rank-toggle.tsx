import Link from "next/link";

export function RankToggle({ active }: { active: "return" | "sharpe" }) {
  const base =
    "rounded-xl px-3 py-2 text-sm font-medium transition border";
  const activeCls = "bg-slate-900 text-white border-slate-900";
  const idleCls = "bg-white text-slate-700 border-slate-300 hover:bg-slate-50";

  return (
    <div className="inline-flex gap-2">
      <Link
        href="/?rank=return"
        className={`${base} ${active === "return" ? activeCls : idleCls}`}
      >
        Rank by Return
      </Link>
      <Link
        href="/?rank=sharpe"
        className={`${base} ${active === "sharpe" ? activeCls : idleCls}`}
      >
        Rank by Sharpe
      </Link>
    </div>
  );
}
