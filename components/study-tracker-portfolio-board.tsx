"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { formatPct } from "@/lib/format";
import type {
  StudyTrackerBenchmarkCode,
  StudyTrackerIdea,
  StudyTrackerIdeaInput,
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

type ApiResponse = {
  ok?: boolean;
  error?: string;
  idea?: StudyTrackerIdea;
  warning?: string;
};

type PortfolioDraft = {
  included_at: string;
  included_price: string;
  weight: string;
  position_status: "" | "active" | "closed";
  exited_at: string;
  exited_price: string;
};

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

function describeCurrentPriceSource(idea: StudyTrackerIdea) {
  if (idea.current_price === null) {
    return "저장된 현재가가 없습니다. '현재가 새로고침'으로 실제 시세를 다시 조회할 수 있습니다.";
  }
  return "현재가는 저장된 시장 데이터입니다. 저장 또는 '현재가 새로고침' 시 provider에서 다시 조회합니다.";
}

function describeTrackingFormula(idea: StudyTrackerIdea) {
  if (idea.current_price !== null && idea.pitch_price !== null && idea.pitch_price > 0) {
    return `${formatPrice(idea.current_price, idea.currency)} / ${formatPrice(idea.pitch_price, idea.currency)} - 1 = ${formatPct(
      idea.tracking_return_pct,
    )}`;
  }
  return "Tracking Return은 항상 현재가 기준(current / pitch - 1)으로 계산합니다.";
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

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : NaN;
}

function draftFromIdea(idea: StudyTrackerIdea): PortfolioDraft {
  return {
    included_at: idea.included_at ?? "",
    included_price: idea.included_price?.toString() ?? "",
    weight: idea.weight?.toString() ?? "",
    position_status: idea.position_status ?? "active",
    exited_at: idea.exited_at ?? "",
    exited_price: idea.exited_price?.toString() ?? "",
  };
}

function ideaToPayload(idea: StudyTrackerIdea, overrides?: Partial<StudyTrackerIdeaInput>): StudyTrackerIdeaInput {
  return {
    presented_at: idea.presented_at,
    presenter: idea.presenter,
    company_name: idea.company_name,
    ticker: idea.ticker,
    sector: idea.sector,
    pitch_price: idea.pitch_price,
    target_price: idea.target_price,
    pitch_upside_pct: idea.pitch_upside_pct,
    currency: idea.currency,
    current_price: idea.current_price,
    current_upside_pct: idea.current_upside_pct,
    current_return_pct: idea.current_return_pct,
    thesis: idea.thesis,
    trigger: idea.trigger,
    risk: idea.risk,
    style: idea.style,
    status: idea.status,
    entry_date: idea.entry_date,
    exit_date: idea.exit_date,
    close_return_pct: idea.close_return_pct,
    note: idea.note,
    tracking_return_pct: idea.tracking_return_pct,
    is_included: idea.is_included,
    included_at: idea.included_at,
    included_price: idea.included_price,
    weight: idea.weight,
    position_status: idea.position_status,
    exited_at: idea.exited_at,
    exited_price: idea.exited_price,
    ...overrides,
  };
}

async function readApiResponse(res: Response): Promise<ApiResponse> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    return { ok: false, error: text?.trim() || `HTTP ${res.status}` };
  }
  return (await res.json()) as ApiResponse;
}

export function StudyTrackerPortfolioBoard({ data }: { data: StudyTrackerPortfolioData }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ideas, setIdeas] = useState(data.ideas);
  const [search, setSearch] = useState("");
  const [presenterFilter, setPresenterFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "active" | "closed">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("included_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedIdeaId, setSelectedIdeaId] = useState<number | null>(null);
  const [draft, setDraft] = useState<PortfolioDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [periodFrom, setPeriodFrom] = useState(data.periodFrom);
  const [periodTo, setPeriodTo] = useState(data.periodTo);
  const [benchmark, setBenchmark] = useState<StudyTrackerBenchmarkCode>(data.benchmark);

  useEffect(() => {
    setIdeas(data.ideas);
    setPeriodFrom(data.periodFrom);
    setPeriodTo(data.periodTo);
    setBenchmark(data.benchmark);
  }, [data]);

  const filteredIdeas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ideas.filter((idea) => {
      if (presenterFilter !== "ALL" && idea.presenter !== presenterFilter) return false;
      if (statusFilter !== "ALL" && idea.position_status !== statusFilter) return false;
      if (!q) return true;
      return [idea.presenter, idea.company_name, idea.ticker, idea.thesis, idea.note]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(q));
    });
  }, [ideas, presenterFilter, search, statusFilter]);

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
    () => ideas.find((idea) => idea.id === selectedIdeaId) ?? null,
    [ideas, selectedIdeaId],
  );

  useEffect(() => {
    if (!selectedIdea) {
      setDraft(null);
      return;
    }
    setDraft(draftFromIdea(selectedIdea));
  }, [selectedIdea]);

  function openIdea(idea: StudyTrackerIdea) {
    setSelectedIdeaId(idea.id);
    setMessage(null);
    setError(null);
  }

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "portfolio_return_pct" ? "desc" : "asc");
  }

  function applyPeriodFilters() {
    const params = new URLSearchParams();
    if (periodFrom) params.set("from", periodFrom);
    if (periodTo) params.set("to", periodTo);
    params.set("benchmark", benchmark);
    router.push(`${pathname}?${params.toString()}`);
  }

  async function saveDraft() {
    if (!selectedIdea || !draft) return;
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const payload = ideaToPayload(selectedIdea, {
        is_included: true,
        included_at:
          draft.included_at || selectedIdea.included_at || selectedIdea.entry_date || selectedIdea.presented_at,
        included_price:
          parseOptionalNumber(draft.included_price) ??
          selectedIdea.included_price ??
          selectedIdea.current_price ??
          selectedIdea.pitch_price,
        weight: parseOptionalNumber(draft.weight),
        position_status: draft.position_status || "active",
        exited_at:
          draft.position_status === "closed"
            ? draft.exited_at || selectedIdea.exited_at || selectedIdea.exit_date
            : null,
        exited_price:
          draft.position_status === "closed"
            ? parseOptionalNumber(draft.exited_price) ??
              selectedIdea.exited_price ??
              selectedIdea.current_price
            : null,
      });

      const res = await fetch(`/api/study-tracker/ideas/${selectedIdea.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await readApiResponse(res);
      if (!res.ok || !json.ok || !json.idea) {
        throw new Error(json.error ?? `Failed to save portfolio position (HTTP ${res.status})`);
      }

      setIdeas((prev) => prev.map((idea) => (idea.id === json.idea!.id ? json.idea! : idea)));
      setMessage(json.warning ? `Position updated. ${json.warning}` : "Position updated.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save portfolio position");
    } finally {
      setIsSaving(false);
    }
  }

  async function refreshIdeaQuote() {
    if (!selectedIdea) return;
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/study-tracker/ideas/${selectedIdea.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ideaToPayload(selectedIdea)),
      });
      const json = await readApiResponse(res);
      if (!res.ok || !json.ok || !json.idea) {
        throw new Error(json.error ?? `Failed to refresh market data (HTTP ${res.status})`);
      }

      setIdeas((prev) => prev.map((idea) => (idea.id === json.idea!.id ? json.idea! : idea)));
      setSelectedIdeaId(json.idea.id);
      setMessage(json.warning ? `Live price refreshed. ${json.warning}` : "Live price refreshed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh live price");
    } finally {
      setIsSaving(false);
    }
  }

  async function removeFromPortfolio() {
    if (!selectedIdea) return;
    if (!window.confirm(`${selectedIdea.company_name}을(를) 포트폴리오에서 제외할까요?`)) return;
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/study-tracker/ideas/${selectedIdea.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          ideaToPayload(selectedIdea, {
            is_included: false,
            included_at: null,
            included_price: null,
            weight: null,
            position_status: null,
            exited_at: null,
            exited_price: null,
          }),
        ),
      });
      const json = await readApiResponse(res);
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `Failed to remove from portfolio (HTTP ${res.status})`);
      }

      setIdeas((prev) => prev.filter((idea) => idea.id !== selectedIdea.id));
      setSelectedIdeaId(null);
      setMessage("Removed from portfolio.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove from portfolio");
    } finally {
      setIsSaving(false);
    }
  }

  const cards = [
    { title: "Included", value: String(summary.includedIdeas), tone: "text-slate-900" },
    {
      title: "Portfolio Return",
      value: formatPct(summary.portfolioReturnPct),
      tone: toneClass(summary.portfolioReturnPct),
    },
    {
      title: data.benchmarkLabel,
      value: formatPct(data.benchmarkReturnPct),
      tone: toneClass(data.benchmarkReturnPct),
    },
    {
      title: "Excess vs Benchmark",
      value: formatPct(data.excessReturnPct),
      tone: toneClass(data.excessReturnPct),
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
      <section className="panel p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm">
            <div className="mb-1 text-slate-600">From</div>
            <input
              type="date"
              value={periodFrom}
              onChange={(e) => setPeriodFrom(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">To</div>
            <input
              type="date"
              value={periodTo}
              onChange={(e) => setPeriodTo(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Benchmark</div>
            <select
              value={benchmark}
              onChange={(e) => setBenchmark(e.target.value as StudyTrackerBenchmarkCode)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            >
              <option value="NASDAQ">Nasdaq (QQQ)</option>
              <option value="SPY">SPY</option>
              <option value="KOSPI">KOSPI</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={applyPeriodFilters}
              className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Apply Period
            </button>
          </div>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          현재 MVP에서는 선택 기간 안에 편입된 종목 코호트를 기준으로 포트폴리오와 벤치마크를 비교합니다.
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => (
          <div key={card.title} className="panel px-4 py-3">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{card.title}</div>
            <div className={`mt-2 text-lg font-semibold ${card.tone}`}>{card.value}</div>
          </div>
        ))}
      </section>

      {(message || error) && (
        <section className="space-y-2">
          {message && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>}
          {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
        </section>
      )}

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
                    onClick={() => openIdea(idea)}
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

      {selectedIdea && draft && (
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
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={refreshIdeaQuote}
                  disabled={isSaving}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  현재가 새로고침
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIdeaId(null)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">Presenter</div>
                <div className="mt-1 font-medium text-slate-900">{selectedIdea.presenter}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">Tracking Return</div>
                <div className={`mt-1 font-medium ${toneClass(selectedIdea.tracking_return_pct)}`}>
                  {formatPct(selectedIdea.tracking_return_pct)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">Portfolio Return</div>
                <div className={`mt-1 font-medium ${toneClass(selectedIdea.portfolio_return_pct)}`}>
                  {formatPct(selectedIdea.portfolio_return_pct)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">Current Price</div>
                <div className="mt-1 font-medium text-slate-900">
                  {formatPrice(selectedIdea.current_price, selectedIdea.currency)}
                </div>
              </div>
            </div>

            <section className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">Current Source</div>
                <div className="mt-1 text-slate-900">{describeCurrentPriceSource(selectedIdea)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">Tracking Formula</div>
                <div className="mt-1 text-slate-900">{describeTrackingFormula(selectedIdea)}</div>
              </div>
            </section>

            <section className="mt-5 rounded-2xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-900">Portfolio Edit</div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <div className="mb-1 text-slate-600">Included At</div>
                  <input
                    type="date"
                    value={draft.included_at}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, included_at: e.target.value } : prev))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                  />
                </label>
                <label className="text-sm">
                  <div className="mb-1 text-slate-600">Included Price</div>
                  <input
                    type="number"
                    value={draft.included_price}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, included_price: e.target.value } : prev))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                  />
                </label>
                <label className="text-sm">
                  <div className="mb-1 text-slate-600">Weight</div>
                  <input
                    type="number"
                    step="0.0001"
                    value={draft.weight}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, weight: e.target.value } : prev))}
                    placeholder="비우면 동일가중"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                  />
                </label>
                <label className="text-sm">
                  <div className="mb-1 text-slate-600">Position Status</div>
                  <select
                    value={draft.position_status}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, position_status: e.target.value as PortfolioDraft["position_status"] } : prev,
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                  >
                    <option value="active">active</option>
                    <option value="closed">closed</option>
                  </select>
                </label>
                {draft.position_status === "closed" && (
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">Exited At</div>
                    <input
                      type="date"
                      value={draft.exited_at}
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, exited_at: e.target.value } : prev))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                    />
                  </label>
                )}
                {draft.position_status === "closed" && (
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">Exited Price</div>
                    <input
                      type="number"
                      value={draft.exited_price}
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, exited_price: e.target.value } : prev))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                    />
                  </label>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveDraft}
                  disabled={isSaving}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isSaving ? "Saving..." : "Save Position"}
                </button>
                <button
                  type="button"
                  onClick={removeFromPortfolio}
                  disabled={isSaving}
                  className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  Remove from Portfolio
                </button>
              </div>
            </section>

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
