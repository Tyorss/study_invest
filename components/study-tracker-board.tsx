"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatNum, formatPct } from "@/lib/format";
import type { StudyTrackerData, StudyTrackerIdea, StudyTrackerIdeaInput } from "@/types/study-tracker";

type Draft = {
  presented_at: string;
  presenter: string;
  company_name: string;
  ticker: string;
  sector: string;
  pitch_price: string;
  target_price: string;
  pitch_upside_pct: string;
  currency: "" | "KRW" | "USD";
  current_price: string;
  current_upside_pct: string;
  current_return_pct: string;
  thesis: string;
  trigger: string;
  risk: string;
  style: string;
  status: string;
  entry_date: string;
  exit_date: string;
  close_return_pct: string;
  note: string;
  tracking_return_pct: string;
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
  idea?: StudyTrackerIdea;
};

function emptyDraft(): Draft {
  return {
    presented_at: "",
    presenter: "",
    company_name: "",
    ticker: "",
    sector: "",
    pitch_price: "",
    target_price: "",
    pitch_upside_pct: "",
    currency: "",
    current_price: "",
    current_upside_pct: "",
    current_return_pct: "",
    thesis: "",
    trigger: "",
    risk: "",
    style: "",
    status: "",
    entry_date: "",
    exit_date: "",
    close_return_pct: "",
    note: "",
    tracking_return_pct: "",
  };
}

function ideaToDraft(idea: StudyTrackerIdea): Draft {
  return {
    presented_at: idea.presented_at ?? "",
    presenter: idea.presenter,
    company_name: idea.company_name,
    ticker: idea.ticker,
    sector: idea.sector ?? "",
    pitch_price: idea.pitch_price?.toString() ?? "",
    target_price: idea.target_price?.toString() ?? "",
    pitch_upside_pct: idea.pitch_upside_pct?.toString() ?? "",
    currency: idea.currency ?? "",
    current_price: idea.current_price?.toString() ?? "",
    current_upside_pct: idea.current_upside_pct?.toString() ?? "",
    current_return_pct: idea.current_return_pct?.toString() ?? "",
    thesis: idea.thesis ?? "",
    trigger: idea.trigger ?? "",
    risk: idea.risk ?? "",
    style: idea.style ?? "",
    status: idea.status ?? "",
    entry_date: idea.entry_date ?? "",
    exit_date: idea.exit_date ?? "",
    close_return_pct: idea.close_return_pct?.toString() ?? "",
    note: idea.note ?? "",
    tracking_return_pct: idea.tracking_return_pct?.toString() ?? "",
  };
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : NaN;
}

function toPayload(draft: Draft): StudyTrackerIdeaInput {
  return {
    presented_at: draft.presented_at.trim() || null,
    presenter: draft.presenter,
    company_name: draft.company_name,
    ticker: draft.ticker,
    sector: draft.sector.trim() || null,
    pitch_price: parseOptionalNumber(draft.pitch_price),
    target_price: parseOptionalNumber(draft.target_price),
    pitch_upside_pct: parseOptionalNumber(draft.pitch_upside_pct),
    currency: draft.currency || null,
    current_price: parseOptionalNumber(draft.current_price),
    current_upside_pct: parseOptionalNumber(draft.current_upside_pct),
    current_return_pct: parseOptionalNumber(draft.current_return_pct),
    thesis: draft.thesis.trim() || null,
    trigger: draft.trigger.trim() || null,
    risk: draft.risk.trim() || null,
    style: draft.style.trim() || null,
    status: draft.status.trim() || null,
    entry_date: draft.entry_date.trim() || null,
    exit_date: draft.exit_date.trim() || null,
    close_return_pct: parseOptionalNumber(draft.close_return_pct),
    note: draft.note.trim() || null,
    tracking_return_pct: parseOptionalNumber(draft.tracking_return_pct),
  };
}

function formatPrice(value: number | null, currency: StudyTrackerIdea["currency"]) {
  if (value === null) return "-";
  const digits = currency === "KRW" ? 0 : 1;
  if (currency === "USD") {
    return `$${formatNum(value, digits)}`;
  }
  if (currency === "KRW") {
    return `₩${formatNum(value, digits)}`;
  }
  return formatNum(value, 2);
}

function toneClass(value: number | null) {
  if (value === null) return "text-slate-900";
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-rose-700";
  return "text-slate-900";
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sortUnique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((v): v is string => Boolean(v?.trim())).map((v) => v.trim()))].sort(
    (a, b) => a.localeCompare(b, "ko-KR"),
  );
}

function buildSummary(ideas: StudyTrackerIdea[]) {
  const trackingReturns = ideas
    .map((idea) => idea.tracking_return_pct)
    .filter((value): value is number => value !== null);
  const sortedByReturn = [...ideas]
    .filter((idea) => idea.tracking_return_pct !== null)
    .sort(
      (a, b) =>
        (b.tracking_return_pct ?? Number.NEGATIVE_INFINITY) -
        (a.tracking_return_pct ?? Number.NEGATIVE_INFINITY),
    );

  return {
    totalIdeas: ideas.length,
    activeIdeas: ideas.filter((idea) => idea.status === "편입" || idea.status === "검토중").length,
    closedIdeas: ideas.filter((idea) => idea.status === "전량청산").length,
    avgTrackingReturnPct: average(trackingReturns),
    bestIdea: sortedByReturn[0] ?? null,
    worstIdea: sortedByReturn.at(-1) ?? null,
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

export function StudyTrackerBoard({ data }: { data: StudyTrackerData }) {
  const router = useRouter();
  const [ideas, setIdeas] = useState(data.ideas);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sectorFilter, setSectorFilter] = useState("ALL");
  const [styleFilter, setStyleFilter] = useState("ALL");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => buildSummary(ideas), [ideas]);
  const statuses = useMemo(() => sortUnique(ideas.map((idea) => idea.status)), [ideas]);
  const sectors = useMemo(() => sortUnique(ideas.map((idea) => idea.sector)), [ideas]);
  const styles = useMemo(() => sortUnique(ideas.map((idea) => idea.style)), [ideas]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ideas.filter((idea) => {
      if (statusFilter !== "ALL" && idea.status !== statusFilter) return false;
      if (sectorFilter !== "ALL" && idea.sector !== sectorFilter) return false;
      if (styleFilter !== "ALL" && idea.style !== styleFilter) return false;
      if (!q) return true;

      return [
        idea.presenter,
        idea.company_name,
        idea.ticker,
        idea.sector,
        idea.thesis,
        idea.trigger,
        idea.risk,
        idea.note,
      ]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(q));
    });
  }, [ideas, search, statusFilter, sectorFilter, styleFilter]);

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setEditingId(null);
    setDraft(emptyDraft());
    setMessage(null);
    setError(null);
  }

  function startEdit(idea: StudyTrackerIdea) {
    setEditingId(idea.id);
    setDraft(ideaToDraft(idea));
    setMessage(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveIdea() {
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const payload = toPayload(draft);
      const method = editingId === null ? "POST" : "PATCH";
      const url =
        editingId === null
          ? "/api/study-tracker/ideas"
          : `/api/study-tracker/ideas/${editingId}`;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await readApiResponse(res);
      if (!res.ok || !json.ok || !json.idea) {
        throw new Error(json.error ?? `Failed to save idea (HTTP ${res.status})`);
      }

      setIdeas((prev) => {
        if (editingId === null) {
          return [json.idea!, ...prev];
        }
        return prev.map((idea) => (idea.id === json.idea!.id ? json.idea! : idea));
      });
      setMessage(editingId === null ? "Idea added." : "Idea updated.");
      setEditingId(null);
      setDraft(emptyDraft());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save idea");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteIdea(idea: StudyTrackerIdea) {
    if (!window.confirm(`Delete ${idea.company_name} (${idea.ticker})?`)) return;
    setBusyId(idea.id);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/study-tracker/ideas/${idea.id}`, {
        method: "DELETE",
      });
      const json = await readApiResponse(res);
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `Failed to delete idea (HTTP ${res.status})`);
      }
      setIdeas((prev) => prev.filter((row) => row.id !== idea.id));
      if (editingId === idea.id) {
        resetForm();
      }
      setMessage("Idea deleted.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete idea");
    } finally {
      setBusyId(null);
    }
  }

  const cards = [
    { title: "Total Ideas", value: String(summary.totalIdeas), tone: "text-slate-900" },
    { title: "Active", value: String(summary.activeIdeas), tone: "text-slate-900" },
    { title: "Closed", value: String(summary.closedIdeas), tone: "text-slate-900" },
    {
      title: "Avg Tracking Return",
      value: formatPct(summary.avgTrackingReturnPct),
      tone: toneClass(summary.avgTrackingReturnPct),
    },
    {
      title: "Best",
      value: summary.bestIdea
        ? `${summary.bestIdea.company_name} ${formatPct(summary.bestIdea.tracking_return_pct)}`
        : "-",
      tone: toneClass(summary.bestIdea?.tracking_return_pct ?? null),
    },
    {
      title: "Worst",
      value: summary.worstIdea
        ? `${summary.worstIdea.company_name} ${formatPct(summary.worstIdea.tracking_return_pct)}`
        : "-",
      tone: toneClass(summary.worstIdea?.tracking_return_pct ?? null),
    },
  ];

  return (
    <div className="space-y-5">
      <section className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {editingId === null ? "Add Study Idea" : `Edit Idea #${editingId}`}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Initial rows come from the study workbook seed. After that, we manage everything from
              this page.
            </p>
          </div>
          {editingId !== null && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Presented</div>
            <input
              type="date"
              value={draft.presented_at}
              onChange={(e) => updateDraft("presented_at", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Presenter</div>
            <input
              value={draft.presenter}
              onChange={(e) => updateDraft("presenter", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Company</div>
            <input
              value={draft.company_name}
              onChange={(e) => updateDraft("company_name", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Ticker</div>
            <input
              value={draft.ticker}
              onChange={(e) => updateDraft("ticker", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Sector</div>
            <input
              value={draft.sector}
              onChange={(e) => updateDraft("sector", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Style</div>
            <input
              value={draft.style}
              onChange={(e) => updateDraft("style", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Status</div>
            <input
              value={draft.status}
              onChange={(e) => updateDraft("status", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Currency</div>
            <select
              value={draft.currency}
              onChange={(e) => updateDraft("currency", e.target.value as Draft["currency"])}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            >
              <option value="">-</option>
              <option value="KRW">KRW</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Pitch Price</div>
            <input
              type="number"
              value={draft.pitch_price}
              onChange={(e) => updateDraft("pitch_price", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Current Price</div>
            <input
              type="number"
              value={draft.current_price}
              onChange={(e) => updateDraft("current_price", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Target Price</div>
            <input
              type="number"
              value={draft.target_price}
              onChange={(e) => updateDraft("target_price", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Tracking Return</div>
            <input
              type="number"
              step="0.0001"
              value={draft.tracking_return_pct}
              onChange={(e) => updateDraft("tracking_return_pct", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Pitch Upside</div>
            <input
              type="number"
              step="0.0001"
              value={draft.pitch_upside_pct}
              onChange={(e) => updateDraft("pitch_upside_pct", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Current Upside</div>
            <input
              type="number"
              step="0.0001"
              value={draft.current_upside_pct}
              onChange={(e) => updateDraft("current_upside_pct", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Current Return</div>
            <input
              type="number"
              step="0.0001"
              value={draft.current_return_pct}
              onChange={(e) => updateDraft("current_return_pct", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Close Return</div>
            <input
              type="number"
              step="0.0001"
              value={draft.close_return_pct}
              onChange={(e) => updateDraft("close_return_pct", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Entry Date</div>
            <input
              type="date"
              value={draft.entry_date}
              onChange={(e) => updateDraft("entry_date", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Exit Date</div>
            <input
              type="date"
              value={draft.exit_date}
              onChange={(e) => updateDraft("exit_date", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Thesis</div>
            <textarea
              rows={4}
              value={draft.thesis}
              onChange={(e) => updateDraft("thesis", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Trigger</div>
            <textarea
              rows={4}
              value={draft.trigger}
              onChange={(e) => updateDraft("trigger", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Risk</div>
            <textarea
              rows={4}
              value={draft.risk}
              onChange={(e) => updateDraft("risk", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Note</div>
            <textarea
              rows={4}
              value={draft.note}
              onChange={(e) => updateDraft("note", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={saveIdea}
            disabled={isSaving}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSaving ? "Saving..." : editingId === null ? "Add Idea" : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={resetForm}
            disabled={isSaving}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
          >
            Clear Form
          </button>
          {message && <span className="text-sm text-emerald-700">{message}</span>}
          {error && <span className="text-sm text-rose-700">{error}</span>}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        {cards.map((card) => (
          <div key={card.title} className="panel p-4">
            <div className="metric">{card.title}</div>
            <div className={`mt-2 text-sm font-semibold ${card.tone}`}>{card.value}</div>
          </div>
        ))}
      </div>

      <section className="panel p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Search</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Presenter, company, ticker, thesis..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Status</div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            >
              <option value="ALL">All</option>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Sector</div>
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            >
              <option value="ALL">All</option>
              {sectors.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Style</div>
            <select
              value={styleFilter}
              onChange={(e) => setStyleFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            >
              <option value="ALL">All</option>
              {styles.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 text-xs text-slate-500">
          Showing {filtered.length} of {ideas.length} study ideas.
        </div>
      </section>

      <div className="panel overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {[
                "Action",
                "Presented",
                "Presenter",
                "Company",
                "Ticker",
                "Status",
                "Pitch",
                "Current",
                "Target",
                "Tracking Return",
                "Notes",
              ].map((header) => (
                <th key={header} className="whitespace-nowrap px-3 py-3 text-left font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((idea) => {
              const isBusy = busyId === idea.id;
              return (
                <tr key={idea.id} className="border-t border-slate-200/70 align-top">
                  <td className="whitespace-nowrap px-3 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isSaving || busyId !== null}
                        onClick={() => startEdit(idea)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-60"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={isBusy || busyId !== null || isSaving}
                        onClick={() => deleteIdea(idea)}
                        className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">{idea.presented_at ?? "-"}</td>
                  <td className="whitespace-nowrap px-3 py-3">{idea.presenter}</td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-900">{idea.company_name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {[idea.sector, idea.style].filter(Boolean).join(" / ") || "-"}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">{idea.ticker}</td>
                  <td className="whitespace-nowrap px-3 py-3">{idea.status ?? "-"}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {formatPrice(idea.pitch_price, idea.currency)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {formatPrice(idea.current_price, idea.currency)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {formatPrice(idea.target_price, idea.currency)}
                  </td>
                  <td className={`num whitespace-nowrap px-3 py-3 ${toneClass(idea.tracking_return_pct)}`}>
                    {formatPct(idea.tracking_return_pct)}
                  </td>
                  <td className="min-w-[24rem] px-3 py-3">
                    <div className="space-y-2">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Thesis
                        </div>
                        <div className="mt-1 whitespace-pre-wrap text-slate-800">{idea.thesis ?? "-"}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Trigger / Risk
                        </div>
                        <div className="mt-1 whitespace-pre-wrap text-slate-800">
                          {idea.trigger ?? "-"}
                          {"\n"}
                          {idea.risk ?? "-"}
                        </div>
                      </div>
                      {idea.note && (
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Note
                          </div>
                          <div className="mt-1 whitespace-pre-wrap text-slate-800">{idea.note}</div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-10 text-center text-slate-500">
                  No study ideas matched the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
