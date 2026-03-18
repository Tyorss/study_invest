"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  StudySession,
  StudySessionCompany,
  StudySessionCompanyInput,
  StudySessionData,
  StudySessionFollowUpStatus,
  StudySessionInput,
  StudySessionStance,
} from "@/types/study-tracker";

const STANCE_OPTIONS: Array<{ value: StudySessionStance; label: string }> = [
  { value: "bullish", label: "Bullish" },
  { value: "watch", label: "Watch" },
  { value: "neutral", label: "Neutral" },
  { value: "avoid", label: "Avoid" },
];

const FOLLOW_UP_OPTIONS: Array<{ value: StudySessionFollowUpStatus; label: string }> = [
  { value: "waiting_event", label: "Waiting Event" },
  { value: "ready_for_call", label: "Ready for Call" },
  { value: "dropped", label: "Dropped" },
  { value: "converted", label: "Converted" },
];

type SessionDraft = {
  presented_at: string;
  presenter: string;
  industry_name: string;
  title: string;
  thesis: string;
  anti_thesis: string;
  note: string;
};

type CompanyDraft = {
  company_name: string;
  ticker: string;
  sector: string;
  session_stance: StudySessionStance;
  mention_reason: string;
  follow_up_status: StudySessionFollowUpStatus;
  next_event_date: string;
  note: string;
};

type SessionResponse = {
  ok?: boolean;
  error?: string;
  session?: StudySession;
  company?: StudySessionCompany;
};

function emptySessionDraft(): SessionDraft {
  return {
    presented_at: "",
    presenter: "",
    industry_name: "",
    title: "",
    thesis: "",
    anti_thesis: "",
    note: "",
  };
}

function emptyCompanyDraft(): CompanyDraft {
  return {
    company_name: "",
    ticker: "",
    sector: "",
    session_stance: "watch",
    mention_reason: "",
    follow_up_status: "waiting_event",
    next_event_date: "",
    note: "",
  };
}

function sessionToDraft(session: StudySession): SessionDraft {
  return {
    presented_at: session.presented_at,
    presenter: session.presenter,
    industry_name: session.industry_name,
    title: session.title,
    thesis: session.thesis ?? "",
    anti_thesis: session.anti_thesis ?? "",
    note: session.note ?? "",
  };
}

function companyToDraft(company: StudySessionCompany): CompanyDraft {
  return {
    company_name: company.company_name,
    ticker: company.ticker,
    sector: company.sector ?? "",
    session_stance: company.session_stance,
    mention_reason: company.mention_reason ?? "",
    follow_up_status: company.follow_up_status,
    next_event_date: company.next_event_date ?? "",
    note: company.note ?? "",
  };
}

function toSessionPayload(draft: SessionDraft): StudySessionInput {
  return {
    presented_at: draft.presented_at,
    presenter: draft.presenter,
    industry_name: draft.industry_name,
    title: draft.title,
    thesis: draft.thesis.trim() || null,
    anti_thesis: draft.anti_thesis.trim() || null,
    note: draft.note.trim() || null,
  };
}

function toCompanyPayload(sessionId: number, draft: CompanyDraft): StudySessionCompanyInput {
  return {
    session_id: sessionId,
    company_name: draft.company_name,
    ticker: draft.ticker,
    sector: draft.sector.trim() || null,
    session_stance: draft.session_stance,
    mention_reason: draft.mention_reason.trim() || null,
    follow_up_status: draft.follow_up_status,
    next_event_date: draft.next_event_date || null,
    note: draft.note.trim() || null,
  };
}

function summarize(text: string | null | undefined) {
  const value = (text ?? "").replace(/\s+/g, " ").trim();
  if (!value) return "-";
  return value.length > 92 ? `${value.slice(0, 92)}...` : value;
}

async function readApiResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(text?.trim() || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

function callDirectionFromStance(stance: StudySessionStance) {
  if (stance === "bullish") return "long";
  if (stance === "avoid") return "avoid";
  return "watch";
}

export function StudySessionsBoard({ data }: { data: StudySessionData }) {
  const router = useRouter();
  const [sessions, setSessions] = useState(data.sessions);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(data.sessions[0]?.id ?? null);
  const [sessionDraft, setSessionDraft] = useState<SessionDraft>(emptySessionDraft());
  const [companyDraft, setCompanyDraft] = useState<CompanyDraft>(emptyCompanyDraft());
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [busyCompanyId, setBusyCompanyId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSessions(data.sessions);
    if (data.sessions.length > 0 && !selectedSessionId && !creatingSession) {
      setSelectedSessionId(data.sessions[0].id);
    }
  }, [creatingSession, data.sessions, selectedSessionId]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions],
  );

  useEffect(() => {
    if (creatingSession) {
      setSessionDraft(emptySessionDraft());
      setCompanyDraft(emptyCompanyDraft());
      setEditingCompanyId(null);
      return;
    }
    if (selectedSession) {
      setSessionDraft(sessionToDraft(selectedSession));
      setCompanyDraft(emptyCompanyDraft());
      setEditingCompanyId(null);
    }
  }, [creatingSession, selectedSession]);

  function resetCompanyEditor() {
    setEditingCompanyId(null);
    setCompanyDraft(emptyCompanyDraft());
  }

  function openCreateSession() {
    setCreatingSession(true);
    setSelectedSessionId(null);
    setSessionDraft(emptySessionDraft());
    setCompanyDraft(emptyCompanyDraft());
    setEditingCompanyId(null);
    setMessage(null);
    setError(null);
  }

  function openSession(session: StudySession) {
    setCreatingSession(false);
    setSelectedSessionId(session.id);
    setMessage(null);
    setError(null);
  }

  async function saveSession() {
    setIsSavingSession(true);
    setMessage(null);
    setError(null);

    try {
      const payload = toSessionPayload(sessionDraft);
      const isNew = creatingSession || !selectedSession;
      const url = isNew ? "/api/study-tracker/sessions" : `/api/study-tracker/sessions/${selectedSession.id}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await readApiResponse<SessionResponse>(res);
      if (!res.ok || !json.ok || !json.session) {
        throw new Error(json.error ?? `Failed to save session (HTTP ${res.status})`);
      }
      if (isNew) {
        setSessions((prev) => [{ ...json.session!, companies: [], covered_count: 0, converted_count: 0, adoption_count: 0 }, ...prev]);
        setSelectedSessionId(json.session.id);
        setCreatingSession(false);
        setMessage("Session created.");
      } else {
        setSessions((prev) => prev.map((session) => (session.id === json.session!.id ? { ...session, ...json.session! } : session)));
        setMessage("Session updated.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save session");
    } finally {
      setIsSavingSession(false);
    }
  }

  async function saveCompany() {
    if (!selectedSession) return;
    setIsSavingCompany(true);
    setMessage(null);
    setError(null);

    try {
      const payload = toCompanyPayload(selectedSession.id, companyDraft);
      const isNew = editingCompanyId === null;
      const url = isNew
        ? `/api/study-tracker/sessions/${selectedSession.id}/companies`
        : `/api/study-tracker/session-companies/${editingCompanyId}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await readApiResponse<SessionResponse>(res);
      if (!res.ok || !json.ok || !json.company) {
        throw new Error(json.error ?? `Failed to save company (HTTP ${res.status})`);
      }
      setSessions((prev) =>
        prev.map((session) => {
          if (session.id !== selectedSession.id) return session;
          const companies = isNew
            ? [...session.companies, { ...json.company!, converted_call_count: json.company?.converted_call_count ?? 0 }]
            : session.companies.map((company) =>
                company.id === json.company!.id
                  ? { ...company, ...json.company!, converted_call_count: company.converted_call_count }
                  : company,
              );
          const sortedCompanies = [...companies].sort((a, b) => a.company_name.localeCompare(b.company_name, "ko-KR"));
          return {
            ...session,
            companies: sortedCompanies,
            covered_count: sortedCompanies.length,
          };
        }),
      );
      resetCompanyEditor();
      setMessage(isNew ? "Covered company added." : "Covered company updated.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save covered company");
    } finally {
      setIsSavingCompany(false);
    }
  }

  async function deleteCompany(company: StudySessionCompany) {
    if (!window.confirm(`${company.company_name} (${company.ticker})를 session coverage에서 제거할까요?`)) return;
    setBusyCompanyId(company.id);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/study-tracker/session-companies/${company.id}`, {
        method: "DELETE",
      });
      const json = await readApiResponse<{ ok?: boolean; error?: string }>(res);
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `Failed to delete company (HTTP ${res.status})`);
      }
      setSessions((prev) =>
        prev.map((session) => {
          if (session.id !== selectedSessionId) return session;
          const companies = session.companies.filter((item) => item.id !== company.id);
          return { ...session, companies, covered_count: companies.length };
        }),
      );
      if (editingCompanyId === company.id) resetCompanyEditor();
      setMessage("Covered company removed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete covered company");
    } finally {
      setBusyCompanyId(null);
    }
  }

  function createActionableCall(session: StudySession, company: StudySessionCompany) {
    const params = new URLSearchParams({
      compose: "1",
      sourceSessionId: String(session.id),
      sourceCoverageId: String(company.id),
      presenter: session.presenter,
      companyName: company.company_name,
      ticker: company.ticker,
      sector: company.sector ?? "",
      callDirection: callDirectionFromStance(company.session_stance),
      sourceSessionLabel: `${session.industry_name} · ${session.presenter}`,
      sourceCoverageLabel: `${company.company_name} (${company.ticker})`,
    });
    router.push(`/study-tracker?${params.toString()}`);
  }

  const summaryCards = [
    { title: "Total Sessions", value: String(data.summary.totalSessions) },
    { title: "Covered Companies", value: String(data.summary.totalCoveredCompanies) },
    { title: "Converted Calls", value: String(data.summary.totalConvertedCalls) },
    {
      title: "Top Conversion",
      value: data.summary.topSessionByConversion
        ? `${data.summary.topSessionByConversion.industry_name} · ${data.summary.topSessionByConversion.converted_count}`
        : "-",
    },
  ];

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
            <h2 className="text-base font-semibold text-slate-900">Industry Sessions</h2>
            <p className="mt-1 text-sm text-slate-600">
              세션은 리서치 자산이고, 여기서 언급된 종목은 기본적으로 성과판 평가 대상이 아닙니다.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateSession}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            새 산업 발표
          </button>
        </div>
        {message && <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>}
        {error && <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      </section>

      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                {[
                  "Presented",
                  "Presenter",
                  "Industry",
                  "Summary",
                  "Covered",
                  "Converted",
                  "Adoption",
                ].map((heading) => (
                  <th key={heading} className="px-3 py-3 font-semibold">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr
                  key={session.id}
                  className="cursor-pointer border-t border-slate-200 hover:bg-slate-50"
                  onClick={() => openSession(session)}
                >
                  <td className="px-3 py-3">{session.presented_at}</td>
                  <td className="px-3 py-3">{session.presenter}</td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-900">{session.industry_name}</div>
                    <div className="mt-1 text-xs text-slate-500">{session.title}</div>
                  </td>
                  <td className="max-w-[360px] px-3 py-3 text-xs text-slate-600">{summarize(session.thesis)}</td>
                  <td className="px-3 py-3 text-slate-700">{session.covered_count}</td>
                  <td className="px-3 py-3 text-slate-700">{session.converted_count}</td>
                  <td className="px-3 py-3 text-slate-700">{session.adoption_count}</td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-slate-500">
                    No sessions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {(creatingSession || selectedSession) && (
        <div className="fixed inset-0 z-30 flex justify-end bg-slate-900/20" onClick={() => setCreatingSession(false)}>
          <aside
            className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Study Session</div>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                  {creatingSession ? "New Session" : selectedSession?.industry_name}
                </h3>
                {!creatingSession && selectedSession?.title && (
                  <div className="mt-1 text-sm text-slate-500">{selectedSession.title}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreatingSession(false);
                  setSelectedSessionId(null);
                  resetCompanyEditor();
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm">
                <div className="mb-1 text-slate-600">Presented At</div>
                <input
                  type="date"
                  value={sessionDraft.presented_at}
                  onChange={(e) => setSessionDraft((prev) => ({ ...prev, presented_at: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">Presenter</div>
                <input
                  list="session-presenters"
                  value={sessionDraft.presenter}
                  onChange={(e) => setSessionDraft((prev) => ({ ...prev, presenter: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                />
                <datalist id="session-presenters">
                  {data.participants.map((participant) => (
                    <option key={participant.id} value={participant.name} />
                  ))}
                </datalist>
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">Industry</div>
                <input
                  value={sessionDraft.industry_name}
                  onChange={(e) => setSessionDraft((prev) => ({ ...prev, industry_name: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">Title</div>
                <input
                  value={sessionDraft.title}
                  onChange={(e) => setSessionDraft((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                />
              </label>
              <label className="text-sm md:col-span-2">
                <div className="mb-1 text-slate-600">Thesis</div>
                <textarea
                  rows={4}
                  value={sessionDraft.thesis}
                  onChange={(e) => setSessionDraft((prev) => ({ ...prev, thesis: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                />
              </label>
              <label className="text-sm md:col-span-2">
                <div className="mb-1 text-slate-600">Anti-Thesis</div>
                <textarea
                  rows={3}
                  value={sessionDraft.anti_thesis}
                  onChange={(e) => setSessionDraft((prev) => ({ ...prev, anti_thesis: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                />
              </label>
              <label className="text-sm md:col-span-2">
                <div className="mb-1 text-slate-600">Notes</div>
                <textarea
                  rows={3}
                  value={sessionDraft.note}
                  onChange={(e) => setSessionDraft((prev) => ({ ...prev, note: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveSession}
                disabled={isSavingSession}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:bg-slate-400"
              >
                {isSavingSession ? "Saving..." : creatingSession ? "Create Session" : "Save Session"}
              </button>
            </div>

            {selectedSession && (
              <section className="mt-6 rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Covered Companies</div>
                    <div className="mt-1 text-xs text-slate-500">
                      여기 종목들은 coverage일 뿐이고, 기본적으로 성과판 랭킹 대상이 아닙니다.
                    </div>
                  </div>
                  <div className="text-sm text-slate-500">{selectedSession.covered_count} companies</div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">Company</div>
                    <input
                      value={companyDraft.company_name}
                      onChange={(e) => setCompanyDraft((prev) => ({ ...prev, company_name: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                    />
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">Ticker</div>
                    <input
                      value={companyDraft.ticker}
                      onChange={(e) => setCompanyDraft((prev) => ({ ...prev, ticker: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                    />
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">Sector</div>
                    <input
                      value={companyDraft.sector}
                      onChange={(e) => setCompanyDraft((prev) => ({ ...prev, sector: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                    />
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">Session Stance</div>
                    <select
                      value={companyDraft.session_stance}
                      onChange={(e) => setCompanyDraft((prev) => ({ ...prev, session_stance: e.target.value as StudySessionStance }))}
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
                    <div className="mb-1 text-slate-600">Follow-up</div>
                    <select
                      value={companyDraft.follow_up_status}
                      onChange={(e) =>
                        setCompanyDraft((prev) => ({
                          ...prev,
                          follow_up_status: e.target.value as StudySessionFollowUpStatus,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                    >
                      {FOLLOW_UP_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 text-slate-600">Next Event</div>
                    <input
                      type="date"
                      value={companyDraft.next_event_date}
                      onChange={(e) => setCompanyDraft((prev) => ({ ...prev, next_event_date: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                    />
                  </label>
                  <label className="text-sm md:col-span-2 xl:col-span-3">
                    <div className="mb-1 text-slate-600">Mention Reason</div>
                    <textarea
                      rows={2}
                      value={companyDraft.mention_reason}
                      onChange={(e) => setCompanyDraft((prev) => ({ ...prev, mention_reason: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                    />
                  </label>
                  <label className="text-sm md:col-span-2 xl:col-span-3">
                    <div className="mb-1 text-slate-600">Note</div>
                    <textarea
                      rows={2}
                      value={companyDraft.note}
                      onChange={(e) => setCompanyDraft((prev) => ({ ...prev, note: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={saveCompany}
                    disabled={isSavingCompany}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                  >
                    {isSavingCompany ? "Saving..." : editingCompanyId === null ? "Add Covered Company" : "Save Company"}
                  </button>
                  {editingCompanyId !== null && (
                    <button
                      type="button"
                      onClick={resetCompanyEditor}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div className="mt-5 space-y-3">
                  {selectedSession.companies.length === 0 ? (
                    <div className="text-sm text-slate-500">No covered companies yet.</div>
                  ) : (
                    selectedSession.companies.map((company) => (
                      <div key={company.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-slate-900">
                              {company.company_name} <span className="text-slate-500">({company.ticker})</span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                              <span>stance: {company.session_stance}</span>
                              <span>follow-up: {company.follow_up_status}</span>
                              {company.next_event_date && <span>next event: {company.next_event_date}</span>}
                              <span>converted calls: {company.converted_call_count}</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => createActionableCall(selectedSession, company)}
                              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
                            >
                              Create Actionable Call
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCompanyId(company.id);
                                setCompanyDraft(companyToDraft(company));
                              }}
                              className="rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-slate-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteCompany(company)}
                              disabled={busyCompanyId === company.id}
                              className="rounded-lg border border-rose-200 px-3 py-2 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Reason</div>
                            <div className="mt-2 whitespace-pre-wrap text-slate-700">{company.mention_reason ?? "-"}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Note</div>
                            <div className="mt-2 whitespace-pre-wrap text-slate-700">{company.note ?? "-"}</div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
