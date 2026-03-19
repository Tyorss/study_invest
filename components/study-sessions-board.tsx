"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  StudySession,
  StudySessionCompany,
  StudySessionCompanyInput,
  StudySessionData,
  StudySessionInput,
  StudySessionStance,
} from "@/types/study-tracker";

const STANCE_OPTIONS: Array<{ value: StudySessionStance; label: string }> = [
  { value: "bullish", label: "긍정" },
  { value: "watch", label: "관찰" },
  { value: "neutral", label: "중립" },
  { value: "avoid", label: "회피" },
];

type PanelMode = "closed" | "view" | "edit" | "create";

type FreeIdeaDraft = {
  presented_at: string;
  presenter: string;
  company_name: string;
  ticker: string;
  sector: string;
  target_price: string;
  session_stance: StudySessionStance;
  thesis: string;
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

function emptyDraft(): FreeIdeaDraft {
  return {
    presented_at: "",
    presenter: "",
    company_name: "",
    ticker: "",
    sector: "",
    target_price: "",
    session_stance: "watch",
    thesis: "",
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
    target_price:
      entry.company.target_price !== null && entry.company.target_price !== undefined
        ? String(entry.company.target_price)
        : "",
    session_stance: entry.company.session_stance,
    thesis: entry.company.mention_reason ?? entry.session.thesis ?? "",
    note: entry.company.note ?? entry.session.note ?? "",
  };
}

function summarize(text: string | null | undefined) {
  const value = (text ?? "").replace(/\s+/g, " ").trim();
  if (!value) return "-";
  return value.length > 92 ? `${value.slice(0, 92)}...` : value;
}

function parseDraftNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
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

function ratioFrom(endValue: number | null, startValue: number | null) {
  if (endValue === null || startValue === null || startValue <= 0) return null;
  return endValue / startValue - 1;
}

function describeFreeIdeaTarget(company: StudySessionCompany) {
  if (company.target_price === null) {
    return {
      badge: "목표가 없음",
      badgeClass: "border-slate-200 bg-slate-100 text-slate-700",
      remaining: null as number | null,
    };
  }
  if (company.current_price !== null && company.current_price >= company.target_price) {
    return {
      badge: "업데이트 필요",
      badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
      remaining: ratioFrom(company.target_price, company.current_price),
    };
  }
  return {
    badge: "활성",
    badgeClass: "border-slate-200 bg-slate-100 text-slate-700",
    remaining: ratioFrom(company.target_price, company.current_price),
  };
}

function formatPct(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
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
    thesis: draft.thesis.trim() || null,
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
    target_price: parseDraftNumber(draft.target_price),
    session_stance: draft.session_stance,
    mention_reason: draft.thesis.trim() || null,
    follow_up_status: "waiting_event",
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

export function StudySessionsBoard({ data }: { data: StudySessionData }) {
  const [sessions, setSessions] = useState(data.sessions);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>("closed");
  const [draft, setDraft] = useState<FreeIdeaDraft>(emptyDraft());
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
  const bullishCount = useMemo(
    () => entries.filter((entry) => entry.company.session_stance === "bullish").length,
    [entries],
  );
  const latestDate = useMemo(() => entries[0]?.session.presented_at ?? "-", [entries]);

  const summaryCards = [
    { title: "전체 종목 수", value: String(entries.length) },
    { title: "작성자 수", value: String(distinctPresenterCount) },
    { title: "긍정 의견 수", value: String(bullishCount) },
    { title: "최근 등록일", value: latestDate },
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

      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                {["작성일", "작성자", "종목", "등록 기준가", "목표 / 상태", "관점", "요약"].map((heading) => (
                  <th key={heading} className="px-3 py-3 font-semibold">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.company.id}
                  className="cursor-pointer border-t border-slate-200 hover:bg-slate-50"
                  onClick={() => openEntry(entry)}
                >
                  <td className="px-3 py-3">{entry.session.presented_at}</td>
                  <td className="px-3 py-3">{entry.session.presenter}</td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-900">{entry.company.company_name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {[entry.company.ticker, entry.company.sector].filter(Boolean).join(" · ") || "-"}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    <div>{formatPrice(entry.company.reference_price, entry.company.currency)}</div>
                    <div className="mt-1 text-xs text-slate-500">{entry.company.reference_price_date ?? "-"}</div>
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    <div className="text-sm font-medium text-slate-900">
                      {formatPrice(entry.company.current_price, entry.company.currency)} {"->"} {formatPrice(entry.company.target_price, entry.company.currency)}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {describeFreeIdeaTarget(entry.company).remaining !== null && (
                        <span className="text-xs text-slate-500">
                          잔여 업사이드 {formatPct(describeFreeIdeaTarget(entry.company).remaining)}
                        </span>
                      )}
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${describeFreeIdeaTarget(entry.company).badgeClass}`}
                      >
                        {describeFreeIdeaTarget(entry.company).badge}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{stanceLabel(entry.company.session_stance)}</td>
                  <td className="max-w-[420px] px-3 py-3 text-xs text-slate-600">
                    {summarize(
                      entry.company.mention_reason ?? entry.session.thesis ?? entry.company.note ?? entry.session.note,
                    )}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-slate-500">
                    아직 등록된 자유 종목이 없습니다.
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
                    <div className="text-slate-500">목표가</div>
                    <div className="mt-1 font-medium text-slate-900">
                      {formatPrice(detailEntry.company.target_price, detailEntry.company.currency)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="text-slate-500">현재가</div>
                    <div className="mt-1 font-medium text-slate-900">
                      {formatPrice(detailEntry.company.current_price, detailEntry.company.currency)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="text-slate-500">관점</div>
                    <div className="mt-1 font-medium text-slate-900">{stanceLabel(detailEntry.company.session_stance)}</div>
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
                  <div className="text-sm font-semibold text-slate-900">상세 설명</div>
                  <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {detailEntry.company.mention_reason ?? detailEntry.session.thesis ?? "-"}
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
                  <label className="text-sm md:col-span-2">
                    <div className="mb-1 text-slate-600">목표가</div>
                    <input
                      inputMode="decimal"
                      value={draft.target_price}
                      onChange={(e) => updateDraft("target_price", e.target.value)}
                      placeholder="비워두면 목표가 없이 저장됩니다"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                    />
                    <div className="mt-1 text-xs text-slate-500">
                      저장하면 작성일 기준 가격과 현재가를 자동으로 다시 불러옵니다.
                    </div>
                  </label>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">의견 요약</div>
                    <textarea
                      rows={5}
                      value={draft.thesis}
                      onChange={(e) => updateDraft("thesis", e.target.value)}
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
