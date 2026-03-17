"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPct } from "@/lib/format";
import type { StudyTrackerData, StudyTrackerIdea, StudyTrackerIdeaInput } from "@/types/study-tracker";

const DEFAULT_STATUS_OPTIONS = ["검토중", "보류", "편입", "전량청산"];
const DEFAULT_SECTOR_OPTIONS = [
  "AI 인프라",
  "반도체",
  "소프트웨어",
  "조선",
  "바이오",
  "자동차",
  "방산",
  "금융",
  "건설",
  "로봇",
  "엔터",
  "경기소비재",
];
const DEFAULT_STYLE_OPTIONS = [
  "고성장주",
  "대형우량주",
  "턴어라운드",
  "경기민감주",
  "가치주",
  "자산주",
];
const POSITION_STATUS_OPTIONS = ["active", "closed"] as const;

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
  is_included: boolean;
  included_at: string;
  included_price: string;
  weight: string;
  position_status: "" | "active" | "closed";
  exited_at: string;
  exited_price: string;
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
  idea?: StudyTrackerIdea;
  warning?: string;
};

type SortKey =
  | "presented_at"
  | "company_name"
  | "presenter"
  | "status"
  | "tracking_return_pct"
  | "current_upside_pct";

type SortDirection = "asc" | "desc";

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
    status: "검토중",
    entry_date: "",
    exit_date: "",
    close_return_pct: "",
    note: "",
    tracking_return_pct: "",
    is_included: false,
    included_at: "",
    included_price: "",
    weight: "",
    position_status: "",
    exited_at: "",
    exited_price: "",
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
    status: idea.status ?? "검토중",
    entry_date: idea.entry_date ?? "",
    exit_date: idea.exit_date ?? "",
    close_return_pct: idea.close_return_pct?.toString() ?? "",
    note: idea.note ?? "",
    tracking_return_pct: idea.tracking_return_pct?.toString() ?? "",
    is_included: idea.is_included,
    included_at: idea.included_at ?? "",
    included_price: idea.included_price?.toString() ?? "",
    weight: idea.weight?.toString() ?? "",
    position_status: idea.position_status ?? "",
    exited_at: idea.exited_at ?? "",
    exited_price: idea.exited_price?.toString() ?? "",
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
    is_included: draft.is_included,
    included_at: draft.is_included ? draft.included_at.trim() || null : null,
    included_price: draft.is_included ? parseOptionalNumber(draft.included_price) : null,
    weight: draft.is_included ? parseOptionalNumber(draft.weight) : null,
    position_status: draft.is_included ? draft.position_status || "active" : null,
    exited_at: draft.is_included ? draft.exited_at.trim() || null : null,
    exited_price: draft.is_included ? parseOptionalNumber(draft.exited_price) : null,
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

function toSingleLine(value: string | null | undefined) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}

function summarizeIdea(idea: StudyTrackerIdea) {
  const candidate =
    toSingleLine(idea.thesis) ??
    toSingleLine(idea.note) ??
    toSingleLine(idea.trigger) ??
    toSingleLine(idea.risk);
  if (!candidate) return "-";
  return candidate.length > 88 ? `${candidate.slice(0, 88)}...` : candidate;
}

function describeCurrentPriceSource(idea: StudyTrackerIdea) {
  if (idea.current_price === null) {
    return "저장된 현재가가 없습니다. '현재가 새로고침'을 눌러 실제 시세를 다시 가져올 수 있습니다.";
  }
  return "현재가는 저장된 시장 데이터입니다. 수정/저장 또는 '현재가 새로고침' 시 provider에서 다시 조회합니다.";
}

function describeTrackingFormula(idea: StudyTrackerIdea) {
  if (idea.close_return_pct !== null) {
    return `Close Return 우선 적용: ${formatPct(idea.close_return_pct)}`;
  }
  if (idea.current_price !== null && idea.pitch_price !== null && idea.pitch_price > 0) {
    return `${formatPrice(idea.current_price, idea.currency)} / ${formatPrice(idea.pitch_price, idea.currency)} - 1 = ${formatPct(
      idea.tracking_return_pct,
    )}`;
  }
  return "발표가와 현재가가 있어야 Tracking Return을 계산할 수 있습니다.";
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

function mergeOptions(defaults: string[], dynamicValues: Array<string | null | undefined>) {
  const merged = [...defaults];
  const seen = new Set(defaults);
  for (const value of sortUnique(dynamicValues)) {
    if (seen.has(value)) continue;
    seen.add(value);
    merged.push(value);
  }
  return merged;
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

function compareNullableString(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? "").localeCompare(b ?? "", "ko-KR");
}

function compareNullableNumber(a: number | null | undefined, b: number | null | undefined) {
  const av = a ?? Number.NEGATIVE_INFINITY;
  const bv = b ?? Number.NEGATIVE_INFINITY;
  return av - bv;
}

function compareIdeas(a: StudyTrackerIdea, b: StudyTrackerIdea, key: SortKey) {
  switch (key) {
    case "presented_at":
      return compareNullableString(a.presented_at, b.presented_at);
    case "company_name":
      return compareNullableString(a.company_name, b.company_name);
    case "presenter":
      return compareNullableString(a.presenter, b.presenter);
    case "status":
      return compareNullableString(a.status, b.status);
    case "tracking_return_pct":
      return compareNullableNumber(a.tracking_return_pct, b.tracking_return_pct);
    case "current_upside_pct":
      return compareNullableNumber(a.current_upside_pct, b.current_upside_pct);
    default:
      return 0;
  }
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
  const [includedFilter, setIncludedFilter] = useState<"ALL" | "INCLUDED" | "EXCLUDED">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("tracking_return_pct");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedIdeaId, setSelectedIdeaId] = useState<number | null>(null);
  const [menuIdeaId, setMenuIdeaId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshingQuotes, setIsRefreshingQuotes] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => buildSummary(ideas), [ideas]);
  const statuses = useMemo(
    () => mergeOptions(DEFAULT_STATUS_OPTIONS, ideas.map((idea) => idea.status)),
    [ideas],
  );
  const sectors = useMemo(
    () => mergeOptions(DEFAULT_SECTOR_OPTIONS, ideas.map((idea) => idea.sector)),
    [ideas],
  );
  const styles = useMemo(
    () => mergeOptions(DEFAULT_STYLE_OPTIONS, ideas.map((idea) => idea.style)),
    [ideas],
  );
  const presenters = useMemo(() => sortUnique(ideas.map((idea) => idea.presenter)), [ideas]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ideas.filter((idea) => {
      if (statusFilter !== "ALL" && idea.status !== statusFilter) return false;
      if (sectorFilter !== "ALL" && idea.sector !== sectorFilter) return false;
      if (styleFilter !== "ALL" && idea.style !== styleFilter) return false;
      if (includedFilter === "INCLUDED" && !idea.is_included) return false;
      if (includedFilter === "EXCLUDED" && idea.is_included) return false;
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
  }, [ideas, includedFilter, search, statusFilter, sectorFilter, styleFilter]);

  const sortedIdeas = useMemo(() => {
    const items = [...filtered];
    items.sort((a, b) => {
      const result = compareIdeas(a, b, sortKey);
      return sortDirection === "asc" ? result : -result;
    });
    return items;
  }, [filtered, sortDirection, sortKey]);

  const selectedIdea = useMemo(
    () => ideas.find((idea) => idea.id === selectedIdeaId) ?? null,
    [ideas, selectedIdeaId],
  );

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function closeComposer() {
    setEditingId(null);
    setComposerOpen(false);
    setDraft(emptyDraft());
    setError(null);
  }

  function openComposerForCreate() {
    setEditingId(null);
    setComposerOpen(true);
    setDraft(emptyDraft());
    setError(null);
    setMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEdit(idea: StudyTrackerIdea) {
    setEditingId(idea.id);
    setComposerOpen(true);
    setMenuIdeaId(null);
    setDraft(ideaToDraft(idea));
    setMessage(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "tracking_return_pct" || nextKey === "current_upside_pct" ? "desc" : "asc");
  }

  async function patchIdea(
    idea: StudyTrackerIdea,
    overrides: Partial<StudyTrackerIdeaInput>,
    successMessage: string,
  ) {
    setBusyId(idea.id);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/study-tracker/ideas/${idea.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ideaToPayload(idea, overrides)),
      });
      const json = await readApiResponse(res);
      if (!res.ok || !json.ok || !json.idea) {
        throw new Error(json.error ?? `Failed to update idea (HTTP ${res.status})`);
      }
      setIdeas((prev) => prev.map((row) => (row.id === json.idea!.id ? json.idea! : row)));
      setSelectedIdeaId(json.idea.id);
      setMessage(json.warning ? `${successMessage} ${json.warning}` : successMessage);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update idea");
    } finally {
      setBusyId(null);
    }
  }

  async function refreshIdeas(targetIdeas: StudyTrackerIdea[], successMessage: string) {
    if (targetIdeas.length === 0) return;
    setIsRefreshingQuotes(true);
    setMessage(null);
    setError(null);

    try {
      const updated = new Map<number, StudyTrackerIdea>();
      const warnings: string[] = [];

      for (const idea of targetIdeas) {
        const res = await fetch(`/api/study-tracker/ideas/${idea.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ideaToPayload(idea)),
        });
        const json = await readApiResponse(res);
        if (!res.ok || !json.ok || !json.idea) {
          throw new Error(json.error ?? `Failed to refresh idea (HTTP ${res.status})`);
        }
        updated.set(json.idea.id, json.idea);
        if (json.warning) warnings.push(`${idea.ticker}: ${json.warning}`);
      }

      setIdeas((prev) => prev.map((idea) => updated.get(idea.id) ?? idea));
      const warningSuffix =
        warnings.length > 0 ? ` Warnings: ${warnings.slice(0, 2).join(" | ")}` : "";
      setMessage(`${successMessage}${warningSuffix}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh live prices");
    } finally {
      setIsRefreshingQuotes(false);
    }
  }

  async function includeIdea(idea: StudyTrackerIdea) {
    await patchIdea(
      idea,
      {
        is_included: true,
        included_at: idea.included_at ?? idea.entry_date ?? idea.presented_at ?? null,
        included_price: idea.included_price ?? idea.current_price ?? idea.pitch_price ?? null,
        position_status: idea.position_status ?? "active",
        exited_at: null,
        exited_price: null,
      },
      "Included in portfolio.",
    );
  }

  async function removeFromPortfolio(idea: StudyTrackerIdea) {
    if (!window.confirm(`${idea.company_name}을(를) 포트폴리오에서 제외할까요?`)) return;
    await patchIdea(
      idea,
      {
        is_included: false,
        included_at: null,
        included_price: null,
        weight: null,
        position_status: null,
        exited_at: null,
        exited_price: null,
      },
      "Removed from portfolio.",
    );
  }

  async function closePosition(idea: StudyTrackerIdea) {
    await patchIdea(
      idea,
      {
        is_included: true,
        position_status: "closed",
        exited_at: idea.exited_at ?? idea.exit_date ?? null,
        exited_price: idea.exited_price ?? idea.current_price ?? null,
      },
      "Position closed.",
    );
  }

  async function reopenPosition(idea: StudyTrackerIdea) {
    await patchIdea(
      idea,
      {
        is_included: true,
        position_status: "active",
        exited_at: null,
        exited_price: null,
      },
      "Position reopened.",
    );
  }

  async function refreshIdeaQuote(idea: StudyTrackerIdea) {
    await refreshIdeas([idea], "Live price refreshed.");
  }

  async function saveIdea() {
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const payload = toPayload(draft);
      const method = editingId === null ? "POST" : "PATCH";
      const url = editingId === null ? "/api/study-tracker/ideas" : `/api/study-tracker/ideas/${editingId}`;
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
      setSelectedIdeaId(json.idea.id);
      const baseMessage = editingId === null ? "Idea added." : "Idea updated.";
      setMessage(json.warning ? `${baseMessage} ${json.warning}` : baseMessage);
      setEditingId(null);
      setComposerOpen(false);
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
        closeComposer();
      }
      if (selectedIdeaId === idea.id) {
        setSelectedIdeaId(null);
      }
      setMenuIdeaId(null);
      setMessage("Idea deleted.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete idea");
    } finally {
      setBusyId(null);
    }
  }

  const cards = [
    { title: "Total", value: String(summary.totalIdeas), tone: "text-slate-900" },
    { title: "Active", value: String(summary.activeIdeas), tone: "text-slate-900" },
    { title: "Closed", value: String(summary.closedIdeas), tone: "text-slate-900" },
    {
      title: "Avg Return",
      value: formatPct(summary.avgTrackingReturnPct),
      tone: toneClass(summary.avgTrackingReturnPct),
    },
  ];

  const showComposer = composerOpen || editingId !== null;
  const showClosedFields = draft.status === "전량청산" || Boolean(draft.exit_date || draft.close_return_pct);
  const showEntryField = showClosedFields || draft.status === "편입" || Boolean(draft.entry_date);
  const showPortfolioFields = draft.is_included;
  const showPositionExitFields =
    draft.is_included &&
    (draft.position_status === "closed" || Boolean(draft.exited_at || draft.exited_price));

  return (
    <div className="space-y-5">
      <section className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Study Tracker</h2>
            <p className="mt-1 text-sm text-slate-600">
              메인 화면은 비교에 집중하고, 긴 설명은 상세 패널에서 보도록 정리했습니다.
            </p>
          </div>
          {!showComposer ? (
            <button
              type="button"
              onClick={openComposerForCreate}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              추가하기
            </button>
          ) : (
            <button
              type="button"
              onClick={closeComposer}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            >
              {editingId === null ? "닫기" : "취소"}
            </button>
          )}
        </div>

        {message && (
          <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>
        )}
        {error && (
          <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        )}

        {showComposer && (
          <div className="mt-4 rounded-2xl border border-slate-200 p-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {editingId === null ? "New Idea" : `Edit Idea #${editingId}`}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                입력은 최소화했고, 현재가/업사이드/수익률은 저장 시 자동 계산됩니다.
              </p>
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
                  list="study-tracker-presenters"
                  value={draft.presenter}
                  onChange={(e) => updateDraft("presenter", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                />
                <datalist id="study-tracker-presenters">
                  {presenters.map((presenter) => (
                    <option key={presenter} value={presenter} />
                  ))}
                </datalist>
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
                  placeholder="IMVT / KRX:005930 / KOSDAQ:122640"
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
                  <option value="">Auto</option>
                  <option value="KRW">KRW</option>
                  <option value="USD">USD</option>
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">Sector</div>
                <select
                  value={draft.sector}
                  onChange={(e) => updateDraft("sector", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                >
                  <option value="">-</option>
                  {sectors.map((sector) => (
                    <option key={sector} value={sector}>
                      {sector}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">Style</div>
                <select
                  value={draft.style}
                  onChange={(e) => updateDraft("style", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                >
                  <option value="">-</option>
                  {styles.map((style) => (
                    <option key={style} value={style}>
                      {style}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">Status</div>
                <select
                  value={draft.status}
                  onChange={(e) => updateDraft("status", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
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
                <div className="mb-1 text-slate-600">Target Price</div>
                <input
                  type="number"
                  value={draft.target_price}
                  onChange={(e) => updateDraft("target_price", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                />
              </label>
              {showEntryField && (
                <label className="text-sm">
                  <div className="mb-1 text-slate-600">Entry Date</div>
                  <input
                    type="date"
                    value={draft.entry_date}
                    onChange={(e) => updateDraft("entry_date", e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                  />
                </label>
              )}
              {showClosedFields && (
                <label className="text-sm">
                  <div className="mb-1 text-slate-600">Exit Date</div>
                  <input
                    type="date"
                    value={draft.exit_date}
                    onChange={(e) => updateDraft("exit_date", e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                  />
                </label>
              )}
              {showClosedFields && (
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
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Portfolio Layer</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Tracking Return은 발표 기준, Portfolio Return은 편입 기준으로 따로 봅니다.
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={draft.is_included}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setDraft((prev) => ({
                        ...prev,
                        is_included: next,
                        included_at: next ? prev.included_at || prev.entry_date || prev.presented_at : "",
                        included_price: next ? prev.included_price || prev.current_price || prev.pitch_price : "",
                        position_status: next ? prev.position_status || "active" : "",
                        exited_at: next ? prev.exited_at : "",
                        exited_price: next ? prev.exited_price : "",
                        weight: next ? prev.weight : "",
                      }));
                    }}
                  />
                  포트폴리오 편입
                </label>
              </div>

              {showPortfolioFields && (
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">Included At</div>
                    <input
                      type="date"
                      value={draft.included_at}
                      onChange={(e) => updateDraft("included_at", e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                    />
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">Included Price</div>
                    <input
                      type="number"
                      value={draft.included_price}
                      onChange={(e) => updateDraft("included_price", e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                    />
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">Weight</div>
                    <input
                      type="number"
                      step="0.0001"
                      value={draft.weight}
                      onChange={(e) => updateDraft("weight", e.target.value)}
                      placeholder="비우면 동일가중"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                    />
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">Position Status</div>
                    <select
                      value={draft.position_status}
                      onChange={(e) => updateDraft("position_status", e.target.value as Draft["position_status"])}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                    >
                      {POSITION_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                  {showPositionExitFields && (
                    <label className="text-sm">
                      <div className="mb-1 text-slate-600">Exited At</div>
                      <input
                        type="date"
                        value={draft.exited_at}
                        onChange={(e) => updateDraft("exited_at", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                      />
                    </label>
                  )}
                  {showPositionExitFields && (
                    <label className="text-sm">
                      <div className="mb-1 text-slate-600">Exited Price</div>
                      <input
                        type="number"
                        value={draft.exited_price}
                        onChange={(e) => updateDraft("exited_price", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                      />
                    </label>
                  )}
                </div>
              )}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
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
                <div className="mb-1 text-slate-600">Note</div>
                <textarea
                  rows={4}
                  value={draft.note}
                  onChange={(e) => updateDraft("note", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                />
              </label>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <div className="text-slate-500">Current Price</div>
                <div className="mt-1 font-medium text-slate-900">
                  {formatPrice(parseOptionalNumber(draft.current_price), draft.currency || null)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <div className="text-slate-500">Current Return</div>
                <div className={`mt-1 font-medium ${toneClass(parseOptionalNumber(draft.current_return_pct))}`}>
                  {formatPct(parseOptionalNumber(draft.current_return_pct))}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <div className="text-slate-500">Target Gap</div>
                <div className={`mt-1 font-medium ${toneClass(parseOptionalNumber(draft.current_upside_pct))}`}>
                  {formatPct(parseOptionalNumber(draft.current_upside_pct))}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <div className="text-slate-500">Tracking Return</div>
                <div className={`mt-1 font-medium ${toneClass(parseOptionalNumber(draft.tracking_return_pct))}`}>
                  {formatPct(parseOptionalNumber(draft.tracking_return_pct))}
                </div>
              </div>
              {draft.is_included && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <div className="text-slate-500">Portfolio Basis</div>
                  <div className="mt-1 font-medium text-slate-900">
                    {formatPrice(parseOptionalNumber(draft.included_price), draft.currency || null)}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveIdea}
                disabled={isSaving}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isSaving ? "Saving..." : editingId === null ? "Save Idea" : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={closeComposer}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((card) => (
          <div key={card.title} className="panel px-4 py-3">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{card.title}</div>
            <div className={`mt-2 text-lg font-semibold ${card.tone}`}>{card.value}</div>
          </div>
        ))}
      </section>

      <section className="panel p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="text-sm xl:col-span-1">
            <div className="mb-1 text-slate-600">Search</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Presenter, ticker, company, thesis..."
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
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
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
              {sectors.map((sector) => (
                <option key={sector} value={sector}>
                  {sector}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">Portfolio</div>
            <select
              value={includedFilter}
              onChange={(e) => setIncludedFilter(e.target.value as "ALL" | "INCLUDED" | "EXCLUDED")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            >
              <option value="ALL">All</option>
              <option value="INCLUDED">Included only</option>
              <option value="EXCLUDED">Not included</option>
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
              {styles.map((style) => (
                <option key={style} value={style}>
                  {style}
                </option>
              ))}
            </select>
          </label>
          <div className="text-sm text-slate-500 xl:self-end">
            <div>헤더를 클릭하면 오름차순/내림차순 정렬이 됩니다.</div>
            <button
              type="button"
              onClick={() => refreshIdeas(sortedIdeas, `Refreshed ${sortedIdeas.length} ideas.`)}
              disabled={isRefreshingQuotes || sortedIdeas.length === 0}
              className="mt-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRefreshingQuotes ? "Refreshing..." : "현재가 일괄 새로고침"}
            </button>
          </div>
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
                  <button type="button" onClick={() => toggleSort("presented_at")} className="font-medium hover:text-slate-900">
                    발표일 {sortKey === "presented_at" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th className="px-3 py-3">
                  <button type="button" onClick={() => toggleSort("status")} className="font-medium hover:text-slate-900">
                    상태 {sortKey === "status" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th className="px-3 py-3 text-right">
                  <button type="button" onClick={() => toggleSort("tracking_return_pct")} className="font-medium hover:text-slate-900">
                    수익률 {sortKey === "tracking_return_pct" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th className="px-3 py-3 text-right">
                  <button type="button" onClick={() => toggleSort("current_upside_pct")} className="font-medium hover:text-slate-900">
                    Target Gap {sortKey === "current_upside_pct" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th className="px-3 py-3">Summary</th>
                <th className="w-12 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {sortedIdeas.map((idea) => (
                <tr
                  key={idea.id}
                  className="cursor-pointer border-t border-slate-200 align-top hover:bg-slate-50"
                  onClick={() => {
                    setSelectedIdeaId(idea.id);
                    setMenuIdeaId(null);
                  }}
                >
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-900">{idea.company_name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{idea.ticker}</span>
                      {idea.is_included && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          Included
                        </span>
                      )}
                    </div>
                    {idea.sector && <div className="mt-1 text-xs text-slate-400">{idea.sector}</div>}
                  </td>
                  <td className="px-3 py-3 text-slate-700">{idea.presenter}</td>
                  <td className="px-3 py-3 text-slate-700">{idea.presented_at ?? "-"}</td>
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                      {idea.status ?? "-"}
                    </span>
                  </td>
                  <td className={`px-3 py-3 text-right font-medium ${toneClass(idea.tracking_return_pct)}`}>
                    {formatPct(idea.tracking_return_pct)}
                  </td>
                  <td className={`px-3 py-3 text-right ${toneClass(idea.current_upside_pct)}`}>
                    {formatPct(idea.current_upside_pct)}
                  </td>
                  <td className="max-w-[320px] px-3 py-3 text-xs text-slate-600">
                    <div className="line-clamp-2">{summarizeIdea(idea)}</div>
                  </td>
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="relative flex justify-end">
                      <button
                        type="button"
                        onClick={() => setMenuIdeaId((prev) => (prev === idea.id ? null : idea.id))}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
                        aria-label="Row actions"
                      >
                        ⋯
                      </button>
                      {menuIdeaId === idea.id && (
                        <div className="absolute right-0 top-10 z-20 w-32 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                          <button
                            type="button"
                            onClick={() => startEdit(idea)}
                            className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteIdea(idea)}
                            disabled={busyId === idea.id}
                            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          >
                            {busyId === idea.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {sortedIdeas.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-sm text-slate-500">
                    No ideas matched the current filters.
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
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Study Detail</div>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">{selectedIdea.company_name}</h3>
                <div className="mt-1 text-sm text-slate-500">{selectedIdea.ticker}</div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(selectedIdea)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    Edit
                  </button>
                <button
                  type="button"
                  onClick={() => refreshIdeaQuote(selectedIdea)}
                  disabled={busyId === selectedIdea.id}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  현재가 새로고침
                </button>
                {!selectedIdea.is_included ? (
                  <button
                    type="button"
                    onClick={() => includeIdea(selectedIdea)}
                    disabled={busyId === selectedIdea.id}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {busyId === selectedIdea.id ? "Working..." : "포트폴리오 편입"}
                  </button>
                ) : (
                  <>
                    {selectedIdea.position_status === "closed" ? (
                      <button
                        type="button"
                        onClick={() => reopenPosition(selectedIdea)}
                        disabled={busyId === selectedIdea.id}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                      >
                        재편입
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => closePosition(selectedIdea)}
                        disabled={busyId === selectedIdea.id}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                      >
                        편출 처리
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeFromPortfolio(selectedIdea)}
                      disabled={busyId === selectedIdea.id}
                      className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                    >
                      편입 해제
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedIdeaId(null)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">Presenter</div>
                <div className="mt-1 font-medium text-slate-900">{selectedIdea.presenter}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">Presented</div>
                <div className="mt-1 font-medium text-slate-900">{selectedIdea.presented_at ?? "-"}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">Status</div>
                <div className="mt-1 font-medium text-slate-900">{selectedIdea.status ?? "-"}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">Style / Sector</div>
                <div className="mt-1 font-medium text-slate-900">
                  {[selectedIdea.style, selectedIdea.sector].filter(Boolean).join(" / ") || "-"}
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">Pitch</div>
                <div className="mt-1 font-medium text-slate-900">
                  {formatPrice(selectedIdea.pitch_price, selectedIdea.currency)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">Current</div>
                <div className="mt-1 font-medium text-slate-900">
                  {formatPrice(selectedIdea.current_price, selectedIdea.currency)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">Target</div>
                <div className="mt-1 font-medium text-slate-900">
                  {formatPrice(selectedIdea.target_price, selectedIdea.currency)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">Tracking Return</div>
                <div className={`mt-1 font-medium ${toneClass(selectedIdea.tracking_return_pct)}`}>
                  {formatPct(selectedIdea.tracking_return_pct)}
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
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">Portfolio Layer</div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs ${
                    selectedIdea.is_included ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {selectedIdea.is_included ? "Included" : "Not included"}
                </span>
              </div>
              {selectedIdea.is_included ? (
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="text-slate-500">Included At</div>
                    <div className="mt-1 font-medium text-slate-900">{selectedIdea.included_at ?? "-"}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="text-slate-500">Included Price</div>
                    <div className="mt-1 font-medium text-slate-900">
                      {formatPrice(selectedIdea.included_price, selectedIdea.currency)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="text-slate-500">Portfolio Return</div>
                    <div className={`mt-1 font-medium ${toneClass(selectedIdea.portfolio_return_pct)}`}>
                      {formatPct(selectedIdea.portfolio_return_pct)}
                    </div>
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
                  <div className="rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="text-slate-500">Exited At</div>
                    <div className="mt-1 font-medium text-slate-900">{selectedIdea.exited_at ?? "-"}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="text-slate-500">Exited Price</div>
                    <div className="mt-1 font-medium text-slate-900">
                      {formatPrice(selectedIdea.exited_price, selectedIdea.currency)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-500">
                  아직 포트폴리오에는 포함되지 않았습니다. 편입 시 편입일/편입가 기준 Portfolio Return이 별도로 계산됩니다.
                </div>
              )}
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
                <div className="text-sm font-semibold text-slate-900">Updates / Notes</div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {selectedIdea.note ?? "-"}
                </div>
                <div className="mt-3 text-xs text-slate-400">
                  추후 업데이트 로그를 더 붙일 수 있도록 이 영역은 비워두었습니다.
                </div>
              </section>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
