"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  StudySession,
  StudySessionCompany,
  StudySessionCompanyInput,
  StudySessionData,
  StudySessionInput,
  StudySessionFollowUpStatus,
  StudySessionStance,
} from "@/types/study-tracker";

const STANCE_OPTIONS: Array<{ value: StudySessionStance; label: string }> = [
  { value: "long", label: "Long" },
  { value: "short", label: "Short" },
  { value: "neutral", label: "Neutral" },
];

const FOLLOW_UP_OPTIONS: Array<{ value: StudySessionFollowUpStatus; label: string }> = [
  { value: "watching", label: "관찰중" },
  { value: "waiting_event", label: "이벤트 대기" },
  { value: "ready_for_call", label: "정식 콜 후보" },
  { value: "archived", label: "보류 종료" },
];

type PanelMode = "closed" | "view" | "edit" | "create";

type FreeIdeaDraft = {
  presented_at: string;
  presenter: string;
  company_name: string;
  ticker: string;
  sector: string;
  session_stance: StudySessionStance;
  follow_up_status: StudySessionFollowUpStatus;
  summary_line: string;
  why_watch: string;
  checkpoint_note: string;
  risk_note: string;
  note: string;
};

type FreeIdeaEntry = {
  session: StudySession;
  company: StudySessionCompany;
};

type SessionResponse = {
  ok?: boolean;
  error?: string;
  session?: StudySession;
};

type CompanyResponse = {
  ok?: boolean;
  error?: string;
  company?: StudySessionCompany;
  warning?: string;
};

type StudyIdeaResponse = {
  ok?: boolean;
  error?: string;
  idea?: { id: number };
  warning?: string;
};

function emptyDraft(): FreeIdeaDraft {
  return {
    presented_at: "",
    presenter: "",
    company_name: "",
    ticker: "",
    sector: "",
    session_stance: "neutral",
    follow_up_status: "watching",
    summary_line: "",
    why_watch: "",
    checkpoint_note: "",
    risk_note: "",
    note: "",
  };
}

function entryToDraft(entry: FreeIdeaEntry): FreeIdeaDraft {
  return {
    presented_at: entry.session.presented_at,
    presenter: entry.session.presenter,
    company_name: entry.company.company_name,
    ticker: entry.company.ticker,
    sector: entry.company.sector ?? "",
    session_stance: entry.company.session_stance,
    follow_up_status: entry.company.follow_up_status,
    summary_line: entry.company.summary_line ?? "",
    why_watch: entry.company.mention_reason ?? entry.session.thesis ?? "",
    checkpoint_note: entry.company.checkpoint_note ?? "",
    risk_note: entry.company.risk_note ?? "",
    note: entry.company.note ?? entry.session.note ?? "",
  };
}

function summarize(text: string | null | undefined) {
  const value = (text ?? "").replace(/\s+/g, " ").trim();
  if (!value) return "-";
  return value.length > 92 ? `${value.slice(0, 92)}...` : value;
}

function formatPrice(value: number | null, currency: "KRW" | "USD" | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  if (currency === "KRW") {
    return `₩${Math.round(value).toLocaleString("ko-KR")}`;
  }
  if (currency === "USD") {
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
  return value.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

async function readApiResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(text?.trim() || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

function buildSessionPayload(draft: FreeIdeaDraft): StudySessionInput {
  const title = draft.company_name.trim();
  return {
    presented_at: draft.presented_at,
    presenter: draft.presenter.trim(),
    industry_name: title,
    title,
    thesis: draft.why_watch.trim() || null,
    anti_thesis: null,
    note: draft.note.trim() || null,
  };
}

function buildCompanyPayload(sessionId: number, draft: FreeIdeaDraft): StudySessionCompanyInput {
  return {
    session_id: sessionId,
    company_name: draft.company_name.trim(),
    ticker: draft.ticker.trim(),
    sector: draft.sector.trim() || null,
    session_stance: draft.session_stance,
    summary_line: draft.summary_line.trim() || null,
    mention_reason: draft.why_watch.trim() || null,
    checkpoint_note: draft.checkpoint_note.trim() || null,
    risk_note: draft.risk_note.trim() || null,
    follow_up_status: draft.follow_up_status,
    next_event_date: null,
    note: draft.note.trim() || null,
  };
}

function sortSessions(sessions: StudySession[]) {
  return [...sessions]
    .map((session) => ({
      ...session,
      companies: [...session.companies].sort((a, b) =>
        a.company_name.localeCompare(b.company_name, "ko-KR"),
      ),
      covered_count: session.companies.length,
    }))
    .sort((a, b) => {
      if (a.presented_at === b.presented_at) return b.id - a.id;
      return b.presented_at.localeCompare(a.presented_at);
    });
}

function sortEntries(entries: FreeIdeaEntry[]) {
  return [...entries].sort((a, b) => {
    const dateCompare = b.session.presented_at.localeCompare(a.session.presented_at);
    if (dateCompare !== 0) return dateCompare;
    return a.company.company_name.localeCompare(b.company.company_name, "ko-KR");
  });
}

function upsertSessionWithCompany(
  sessions: StudySession[],
  sessionRow: StudySession,
  companyRow: StudySessionCompany,
) {
  const next = sessions.map((session) => {
    if (session.id !== sessionRow.id) return session;
    const existingIndex = session.companies.findIndex((company) => company.id === companyRow.id);
    const companies = existingIndex >= 0
      ? session.companies.map((company) => (company.id === companyRow.id ? companyRow : company))
      : [...session.companies, companyRow];
    return {
      ...session,
      ...sessionRow,
      companies,
      covered_count: companies.length,
    };
  });

  if (!next.some((session) => session.id === sessionRow.id)) {
    next.push({
      ...sessionRow,
      companies: [companyRow],
      covered_count: 1,
      converted_count: sessionRow.converted_count ?? 0,
      adoption_count: sessionRow.adoption_count ?? 0,
    });
  }

  return sortSessions(next);
}

function stanceLabel(value: StudySessionStance) {
  return STANCE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function followUpLabel(value: StudySessionFollowUpStatus) {
  return FOLLOW_UP_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function stanceTone(value: StudySessionStance) {
  if (value === "long") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (value === "short") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function followUpTone(value: StudySessionFollowUpStatus) {
  switch (value) {
    case "ready_for_call":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "waiting_event":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "archived":
      return "bg-slate-100 text-slate-600 border-slate-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export function StudySessionsBoard({ data }: { data: StudySessionData }) {
  const router = useRouter();
  const [sessions, setSessions] = useState(data.sessions);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>("closed");
  const [draft, setDraft] = useState<FreeIdeaDraft>(emptyDraft());
  const [search, setSearch] = useState("");
  const [presenterFilter, setPresenterFilter] = useState("ALL");
  const [stanceFilter, setStanceFilter] = useState<"ALL" | StudySessionStance>("ALL");
  const [followUpFilter, setFollowUpFilter] = useState<"ALL" | StudySessionFollowUpStatus>("ALL");
  const [isSaving, setIsSaving] = useState(false);
  const [busyCompanyId, setBusyCompanyId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSessions(data.sessions);
  }, [data.sessions]);

  const entries = useMemo(() => {
    const flat = sessions.flatMap((session) =>
      session.companies.map((company) => ({ session, company })),
    );
    return sortEntries(flat);
  }, [sessions]);

  const presenters = useMemo(
    () =>
      [...new Set(entries.map((entry) => entry.session.presenter.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "ko-KR"),
      ),
    [entries],
  );

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (presenterFilter !== "ALL" && entry.session.presenter !== presenterFilter) return false;
      if (stanceFilter !== "ALL" && entry.company.session_stance !== stanceFilter) return false;
      if (followUpFilter !== "ALL" && entry.company.follow_up_status !== followUpFilter) return false;
      if (!q) return true;
      return [
        entry.session.presenter,
        entry.company.company_name,
        entry.company.ticker,
        entry.company.summary_line,
        entry.company.mention_reason,
        entry.company.checkpoint_note,
        entry.company.risk_note,
        entry.company.note,
      ]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(q));
    });
  }, [entries, followUpFilter, presenterFilter, search, stanceFilter]);

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.company.id === selectedCompanyId) ?? null,
    [entries, selectedCompanyId],
  );

  function updateDraft<K extends keyof FreeIdeaDraft>(key: K, value: FreeIdeaDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function closePanel() {
    setPanelMode("closed");
    setSelectedCompanyId(null);
    setDraft(emptyDraft());
  }

  function openCreateEntry() {
    setPanelMode("create");
    setSelectedCompanyId(null);
    setDraft(emptyDraft());
    setMessage(null);
    setError(null);
  }

  function openEntry(entry: FreeIdeaEntry) {
    setPanelMode("view");
    setSelectedCompanyId(entry.company.id);
    setDraft(emptyDraft());
    setMessage(null);
    setError(null);
  }

  function openEditEntry(entry: FreeIdeaEntry) {
    setPanelMode("edit");
    setSelectedCompanyId(entry.company.id);
    setDraft(entryToDraft(entry));
    setMessage(null);
    setError(null);
  }

  async function includeInPortfolio(entry: FreeIdeaEntry) {
    setBusyCompanyId(entry.company.id);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/study-tracker/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presented_at: entry.session.presented_at,
          presenter: entry.session.presenter,
          company_name: entry.company.company_name,
          ticker: entry.company.ticker,
          sector: entry.company.sector ?? null,
          pitch_price: entry.company.reference_price,
          target_price: entry.company.target_price,
          currency: entry.company.currency,
          thesis: entry.company.mention_reason ?? entry.session.thesis ?? null,
          note: entry.company.note ?? entry.session.note ?? null,
          status: "편입",
          is_included: true,
          included_at: new Date().toISOString().slice(0, 10),
          source_session_id: entry.session.id,
          source_coverage_id: entry.company.id,
        }),
      });
      const json = await readApiResponse<StudyIdeaResponse>(res);
      if (!res.ok || !json.ok || !json.idea) {
        throw new Error(json.error ?? `포트폴리오 편입에 실패했습니다. (HTTP ${res.status})`);
      }

      router.push("/study-tracker/portfolio");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "포트폴리오 편입에 실패했습니다.");
    } finally {
      setBusyCompanyId(null);
    }
  }

  async function saveEntry() {
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const sessionPayload = buildSessionPayload(draft);
      const isNew = panelMode === "create" || !selectedEntry;

      if (isNew) {
        const sessionRes = await fetch("/api/study-tracker/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sessionPayload),
        });
        const sessionJson = await readApiResponse<SessionResponse>(sessionRes);
        if (!sessionRes.ok || !sessionJson.ok || !sessionJson.session) {
          throw new Error(sessionJson.error ?? `자유 종목을 저장하지 못했습니다. (HTTP ${sessionRes.status})`);
        }

        const companyRes = await fetch(`/api/study-tracker/sessions/${sessionJson.session.id}/companies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...buildCompanyPayload(sessionJson.session.id, draft),
            presented_at: draft.presented_at,
          }),
        });
        const companyJson = await readApiResponse<CompanyResponse>(companyRes);
        if (!companyRes.ok || !companyJson.ok || !companyJson.company) {
          throw new Error(companyJson.error ?? `종목을 저장하지 못했습니다. (HTTP ${companyRes.status})`);
        }

        const nextSession: StudySession = {
          ...sessionJson.session,
          companies: [companyJson.company],
          covered_count: 1,
          converted_count: sessionJson.session.converted_count ?? 0,
          adoption_count: sessionJson.session.adoption_count ?? 0,
        };
        setSessions((prev) => upsertSessionWithCompany(prev, nextSession, companyJson.company!));
        setSelectedCompanyId(companyJson.company.id);
        setPanelMode("view");
        setMessage(
          companyJson.warning
            ? `자유 종목을 등록했습니다. ${companyJson.warning}`
            : "자유 종목을 등록했습니다.",
        );
      } else {
        const sessionRes = await fetch(`/api/study-tracker/sessions/${selectedEntry.session.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sessionPayload),
        });
        const sessionJson = await readApiResponse<SessionResponse>(sessionRes);
        if (!sessionRes.ok || !sessionJson.ok || !sessionJson.session) {
          throw new Error(sessionJson.error ?? `자유 종목을 수정하지 못했습니다. (HTTP ${sessionRes.status})`);
        }

        const companyRes = await fetch(`/api/study-tracker/session-companies/${selectedEntry.company.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...buildCompanyPayload(selectedEntry.session.id, draft),
            presented_at: draft.presented_at,
          }),
        });
        const companyJson = await readApiResponse<CompanyResponse>(companyRes);
        if (!companyRes.ok || !companyJson.ok || !companyJson.company) {
          throw new Error(companyJson.error ?? `종목을 수정하지 못했습니다. (HTTP ${companyRes.status})`);
        }

        setSessions((prev) => upsertSessionWithCompany(prev, sessionJson.session!, companyJson.company!));
        setPanelMode("view");
        setMessage(
          companyJson.warning
            ? `자유 종목을 수정했습니다. ${companyJson.warning}`
            : "자유 종목을 수정했습니다.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "자유 종목을 저장하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteEntry(entry: FreeIdeaEntry) {
    if (!window.confirm(`${entry.company.company_name} (${entry.company.ticker})를 삭제할까요?`)) return;
    setBusyCompanyId(entry.company.id);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/study-tracker/session-companies/${entry.company.id}`, {
        method: "DELETE",
      });
      const json = await readApiResponse<{ ok?: boolean; error?: string }>(res);
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `종목을 삭제하지 못했습니다. (HTTP ${res.status})`);
      }

      setSessions((prev) =>
        prev
          .map((session) => {
            if (session.id !== entry.session.id) return session;
            const companies = session.companies.filter((company) => company.id !== entry.company.id);
            return {
              ...session,
              companies,
              covered_count: companies.length,
            };
          })
          .filter((session) => session.companies.length > 0),
      );

      if (selectedCompanyId === entry.company.id) {
        closePanel();
      }
      setMessage("자유 종목을 삭제했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "자유 종목을 삭제하지 못했습니다.");
    } finally {
      setBusyCompanyId(null);
    }
  }

  const distinctPresenterCount = useMemo(
    () => new Set(entries.map((entry) => entry.session.presenter.trim()).filter(Boolean)).size,
    [entries],
  );
  const recentWeekCount = useMemo(() => {
    const boundary = new Date();
    boundary.setHours(0, 0, 0, 0);
    boundary.setDate(boundary.getDate() - 6);
    return entries.filter((entry) => {
      const parsed = new Date(`${entry.session.presented_at}T00:00:00`);
      return Number.isFinite(parsed.getTime()) && parsed >= boundary;
    }).length;
  }, [entries]);
  const convertedCount = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.company.converted_call_count, 0),
    [entries],
  );

  const summaryCards = [
    { title: "전체 종목 수", value: String(entries.length) },
    { title: "작성자 수", value: String(distinctPresenterCount) },
    { title: "최근 7일 등록 수", value: String(recentWeekCount) },
    { title: "정식 콜 전환 수", value: String(convertedCount || 0) },
  ];

  const panelOpen = panelMode !== "closed";
  const detailEntry = selectedEntry;
  const editingEntry = panelMode === "edit" && selectedEntry ? selectedEntry : null;

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.title} className="panel px-4 py-3">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{card.title}</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{card.value}</div>
          </div>
        ))}
      </section>

      <section className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">자유 종목</h2>
            <p className="mt-1 text-sm text-slate-600">
              종목 단위로 자유롭게 의견과 메모를 남기는 공간입니다.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateEntry}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            새 종목 등록
          </button>
        </div>
        {message && (
          <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>
        )}
        {error && <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      </section>

      <section className="panel p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-sm">
            <div className="mb-1 text-slate-600">검색</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="작성자, 종목명, 티커, 요약 검색"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">작성자</div>
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
            <div className="mb-1 text-slate-600">관점</div>
            <select
              value={stanceFilter}
              onChange={(e) => setStanceFilter(e.target.value as "ALL" | StudySessionStance)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            >
              <option value="ALL">전체</option>
              {STANCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <div className="mb-1 text-slate-600">팔로업 상태</div>
            <select
              value={followUpFilter}
              onChange={(e) => setFollowUpFilter(e.target.value as "ALL" | StudySessionFollowUpStatus)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            >
              <option value="ALL">전체</option>
              {FOLLOW_UP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="divide-y divide-slate-200 md:hidden">
          {filteredEntries.map((entry) => (
            <div
              key={entry.company.id}
              className="space-y-3 p-4"
              onClick={() => openEntry(entry)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-900">{entry.company.company_name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {[entry.company.ticker, entry.company.sector].filter(Boolean).join(" · ") || "-"}
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs text-slate-500">
                  <div>{entry.session.presented_at}</div>
                  <div className="mt-1 whitespace-nowrap">{entry.session.presenter}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs ${stanceTone(entry.company.session_stance)}`}
                >
                  {stanceLabel(entry.company.session_stance)}
                </span>
                <span
                  className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs ${followUpTone(entry.company.follow_up_status)}`}
                >
                  {followUpLabel(entry.company.follow_up_status)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-slate-500">등록 기준가</div>
                  <div className="mt-1 font-medium text-slate-900">
                    {formatPrice(entry.company.reference_price, entry.company.currency)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">기준일</div>
                  <div className="mt-1 font-medium text-slate-900">{entry.company.reference_price_date ?? "-"}</div>
                </div>
              </div>

              <div className="text-xs text-slate-600">
                <div className="line-clamp-2">
                  {summarize(
                    entry.company.summary_line ??
                      entry.company.mention_reason ??
                      entry.session.thesis ??
                      entry.company.note ??
                      entry.session.note,
                  )}
                </div>
              </div>
            </div>
          ))}
          {filteredEntries.length === 0 && <div className="px-4 py-10 text-center text-slate-500">조건에 맞는 자유 종목이 없습니다.</div>}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                {["작성일", "작성자", "종목", "관점", "팔로업", "등록 기준가", "요약"].map((heading) => (
                  <th key={heading} className="px-3 py-3 font-semibold">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => (
                <tr
                  key={entry.company.id}
                  className="cursor-pointer border-t border-slate-200 hover:bg-slate-50"
                  onClick={() => openEntry(entry)}
                >
                  <td className="px-3 py-3 whitespace-nowrap">{entry.session.presented_at}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{entry.session.presenter}</td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-900">{entry.company.company_name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {[entry.company.ticker, entry.company.sector].filter(Boolean).join(" · ") || "-"}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    <span
                      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs ${stanceTone(entry.company.session_stance)}`}
                    >
                      {stanceLabel(entry.company.session_stance)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    <span
                      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs ${followUpTone(entry.company.follow_up_status)}`}
                    >
                      {followUpLabel(entry.company.follow_up_status)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    <div>{formatPrice(entry.company.reference_price, entry.company.currency)}</div>
                    <div className="mt-1 text-xs text-slate-500">{entry.company.reference_price_date ?? "-"}</div>
                  </td>
                  <td className="max-w-[420px] px-3 py-3 text-xs text-slate-600">
                    <div className="line-clamp-1">
                      {summarize(
                        entry.company.summary_line ??
                          entry.company.mention_reason ??
                          entry.session.thesis ??
                          entry.company.note ??
                          entry.session.note,
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-slate-500">
                    조건에 맞는 자유 종목이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {panelOpen && (
        <div className="fixed inset-0 z-30 flex justify-end bg-slate-900/20" onClick={closePanel}>
          <aside
            className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">자유 종목</div>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                  {panelMode === "create"
                    ? "새 자유 종목"
                    : panelMode === "edit"
                      ? `${editingEntry?.company.company_name ?? "자유 종목"} 수정`
                      : detailEntry?.company.company_name}
                </h3>
                {panelMode !== "create" && detailEntry?.company.ticker && (
                  <div className="mt-1 text-sm text-slate-500">{detailEntry.company.ticker}</div>
                )}
              </div>
              <button
                type="button"
                onClick={closePanel}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              >
                닫기
              </button>
            </div>

            {panelMode === "view" && detailEntry && (
              <>
                <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="text-slate-500">등록 기준가</div>
                    <div className="mt-1 font-medium text-slate-900">
                      {formatPrice(detailEntry.company.reference_price, detailEntry.company.currency)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{detailEntry.company.reference_price_date ?? "-"}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="text-slate-500">관점</div>
                    <div className="mt-1 font-medium text-slate-900">
                      {stanceLabel(detailEntry.company.session_stance)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="text-slate-500">팔로업 상태</div>
                    <div className="mt-1 font-medium text-slate-900">
                      {followUpLabel(detailEntry.company.follow_up_status)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="text-slate-500">현재가</div>
                    <div className="mt-1 font-medium text-slate-900">
                      {formatPrice(detailEntry.company.current_price, detailEntry.company.currency)}
                    </div>
                  </div>
                </div>

                <section className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="text-slate-500">작성일</div>
                    <div className="mt-1 font-medium text-slate-900">{detailEntry.session.presented_at}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="text-slate-500">작성자</div>
                    <div className="mt-1 font-medium text-slate-900">{detailEntry.session.presenter}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="text-slate-500">섹터</div>
                    <div className="mt-1 font-medium text-slate-900">{detailEntry.company.sector ?? "-"}</div>
                  </div>
                </section>

                <section className="mt-5 rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-900">한 줄 요약</div>
                  <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {detailEntry.company.summary_line ?? "-"}
                  </div>
                </section>

                <section className="mt-5 rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-900">왜 보는지</div>
                  <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {detailEntry.company.mention_reason ?? detailEntry.session.thesis ?? "-"}
                  </div>
                </section>

                <section className="mt-5 rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-900">이벤트 / 체크포인트</div>
                  <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {detailEntry.company.checkpoint_note ?? "-"}
                  </div>
                </section>

                <section className="mt-5 rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-900">리스크</div>
                  <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {detailEntry.company.risk_note ?? "-"}
                  </div>
                </section>

                <section className="mt-5 rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-900">메모</div>
                  <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {detailEntry.company.note ?? detailEntry.session.note ?? "-"}
                  </div>
                </section>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => includeInPortfolio(detailEntry)}
                    disabled={busyCompanyId === detailEntry.company.id}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                  >
                    {busyCompanyId === detailEntry.company.id ? "편입 중..." : "포트폴리오 편입"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditEntry(detailEntry)}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteEntry(detailEntry)}
                    disabled={busyCompanyId === detailEntry.company.id}
                    className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                  >
                    삭제
                  </button>
                  <button
                    type="button"
                    onClick={closePanel}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    닫기
                  </button>
                </div>
              </>
            )}

            {(panelMode === "create" || panelMode === "edit") && (
              <>
                {editingEntry && (
                  <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 p-3 text-sm">
                      <div className="text-slate-500">등록 기준가</div>
                      <div className="mt-1 font-medium text-slate-900">
                        {formatPrice(editingEntry.company.reference_price, editingEntry.company.currency)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3 text-sm">
                      <div className="text-slate-500">현재가</div>
                      <div className="mt-1 font-medium text-slate-900">
                        {formatPrice(editingEntry.company.current_price, editingEntry.company.currency)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3 text-sm">
                      <div className="text-slate-500">통화</div>
                      <div className="mt-1 font-medium text-slate-900">{editingEntry.company.currency ?? "-"}</div>
                    </div>
                  </div>
                )}

                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">작성일</div>
                    <input
                      type="date"
                      value={draft.presented_at}
                      onChange={(e) => updateDraft("presented_at", e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                    />
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">작성자</div>
                    <input
                      list="free-idea-presenters"
                      value={draft.presenter}
                      onChange={(e) => updateDraft("presenter", e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                    />
                    <datalist id="free-idea-presenters">
                      {data.participants.map((participant) => (
                        <option key={participant.id} value={participant.name} />
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
                      placeholder="IMVT / 005930 / KRX:005930"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                    />
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">관점</div>
                    <select
                      value={draft.session_stance}
                      onChange={(e) => updateDraft("session_stance", e.target.value as StudySessionStance)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                    >
                      {STANCE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">섹터</div>
                    <input
                      value={draft.sector}
                      onChange={(e) => updateDraft("sector", e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                    />
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">팔로업 상태</div>
                    <select
                      value={draft.follow_up_status}
                      onChange={(e) => updateDraft("follow_up_status", e.target.value as StudySessionFollowUpStatus)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                    >
                      {FOLLOW_UP_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="text-sm md:col-span-2">
                    <div className="mb-1 text-slate-600">한 줄 요약</div>
                    <input
                      value={draft.summary_line}
                      onChange={(e) => updateDraft("summary_line", e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                    />
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">왜 보는지</div>
                    <textarea
                      rows={5}
                      value={draft.why_watch}
                      onChange={(e) => updateDraft("why_watch", e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                    />
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">이벤트 / 체크포인트</div>
                    <textarea
                      rows={5}
                      value={draft.checkpoint_note}
                      onChange={(e) => updateDraft("checkpoint_note", e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                    />
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">리스크</div>
                    <textarea
                      rows={5}
                      value={draft.risk_note}
                      onChange={(e) => updateDraft("risk_note", e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                    />
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">메모</div>
                    <textarea
                      rows={5}
                      value={draft.note}
                      onChange={(e) => updateDraft("note", e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={saveEntry}
                    disabled={isSaving}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:bg-slate-400"
                  >
                    {isSaving ? "저장 중..." : panelMode === "create" ? "등록하기" : "저장하기"}
                  </button>
                  {panelMode === "edit" && editingEntry && (
                    <button
                      type="button"
                      onClick={() => deleteEntry(editingEntry)}
                      disabled={busyCompanyId === editingEntry.company.id}
                      className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                    >
                      삭제
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (panelMode === "edit" && selectedEntry) {
                        setPanelMode("view");
                        return;
                      }
                      closePanel();
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    취소
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
