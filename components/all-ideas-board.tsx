"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import type { HomeIdea } from "@/lib/home-data";

/* 메인 페이지와 동일한 흰 테마 */
const T = {
  bg: "#ffffff",
  bgCard: "#ffffff",
  bgSubtle: "#f5f5f5",
  bgPanel: "#fafafa",
  border: "#e5e5e5",
  borderMid: "#d4d4d4",
  borderStrong: "#737373",
  text1: "#171717",
  text2: "#404040",
  text3: "#737373",
  text4: "#a3a3a3",
  accentAlt: "#8B2635",
};

type Category = "top_pick" | "watchlist" | "study";
type CategoryFilter = Category | "all";

const CATEGORY_CHIPS: Array<{ key: CategoryFilter; label: string }> = [
  { key: "all", label: "전체" },
  { key: "top_pick", label: "★ Top Pick" },
  { key: "watchlist", label: "관심 종목" },
  { key: "study", label: "스터디" },
];

/* 통합 상태 — status / position_status / category를 한 드롭다운으로 조작 */
type UnifiedState = "reviewing" | "hold" | "active" | "closed";
const UNIFIED_STATE_OPTIONS: Array<{ value: UnifiedState; label: string }> = [
  { value: "reviewing", label: "검토중" },
  { value: "hold", label: "보류" },
  { value: "active", label: "편입 (Top Pick)" },
  { value: "closed", label: "청산" },
];

function deriveUnifiedState(idea: HomeIdea): UnifiedState {
  if (idea.position_status === "closed") return "closed";
  if (idea.position_status === "active") return "active";
  if (idea.status === "보류") return "hold";
  return "reviewing";
}

// 선택된 상태에 맞춰 idea의 category / position_status / status / is_included 를 한꺼번에 계산
function patchForUnifiedState(
  current: HomeIdea,
  next: UnifiedState,
): Record<string, unknown> {
  switch (next) {
    case "reviewing":
      return { status: "검토중", position_status: null, is_included: false };
    case "hold":
      return { status: "보류", position_status: null, is_included: false };
    case "active":
      return {
        status: "편입",
        position_status: "active",
        is_included: true,
        // 편입하면 자동으로 Top Pick 으로 승격 (관심 종목이었어도 그대로 승격)
        category: "top_pick",
      };
    case "closed":
      return {
        status: "전량청산",
        position_status: "closed",
        is_included: true,
        category: current.category, // 청산 시 기존 카테고리 유지
      };
  }
}

function formatReturn(r: number | null) {
  if (r === null) return "—";
  const s = r > 0 ? "+" : "";
  return `${s}${(r * 100).toFixed(2)}%`;
}
function returnColor(r: number | null) {
  if (r === null) return T.text3;
  if (r > 0) return "#166534";
  if (r < 0) return "#991b1b";
  return T.text3;
}
function categoryLabel(c: Category) {
  return c === "top_pick" ? "★ Top Pick" : c === "watchlist" ? "관심 종목" : "스터디";
}

const primaryBtn: React.CSSProperties = {
  background: T.text1, color: "#fff", border: "none",
  padding: "6px 14px", fontSize: "0.78rem", cursor: "pointer",
  fontFamily: "inherit", letterSpacing: "0.05em", borderRadius: 2,
};
const ghostBtn: React.CSSProperties = {
  background: "none", color: T.text2, border: `1px solid ${T.borderMid}`,
  padding: "6px 12px", fontSize: "0.78rem", cursor: "pointer",
  fontFamily: "inherit", letterSpacing: "0.05em", borderRadius: 2,
};

export function AllIdeasBoard({ initialIdeas }: { initialIdeas: HomeIdea[] }) {
  const [ideas, setIdeas] = useState(initialIdeas);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<number | null>(null);

  const sectors = useMemo(() => {
    const s = new Set<string>();
    for (const i of ideas) if (i.sector) s.add(i.sector);
    return ["all", ...Array.from(s).sort((a, b) => a.localeCompare(b, "ko-KR"))];
  }, [ideas]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ideas.filter((i) => {
      if (categoryFilter !== "all" && i.category !== categoryFilter) return false;
      if (sectorFilter !== "all" && i.sector !== sectorFilter) return false;
      if (q) {
        const hay = `${i.company_name} ${i.ticker} ${i.sector ?? ""} ${i.presenter}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [ideas, query, categoryFilter, sectorFilter]);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/home/data", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setIdeas([...(data.topPicks ?? []), ...(data.watchlist ?? []), ...(data.studyIdeas ?? [])]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "로드 실패");
    } finally {
      setBusy(false);
    }
  }, []);

  const patchIdea = useCallback(
    async (id: number, patch: Record<string, unknown>) => {
      // 낙관적 업데이트: 로컬 상태 즉시 반영
      setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, ...(patch as Partial<HomeIdea>) } : i)));
      setError(null);
      // 백그라운드 저장
      try {
        const res = await fetch(`/api/home/ideas/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "save failed");
        }
      } catch (e) {
        setError((e instanceof Error ? e.message : "저장 실패") + " — 새로고침으로 최신 상태를 확인하세요");
      }
    },
    [],
  );

  const deleteIdea = useCallback(
    async (id: number) => {
      if (!window.confirm("이 종목을 삭제하시겠습니까?")) return;
      const prev = ideas;
      setIdeas((arr) => arr.filter((i) => i.id !== id));
      try {
        const res = await fetch(`/api/home/ideas/${id}`, { method: "DELETE" });
        if (!res.ok) {
          setIdeas(prev); // 롤백
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "delete failed");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "삭제 실패");
      }
    },
    [ideas],
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text1, padding: "32px 16px 80px", fontFamily: "'Pretendard Variable', 'Pretendard', -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        {/* Header — 메인 페이지와 동일 톤 */}
        <header style={{ borderBottom: `2px solid ${T.text1}`, paddingBottom: 18, marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, flexWrap: "wrap", gap: 10 }}>
            <div style={{ fontSize: "0.68rem", letterSpacing: "0.28em", color: T.text3, textTransform: "uppercase" }}>
              All Study Ideas · Collective Ledger
            </div>
            <div style={{ fontSize: "0.72rem", color: T.text3, display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={refresh} disabled={busy} style={ghostBtn}>
                {busy ? "…" : "↻ 새로고침"}
              </button>
              <Link href="/" style={{ ...ghostBtn, textDecoration: "none" }}>
                ← 메인
              </Link>
            </div>
          </div>
          <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.4rem)", fontWeight: 700, margin: "8px 0 4px", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            전체 스터디 종목
          </h1>
          <p style={{ margin: 0, fontSize: "0.88rem", color: T.text3 }}>
            {filtered.length}개 표시 중 · 전체 {ideas.length}개
          </p>
        </header>

        {error && (
          <div style={{ padding: "10px 14px", background: "#FEF2F2", color: "#991b1b", fontSize: "0.85rem", marginBottom: 14, border: "1px solid #FCA5A5" }}>
            {error}
          </div>
        )}

        {/* Filter bar */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="종목명 · 티커 · 섹터 · 담당자 검색"
            style={{
              flex: "1 1 260px",
              font: "inherit", fontSize: "0.9rem",
              color: T.text1, background: T.bgCard,
              border: `1px solid ${T.borderMid}`, padding: "8px 12px",
              outline: "none", borderRadius: 2,
            }}
          />
          <div style={{ display: "flex", gap: 4 }}>
            {CATEGORY_CHIPS.map((c) => (
              <button
                key={c.key}
                onClick={() => setCategoryFilter(c.key)}
                style={{
                  padding: "6px 12px", fontSize: "0.78rem", cursor: "pointer",
                  fontFamily: "inherit", borderRadius: 2,
                  border: `1px solid ${categoryFilter === c.key ? T.text1 : T.borderMid}`,
                  background: categoryFilter === c.key ? T.text1 : "transparent",
                  color: categoryFilter === c.key ? "#fff" : T.text2,
                  letterSpacing: "0.05em",
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            style={{
              font: "inherit", fontSize: "0.82rem",
              color: T.text1, background: T.bgCard,
              border: `1px solid ${T.borderMid}`, padding: "6px 10px",
              outline: "none", borderRadius: 2,
            }}
          >
            {sectors.map((s) => (
              <option key={s} value={s}>{s === "all" ? "모든 섹터" : s}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}` }}>
          <div
            className="row-all row-all-head"
            style={{
              display: "grid",
              gridTemplateColumns: "24px 90px minmax(0, 1fr) 110px 90px 80px 70px 60px",
              gap: 10,
              alignItems: "center",
              padding: "10px 14px",
              fontSize: "0.68rem",
              color: T.text3,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 600,
              borderBottom: `1px solid ${T.border}`,
              background: T.bgPanel,
            }}
          >
            <span></span>
            <span>분류</span>
            <span>종목 · 티커</span>
            <span>섹터</span>
            <span>담당</span>
            <span style={{ textAlign: "right" }}>수익률</span>
            <span>상태</span>
            <span></span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: T.text4, fontStyle: "italic" }}>
              조건에 맞는 종목이 없습니다
            </div>
          ) : (
            filtered.map((idea) => (
              <IdeaRow
                key={idea.id}
                idea={idea}
                expanded={openId === idea.id}
                onToggle={() => setOpenId(openId === idea.id ? null : idea.id)}
                onPatch={(patch) => patchIdea(idea.id, patch)}
                onDelete={() => deleteIdea(idea.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function IdeaRow({
  idea,
  expanded,
  onToggle,
  onPatch,
  onDelete,
}: {
  idea: HomeIdea;
  expanded: boolean;
  onToggle: () => void;
  onPatch: (patch: Record<string, unknown>) => Promise<void> | void;
  onDelete: () => void;
}) {
  return (
    <div style={{ borderBottom: `1px solid ${T.border}` }}>
      <div
        className="row-all"
        onClick={onToggle}
        style={{
          display: "grid",
          gridTemplateColumns: "24px 90px minmax(0, 1fr) 110px 90px 80px 70px 60px",
          gap: 10,
          alignItems: "center",
          padding: "10px 14px",
          cursor: "pointer",
          background: expanded ? T.bgSubtle : T.bgCard,
          fontSize: "0.86rem",
          transition: "background 150ms",
        }}
      >
        <span style={{ color: T.text4, fontFamily: "var(--font-mono, monospace)", fontSize: "0.76rem" }}>
          {expanded ? "▾" : "▸"}
        </span>
        <span
          className="col-category"
          style={{
            fontSize: "0.7rem",
            color: idea.category === "top_pick" ? T.accentAlt : idea.category === "watchlist" ? T.text1 : T.text3,
            fontWeight: 600,
          }}
        >
          {categoryLabel(idea.category)}
        </span>
        <span className="col-name" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <span style={{ fontWeight: 600, color: T.text1 }}>{idea.company_name}</span>
          <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.76rem", color: T.text3, marginLeft: 8 }}>{idea.ticker}</span>
        </span>
        <span className="col-sector" style={{ fontSize: "0.8rem", color: T.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{idea.sector ?? "—"}</span>
        <span className="col-presenter" style={{ fontSize: "0.78rem", color: T.text3 }}>{idea.presenter}</span>
        <span
          className="col-return"
          style={{
            fontSize: "0.82rem", fontWeight: 600,
            color: returnColor(idea.return_pct),
            fontFamily: "var(--font-mono, monospace)",
            textAlign: "right",
          }}
        >
          {formatReturn(idea.return_pct)}
        </span>
        <span className="col-state" style={{ fontSize: "0.75rem", color: T.text3 }}>
          {UNIFIED_STATE_OPTIONS.find((o) => o.value === deriveUnifiedState(idea))?.label.replace(" (Top Pick)", "") ?? "—"}
        </span>
        <span className="col-delete" style={{ textAlign: "right" }}>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            style={{ background: "none", border: "1px solid transparent", color: T.text4, cursor: "pointer", fontSize: "1rem", padding: "2px 8px", borderRadius: 2, lineHeight: 1 }}
            title="삭제"
          >
            ×
          </button>
        </span>
      </div>

      {expanded && (
        <div style={{ padding: "14px 20px 18px", borderTop: `1px solid ${T.border}`, background: T.bg }}>
          <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 12 }}>
            <Field label="종목명" value={idea.company_name} onCommit={(v) => onPatch({ company_name: v || "(이름 없음)" })} />
            <Field label="티커" value={idea.ticker} onCommit={(v) => onPatch({ ticker: v || "?" })} mono />
            <Field label="섹터" value={idea.sector} onCommit={(v) => onPatch({ sector: v })} />
            <Field label="담당자" value={idea.presenter} onCommit={(v) => onPatch({ presenter: v || "—" })} />
          </div>

          <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 12 }}>
            <SelectField
              label="상태"
              value={deriveUnifiedState(idea)}
              options={UNIFIED_STATE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              onChange={(v) => onPatch(patchForUnifiedState(idea, v as UnifiedState))}
            />
            <SelectField
              label="분류"
              value={idea.category}
              options={[
                { value: "top_pick", label: "★ Top Pick" },
                { value: "watchlist", label: "관심 종목" },
                { value: "study", label: "스터디" },
              ]}
              onChange={(v) => onPatch({ category: v })}
            />
          </div>

          <MultilineField label="Thesis · 투자 논리" value={idea.thesis} onCommit={(v) => onPatch({ thesis: v })} />
          <MultilineField label="Trigger · 촉매" value={idea.trigger} onCommit={(v) => onPatch({ trigger: v })} />
          <MultilineField label="Risk · 리스크" value={idea.risk} onCommit={(v) => onPatch({ risk: v })} />
          <MultilineField label="Note · 메모" value={idea.note} onCommit={(v) => onPatch({ note: v })} />
        </div>
      )}
    </div>
  );
}

function Field({
  label, value, onCommit, mono,
}: {
  label: string;
  value: string | null;
  onCommit: (v: string) => void;
  mono?: boolean;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const changed = draft !== (value ?? "");
  return (
    <div>
      <div style={fieldLabel}>{label}</div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { if (changed) onCommit(draft); }}
          onKeyDown={(e) => { if (e.key === "Enter" && changed) { onCommit(draft); (e.target as HTMLInputElement).blur(); } }}
          style={{
            flex: 1,
            font: "inherit", fontSize: "0.88rem",
            color: T.text1, background: T.bgCard,
            border: `1px solid ${T.border}`, padding: "6px 10px",
            outline: "none", borderRadius: 2,
            fontFamily: mono ? "var(--font-mono, monospace)" : undefined,
          }}
        />
      </div>
    </div>
  );
}

function MultilineField({
  label, value, onCommit,
}: { label: string; value: string | null; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value ?? "");
  const changed = draft !== (value ?? "");
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={fieldLabel}>{label}</div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (changed) onCommit(draft); }}
        rows={2}
        style={{
          width: "100%", boxSizing: "border-box",
          font: "inherit", fontSize: "0.88rem",
          color: T.text1, background: T.bgCard,
          border: `1px solid ${T.border}`, padding: "8px 10px",
          outline: "none", borderRadius: 2, resize: "vertical",
          lineHeight: 1.55,
        }}
      />
    </div>
  );
}

function SelectField({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div style={fieldLabel}>{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", font: "inherit", fontSize: "0.88rem",
          color: T.text1, background: T.bgCard,
          border: `1px solid ${T.border}`, padding: "6px 10px",
          outline: "none", borderRadius: 2,
        }}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

const fieldLabel: React.CSSProperties = {
  fontSize: "0.66rem", color: T.text3,
  letterSpacing: "0.16em", textTransform: "uppercase",
  fontWeight: 600, marginBottom: 4,
};

// re-use primaryBtn to silence "unused" lint warnings in future edits
export const _unusedAllIdeasExports = { primaryBtn };
