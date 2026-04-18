"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  HomeData,
  HomeIdea,
  HomeIndustry,
  HomeUpdate,
} from "@/lib/home-data";

/* ============================ THEME ============================ */
// 흰 배경 / 검정 텍스트 기본 톤. memory_chain_editor 톤에 맞춤.
const T = {
  bg: "#ffffff",
  bgCard: "#ffffff",
  bgPanel: "#fafafa",
  bgSubtle: "#f5f5f5",
  border: "#e5e5e5",
  borderMid: "#d4d4d4",
  borderStrong: "#737373",
  borderActive: "#171717",
  text1: "#171717",
  text2: "#404040",
  text3: "#737373",
  text4: "#a3a3a3",
  accent: "#171717",
  accentAlt: "#8B2635", // burgundy (Top Pick 포인트)
};

const FEED_LIMIT = 6;

const PICK_STATUS_LIST = [
  { key: "active", label: "관찰" },
  { key: "holding", label: "보유" },
  { key: "closed", label: "청산" },
] as const;

const SESSION_STANCE_LIST = [
  { key: "bullish", label: "Bullish" },
  { key: "watch", label: "관찰" },
  { key: "neutral", label: "중립" },
  { key: "avoid", label: "회피" },
] as const;

const FOLLOW_UP_LIST = [
  { key: "waiting_event", label: "이벤트 대기" },
  { key: "ready_for_call", label: "콜 준비" },
  { key: "converted", label: "콜 전환" },
  { key: "dropped", label: "폐기" },
] as const;

type PickStatusKey = (typeof PICK_STATUS_LIST)[number]["key"];
type StanceKey = (typeof SESSION_STANCE_LIST)[number]["key"];
type FollowUpKey = (typeof FOLLOW_UP_LIST)[number]["key"];

/* ============================ Utilities ============================ */

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function formatSyncTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function timeAgo(iso: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  if (h < 24) return `${h}시간 전`;
  if (d < 7) return `${d}일 전`;
  const dt = new Date(iso);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function formatReturn(r: number | null) {
  if (r === null) return "—";
  const pct = (r * 100).toFixed(2);
  const sign = r > 0 ? "+" : "";
  return `${sign}${pct}%`;
}

function returnColor(r: number | null) {
  if (r === null) return T.text3;
  if (r > 0) return "#166534";
  if (r < 0) return "#991b1b";
  return T.text3;
}

function ideaPickStatus(idea: HomeIdea): PickStatusKey {
  if (idea.position_status === "closed") return "closed";
  if (idea.position_status === "active") return "holding";
  return "active";
}

/* ============================ Inline Editable ============================ */

function Editable({
  value,
  onCommit,
  placeholder,
  multiline,
  mono,
  bold,
}: {
  value: string | null;
  onCommit: (next: string) => void;
  placeholder?: string;
  multiline?: boolean;
  mono?: boolean;
  bold?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== (value ?? "")) onCommit(draft);
  };

  if (editing) {
    const Tag = multiline ? "textarea" : "input";
    return (
      <Tag
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (!multiline && e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            setDraft(value ?? "");
            setEditing(false);
          }
        }}
        placeholder={placeholder}
        rows={multiline ? 3 : undefined}
        style={{
          font: "inherit",
          color: "inherit",
          background: T.bgSubtle,
          border: `1px solid ${T.borderStrong}`,
          padding: "4px 6px",
          outline: "none",
          width: "100%",
          boxSizing: "border-box",
          resize: multiline ? "vertical" : "none",
          borderRadius: 2,
          fontFamily: mono ? "var(--font-mono, monospace)" : "inherit",
          fontWeight: bold ? 600 : undefined,
        }}
      />
    );
  }

  const empty = !value;
  return (
    <span
      onClick={() => setEditing(true)}
      style={{
        cursor: "text",
        borderBottom: "1px dashed transparent",
        transition: "border-color 150ms, background 150ms",
        color: empty ? T.text4 : "inherit",
        fontStyle: empty ? "italic" : "normal",
        padding: "1px 3px",
        marginLeft: "-3px",
        borderRadius: 2,
        display: multiline ? "block" : "inline-block",
        minHeight: multiline ? "1.5em" : undefined,
        whiteSpace: multiline ? "pre-wrap" : undefined,
        fontFamily: mono ? "var(--font-mono, monospace)" : undefined,
        fontWeight: bold ? 600 : undefined,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = T.bgSubtle;
        e.currentTarget.style.borderBottomColor = T.borderMid;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.borderBottomColor = "transparent";
      }}
    >
      {value || placeholder}
    </span>
  );
}

/* ============================ Author prompt ============================ */

function useAuthorName() {
  const [name, setName] = useState<string>("");
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("study-tracker-author");
      if (stored) setName(stored);
    } catch {}
  }, []);
  const set = useCallback((next: string) => {
    setName(next);
    try {
      window.localStorage.setItem("study-tracker-author", next);
    } catch {}
  }, []);
  return { name, set };
}

/* ============================ Updates block ============================ */

function UpdatesBlock({
  updates,
  onAdd,
  compact,
  authorName,
}: {
  updates: HomeUpdate[];
  onAdd: (body: string, author: string) => Promise<void>;
  compact?: boolean;
  authorName: string;
}) {
  const [adding, setAdding] = useState(false);
  const [draftBody, setDraftBody] = useState("");
  const [draftAuthor, setDraftAuthor] = useState(authorName);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => setDraftAuthor(authorName), [authorName]);

  const sorted = useMemo(
    () => [...updates].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [updates],
  );
  const initialCount = compact ? 2 : 3;
  const visible = expanded ? sorted : sorted.slice(0, initialCount);
  const hidden = sorted.length - visible.length;

  const submit = async () => {
    const body = draftBody.trim();
    if (!body) {
      setAdding(false);
      setDraftBody("");
      return;
    }
    setBusy(true);
    try {
      await onAdd(body, draftAuthor.trim());
      setDraftBody("");
      setAdding(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        marginTop: compact ? 10 : 14,
        paddingTop: compact ? 10 : 14,
        borderTop: `1px dotted ${T.borderMid}`,
      }}
    >
      <div
        style={{
          fontSize: "0.68rem",
          color: T.text3,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          marginBottom: 8,
          fontWeight: 600,
        }}
      >
        업데이트 {updates.length > 0 && <span style={{ color: T.text2 }}>· {updates.length}</span>}
      </div>

      {sorted.length === 0 && !adding && (
        <div style={{ fontSize: "0.82rem", color: T.text4, fontStyle: "italic", marginBottom: 8 }}>
          아직 업데이트가 없습니다
        </div>
      )}

      {visible.map((u) => (
        <div
          key={u.id}
          style={{
            display: "grid",
            gridTemplateColumns: "72px 1fr",
            gap: 10,
            padding: "6px 0",
            fontSize: "0.85rem",
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          <div style={{ color: T.text3, fontSize: "0.75rem", paddingTop: 2, fontFamily: "var(--font-mono, monospace)" }}>
            {timeAgo(u.created_at)}
          </div>
          <div style={{ color: T.text1, lineHeight: 1.55, minWidth: 0 }}>
            {u.title && <div style={{ fontWeight: 600, marginBottom: 2 }}>{u.title}</div>}
            <div style={{ whiteSpace: "pre-wrap" }}>{u.body}</div>
            {u.created_by && <div style={{ fontSize: "0.72rem", color: T.text3, marginTop: 2 }}>— {u.created_by}</div>}
          </div>
        </div>
      ))}

      {hidden > 0 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          style={{ background: "none", border: "none", color: T.text1, fontSize: "0.75rem", cursor: "pointer", padding: "6px 0", fontFamily: "inherit" }}
        >
          + {hidden}개 더 보기
        </button>
      )}
      {expanded && sorted.length > initialCount && (
        <button
          onClick={() => setExpanded(false)}
          style={{ background: "none", border: "none", color: T.text3, fontSize: "0.75rem", cursor: "pointer", padding: "6px 0", fontFamily: "inherit" }}
        >
          접기
        </button>
      )}

      {adding ? (
        <div style={{ marginTop: 10, padding: 10, background: T.bgSubtle, border: `1px solid ${T.border}` }}>
          <textarea
            autoFocus
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            placeholder="업데이트 내용 (공시 · 실적 · 뉴스 · 분석)"
            rows={2}
            style={{
              width: "100%", boxSizing: "border-box", font: "inherit",
              fontSize: "0.85rem", color: T.text1, background: T.bgCard,
              border: `1px solid ${T.border}`, padding: "8px 10px",
              resize: "vertical", outline: "none", borderRadius: 2,
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
            <input
              value={draftAuthor}
              onChange={(e) => setDraftAuthor(e.target.value)}
              placeholder="작성자"
              style={{
                flex: 1, font: "inherit", fontSize: "0.8rem",
                color: T.text1, background: T.bgCard, border: `1px solid ${T.border}`,
                padding: "6px 10px", outline: "none", borderRadius: 2,
              }}
            />
            <button onClick={submit} disabled={busy} style={primaryBtn}>저장</button>
            <button onClick={() => { setAdding(false); setDraftBody(""); }} style={ghostBtn}>취소</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{
            marginTop: 8, background: "none", border: `1px dashed ${T.borderMid}`,
            color: T.text3, padding: "6px 14px", fontSize: "0.76rem",
            cursor: "pointer", borderRadius: 2, letterSpacing: "0.04em",
            fontFamily: "inherit",
          }}
        >
          + 업데이트 추가
        </button>
      )}
    </div>
  );
}

/* ============================ Buttons ============================ */

const primaryBtn: React.CSSProperties = {
  background: T.text1, color: "#fff", border: "none",
  padding: "6px 16px", fontSize: "0.78rem", cursor: "pointer",
  fontFamily: "inherit", letterSpacing: "0.05em", borderRadius: 2,
};
const ghostBtn: React.CSSProperties = {
  background: "none", color: T.text2, border: `1px solid ${T.borderMid}`,
  padding: "6px 12px", fontSize: "0.78rem", cursor: "pointer",
  fontFamily: "inherit", letterSpacing: "0.05em", borderRadius: 2,
};

/* ============================ Pick Card ============================ */

function PickCard({
  idea,
  number,
  variant,
  authorName,
  onPatch,
  onDelete,
  onAddUpdate,
}: {
  idea: HomeIdea;
  number: number;
  variant: "top_pick" | "watchlist";
  authorName: string;
  onPatch: (id: number, patch: Partial<HomeIdea>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onAddUpdate: (ideaId: number, body: string, author: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const accent = variant === "top_pick" ? T.accentAlt : T.text1;
  const markSymbol = variant === "top_pick" ? "★" : "◦";
  const pickStatus = ideaPickStatus(idea);

  const cyclePickStatus = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const order: PickStatusKey[] = ["active", "holding", "closed"];
    const i = order.indexOf(pickStatus);
    const next = order[(i + 1) % order.length];
    const patch: Partial<HomeIdea> =
      next === "holding"
        ? { position_status: "active" as const }
        : next === "closed"
          ? { position_status: "closed" as const }
          : { position_status: null };
    void onPatch(idea.id, patch);
  };

  const pickLabel = PICK_STATUS_LIST.find((s) => s.key === pickStatus)?.label ?? "관찰";

  return (
    <article
      style={{
        background: T.bgCard,
        border: `1px solid ${T.border}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 2,
        marginBottom: 6,
        overflow: "hidden",
      }}
    >
      {/* Compact one-line header (click to expand) */}
      <div
        className="row-pick"
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "grid",
          gridTemplateColumns: "28px 28px minmax(0, 1fr) auto auto auto auto",
          gap: 10,
          alignItems: "center",
          padding: "10px 14px",
          cursor: "pointer",
          background: expanded ? T.bgSubtle : T.bgCard,
          transition: "background 150ms",
        }}
      >
        <span style={{ color: T.text4, fontFamily: "var(--font-mono, monospace)", fontSize: "0.78rem" }}>
          {expanded ? "▾" : "▸"}
        </span>
        <span style={{ color: accent, fontWeight: 700, fontSize: "0.85rem" }}>
          {markSymbol}
          <span style={{ fontSize: "0.6rem", marginLeft: 3, letterSpacing: "0.08em" }}>{String(number).padStart(2, "0")}</span>
        </span>
        <div className="row-pick-name" style={{ minWidth: 0, display: "flex", gap: 10, alignItems: "baseline", overflow: "hidden", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, color: T.text1, fontSize: "0.95rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {idea.company_name}
          </span>
          <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.78rem", color: T.text3 }}>{idea.ticker}</span>
          {idea.sector && (
            <span style={{ fontSize: "0.75rem", color: T.text4 }}>· {idea.sector}</span>
          )}
        </div>
        {variant === "top_pick" && (
          <span className="mobile-hide" style={{ fontSize: "0.75rem", color: T.text3, whiteSpace: "nowrap" }}>
            {idea.presenter}
          </span>
        )}
        <span
          className="row-pick-return"
          style={{
            fontSize: "0.82rem",
            fontWeight: 600,
            color: returnColor(idea.return_pct),
            fontFamily: "var(--font-mono, monospace)",
            minWidth: 70,
            textAlign: "right",
          }}
        >
          {formatReturn(idea.return_pct)}
        </span>
        <button onClick={cyclePickStatus} style={pillBtn(accent)} title="상태 변경 (클릭)">
          {pickLabel}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`"${idea.company_name}"을(를) 삭제하시겠습니까?`)) onDelete(idea.id);
          }}
          style={{
            background: "none",
            border: "1px solid transparent",
            color: T.text4,
            cursor: "pointer",
            fontSize: "1.05rem",
            padding: "2px 8px",
            borderRadius: 2,
            lineHeight: 1,
          }}
          title="삭제"
        >
          ×
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: "14px 18px 18px", borderTop: `1px solid ${T.border}` }}>
          <h3 style={{ fontSize: "1.35rem", fontWeight: 600, color: T.text1, margin: "0 0 8px", lineHeight: 1.2 }}>
            <Editable value={idea.company_name} onCommit={(v) => onPatch(idea.id, { company_name: v || "(이름 없음)" })} placeholder="종목명" bold />
            <span style={{ fontSize: "0.8rem", color: T.text3, marginLeft: 10, fontFamily: "var(--font-mono, monospace)", fontWeight: 400 }}>
              <Editable value={idea.ticker} onCommit={(v) => onPatch(idea.id, { ticker: v || "?" })} placeholder="티커" mono />
            </span>
          </h3>

          <div style={{ fontSize: "0.82rem", color: T.text2, display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 12 }}>
            {variant === "top_pick" && (
              <span>
                <span style={{ color: T.text4, marginRight: 4 }}>담당</span>
                <Editable value={idea.presenter} onCommit={(v) => onPatch(idea.id, { presenter: v || "—" })} placeholder="—" />
              </span>
            )}
            <span>
              <span style={{ color: T.text4, marginRight: 4 }}>섹터</span>
              <Editable value={idea.sector} onCommit={(v) => onPatch(idea.id, { sector: v })} placeholder="—" />
            </span>
            {idea.presented_at && (
              <span>
                <span style={{ color: T.text4, marginRight: 4 }}>등록일</span>
                <span style={{ fontFamily: "var(--font-mono, monospace)" }}>{idea.presented_at}</span>
              </span>
            )}
          </div>

          <div
            style={{
              fontSize: "0.9rem", color: T.text1, lineHeight: 1.6,
              padding: "10px 14px", background: T.bgSubtle,
              borderLeft: `2px solid ${accent}`, marginBottom: 4,
            }}
          >
            <div
              style={{
                fontSize: "0.62rem", color: accent,
                letterSpacing: "0.18em", textTransform: "uppercase",
                marginBottom: 4, fontWeight: 700,
              }}
            >
              Thesis · 투자 논리
            </div>
            <Editable value={idea.thesis} onCommit={(v) => onPatch(idea.id, { thesis: v })} placeholder="투자 논리를 간단히 정리해 주세요" multiline />
          </div>

          <UpdatesBlock
            updates={idea.updates}
            authorName={authorName}
            onAdd={(body, author) => onAddUpdate(idea.id, body, author)}
          />
        </div>
      )}
    </article>
  );
}

function pillBtn(color: string): React.CSSProperties {
  return {
    background: T.bgSubtle, color,
    border: `1px solid ${color}`,
    padding: "3px 11px", borderRadius: 999,
    fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.06em",
    cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
  };
}

/* ============================ Industry Card ============================ */

function IndustryCard({
  industry,
  number,
  onPatch,
  onPatchCompany,
  onAddCompany,
  onDeleteCompany,
}: {
  industry: HomeIndustry;
  number: number;
  onPatch: (id: number, patch: Partial<HomeIndustry>) => Promise<void>;
  onPatchCompany: (companyId: number, patch: Record<string, unknown>) => Promise<void>;
  onAddCompany: (sessionId: number) => Promise<void>;
  onDeleteCompany: (companyId: number) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article
      style={{
        background: T.bgCard,
        border: `1px solid ${T.border}`,
        borderRadius: 2,
        marginBottom: 6,
        overflow: "hidden",
      }}
    >
      {/* Compact one-line header */}
      <div
        className="row-industry"
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "grid",
          gridTemplateColumns: "28px 36px minmax(0, 1fr) auto auto auto",
          gap: 10,
          alignItems: "center",
          padding: "10px 14px",
          cursor: "pointer",
          background: expanded ? T.bgSubtle : T.bgCard,
          transition: "background 150ms",
        }}
      >
        <span style={{ color: T.text4, fontFamily: "var(--font-mono, monospace)", fontSize: "0.78rem" }}>
          {expanded ? "▾" : "▸"}
        </span>
        <span style={{ color: T.text3, fontFamily: "var(--font-mono, monospace)", fontSize: "0.8rem", fontWeight: 700 }}>
          {String(number).padStart(2, "0")}
        </span>
        <div className="row-industry-name" style={{ minWidth: 0, display: "flex", gap: 10, alignItems: "baseline", overflow: "hidden", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, color: T.text1, fontSize: "1rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {industry.industry_name}
          </span>
          <span style={{ fontSize: "0.75rem", color: T.text4, fontFamily: "var(--font-mono, monospace)" }}>{industry.presented_at}</span>
        </div>
        <span className="row-industry-meta" style={{ fontSize: "0.75rem", color: T.text3, whiteSpace: "nowrap" }}>
          종목 {industry.ideas.length + industry.companies.length}
        </span>
        <Link
          href={`/industries/${industry.id}`}
          onClick={(e) => e.stopPropagation()}
          style={{ ...ghostBtn, textDecoration: "none", display: "inline-flex", alignItems: "center", padding: "4px 10px", fontSize: "0.72rem" }}
        >
          상세 →
        </Link>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: "16px 20px 18px", borderTop: `1px solid ${T.border}` }}>
          <div style={{ marginBottom: 10 }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: T.text1, margin: 0, marginBottom: 4, lineHeight: 1.25 }}>
              <Editable value={industry.industry_name} onCommit={(v) => onPatch(industry.id, { industry_name: v || "미정" })} placeholder="산업명" bold />
            </h2>
            <div style={{ fontSize: "0.82rem", color: T.text2, display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span>
                <span style={{ color: T.text4, marginRight: 4 }}>발표자</span>
                <Editable value={industry.presenter} onCommit={(v) => onPatch(industry.id, { presenter: v || "—" })} placeholder="—" />
              </span>
              <span>
                <span style={{ color: T.text4, marginRight: 4 }}>일시</span>
                <span style={{ fontFamily: "var(--font-mono, monospace)" }}>{industry.presented_at}</span>
              </span>
            </div>
          </div>

          {industry.summary_md && (
            <Link
              href={`/industries/${industry.id}`}
              style={{
                display: "inline-block",
                marginTop: 8,
                marginBottom: 10,
                padding: "6px 12px",
                fontSize: "0.78rem",
                color: T.text1,
                border: `1px solid ${T.borderMid}`,
                textDecoration: "none",
                borderRadius: 2,
                letterSpacing: "0.04em",
              }}
            >
              발표 자료 요약 · 밸류체인 상세 →
            </Link>
          )}

          {/* Ideas mapped from study_tracker_ideas by sector */}
          {industry.ideas.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: "0.66rem", color: T.text3, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600, marginTop: 10, marginBottom: 6 }}>
                스터디 종목 · {industry.ideas.length}
              </div>
              {industry.ideas.map((idea) => (
                <div
                  key={`idea-${idea.id}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto auto auto",
                    gap: 12,
                    alignItems: "center",
                    padding: "8px 0",
                    borderTop: `1px solid ${T.border}`,
                    fontSize: "0.85rem",
                  }}
                >
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span style={{ fontWeight: 500, color: T.text1 }}>{idea.company_name}</span>
                    <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.76rem", color: T.text3, marginLeft: 8 }}>{idea.ticker}</span>
                  </span>
                  <span style={{ fontSize: "0.72rem", color: T.text3 }}>{idea.presenter}</span>
                  <span
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      fontFamily: "var(--font-mono, monospace)",
                      color: returnColor(idea.return_pct),
                      minWidth: 64,
                      textAlign: "right",
                    }}
                  >
                    {formatReturn(idea.return_pct)}
                  </span>
                  <span style={{ fontSize: "0.7rem", color: T.text3 }}>
                    {idea.status || "—"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Ad-hoc companies added via UI (study_session_companies) */}
          {industry.companies.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: "0.66rem", color: T.text3, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>
                추가 기업
              </div>
              {industry.companies.map((c, idx) => (
                <div
                  key={c.id}
                  style={{
                    padding: "10px 0", borderTop: `1px solid ${T.border}`,
                    display: "grid", gridTemplateColumns: "50px 1fr auto",
                    gap: 14, alignItems: "flex-start",
                  }}
                >
                  <div style={{ fontSize: "0.66rem", color: T.text3, letterSpacing: "0.14em", paddingTop: 4, fontFamily: "var(--font-mono, monospace)" }}>
                    #{idx + 1}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.95rem", fontWeight: 500, marginBottom: 4, color: T.text1 }}>
                      <Editable value={c.company_name} onCommit={(v) => onPatchCompany(c.id, { company_name: v || "(이름 없음)" })} placeholder="기업명" />
                      <span style={{ fontFamily: "var(--font-mono, monospace)", color: T.text3, fontWeight: 400, marginLeft: 10, fontSize: "0.78rem" }}>
                        <Editable value={c.ticker} onCommit={(v) => onPatchCompany(c.id, { ticker: v || "?" })} placeholder="티커" mono />
                      </span>
                    </div>
                    <div style={{ fontSize: "0.78rem", color: T.text2, marginBottom: 4 }}>
                      <span style={{ color: T.text4, marginRight: 4 }}>섹터</span>
                      <Editable value={c.sector} onCommit={(v) => onPatchCompany(c.id, { sector: v })} placeholder="—" />
                    </div>
                    <div style={{ fontSize: "0.82rem", color: T.text1, lineHeight: 1.55 }}>
                      <Editable value={c.note} onCommit={(v) => onPatchCompany(c.id, { note: v })} placeholder="요약 · 메모" multiline />
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm(`${c.company_name}을(를) 삭제하시겠습니까?`)) onDeleteCompany(c.id);
                    }}
                    style={{ background: "none", border: "1px solid transparent", color: T.text4, cursor: "pointer", fontSize: "1rem", padding: "2px 8px", borderRadius: 2, lineHeight: 1 }}
                    title="기업 삭제"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => onAddCompany(industry.id)}
            style={{
              marginTop: 12, background: "none", border: `1px dashed ${T.borderMid}`,
              color: T.text3, padding: "6px 14px", fontSize: "0.78rem",
              cursor: "pointer", borderRadius: 2, letterSpacing: "0.04em", fontFamily: "inherit",
            }}
          >
            + 기업 추가
          </button>
        </div>
      )}
    </article>
  );
}

/* ============================ Recent Updates Feed ============================ */

function RecentUpdatesFeed({ items }: { items: HomeUpdate[] }) {
  if (items.length === 0) {
    return (
      <div
        style={{
          padding: "26px 20px", textAlign: "center",
          background: T.bgCard, border: `1px dashed ${T.border}`,
          color: T.text4, fontSize: "0.88rem", fontStyle: "italic",
        }}
      >
        아직 업데이트가 없습니다 · 각 종목에서 업데이트를 추가하면 여기에 모입니다
      </div>
    );
  }

  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.border}` }}>
      {items.map((u, i) => {
        const isPick = u.source_type === "pick";
        const isWatch = u.source_type === "watchlist";
        const badge = isPick ? "★ Top Pick" : isWatch ? "관심 종목" : u.parent_name ?? "산업";
        const badgeColor = isPick ? T.accentAlt : T.text1;
        return (
          <div
            key={u.id}
            style={{
              display: "grid", gridTemplateColumns: "80px 1fr",
              gap: 14, padding: "12px 18px",
              borderTop: i === 0 ? "none" : `1px solid ${T.border}`,
            }}
          >
            <div style={{ fontSize: "0.72rem", color: T.text3, paddingTop: 2, whiteSpace: "nowrap", fontFamily: "var(--font-mono, monospace)" }}>
              {timeAgo(u.created_at)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: "0.6rem", letterSpacing: "0.14em", textTransform: "uppercase",
                    padding: "2px 8px", background: T.bgSubtle, color: badgeColor,
                    fontWeight: 600, borderRadius: 2, border: `1px solid ${T.border}`,
                  }}
                >
                  {badge}
                </span>
                <span style={{ fontSize: "0.98rem", fontWeight: 600, color: T.text1 }}>
                  {u.source_name || "—"}
                </span>
              </div>
              {u.title && <div style={{ fontSize: "0.85rem", fontWeight: 600, color: T.text1 }}>{u.title}</div>}
              <div style={{ fontSize: "0.87rem", color: T.text1, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{u.body}</div>
              {u.created_by && <div style={{ fontSize: "0.72rem", color: T.text3, marginTop: 2 }}>— {u.created_by}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ============================ Main App ============================ */

export function StudyTrackerHome({
  initialData,
  dbError = null,
}: {
  initialData: HomeData;
  dbError?: string | null;
}) {
  const [data, setData] = useState<HomeData>(initialData);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(dbError);
  const { name: authorName, set: setAuthorName } = useAuthorName();

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/home/data", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const next = (await res.json()) as HomeData;
      setData(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "새로고침 실패");
    } finally {
      setBusy(false);
    }
  }, []);

  // --- Local-state helpers for optimistic updates -------------------------
  const updateIdeaInState = useCallback((id: number, patch: Partial<HomeIdea>) => {
    setData((d) => {
      const apply = (arr: HomeIdea[]) => arr.map((i) => (i.id === id ? { ...i, ...patch } : i));
      return {
        ...d,
        topPicks: apply(d.topPicks),
        watchlist: apply(d.watchlist),
        studyIdeas: apply(d.studyIdeas),
        industries: d.industries.map((ind) => ({ ...ind, ideas: apply(ind.ideas) })),
      };
    });
  }, []);

  const moveIdeaCategory = useCallback((id: number, next: "top_pick" | "watchlist" | "study") => {
    setData((d) => {
      const pool = [...d.topPicks, ...d.watchlist, ...d.studyIdeas];
      const target = pool.find((i) => i.id === id);
      if (!target) return d;
      const updated: HomeIdea = { ...target, category: next };
      const remove = (arr: HomeIdea[]) => arr.filter((i) => i.id !== id);
      return {
        ...d,
        topPicks: next === "top_pick" ? [...remove(d.topPicks), updated] : remove(d.topPicks),
        watchlist: next === "watchlist" ? [...remove(d.watchlist), updated] : remove(d.watchlist),
        studyIdeas: next === "study" ? [...remove(d.studyIdeas), updated] : remove(d.studyIdeas),
      };
    });
  }, []);

  const removeIdeaFromState = useCallback((id: number) => {
    setData((d) => {
      const strip = (arr: HomeIdea[]) => arr.filter((i) => i.id !== id);
      return {
        ...d,
        topPicks: strip(d.topPicks),
        watchlist: strip(d.watchlist),
        studyIdeas: strip(d.studyIdeas),
        industries: d.industries.map((ind) => ({ ...ind, ideas: strip(ind.ideas) })),
      };
    });
  }, []);

  // --- Mutations -----------------------------------------------------------
  const patchIdea = useCallback(
    async (id: number, patch: Partial<HomeIdea>) => {
      if ("category" in patch && (patch.category === "top_pick" || patch.category === "watchlist" || patch.category === "study")) {
        moveIdeaCategory(id, patch.category);
      } else {
        updateIdeaInState(id, patch);
      }
      setError(null);
      try {
        const res = await fetch(`/api/home/ideas/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "patch failed");
        }
      } catch (e) {
        setError((e instanceof Error ? e.message : "저장 실패") + " — ↻ 새로고침으로 최신 상태 확인");
      }
    },
    [moveIdeaCategory, updateIdeaInState],
  );

  const deleteIdea = useCallback(
    async (id: number) => {
      removeIdeaFromState(id);
      try {
        const res = await fetch(`/api/home/ideas/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error((await res.json()).error || "delete failed");
      } catch (e) {
        setError(e instanceof Error ? e.message : "삭제 실패");
      }
    },
    [removeIdeaFromState],
  );

  const promoteIdea = useCallback(
    async (ideaId: number, category: "top_pick" | "watchlist") => {
      moveIdeaCategory(ideaId, category);
      try {
        const res = await fetch(`/api/home/ideas/${ideaId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "update failed");
      } catch (e) {
        setError(e instanceof Error ? e.message : "변경 실패");
      }
    },
    [moveIdeaCategory],
  );

  // 신규 생성은 서버가 id 발급 → refresh 필요
  const addIdeaByTicker = useCallback(
    async (category: "top_pick" | "watchlist", ticker: string, companyName?: string) => {
      const t = ticker.trim();
      if (!t) return;
      setBusy(true);
      try {
        const res = await fetch("/api/home/ideas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category,
            company_name: (companyName || t).trim(),
            ticker: t,
            presenter: authorName || "미정",
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "create failed");
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "추가 실패");
      } finally {
        setBusy(false);
      }
    },
    [authorName, refresh],
  );

  const addIdeaUpdate = useCallback(
    async (ideaId: number, body: string, author: string) => {
      // 업데이트는 피드/타임스탬프 합산이 걸려있어서 refresh가 자연스러움 (잘 쓰이지 않음)
      const res = await fetch(`/api/home/ideas/${ideaId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, created_by: author || authorName || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "update add failed");
      await refresh();
    },
    [authorName, refresh],
  );

  const patchIndustry = useCallback(
    async (id: number, patch: Partial<HomeIndustry>) => {
      setData((d) => ({
        ...d,
        industries: d.industries.map((ind) => (ind.id === id ? { ...ind, ...patch } : ind)),
      }));
      try {
        const res = await fetch(`/api/home/sessions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error((await res.json()).error || "patch failed");
      } catch (e) {
        setError(e instanceof Error ? e.message : "저장 실패");
      }
    },
    [],
  );

  const addCompany = useCallback(
    async (sessionId: number) => {
      setBusy(true);
      try {
        const res = await fetch(`/api/home/sessions/${sessionId}/companies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company_name: "새 기업", ticker: "?" }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "company add failed");
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "추가 실패");
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const patchCompany = useCallback(
    async (companyId: number, patch: Record<string, unknown>) => {
      setData((d) => ({
        ...d,
        industries: d.industries.map((ind) => ({
          ...ind,
          companies: ind.companies.map((c) =>
            c.id === companyId ? { ...c, ...(patch as Partial<typeof c>) } : c,
          ),
        })),
      }));
      try {
        const res = await fetch(`/api/home/companies/${companyId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error((await res.json()).error || "patch failed");
      } catch (e) {
        setError(e instanceof Error ? e.message : "저장 실패");
      }
    },
    [],
  );

  const deleteCompany = useCallback(
    async (companyId: number) => {
      setData((d) => ({
        ...d,
        industries: d.industries.map((ind) => ({
          ...ind,
          companies: ind.companies.filter((c) => c.id !== companyId),
        })),
      }));
      try {
        const res = await fetch(`/api/home/companies/${companyId}`, { method: "DELETE" });
        if (!res.ok) throw new Error((await res.json()).error || "delete failed");
      } catch (e) {
        setError(e instanceof Error ? e.message : "삭제 실패");
      }
    },
    [],
  );

  const recentVisible = data.recentUpdates.slice(0, FEED_LIMIT);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text1, padding: "32px 16px 80px", fontFamily: "'Pretendard Variable', 'Pretendard', -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <header style={{ borderBottom: `2px solid ${T.text1}`, paddingBottom: 18, marginBottom: 30 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, flexWrap: "wrap", gap: 10 }}>
            <div style={{ fontSize: "0.68rem", letterSpacing: "0.28em", color: T.text3, textTransform: "uppercase" }}>
              Collective Study Ledger
            </div>
            <div style={{ fontSize: "0.72rem", color: T.text3, display: "flex", gap: 12, alignItems: "center" }}>
              <span>
                작성자:{" "}
                <input
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="이름"
                  style={{ font: "inherit", color: T.text1, background: T.bgSubtle, border: `1px solid ${T.border}`, padding: "2px 6px", width: 80, borderRadius: 2 }}
                />
              </span>
              <button onClick={refresh} disabled={busy} style={ghostBtn}>
                {busy ? "…" : "↻ 새로고침"}
              </button>
              <Link href="/study-tracker" style={{ ...ghostBtn, textDecoration: "none" }}>
                전체 종목 →
              </Link>
              <Link href="/mock-trading" style={{ ...ghostBtn, textDecoration: "none" }}>
                모의투자 →
              </Link>
            </div>
          </div>
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 2.8rem)", fontWeight: 700, margin: "8px 0 4px", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            스터디 트래커
          </h1>
          <p style={{ margin: 0, fontSize: "0.9rem", color: T.text3 }}>
            Top Pick · 관심 종목 · 산업별 발표 기록 — 누구나 클릭하여 수정할 수 있습니다
          </p>
        </header>

        {error && (
          <div style={{ padding: "10px 14px", background: "#FEF2F2", color: "#991b1b", fontSize: "0.85rem", marginBottom: 14, border: "1px solid #FCA5A5" }}>
            {error}
          </div>
        )}

        {/* Top Picks */}
        <section style={{ marginBottom: 40 }}>
          <SectionHeading label="★ Top Picks" subtitle="스터디 내 집중 관찰 종목" />
          {data.topPicks.map((p, i) => (
            <PickCard
              key={p.id}
              idea={p}
              number={i + 1}
              variant="top_pick"
              authorName={authorName}
              onPatch={patchIdea}
              onDelete={deleteIdea}
              onAddUpdate={addIdeaUpdate}
            />
          ))}
          <AddIdeaPanel
            variant="top_pick"
            color={T.accentAlt}
            candidates={data.studyIdeas}
            onPromote={(id) => promoteIdea(id, "top_pick")}
            onCreateByTicker={(t, name) => addIdeaByTicker("top_pick", t, name)}
          />
        </section>

        {/* Watchlist */}
        <section style={{ marginBottom: 40 }}>
          <SectionHeading label="관심 종목" subtitle="스터디 외 개인 관찰 종목 (밸류체인 보완용)" />
          {data.watchlist.map((p, i) => (
            <PickCard
              key={p.id}
              idea={p}
              number={i + 1}
              variant="watchlist"
              authorName={authorName}
              onPatch={patchIdea}
              onDelete={deleteIdea}
              onAddUpdate={addIdeaUpdate}
            />
          ))}
          <AddIdeaPanel
            variant="watchlist"
            color={T.text1}
            candidates={data.studyIdeas}
            onPromote={(id) => promoteIdea(id, "watchlist")}
            onCreateByTicker={(t, name) => addIdeaByTicker("watchlist", t, name)}
          />
        </section>

        {/* Recent Updates — only shown when there is activity in the last 2 weeks */}
        {data.hasRecentActivity && (
          <section style={{ marginBottom: 40 }}>
            <SectionHeading label="Recent Updates" subtitle="최근 1주일 업데이트" />
            <RecentUpdatesFeed items={recentVisible} />
            {data.recentUpdates.length > FEED_LIMIT && (
              <div style={{ textAlign: "center", marginTop: 10, fontSize: "0.78rem", color: T.text3, fontStyle: "italic" }}>
                상위 {FEED_LIMIT}개만 표시됩니다 · 전체 이력은 각 종목 카드에서 확인
              </div>
            )}
          </section>
        )}

        <div
          style={{
            fontSize: "0.76rem", color: T.text2,
            background: T.bgSubtle, border: `1px solid ${T.border}`,
            padding: "10px 14px", marginBottom: 22, lineHeight: 1.5,
          }}
        >
          <strong style={{ color: T.text1 }}>편집 안내</strong> · 회색 텍스트나 빈 칸을 클릭하면 바로 수정됩니다. 상태 배지도 클릭하면 순환합니다.
          여러 명이 동시 편집할 경우 마지막 저장이 우선되니 수정 전 <strong>새로고침</strong>을 권장합니다.
        </div>

        {/* Industries */}
        <section>
          <SectionHeading label="Industries" subtitle="산업 발표 → 기업 발표 1, 2" />
          {data.industries.length === 0 ? (
            <EmptyState label="아직 등록된 산업이 없습니다" />
          ) : (
            data.industries.map((ind, i) => (
              <IndustryCard
                key={ind.id}
                industry={ind}
                number={i + 1}
                onPatch={patchIndustry}
                onPatchCompany={patchCompany}
                onAddCompany={addCompany}
                onDeleteCompany={deleteCompany}
              />
            ))
          )}
        </section>

        <footer style={{ marginTop: 50, paddingTop: 18, borderTop: `1px solid ${T.border}`, fontSize: "0.72rem", color: T.text3, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <span suppressHydrationWarning>동기화 {formatSyncTime(data.lastSyncedAt)}</span>
          <span style={{ letterSpacing: "0.1em" }}>EST. 2026 · COLLECTIVE LEDGER</span>
        </footer>
      </div>
    </div>
  );
}

function SectionHeading({ label, subtitle }: { label: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: "0.68rem", letterSpacing: "0.26em", color: T.text1, textTransform: "uppercase", fontWeight: 700, marginBottom: 2 }}>
        {label}
      </div>
      {subtitle && <div style={{ fontSize: "0.82rem", color: T.text3 }}>{subtitle}</div>}
    </div>
  );
}

function EmptyState({ label, onAdd, cta }: { label: string; onAdd?: () => void; cta?: string }) {
  return (
    <div
      style={{
        padding: "30px 16px", textAlign: "center",
        background: T.bgCard, border: `1px dashed ${T.borderMid}`,
      }}
    >
      <div style={{ fontSize: "0.95rem", color: T.text3, marginBottom: onAdd ? 12 : 0 }}>{label}</div>
      {onAdd && cta && (
        <button onClick={onAdd} style={primaryBtn}>{cta}</button>
      )}
    </div>
  );
}

function AddIdeaPanel({
  variant,
  color,
  candidates,
  onPromote,
  onCreateByTicker,
}: {
  variant: "top_pick" | "watchlist";
  color: string;
  candidates: HomeIdea[];
  onPromote: (id: number) => Promise<void> | void;
  onCreateByTicker: (ticker: string, companyName?: string) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"pick" | "ticker">(variant === "top_pick" ? "pick" : "ticker");
  const [query, setQuery] = useState("");
  const [ticker, setTicker] = useState("");
  const [companyName, setCompanyName] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates.slice(0, 30);
    return candidates
      .filter(
        (c) =>
          c.company_name.toLowerCase().includes(q) ||
          c.ticker.toLowerCase().includes(q) ||
          (c.sector ?? "").toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [candidates, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
    setTicker("");
    setCompanyName("");
  };

  const label = variant === "top_pick" ? "+ Top Pick 추가" : "+ 관심 종목 추가";

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          width: "100%", background: "none",
          border: `1px dashed ${color}`, color,
          padding: 12, fontSize: "0.82rem", cursor: "pointer",
          borderRadius: 2, letterSpacing: "0.06em", marginTop: 6, fontFamily: "inherit",
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div
      style={{
        marginTop: 6, padding: 14,
        background: T.bgSubtle, border: `1px solid ${color}`,
        borderRadius: 2,
      }}
    >
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <button
          onClick={() => setMode("pick")}
          style={mode === "pick" ? { ...primaryBtn, background: color } : { ...ghostBtn }}
        >
          기존 스터디 종목에서 선택
        </button>
        <button
          onClick={() => setMode("ticker")}
          style={mode === "ticker" ? { ...primaryBtn, background: color } : { ...ghostBtn }}
        >
          티커 직접 입력
        </button>
        <button onClick={close} style={{ ...ghostBtn, marginLeft: "auto" }}>취소</button>
      </div>

      {mode === "pick" ? (
        candidates.length === 0 ? (
          <div style={{ fontSize: "0.82rem", color: T.text3, fontStyle: "italic", padding: "10px 0" }}>
            기존 스터디 종목이 없습니다. 티커 직접 입력을 이용해주세요.
          </div>
        ) : (
          <>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="종목명 · 티커 · 섹터 검색"
              style={{
                width: "100%", boxSizing: "border-box",
                font: "inherit", fontSize: "0.85rem",
                color: T.text1, background: T.bgCard,
                border: `1px solid ${T.border}`, padding: "8px 10px",
                outline: "none", borderRadius: 2, marginBottom: 8,
              }}
            />
            <div style={{ maxHeight: 260, overflowY: "auto", border: `1px solid ${T.border}`, background: T.bgCard }}>
              {filtered.length === 0 ? (
                <div style={{ padding: 12, fontSize: "0.82rem", color: T.text4, fontStyle: "italic" }}>
                  검색 결과 없음
                </div>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    onClick={async () => { await onPromote(c.id); close(); }}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) auto auto auto",
                      gap: 10, alignItems: "center",
                      width: "100%", textAlign: "left",
                      padding: "8px 12px",
                      background: "none", border: "none",
                      borderBottom: `1px solid ${T.border}`,
                      cursor: "pointer", fontFamily: "inherit",
                      fontSize: "0.85rem", color: T.text1,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = T.bgSubtle; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                  >
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <span style={{ fontWeight: 500 }}>{c.company_name}</span>
                      <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.76rem", color: T.text3, marginLeft: 8 }}>{c.ticker}</span>
                    </span>
                    <span style={{ fontSize: "0.72rem", color: T.text3 }}>{c.sector ?? "—"}</span>
                    <span style={{ fontSize: "0.72rem", color: T.text3 }}>{c.presenter}</span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono, monospace)",
                        fontSize: "0.76rem", fontWeight: 600,
                        color: returnColor(c.return_pct), minWidth: 60, textAlign: "right",
                      }}
                    >
                      {formatReturn(c.return_pct)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </>
        )
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
          <input
            autoFocus
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="티커 (예: 005930, NVDA)"
            style={{
              font: "inherit", fontSize: "0.85rem",
              color: T.text1, background: T.bgCard,
              border: `1px solid ${T.border}`, padding: "8px 10px",
              outline: "none", borderRadius: 2,
              fontFamily: "var(--font-mono, monospace)",
            }}
          />
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="종목명 (선택)"
            style={{
              font: "inherit", fontSize: "0.85rem",
              color: T.text1, background: T.bgCard,
              border: `1px solid ${T.border}`, padding: "8px 10px",
              outline: "none", borderRadius: 2,
            }}
          />
          <button
            onClick={async () => {
              if (!ticker.trim()) return;
              await onCreateByTicker(ticker.trim(), companyName.trim() || undefined);
              close();
            }}
            style={{ ...primaryBtn, background: color }}
          >
            추가
          </button>
        </div>
      )}
    </div>
  );
}

function AddMoreBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", background: "none",
        border: `1px dashed ${color}`, color,
        padding: 12, fontSize: "0.82rem", cursor: "pointer",
        borderRadius: 2, letterSpacing: "0.06em", marginTop: 6, fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}
