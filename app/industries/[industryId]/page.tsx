import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fetchHomeData } from "@/lib/home-data";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { PersistedChain } from "@/components/value-chain/persisted-chain";
import CosmeticsChain from "@/components/value-chain/cosmetics";
import SoftwareChain from "@/components/value-chain/software";
import SemiChain from "@/components/value-chain/semi";
import DefenseChain from "@/components/value-chain/defense";
import ShipChain from "@/components/value-chain/ship";
import ConsumerChain from "@/components/value-chain/consumer";

type ChainEditor = React.ComponentType<{
  initialData?: unknown;
  onChange?: (data: unknown) => void;
}>;

const VALUE_CHAIN_BY_INDUSTRY: Record<string, ChainEditor> = {
  화장품: CosmeticsChain as ChainEditor,
  소프트웨어: SoftwareChain as ChainEditor,
  반도체: SemiChain as ChainEditor,
  방산: DefenseChain as ChainEditor,
  조선: ShipChain as ChainEditor,
  소비재: ConsumerChain as ChainEditor,
};

async function fetchValueChain(sessionId: number) {
  try {
    const supabase = getAdminSupabase();
    const { data } = await supabase
      .from("study_session_value_chains")
      .select("layers, nodes, edges, companies")
      .eq("session_id", sessionId)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

export default async function IndustryDetailPage({
  params,
}: {
  params: { industryId: string };
}) {
  const id = Number(params.industryId);
  if (!Number.isInteger(id) || id < 1) notFound();

  let industry;
  let error: string | null = null;
  let valueChain: Record<string, unknown> | null = null;
  try {
    const data = await fetchHomeData();
    industry = data.industries.find((i) => i.id === id);
    if (industry) {
      valueChain = await fetchValueChain(industry.id);
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "데이터 로드 실패";
  }

  if (error) {
    return (
      <div style={wrapStyle}>
        <div style={errorBox}>{error}</div>
      </div>
    );
  }
  if (!industry) notFound();

  const returnColor = (r: number | null) =>
    r === null ? "#737373" : r > 0 ? "#166534" : r < 0 ? "#991b1b" : "#737373";
  const formatReturn = (r: number | null) => {
    if (r === null) return "—";
    const sign = r > 0 ? "+" : "";
    return `${sign}${(r * 100).toFixed(2)}%`;
  };

  return (
    <div style={wrapStyle}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ marginBottom: 20, fontSize: "0.75rem", color: "#737373" }}>
          <Link href="/" style={{ color: "#171717", textDecoration: "none" }}>
            ← 스터디 트래커
          </Link>
        </div>

        <header style={{ borderBottom: "2px solid #171717", paddingBottom: 18, marginBottom: 30 }}>
          <div style={{ fontSize: "0.7rem", letterSpacing: "0.25em", color: "#737373", textTransform: "uppercase", marginBottom: 6 }}>
            Industry · {industry.presented_at}
          </div>
          <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.4rem)", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
            {industry.industry_name}
          </h1>
          <div style={{ marginTop: 8, fontSize: "0.85rem", color: "#404040", display: "flex", gap: 18, flexWrap: "wrap" }}>
            <span>
              <span style={{ color: "#a3a3a3", marginRight: 4 }}>발표자</span>
              {industry.presenter}
            </span>
            <span>
              <span style={{ color: "#a3a3a3", marginRight: 4 }}>스터디 종목</span>
              {industry.ideas.length}개
            </span>
          </div>
        </header>

        {/* Summary (collapsible) */}
        <details style={sectionBox}>
          <summary style={sectionSummary}>
            <span style={sectionLabel}>발표 자료 요약</span>
            <span style={chevron}>▸</span>
          </summary>
          <div style={{ padding: "18px 22px" }}>
            {industry.summary_md ? (
              <div
                className="industry-summary"
                style={{ fontSize: "0.9rem", color: "#171717", lineHeight: 1.7 }}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {industry.summary_md}
                </ReactMarkdown>
              </div>
            ) : (
              <div style={emptyBox}>아직 업로드된 요약이 없습니다.</div>
            )}
          </div>
        </details>

        {/* Value chain (collapsible) */}
        {(() => {
          const ValueChainEditor = VALUE_CHAIN_BY_INDUSTRY[industry.industry_name];
          return (
            <details style={sectionBox}>
              <summary style={sectionSummary}>
                <span style={sectionLabel}>밸류체인 시각화</span>
                <span style={chevron}>▸</span>
              </summary>
              <div style={{ padding: 0 }} className="value-chain-scroll">
                {ValueChainEditor ? (
                  <PersistedChain
                    sessionId={industry.id}
                    initialData={valueChain}
                    Editor={ValueChainEditor}
                  />
                ) : (
                  <div style={{ padding: "20px 22px" }}>
                    <div
                      style={{
                        padding: "22px 22px",
                        background: "#fafafa",
                        border: "1px dashed #d4d4d4",
                        fontSize: "0.9rem",
                        color: "#404040",
                        lineHeight: 1.7,
                      }}
                    >
                      <div style={{ fontWeight: 600, color: "#171717", marginBottom: 6 }}>준비 중</div>
                      이 산업의 밸류체인 자료가 아직 준비되지 않았습니다.
                    </div>
                  </div>
                )}
              </div>
            </details>
          );
        })()}

        {/* Ideas list (collapsible) */}
        <details style={sectionBox}>
          <summary style={sectionSummary}>
            <span style={sectionLabel}>
              기업 <span style={{ color: "#737373", marginLeft: 8, letterSpacing: 0, fontWeight: 400 }}>· {industry.ideas.length}</span>
            </span>
            <span style={chevron}>▸</span>
          </summary>
          <div style={{ padding: "14px 22px 20px" }}>
            {industry.ideas.length === 0 ? (
              <div style={emptyBox}>이 산업에 매핑된 종목이 없습니다.</div>
            ) : (
              <div style={{ background: "#fff", border: "1px solid #e5e5e5" }}>
                {industry.ideas.map((idea, i) => (
                  <div
                    key={idea.id}
                    className="row-detail-idea"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) auto auto auto",
                      gap: 14,
                      padding: "12px 16px",
                      borderTop: i === 0 ? "none" : "1px solid #e5e5e5",
                      fontSize: "0.88rem",
                      alignItems: "center",
                    }}
                  >
                    <span className="col-name" style={{ minWidth: 0, overflow: "hidden" }}>
                      <span style={{ fontWeight: 600, color: "#171717" }}>{idea.company_name}</span>
                      <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.78rem", color: "#737373", marginLeft: 10 }}>
                        {idea.ticker}
                      </span>
                      {idea.thesis && (
                        <div style={{ fontSize: "0.8rem", color: "#404040", marginTop: 4, lineHeight: 1.5 }}>
                          {idea.thesis}
                        </div>
                      )}
                    </span>
                    <span className="col-presenter" style={{ fontSize: "0.75rem", color: "#737373" }}>{idea.presenter}</span>
                    <span
                      className="col-return"
                      style={{
                        fontFamily: "var(--font-mono, monospace)",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        color: returnColor(idea.return_pct),
                        minWidth: 70,
                        textAlign: "right",
                      }}
                    >
                      {formatReturn(idea.return_pct)}
                    </span>
                    <span className="col-state" style={{ fontSize: "0.72rem", color: "#737373", minWidth: 56 }}>
                      {idea.status || "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}

const sectionBox: React.CSSProperties = {
  marginBottom: 14,
  border: "1px solid #e5e5e5",
  background: "#ffffff",
  borderRadius: 2,
};

const sectionSummary: React.CSSProperties = {
  cursor: "pointer",
  padding: "12px 18px",
  listStyle: "none",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "#fafafa",
  borderBottom: "1px solid #e5e5e5",
};

const sectionLabel: React.CSSProperties = {
  fontSize: "0.78rem",
  letterSpacing: "0.22em",
  color: "#171717",
  textTransform: "uppercase",
  fontWeight: 700,
};

const chevron: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "#737373",
  fontFamily: "var(--font-mono, monospace)",
};

const wrapStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#ffffff",
  color: "#171717",
  padding: "24px 12px 60px",
  fontFamily: "'Pretendard Variable', 'Pretendard', -apple-system, sans-serif",
};

const emptyBox: React.CSSProperties = {
  padding: "18px 20px",
  background: "#fafafa",
  border: "1px dashed #d4d4d4",
  color: "#737373",
  fontSize: "0.88rem",
};

const errorBox: React.CSSProperties = {
  padding: "14px 18px",
  background: "#FEF2F2",
  border: "1px solid #FCA5A5",
  color: "#991b1b",
  fontSize: "0.9rem",
};
