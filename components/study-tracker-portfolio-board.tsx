"use client";

import { useMemo, useState } from "react";
import { formatPct } from "@/lib/format";
import type {
  StudyTrackerIdea,
  StudyTrackerPortfolioData,
  StudyTrackerPortfolioSummary,
} from "@/types/study-tracker";

type SortKey =
  | "company_name"
  | "presenter"
  | "included_at"
  | "position_status"
  | "portfolio_return_pct"
  | "weight";

type SortDirection = "asc" | "desc";

function formatPrice(value: number | null, currency: StudyTrackerIdea["currency"]) {
  if (value === null) return "-";
  const digits = currency === "KRW" ? 0 : 1;
  if (currency === "USD") {
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: digits })}`;
  }
  if (currency === "KRW") {
    return `₩${value.toLocaleString("ko-KR", { maximumFractionDigits: digits })}`;
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function toneClass(value: number | null) {
  if (value === null) return "text-slate-900";
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-rose-700";
  return "text-slate-900";
}

function compareNullableString(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? "").localeCompare(b ?? "", "ko-KR");
}

function compareNullableNumber(a: number | null | undefined, b: number | null | undefined) {
  const av = a ?? Number.NEGATIVE_INFINITY;
  const bv = b ?? Number.NEGATIVE_INFINITY;
  return av - bv;
}

function normalizeWeight(weight: number | null) {
  return weight !== null && Number.isFinite(weight) && weight > 0 ? weight : 1;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildPortfolioSummary(ideas: StudyTrackerIdea[]): StudyTrackerPortfolioSummary {
  const valid = ideas.filter((idea) => idea.portfolio_return_pct !== null);
  const totalWeight = valid.reduce((sum, idea) => sum + normalizeWeight(idea.weight), 0);
  const sortedByContribution = [...valid].sort((a, b) => {
    const aContribution =
      totalWeight > 0 ? ((a.portfolio_return_pct ?? 0) * normalizeWeight(a.weight)) / totalWeight : 0;
    const bContribution =
      totalWeight > 0 ? ((b.portfolio_return_pct ?? 0) * normalizeWeight(b.weight)) / totalWeight : 0;
    return bContribution - aContribution;
  });

  return {
    includedIdeas: ideas.length,
    portfolioReturnPct:
      totalWeight > 0
        ? valid.reduce((sum, idea) => {
            const weight = normalizeWeight(idea.weight);
            return sum + ((idea.portfolio_return_pct ?? 0) * weight) / totalWeight;
          }, 0)
        : null,
    avgPositionReturnPct: average(
      valid.map((idea) => idea.portfolio_return_pct).filter((value): value is number => value !== null),
    ),
    bestContributor: sortedByContribution[0] ?? null,
    worstContributor: sortedByContribution.at(-1) ?? null,
  };
}

function compareIdeas(a: StudyTrackerIdea, b: StudyTrackerIdea, key: SortKey) {
  switch (key) {
    case "company_name":
      return compareNullableString(a.company_name, b.company_name);
    case "presenter":
      return compareNullableString(a.presenter, b.presenter);
    case "included_at":
      return compareNullableString(a.included_at, b.included_at);
    case "position_status":
      return compareNullableString(a.position_status, b.position_status);
    case "portfolio_return_pct":
      return compareNullableNumber(a.portfolio_return_pct, b.portfolio_return_pct);
    case "weight":
      return compareNullableNumber(a.weight, b.weight);
    default:
      return 0;
  }
}

export function StudyTrackerPortfolioBoard({ data }: { data: StudyTrackerPortfolioData }) {
  const [search, setSearch] = useState("");
  const [presenterFilter, setPresenterFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "active" | "closed">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("included_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedIdeaId, setSelectedIdeaId] = useState<number | null>(null);

  const filteredIdeas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.ideas.filter((idea) => {
      if (presenterFilter !== "ALL" && idea.presenter !== presenterFilter) return false;
      if (statusFilter !== "ALL" && idea.position_status !== statusFilter) return false;
      if (!q) return true;
      return [idea.presenter, idea.company_name, idea.ticker, idea.thesis, idea.note]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(q));
    });
  }, [data.ideas, presenterFilter, search, statusFilter]);

  const summary = useMemo(() => buildPortfolioSummary(filteredIdeas), [filteredIdeas]);

  const sortedIdeas = useMemo(() => {
    const items = [...filteredIdeas];
    items.sort((a, b) => {
      const result = compareIdeas(a, b, sortKey);
      return sortDirection === "asc" ? result : -result;
    });
    return items;
  }, [filteredIdeas, sortDirection, sortKey]);

  const selectedIdea = useMemo(
    () => sortedIdeas.find((idea) => idea.id === selectedIdeaId) ?? null,
    [selectedIdeaId, sortedIdeas],
  );

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "portfolio_return_pct" ? "desc" : "asc");
  }

  const cards = [
    { title: "Included", value: String(summary.includedIdeas), tone: "text-slate-900" },
    {
      title: "Portfolio Return",
      value: formatPct(summary.portfolioReturnPct),
      tone: toneClass(summary.portfolioReturnPct),
    },
    {
      title: "Avg Position Return",
      value: formatPct(summary.avgPositionReturnPct),
      tone: toneClass(summary.avgPositionReturnPct),
    },
    {
      title: "Best Contributor",
      value: summary.bestContributor ? summary.bestContributor.ticker : "-",
      tone: toneClass(summary.bestContributor?.portfolio_return_pct ?? null),
    },
  ];

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((card) => (
          <div key={card.title} className="panel px-4 py-3">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{card.title}</div>
            <div className={`mt-2 text-lg font-semibold ${card.tone}`}>{card.value}</div>
          </div>
        ))}
      </section>

      <section className="panel p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm xl:col-span-2">
            <div className="mb-1 text-slate-600">Search</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Presenter, ticker, company..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Presenter</div>
            <select
              value={presenterFilter}
              onChange={(e) => setPresenterFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            >
              <option value="ALL">All</option>
              {data.presenters.map((presenter) => (
                <option key={presenter} value={presenter}>
                  {presenter}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Position Status</div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "ALL" | "active" | "closed")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            >
              <option value="ALL">All</option>
              <option value="active">active</option>
              <option value="closed">closed</option>
            </select>
          </label>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-3">
                  <button type="button" onClick={() => toggleSort("company_name")} className="font-medium hover:text-slate-900">
                    종목 {sortKey === "company_name" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th className="px-3 py-3">
                  <button type="button" onClick={() => toggleSort("presenter")} className="font-medium hover:text-slate-900">
                    발표자 {sortKey === "presenter" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th className="px-3 py-3">
                  <button type="button" onClick={() => toggleSort("included_at")} className="font-medium hover:text-slate-900">
                    편입일 {sortKey === "included_at" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th className="px-3 py-3 text-right">편입가</th>
                <th className="px-3 py-3 text-right">현재/종료가</th>
                <th className="px-3 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort("portfolio_return_pct")}
                    className="font-medium hover:text-slate-900"
                  >
                    Portfolio Return {sortKey === "portfolio_return_pct" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th className="px-3 py-3 text-right">
                  <button type="button" onClick={() => toggleSort("weight")} className="font-medium hover:text-slate-900">
                    Weight {sortKey === "weight" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("position_status")}
                    className="font-medium hover:text-slate-900"
                  >
                    상태 {sortKey === "position_status" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedIdeas.map((idea) => {
                const markPrice =
                  idea.position_status === "closed" ? idea.exited_price ?? null : idea.current_price ?? null;
                return (
                  <tr
                    key={idea.id}
                    className="cursor-pointer border-t border-slate-200 align-top hover:bg-slate-50"
                    onClick={() => setSelectedIdeaId(idea.id)}
                  >
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-900">{idea.company_name}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{idea.ticker}</div>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{idea.presenter}</td>
                    <td className="px-3 py-3 text-slate-700">{idea.included_at ?? "-"}</td>
                    <td className="px-3 py-3 text-right text-slate-700">
                      {formatPrice(idea.included_price, idea.currency)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700">
                      {formatPrice(markPrice, idea.currency)}
                    </td>
                    <td className={`px-3 py-3 text-right font-medium ${toneClass(idea.portfolio_return_pct)}`}>
                      {formatPct(idea.portfolio_return_pct)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700">
                      {idea.weight !== null ? idea.weight.toString() : "Equal"}
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                        {idea.position_status ?? "-"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {sortedIdeas.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-sm text-slate-500">
                    No included positions matched the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedIdea && (
        <div className="fixed inset-0 z-30 flex justify-end bg-slate-900/20" onClick={() => setSelectedIdeaId(null)}>
          <aside
            className="h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Portfolio Detail</div>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">{selectedIdea.company_name}</h3>
                <div className="mt-1 text-sm text-slate-500">{selectedIdea.ticker}</div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIdeaId(null)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">Presenter</div>
                <div className="mt-1 font-medium text-slate-900">{selectedIdea.presenter}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">Included At</div>
                <div className="mt-1 font-medium text-slate-900">{selectedIdea.included_at ?? "-"}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">Position Status</div>
                <div className="mt-1 font-medium text-slate-900">{selectedIdea.position_status ?? "-"}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">Weight</div>
                <div className="mt-1 font-medium text-slate-900">
                  {selectedIdea.weight !== null ? selectedIdea.weight.toString() : "Equal"}
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">Included Price</div>
                <div className="mt-1 font-medium text-slate-900">
                  {formatPrice(selectedIdea.included_price, selectedIdea.currency)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">Current Price</div>
                <div className="mt-1 font-medium text-slate-900">
                  {formatPrice(selectedIdea.current_price, selectedIdea.currency)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">Exited Price</div>
                <div className="mt-1 font-medium text-slate-900">
                  {formatPrice(selectedIdea.exited_price, selectedIdea.currency)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">Portfolio Return</div>
                <div className={`mt-1 font-medium ${toneClass(selectedIdea.portfolio_return_pct)}`}>
                  {formatPct(selectedIdea.portfolio_return_pct)}
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">Tracking Return</div>
                <div className={`mt-1 font-medium ${toneClass(selectedIdea.tracking_return_pct)}`}>
                  {formatPct(selectedIdea.tracking_return_pct)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">Exited At</div>
                <div className="mt-1 font-medium text-slate-900">{selectedIdea.exited_at ?? "-"}</div>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="text-sm font-semibold text-slate-900">Thesis</div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {selectedIdea.thesis ?? "-"}
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="text-sm font-semibold text-slate-900">Trigger / Risk</div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Trigger</div>
                    <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {selectedIdea.trigger ?? "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Risk</div>
                    <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {selectedIdea.risk ?? "-"}
                    </div>
                  </div>
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="text-sm font-semibold text-slate-900">Notes</div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {selectedIdea.note ?? "-"}
                </div>
              </section>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
