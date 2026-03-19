"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPct } from "@/lib/format";
import type {
  StudyCallDirection,
  StudyCallFeedbackStance,
  StudyTargetStatus,
  StudyCallUpdateType,
  StudyTrackerData,
  StudyTrackerIdea,
  StudyTrackerIdeaInput,
} from "@/types/study-tracker";

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
const CALL_DIRECTION_OPTIONS: Array<{ value: StudyCallDirection; label: string }> = [
  { value: "long", label: "매수" },
  { value: "neutral", label: "중립" },
  { value: "short", label: "매도" },
];
const TARGET_STATUS_OPTIONS: Array<{ value: StudyTargetStatus; label: string }> = [
  { value: "active", label: "활성" },
  { value: "target_hit", label: "목표 도달" },
  { value: "revising", label: "재산정 필요" },
  { value: "upgraded", label: "목표 상향" },
  { value: "downgraded", label: "목표 하향" },
  { value: "trim_or_hold", label: "차익실현/보유" },
  { value: "closed", label: "종료" },
  { value: "invalidated", label: "무효화" },
];
const POSITION_STATUS_OPTIONS = ["active", "closed"] as const;
const FEEDBACK_STANCE_OPTIONS: Array<{ value: StudyCallFeedbackStance; label: string }> = [
  { value: "agree", label: "동의" },
  { value: "neutral", label: "중립" },
  { value: "disagree", label: "반대" },
];
const UPDATE_TYPE_OPTIONS: Array<{ value: StudyCallUpdateType; label: string }> = [
  { value: "update", label: "업데이트" },
  { value: "catalyst", label: "촉매" },
  { value: "risk", label: "리스크" },
  { value: "postmortem", label: "사후 복기" },
];

type ComposerPrefill = Partial<StudyTrackerIdeaInput> & {
  sourceSessionLabel?: string;
  sourceCoverageLabel?: string;
};

type Props = {
  data: StudyTrackerData;
  initialComposer?: ComposerPrefill | null;
};

type Draft = {
  presented_at: string;
  presenter: string;
  company_name: string;
  ticker: string;
  sector: string;
  currency: "" | "KRW" | "USD";
  pitch_price: string;
  target_price: string;
  current_target_price: string;
  target_status: "" | StudyTargetStatus;
  target_note: string;
  thesis: string;
  trigger: string;
  risk: string;
  style: string;
  status: string;
  note: string;
  is_included: boolean;
  included_at: string;
  included_price: string;
  weight: string;
  position_status: "" | "active" | "closed";
  exited_at: string;
  exited_price: string;
  source_session_id: string;
  source_coverage_id: string;
  call_direction: StudyCallDirection;
  conviction_score: string;
  invalidation_rule: string;
  time_horizon: string;
};

type SortKey =
  | "company_name"
  | "presented_at"
  | "presenter"
  | "call_direction"
  | "status"
  | "tracking_return_pct"
  | "remaining_upside_pct"
  | "adoption_count"
  | "feedback_count";

type SortDirection = "asc" | "desc";

type ApiResponse = {
  ok?: boolean;
  error?: string;
  idea?: StudyTrackerIdea;
  warning?: string;
};

function todayLocalIsoDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function emptyDraft(prefill?: ComposerPrefill | null): Draft {
  return {
    presented_at: prefill?.presented_at ?? "",
    presenter: prefill?.presenter ?? "",
    company_name: prefill?.company_name ?? "",
    ticker: prefill?.ticker ?? "",
    sector: prefill?.sector ?? "",
    currency: prefill?.currency ?? "",
    pitch_price: prefill?.pitch_price?.toString() ?? "",
    target_price: prefill?.target_price?.toString() ?? "",
    current_target_price: prefill?.current_target_price?.toString() ?? "",
    target_status: prefill?.target_status ?? "",
    target_note: prefill?.target_note ?? "",
    thesis: prefill?.thesis ?? "",
    trigger: prefill?.trigger ?? "",
    risk: prefill?.risk ?? "",
    style: prefill?.style ?? "",
    status: prefill?.status ?? "검토중",
    note: prefill?.note ?? "",
    is_included: Boolean(prefill?.is_included),
    included_at: prefill?.included_at ?? "",
    included_price: prefill?.included_price?.toString() ?? "",
    weight: prefill?.weight?.toString() ?? "",
    position_status: prefill?.position_status ?? "",
    exited_at: prefill?.exited_at ?? "",
    exited_price: prefill?.exited_price?.toString() ?? "",
    source_session_id: prefill?.source_session_id ? String(prefill.source_session_id) : "",
    source_coverage_id: prefill?.source_coverage_id ? String(prefill.source_coverage_id) : "",
    call_direction: prefill?.call_direction ?? "neutral",
    conviction_score: prefill?.conviction_score?.toString() ?? "",
    invalidation_rule: prefill?.invalidation_rule ?? "",
    time_horizon: prefill?.time_horizon ?? "",
  };
}

function ideaToDraft(idea: StudyTrackerIdea): Draft {
  return {
    presented_at: idea.presented_at ?? "",
    presenter: idea.presenter,
    company_name: idea.company_name,
    ticker: idea.ticker,
    sector: idea.sector ?? "",
    currency: idea.currency ?? "",
    pitch_price: idea.pitch_price?.toString() ?? "",
    target_price: idea.target_price?.toString() ?? "",
    current_target_price: idea.current_target_price?.toString() ?? "",
    target_status: idea.target_status ?? "",
    target_note: idea.target_note ?? "",
    thesis: idea.thesis ?? "",
    trigger: idea.trigger ?? "",
    risk: idea.risk ?? "",
    style: idea.style ?? "",
    status: idea.status ?? "검토중",
    note: idea.note ?? "",
    is_included: idea.is_included,
    included_at: idea.included_at ?? "",
    included_price: idea.included_price?.toString() ?? "",
    weight: idea.weight?.toString() ?? "",
    position_status: idea.position_status ?? "",
    exited_at: idea.exited_at ?? "",
    exited_price: idea.exited_price?.toString() ?? "",
    source_session_id: idea.source_session_id ? String(idea.source_session_id) : "",
    source_coverage_id: idea.source_coverage_id ? String(idea.source_coverage_id) : "",
    call_direction: idea.call_direction,
    conviction_score: idea.conviction_score?.toString() ?? "",
    invalidation_rule: idea.invalidation_rule ?? "",
    time_horizon: idea.time_horizon ?? "",
  };
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : NaN;
}

function parseOptionalInt(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isInteger(num) ? num : NaN;
}

function normalizeId(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const id = Number(trimmed);
  return Number.isInteger(id) && id > 0 ? id : NaN;
}

function toPayload(draft: Draft, existing?: StudyTrackerIdea | null): StudyTrackerIdeaInput {
  return {
    presented_at: draft.presented_at.trim() || null,
    presenter: draft.presenter,
    company_name: draft.company_name,
    ticker: draft.ticker,
    sector: draft.sector.trim() || null,
    pitch_price: parseOptionalNumber(draft.pitch_price),
    target_price: parseOptionalNumber(draft.target_price),
    current_target_price: parseOptionalNumber(draft.current_target_price),
    target_status: draft.target_status || null,
    target_note: draft.target_note.trim() || null,
    target_updated_at: existing?.target_updated_at ?? null,
    pitch_upside_pct: existing?.pitch_upside_pct ?? null,
    currency: draft.currency || null,
    current_price: existing?.current_price ?? null,
    current_upside_pct: existing?.current_upside_pct ?? null,
    current_return_pct: existing?.current_return_pct ?? null,
    thesis: draft.thesis.trim() || null,
    trigger: draft.trigger.trim() || null,
    risk: draft.risk.trim() || null,
    style: draft.style.trim() || null,
    status: draft.status.trim() || null,
    entry_date: existing?.entry_date ?? null,
    exit_date: existing?.exit_date ?? null,
    close_return_pct: existing?.close_return_pct ?? null,
    note: draft.note.trim() || null,
    tracking_return_pct: existing?.tracking_return_pct ?? null,
    is_included: draft.is_included,
    included_at: draft.is_included ? draft.included_at.trim() || null : null,
    included_price: draft.is_included ? parseOptionalNumber(draft.included_price) : null,
    weight: draft.is_included ? parseOptionalNumber(draft.weight) : null,
    position_status: draft.is_included ? draft.position_status || "active" : null,
    exited_at: draft.is_included ? draft.exited_at.trim() || null : null,
    exited_price: draft.is_included ? parseOptionalNumber(draft.exited_price) : null,
    source_session_id: normalizeId(draft.source_session_id),
    source_coverage_id: normalizeId(draft.source_coverage_id),
    call_direction: draft.call_direction,
    conviction_score: parseOptionalInt(draft.conviction_score),
    invalidation_rule: draft.invalidation_rule.trim() || null,
    time_horizon: draft.time_horizon.trim() || null,
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

function compareNullableString(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? "").localeCompare(b ?? "", "ko-KR");
}

function compareNullableNumber(a: number | null | undefined, b: number | null | undefined) {
  const av = a ?? Number.NEGATIVE_INFINITY;
  const bv = b ?? Number.NEGATIVE_INFINITY;
  return av - bv;
}

function directionLabel(value: StudyCallDirection) {
  return CALL_DIRECTION_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function targetStatusLabel(value: StudyTargetStatus) {
  return TARGET_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function formatCompactDate(value: string | null | undefined) {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value.slice(2);
  }
  return value;
}

function targetStatusTone(idea: StudyTrackerIdea) {
  if (idea.needs_target_update) return "border-amber-200 bg-amber-50 text-amber-700";
  switch (idea.effective_target_status) {
    case "target_hit":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "upgraded":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "downgraded":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "revising":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "trim_or_hold":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "closed":
    case "invalidated":
      return "border-slate-200 bg-slate-100 text-slate-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function describeTargetStatus(idea: StudyTrackerIdea) {
  if (idea.needs_target_update) return "업데이트 필요";
  return targetStatusLabel(idea.effective_target_status);
}

function compactTargetStateText(idea: StudyTrackerIdea) {
  if (idea.needs_target_update) return "재산정";
  switch (idea.effective_target_status) {
    case "target_hit":
      return "목표 도달";
    case "revising":
      return "재산정";
    case "upgraded":
      return "상향";
    case "downgraded":
      return "하향";
    case "trim_or_hold":
      return "차익/보유";
    case "closed":
      return "종료";
    case "invalidated":
      return "무효화";
    default:
      return null;
  }
}

function formatUpsideSummary(idea: StudyTrackerIdea) {
  if (idea.effective_target_status === "target_hit" || idea.needs_target_update) {
    return null;
  }
  const tpText = `TP ${formatPrice(idea.effective_target_price, idea.currency)}`;
  const stateText = compactTargetStateText(idea);
  return stateText ? `${tpText} · ${stateText}` : tpText;
}

function displayRemainingMovePct(idea: StudyTrackerIdea) {
  if (idea.effective_target_status === "target_hit" || idea.needs_target_update) {
    return idea.call_direction === "short" ? "매도의견" : "목표가 달성";
  }
  if (idea.remaining_upside_pct === null) return "-";
  const adjusted = idea.call_direction === "short" ? -idea.remaining_upside_pct : idea.remaining_upside_pct;
  return formatPct(adjusted);
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
  const mostFollowed = [...ideas].sort((a, b) => b.adoption_count - a.adoption_count)[0] ?? null;
  const mostDiscussed = [...ideas].sort((a, b) => b.feedback_count - a.feedback_count)[0] ?? null;
  return {
    totalCalls: ideas.length,
    adoptedCalls: ideas.filter((idea) => idea.adoption_count > 0).length,
    callsFromSessions: ideas.filter((idea) => idea.source_session_id !== null).length,
    mostFollowed,
    mostDiscussed,
  };
}

function compareIdeas(a: StudyTrackerIdea, b: StudyTrackerIdea, key: SortKey) {
  switch (key) {
    case "company_name":
      return compareNullableString(a.company_name, b.company_name);
    case "presented_at":
      return compareNullableString(a.presented_at, b.presented_at);
    case "presenter":
      return compareNullableString(a.presenter, b.presenter);
    case "call_direction":
      return compareNullableString(a.call_direction, b.call_direction);
    case "status":
      return compareNullableString(a.status, b.status);
    case "tracking_return_pct":
      return compareNullableNumber(a.tracking_return_pct, b.tracking_return_pct);
    case "remaining_upside_pct":
      return compareNullableNumber(a.remaining_upside_pct, b.remaining_upside_pct);
    case "adoption_count":
      return compareNullableNumber(a.adoption_count, b.adoption_count);
    case "feedback_count":
      return compareNullableNumber(a.feedback_count, b.feedback_count);
    default:
      return 0;
  }
}

async function readApiResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(text?.trim() || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export function StudyTrackerBoard({ data, initialComposer = null }: Props) {
  const router = useRouter();
  const prefillConsumedRef = useRef(false);
  const [ideas, setIdeas] = useState(data.ideas);
  const [search, setSearch] = useState("");
  const [presenterFilter, setPresenterFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [directionFilter, setDirectionFilter] = useState<"ALL" | StudyCallDirection>("ALL");
  const [includedFilter, setIncludedFilter] = useState<"ALL" | "INCLUDED" | "EXCLUDED">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("tracking_return_pct");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedIdeaId, setSelectedIdeaId] = useState<number | null>(null);
  const [menuIdeaId, setMenuIdeaId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft(initialComposer));
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshingQuotes, setIsRefreshingQuotes] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedbackParticipantId, setFeedbackParticipantId] = useState(data.participants[0]?.id ?? "");
  const [feedbackStance, setFeedbackStance] = useState<StudyCallFeedbackStance>("agree");
  const [feedbackNote, setFeedbackNote] = useState("");
  const [updateType, setUpdateType] = useState<StudyCallUpdateType>("update");
  const [updateTitle, setUpdateTitle] = useState("");
  const [updateBody, setUpdateBody] = useState("");
  const [updateAuthor, setUpdateAuthor] = useState("");

  useEffect(() => {
    setIdeas(data.ideas);
    if (!feedbackParticipantId && data.participants[0]?.id) {
      setFeedbackParticipantId(data.participants[0].id);
    }
  }, [data.ideas, data.participants, feedbackParticipantId]);

  useEffect(() => {
    if (!initialComposer || prefillConsumedRef.current) return;
    prefillConsumedRef.current = true;
    setComposerOpen(true);
    setEditingId(null);
    setDraft(emptyDraft(initialComposer));
    router.replace("/study-tracker", { scroll: false });
  }, [initialComposer, router]);

  useEffect(() => {
    if (!selectedIdeaId) return;
    const stillExists = data.ideas.some((idea) => idea.id === selectedIdeaId);
    if (!stillExists) {
      setSelectedIdeaId(null);
    }
  }, [data.ideas, selectedIdeaId]);

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
  const presenters = useMemo(
    () => sortUnique(ideas.map((idea) => idea.presenter)),
    [ideas],
  );

  const filteredIdeas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ideas.filter((idea) => {
      if (presenterFilter !== "ALL" && idea.presenter !== presenterFilter) return false;
      if (statusFilter !== "ALL" && idea.status !== statusFilter) return false;
      if (directionFilter !== "ALL" && idea.call_direction !== directionFilter) return false;
      if (includedFilter === "INCLUDED" && !idea.is_included) return false;
      if (includedFilter === "EXCLUDED" && idea.is_included) return false;
      if (!q) return true;
      return [
        idea.presenter,
        idea.company_name,
        idea.ticker,
        idea.sector,
        idea.thesis,
        idea.note,
        idea.trigger,
        idea.risk,
      ]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(q));
    });
  }, [ideas, presenterFilter, statusFilter, directionFilter, includedFilter, search]);

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

  const selectedSourceLabel = useMemo(() => {
    if (!selectedIdea?.source_session) return null;
    return `${selectedIdea.source_session.industry_name} · ${selectedIdea.source_session.presenter}`;
  }, [selectedIdea]);

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function closeComposer() {
    setEditingId(null);
    setComposerOpen(false);
    setDraft(emptyDraft());
    setError(null);
  }

  function openComposerForCreate(prefill?: ComposerPrefill | null) {
    setEditingId(null);
    setComposerOpen(true);
    setDraft(emptyDraft(prefill));
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
    setSortDirection(
      nextKey === "tracking_return_pct" ||
        nextKey === "remaining_upside_pct" ||
        nextKey === "adoption_count" ||
        nextKey === "feedback_count"
        ? "desc"
        : "asc",
    );
  }

  async function patchIdea(
    idea: StudyTrackerIdea,
    payload: StudyTrackerIdeaInput,
    successMessage: string,
  ) {
    setBusyId(idea.id);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/study-tracker/ideas/${idea.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await readApiResponse<ApiResponse>(res);
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
          body: JSON.stringify(toPayload(ideaToDraft(idea), idea)),
        });
        const json = await readApiResponse<ApiResponse>(res);
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
        ...toPayload(ideaToDraft(idea), idea),
        is_included: true,
        included_at: idea.included_at ?? idea.presented_at ?? todayLocalIsoDate(),
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
        ...toPayload(ideaToDraft(idea), idea),
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
        ...toPayload(ideaToDraft(idea), idea),
        is_included: true,
        position_status: "closed",
        exited_at: idea.exited_at ?? todayLocalIsoDate(),
        exited_price: idea.exited_price ?? idea.current_price ?? null,
      },
      "Position closed.",
    );
  }

  async function reopenPosition(idea: StudyTrackerIdea) {
    await patchIdea(
      idea,
      {
        ...toPayload(ideaToDraft(idea), idea),
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
      const existing = editingId === null ? null : ideas.find((idea) => idea.id === editingId) ?? null;
      const payload = toPayload(draft, existing);
      const method = editingId === null ? "POST" : "PATCH";
      const url = editingId === null ? "/api/study-tracker/ideas" : `/api/study-tracker/ideas/${editingId}`;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await readApiResponse<ApiResponse>(res);
      if (!res.ok || !json.ok || !json.idea) {
        throw new Error(json.error ?? `Failed to save idea (HTTP ${res.status})`);
      }
      setIdeas((prev) => {
        if (editingId === null) return [json.idea!, ...prev];
        return prev.map((idea) => (idea.id === json.idea!.id ? json.idea! : idea));
      });
      setSelectedIdeaId(json.idea.id);
      setMessage(json.warning ? `Call saved. ${json.warning}` : editingId === null ? "Call added." : "Call updated.");
      closeComposer();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save call");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteIdea(idea: StudyTrackerIdea) {
    if (!window.confirm(`${idea.company_name} (${idea.ticker}) 콜을 삭제할까요?`)) return;
    setBusyId(idea.id);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/study-tracker/ideas/${idea.id}`, {
        method: "DELETE",
      });
      const json = await readApiResponse<{ ok?: boolean; error?: string }>(res);
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `Failed to delete call (HTTP ${res.status})`);
      }
      setIdeas((prev) => prev.filter((row) => row.id !== idea.id));
      if (selectedIdeaId === idea.id) setSelectedIdeaId(null);
      if (editingId === idea.id) closeComposer();
      setMenuIdeaId(null);
      setMessage("콜을 삭제했습니다.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete call");
    } finally {
      setBusyId(null);
    }
  }

  async function submitFeedback() {
    if (!selectedIdea) return;
    setBusyId(selectedIdea.id);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/study-tracker/ideas/${selectedIdea.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participant_id: feedbackParticipantId,
          stance: feedbackStance,
          note: feedbackNote.trim() || null,
        }),
      });
      const json = await readApiResponse<{ ok?: boolean; error?: string }>(res);
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `Failed to save feedback (HTTP ${res.status})`);
      }
      setFeedbackNote("");
      setMessage("의견을 저장했습니다.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save feedback");
    } finally {
      setBusyId(null);
    }
  }

  async function submitUpdate() {
    if (!selectedIdea) return;
    setBusyId(selectedIdea.id);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/study-tracker/ideas/${selectedIdea.id}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          update_type: updateType,
          title: updateTitle.trim() || null,
          body: updateBody,
          created_by: updateAuthor.trim() || null,
        }),
      });
      const json = await readApiResponse<{ ok?: boolean; error?: string }>(res);
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `Failed to save update (HTTP ${res.status})`);
      }
      setUpdateType("update");
      setUpdateTitle("");
      setUpdateBody("");
      setUpdateAuthor("");
      setMessage("업데이트를 저장했습니다.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save update");
    } finally {
      setBusyId(null);
    }
  }

  const cards = [
    { title: "전체 스터디 종목 수", value: String(summary.totalCalls), tone: "text-slate-900" },
    { title: "실제 매매 연결 종목", value: String(summary.adoptedCalls), tone: "text-slate-900" },
    { title: "산업 발표 연계 종목", value: String(summary.callsFromSessions), tone: "text-slate-900" },
    {
      title: "가장 많이 따라간 종목",
      value: summary.mostFollowed
        ? `${summary.mostFollowed.company_name} · ${summary.mostFollowed.adoption_count}`
        : "-",
      tone: "text-slate-900",
    },
    {
      title: "의견이 가장 많이 달린 종목",
      value: summary.mostDiscussed
        ? `${summary.mostDiscussed.company_name} · ${summary.mostDiscussed.feedback_count}`
        : "-",
      tone: "text-slate-900",
    },
  ];

  const showPortfolioFields = draft.is_included;
  const showPositionExitFields =
    draft.is_included &&
    (draft.position_status === "closed" || Boolean(draft.exited_at || draft.exited_price));

  return (
    <div className="space-y-5">
      <section className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">스터디 종목</h2>
            <p className="mt-1 text-sm text-slate-600">
              이 화면은 스터디에서 다룬 종목을 정리하고 비교하는 곳입니다. 산업 발표에서 언급된 종목은 별도 산업 발표 탭에서 관리합니다.
            </p>
          </div>
          {!composerOpen ? (
            <button
              type="button"
              onClick={() => openComposerForCreate(null)}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              새 종목 추가
            </button>
          ) : (
            <button
              type="button"
              onClick={closeComposer}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            >
              닫기
            </button>
          )}
        </div>

        {message && (
          <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>
        )}
        {error && (
          <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        )}

        {composerOpen && (
          <div className="mt-4 rounded-2xl border border-slate-200 p-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {editingId === null ? "새 콜 등록" : `콜 수정 #${editingId}`}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                산업 발표 세션과 연결되더라도, 이 입력은 실제 콜 생성 시점 기준으로 관리합니다.
              </p>
            </div>

            {(draft.source_session_id || draft.source_coverage_id) && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <div className="font-medium text-slate-900">연결된 발표 맥락</div>
                <div className="mt-1">
                  {initialComposer?.sourceSessionLabel ?? "연결된 발표"}
                  {initialComposer?.sourceCoverageLabel ? ` / ${initialComposer.sourceCoverageLabel}` : ""}
                </div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-sm">
                <div className="mb-1 text-slate-600">콜 날짜</div>
                <input
                  type="date"
                  value={draft.presented_at}
                  onChange={(e) => updateDraft("presented_at", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">발표자</div>
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
                <div className="mb-1 text-slate-600">종목명</div>
                <input
                  value={draft.company_name}
                  onChange={(e) => updateDraft("company_name", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">티커</div>
                <input
                  value={draft.ticker}
                  onChange={(e) => updateDraft("ticker", e.target.value)}
                  placeholder="IMVT / QQQ / KRX:005930"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">방향</div>
                <select
                  value={draft.call_direction}
                  onChange={(e) => updateDraft("call_direction", e.target.value as StudyCallDirection)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                >
                  {CALL_DIRECTION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">상태</div>
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
                <div className="mb-1 text-slate-600">섹터</div>
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
                <div className="mb-1 text-slate-600">스타일</div>
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
                <div className="mb-1 text-slate-600">통화</div>
                <select
                  value={draft.currency}
                  onChange={(e) => updateDraft("currency", e.target.value as Draft["currency"])}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                >
                  <option value="">자동</option>
                  <option value="KRW">KRW</option>
                  <option value="USD">USD</option>
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">발표가</div>
                <input
                  type="number"
                  value={draft.pitch_price}
                  onChange={(e) => updateDraft("pitch_price", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">목표가</div>
                <input
                  type="number"
                  value={draft.target_price}
                  onChange={(e) => updateDraft("target_price", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">현재 목표가</div>
                <input
                  type="number"
                  value={draft.current_target_price}
                  onChange={(e) => updateDraft("current_target_price", e.target.value)}
                  placeholder="비워두면 초기 목표가를 그대로 사용"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">목표 상태</div>
                <select
                  value={draft.target_status}
                  onChange={(e) => updateDraft("target_status", e.target.value as Draft["target_status"])}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                >
                  <option value="">자동(활성)</option>
                  {TARGET_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">확신도 (1-5)</div>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={draft.conviction_score}
                  onChange={(e) => updateDraft("conviction_score", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                />
              </label>
              <label className="text-sm xl:col-span-2">
                <div className="mb-1 text-slate-600">목표 메모</div>
                <input
                  value={draft.target_note}
                  onChange={(e) => updateDraft("target_note", e.target.value)}
                  placeholder="예: TP 도달 후 실적 확인 뒤 상향 검토"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                />
              </label>
              <label className="text-sm xl:col-span-2">
                <div className="mb-1 text-slate-600">투자 기간</div>
                <input
                  value={draft.time_horizon}
                  onChange={(e) => updateDraft("time_horizon", e.target.value)}
                  placeholder="예: 1Q event / 6-12 months"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                />
              </label>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm">
                <div className="mb-1 text-slate-600">투자 아이디어</div>
                <textarea
                  rows={4}
                  value={draft.thesis}
                  onChange={(e) => updateDraft("thesis", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">핵심 이벤트</div>
                <textarea
                  rows={4}
                  value={draft.trigger}
                  onChange={(e) => updateDraft("trigger", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">리스크</div>
                <textarea
                  rows={4}
                  value={draft.risk}
                  onChange={(e) => updateDraft("risk", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">한 줄 요약 / 메모</div>
                <textarea
                  rows={4}
                  value={draft.note}
                  onChange={(e) => updateDraft("note", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                />
              </label>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm">
                <div className="mb-1 text-slate-600">무효화 조건</div>
                <textarea
                  rows={3}
                  value={draft.invalidation_rule}
                  onChange={(e) => updateDraft("invalidation_rule", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                />
              </label>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Included Portfolio</div>
                    <div className="mt-1 text-xs text-slate-500">
                      콜 성과와 별개로 실제 편입 가정 성과를 따로 추적합니다.
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
                          included_at: next ? prev.included_at || prev.presented_at || todayLocalIsoDate() : "",
                          included_price: next ? prev.included_price || prev.pitch_price : "",
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
                      <div className="mb-1 text-slate-600">편입일</div>
                      <input
                        type="date"
                        value={draft.included_at}
                        onChange={(e) => updateDraft("included_at", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                      />
                    </label>
                    <label className="text-sm">
                      <div className="mb-1 text-slate-600">편입가</div>
                      <input
                        type="number"
                        value={draft.included_price}
                        onChange={(e) => updateDraft("included_price", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                      />
                    </label>
                    <label className="text-sm">
                      <div className="mb-1 text-slate-600">비중</div>
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
                      <div className="mb-1 text-slate-600">포지션 상태</div>
                      <select
                        value={draft.position_status}
                        onChange={(e) => updateDraft("position_status", e.target.value as Draft["position_status"])}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                      >
                        <option value="active">보유중</option>
                        <option value="closed">종료</option>
                      </select>
                    </label>
                    {showPositionExitFields && (
                      <label className="text-sm">
                        <div className="mb-1 text-slate-600">청산일</div>
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
                        <div className="mb-1 text-slate-600">청산가</div>
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
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveIdea}
                disabled={isSaving}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isSaving ? "저장 중..." : editingId === null ? "콜 저장" : "변경사항 저장"}
              </button>
              <button
                type="button"
                onClick={closeComposer}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map((card) => (
          <div key={card.title} className="panel px-4 py-3">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{card.title}</div>
            <div className={`mt-2 text-lg font-semibold ${card.tone}`}>{card.value}</div>
          </div>
        ))}
      </section>

      <section className="panel p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="text-sm xl:col-span-2">
            <div className="mb-1 text-slate-600">검색</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="발표자, 티커, 종목명, 아이디어 검색"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">발표자</div>
            <select
              value={presenterFilter}
              onChange={(e) => setPresenterFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            >
              <option value="ALL">전체</option>
              {presenters.map((presenter) => (
                <option key={presenter} value={presenter}>
                  {presenter}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">방향</div>
            <select
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value as "ALL" | StudyCallDirection)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            >
              <option value="ALL">전체</option>
              {CALL_DIRECTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">상태</div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            >
              <option value="ALL">전체</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">포트폴리오</div>
            <select
              value={includedFilter}
              onChange={(e) => setIncludedFilter(e.target.value as "ALL" | "INCLUDED" | "EXCLUDED")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            >
              <option value="ALL">전체</option>
              <option value="INCLUDED">편입만 보기</option>
              <option value="EXCLUDED">미편입만 보기</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <div>헤더를 클릭하면 오름차순/내림차순 정렬이 됩니다.</div>
          <button
            type="button"
            onClick={() => refreshIdeas(sortedIdeas, `${sortedIdeas.length}개 콜의 현재가를 다시 불러왔습니다.`)}
            disabled={isRefreshingQuotes || sortedIdeas.length === 0}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRefreshingQuotes ? "불러오는 중..." : "현재가 일괄 새로고침"}
          </button>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="divide-y divide-slate-200 md:hidden">
          {sortedIdeas.map((idea) => (
            <div
              key={idea.id}
              className="space-y-3 p-4"
              onClick={() => {
                setSelectedIdeaId(idea.id);
                setMenuIdeaId(null);
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-900">{idea.company_name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{idea.ticker}</span>
                    {idea.sector ? <span>{idea.sector}</span> : null}
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs text-slate-500">
                  <div>{formatCompactDate(idea.presented_at)}</div>
                  <div className="mt-1 whitespace-nowrap">{idea.presenter}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                  {directionLabel(idea.call_direction)}
                </span>
                <span className="inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                  {idea.status ?? "-"}
                </span>
                {idea.source_session ? (
                  <span className="inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                    발표 연결
                  </span>
                ) : null}
                {idea.is_included ? (
                  <span className="inline-flex whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">
                    편입
                  </span>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-slate-500">추적 수익률</div>
                  <div className={`mt-1 font-medium ${toneClass(idea.tracking_return_pct)}`}>
                    {formatPct(idea.tracking_return_pct)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">업사이드</div>
                  <div className="mt-1 font-medium text-slate-900">{displayRemainingMovePct(idea)}</div>
                  {formatUpsideSummary(idea) ? (
                    <div className="mt-1 text-xs text-slate-500">{formatUpsideSummary(idea)}</div>
                  ) : null}
                </div>
              </div>

              <div className="text-xs text-slate-600">
                <div className="line-clamp-2">{summarizeIdea(idea)}</div>
              </div>

              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => startEdit(idea)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => deleteIdea(idea)}
                  disabled={busyId === idea.id}
                  className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  {busyId === idea.id ? "삭제 중..." : "삭제"}
                </button>
              </div>
            </div>
          ))}
          {sortedIdeas.length === 0 && <div className="px-4 py-10 text-center text-sm text-slate-500">현재 조건에 맞는 콜이 없습니다.</div>}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-3">
                  <button type="button" onClick={() => toggleSort("company_name")} className="font-medium hover:text-slate-900">
                    종목 {sortKey === "company_name" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th className="px-3 py-3">
                  <button type="button" onClick={() => toggleSort("presented_at")} className="font-medium hover:text-slate-900">
                    발표 날짜 {sortKey === "presented_at" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th className="px-3 py-3">
                  <button type="button" onClick={() => toggleSort("presenter")} className="font-medium hover:text-slate-900">
                    발표자 {sortKey === "presenter" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th className="px-3 py-3">
                  <button type="button" onClick={() => toggleSort("call_direction")} className="font-medium hover:text-slate-900">
                    방향 {sortKey === "call_direction" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th className="px-3 py-3">상태</th>
                <th className="px-3 py-3 text-right">
                  <button type="button" onClick={() => toggleSort("tracking_return_pct")} className="font-medium hover:text-slate-900">
                    추적 수익률 {sortKey === "tracking_return_pct" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th className="px-3 py-3">
                  <button type="button" onClick={() => toggleSort("remaining_upside_pct")} className="font-medium hover:text-slate-900">
                    업사이드 {sortKey === "remaining_upside_pct" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th className="px-3 py-3">요약</th>
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
                      {idea.source_session && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          발표 연결
                        </span>
                      )}
                      {idea.is_included && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          편입
                        </span>
                      )}
                    </div>
                    {idea.sector && <div className="mt-1 text-xs text-slate-400">{idea.sector}</div>}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-slate-700">{formatCompactDate(idea.presented_at)}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-slate-700">{idea.presenter}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                      {directionLabel(idea.call_direction)}
                    </span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                      {idea.status ?? "-"}
                    </span>
                  </td>
                  <td className={`px-3 py-3 text-right font-medium ${toneClass(idea.tracking_return_pct)}`}>
                    {formatPct(idea.tracking_return_pct)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-sm font-medium text-slate-900">
                      {displayRemainingMovePct(idea)}
                    </div>
                    {formatUpsideSummary(idea) ? (
                      <div className="mt-1 text-xs text-slate-500">{formatUpsideSummary(idea)}</div>
                    ) : null}
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
                        aria-label="행 작업"
                      >
                        ⋯
                      </button>
                      {menuIdeaId === idea.id && (
                        <div className="absolute right-0 top-10 z-20 w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                          <button
                            type="button"
                            onClick={() => startEdit(idea)}
                            className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteIdea(idea)}
                            disabled={busyId === idea.id}
                            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          >
                            {busyId === idea.id ? "삭제 중..." : "삭제"}
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {sortedIdeas.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-sm text-slate-500">
                    현재 조건에 맞는 콜이 없습니다.
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
            className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">콜 상세</div>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">{selectedIdea.company_name}</h3>
                <div className="mt-1 text-sm text-slate-500">{selectedIdea.ticker}</div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(selectedIdea)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                >
                  수정
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
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:bg-slate-400"
                  >
                    포트폴리오 편입
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
                  닫기
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">발표 날짜</div>
                <div className="mt-1 font-medium text-slate-900">{formatCompactDate(selectedIdea.presented_at)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">발표자</div>
                <div className="mt-1 font-medium text-slate-900">{selectedIdea.presenter}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">방향</div>
                <div className="mt-1 font-medium text-slate-900">{directionLabel(selectedIdea.call_direction)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">상태</div>
                <div className="mt-1 font-medium text-slate-900">{selectedIdea.status ?? "-"}</div>
              </div>
            </div>

            {(selectedIdea.source_session || selectedIdea.source_coverage) && (
              <section className="mt-5 rounded-2xl border border-slate-200 p-4">
                <div className="text-sm font-semibold text-slate-900">출처 발표</div>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="text-slate-500">발표</div>
                    <div className="mt-1 font-medium text-slate-900">
                      {selectedSourceLabel ?? "-"}
                    </div>
                    {selectedIdea.source_session?.title && (
                      <div className="mt-1 text-slate-600">{selectedIdea.source_session.title}</div>
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="text-slate-500">커버 종목</div>
                    <div className="mt-1 font-medium text-slate-900">
                      {selectedIdea.source_coverage
                        ? `${selectedIdea.source_coverage.company_name} (${selectedIdea.source_coverage.ticker})`
                        : "-"}
                    </div>
                    {selectedIdea.source_coverage && (
                      <div className="mt-1 text-slate-600">
                        관점: {selectedIdea.source_coverage.session_stance} / 후속 상태: {selectedIdea.source_coverage.follow_up_status}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">발표가</div>
                <div className="mt-1 font-medium text-slate-900">
                  {formatPrice(selectedIdea.pitch_price, selectedIdea.currency)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">현재가</div>
                <div className="mt-1 font-medium text-slate-900">
                  {formatPrice(selectedIdea.current_price, selectedIdea.currency)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">초기 목표가</div>
                <div className="mt-1 font-medium text-slate-900">
                  {formatPrice(selectedIdea.target_price, selectedIdea.currency)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">현재 목표가</div>
                <div className="mt-1 font-medium text-slate-900">
                  {formatPrice(selectedIdea.effective_target_price, selectedIdea.currency)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">목표 상태</div>
                <div className="mt-1">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${targetStatusTone(selectedIdea)}`}>
                    {describeTargetStatus(selectedIdea)}
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">목표 수정일</div>
                <div className="mt-1 font-medium text-slate-900">
                  {selectedIdea.target_updated_at ? selectedIdea.target_updated_at.slice(0, 10) : "-"}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">추적 수익률</div>
                <div className={`mt-1 font-medium ${toneClass(selectedIdea.tracking_return_pct)}`}>
                  {formatPct(selectedIdea.tracking_return_pct)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">확신도</div>
                <div className="mt-1 font-medium text-slate-900">{selectedIdea.conviction_score ?? "-"}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">투자 기간</div>
                <div className="mt-1 font-medium text-slate-900">{selectedIdea.time_horizon ?? "-"}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">잔여 업사이드</div>
                <div className={`mt-1 font-medium ${toneClass(selectedIdea.remaining_upside_pct)}`}>
                  {formatPct(selectedIdea.remaining_upside_pct)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">채택 수</div>
                <div className="mt-1 font-medium text-slate-900">{selectedIdea.adoption_count}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-slate-500">의견 수</div>
                <div className="mt-1 font-medium text-slate-900">{selectedIdea.feedback_count}</div>
              </div>
            </div>

            <section className="mt-5 rounded-2xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-900">목표 메모</div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {selectedIdea.target_note ?? "-"}
              </div>
            </section>

            <section className="mt-5 rounded-2xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-900">포트폴리오 레이어</div>
              {selectedIdea.is_included ? (
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="text-slate-500">편입일</div>
                    <div className="mt-1 font-medium text-slate-900">{selectedIdea.included_at ?? "-"}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="text-slate-500">편입가</div>
                    <div className="mt-1 font-medium text-slate-900">
                      {formatPrice(selectedIdea.included_price, selectedIdea.currency)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="text-slate-500">포트폴리오 수익률</div>
                    <div className={`mt-1 font-medium ${toneClass(selectedIdea.portfolio_return_pct)}`}>
                      {formatPct(selectedIdea.portfolio_return_pct)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="text-slate-500">포지션 상태</div>
                    <div className="mt-1 font-medium text-slate-900">{selectedIdea.position_status ?? "-"}</div>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-500">아직 편입 포트폴리오에 들어가지 않은 콜입니다.</div>
              )}
            </section>

            <div className="mt-5 space-y-4">
              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="text-sm font-semibold text-slate-900">투자 아이디어</div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedIdea.thesis ?? "-"}</div>
              </section>
              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="text-sm font-semibold text-slate-900">이벤트 / 리스크 / 무효화 조건</div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">이벤트</div>
                    <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedIdea.trigger ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">리스크</div>
                    <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedIdea.risk ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">무효화 조건</div>
                    <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedIdea.invalidation_rule ?? "-"}</div>
                  </div>
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="text-sm font-semibold text-slate-900">한 줄 요약 / 메모</div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedIdea.note ?? "-"}</div>
              </section>
            </div>

            <section className="mt-5 rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">의견</div>
                  <div className="mt-1 text-xs text-slate-500">동의 / 중립 / 반대 기준으로 의견을 남길 수 있습니다.</div>
                </div>
                <div className="text-sm text-slate-500">{selectedIdea.feedback_count}개 의견</div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="text-sm">
                  <div className="mb-1 text-slate-600">참가자</div>
                  <select
                    value={feedbackParticipantId}
                    onChange={(e) => setFeedbackParticipantId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                  >
                    {data.participants.map((participant) => (
                      <option key={participant.id} value={participant.id}>
                        {participant.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <div className="mb-1 text-slate-600">의견</div>
                  <select
                    value={feedbackStance}
                    onChange={(e) => setFeedbackStance(e.target.value as StudyCallFeedbackStance)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                  >
                    {FEEDBACK_STANCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm md:col-span-1">
                  <div className="mb-1 text-slate-600">메모</div>
                  <input
                    value={feedbackNote}
                    onChange={(e) => setFeedbackNote(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={submitFeedback}
                disabled={busyId === selectedIdea.id || !feedbackParticipantId}
                className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                의견 저장
              </button>
              <div className="mt-4 space-y-3">
                {selectedIdea.feedbacks.length === 0 ? (
                  <div className="text-sm text-slate-500">아직 남겨진 의견이 없습니다.</div>
                ) : (
                  selectedIdea.feedbacks.map((feedback) => (
                    <div key={feedback.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium text-slate-900">{feedback.participant_name}</div>
                        <div className="text-xs text-slate-500">{feedback.stance}</div>
                      </div>
                      <div className="mt-2 text-slate-700">{feedback.note ?? "-"}</div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="mt-5 rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">업데이트 타임라인 / 사후 복기</div>
                  <div className="mt-1 text-xs text-slate-500">materially new call이 아니면 새 row 대신 timeline에 기록합니다.</div>
                </div>
                <div className="text-sm text-slate-500">{selectedIdea.update_count}개 업데이트</div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <div className="mb-1 text-slate-600">유형</div>
                  <select
                    value={updateType}
                    onChange={(e) => setUpdateType(e.target.value as StudyCallUpdateType)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                  >
                    {UPDATE_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <div className="mb-1 text-slate-600">작성자</div>
                  <input
                    value={updateAuthor}
                    onChange={(e) => setUpdateAuthor(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                  />
                </label>
                <label className="text-sm md:col-span-2">
                  <div className="mb-1 text-slate-600">제목</div>
                  <input
                    value={updateTitle}
                    onChange={(e) => setUpdateTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                  />
                </label>
                <label className="text-sm md:col-span-2">
                  <div className="mb-1 text-slate-600">내용</div>
                  <textarea
                    rows={4}
                    value={updateBody}
                    onChange={(e) => setUpdateBody(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={submitUpdate}
                disabled={busyId === selectedIdea.id || !updateBody.trim()}
                className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                업데이트 저장
              </button>
              <div className="mt-4 space-y-3">
                {selectedIdea.updates.length === 0 ? (
                  <div className="text-sm text-slate-500">아직 업데이트가 없습니다.</div>
                ) : (
                  selectedIdea.updates.map((update) => (
                    <div key={update.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-medium text-slate-900">{update.title || update.update_type}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {update.update_type} · {update.created_by ?? "Unknown"} · {update.created_at.slice(0, 10)}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 whitespace-pre-wrap text-slate-700">{update.body}</div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="mt-5 rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">연결된 거래</div>
                <div className="text-sm text-slate-500">{selectedIdea.linked_trade_count}건</div>
              </div>
              <div className="mt-4 space-y-3">
                {selectedIdea.linked_trades.length === 0 ? (
                  <div className="text-sm text-slate-500">아직 이 콜에 연결된 참가자 거래가 없습니다.</div>
                ) : (
                  selectedIdea.linked_trades.map((trade) => (
                    <div key={trade.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium text-slate-900">{trade.participant_name}</div>
                        <div className="text-xs text-slate-500">{trade.trade_date}</div>
                      </div>
                      <div className="mt-2 text-slate-700">
                        {trade.side} {trade.quantity} @ {trade.price.toLocaleString("en-US")}
                        {trade.note ? ` · ${trade.note}` : ""}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
