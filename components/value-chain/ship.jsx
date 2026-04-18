"use client";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  X,
  Plus,
  Minus,
  Trash2,
  ArrowDown,
  ArrowUp,
  EyeOff,
  Eye,
  Building2,
  ChevronRight,
  Search,
} from "lucide-react";

/* ============================ SEED DATA ============================ */

const INITIAL_LAYERS = [
  { id: "L1", name: "원자재 (후판 · 단조)", order: 0, isCenter: false },
  { id: "L2", name: "조선기자재", order: 1, isCenter: false },
  { id: "L3", name: "조선소 Big 3", order: 2, isCenter: true },
  { id: "L4", name: "선종 · 해양", order: 3, isCenter: false },
  { id: "L5", name: "선주 · 에너지 메이저", order: 4, isCenter: false },
  { id: "L6", name: "최종 수요 · 정책", order: 5, isCenter: false },
];

const INITIAL_COMPANIES = {
  // L1
  "005490": { ticker: "005490", name: "POSCO홀딩스", market: "KOSPI" },
  "004020": { ticker: "004020", name: "현대제철", market: "KOSPI" },
  "460860": { ticker: "460860", name: "동국제강", market: "KOSPI" },
  "017850": { ticker: "017850", name: "케이에스피", market: "KOSDAQ" },
  // L2
  "017960": { ticker: "017960", name: "한국카본", market: "KOSPI" },
  "033500": { ticker: "033500", name: "동성화인텍", market: "KOSDAQ" },
  "071970": { ticker: "071970", name: "HD현대마린엔진", market: "KOSPI" },
  "082740": { ticker: "082740", name: "한화엔진", market: "KOSPI" },
  "077970": { ticker: "077970", name: "STX엔진", market: "KOSDAQ" },
  "014620": { ticker: "014620", name: "성광벤드", market: "KOSDAQ" },
  "023160": { ticker: "023160", name: "태광", market: "KOSDAQ" },
  "267260": { ticker: "267260", name: "HD현대일렉트릭", market: "KOSPI" },
  "075580": { ticker: "075580", name: "세진중공업", market: "KOSDAQ" },
  "443060": { ticker: "443060", name: "HD현대마린솔루션", market: "KOSPI" },
  // L3
  "009540": { ticker: "009540", name: "HD한국조선해양", market: "KOSPI" },
  "329180": { ticker: "329180", name: "HD현대중공업", market: "KOSPI" },
  "010620": { ticker: "010620", name: "HD현대미포", market: "KOSPI" },
  "010140": { ticker: "010140", name: "삼성중공업", market: "KOSPI" },
  "042660": { ticker: "042660", name: "한화오션", market: "KOSPI" },
  // L5
  MAERSK: { ticker: "MAERSK", name: "Maersk", market: "CPH" },
  "2603": { ticker: "2603", name: "Evergreen Marine", market: "TWSE" },
  CMACGM: { ticker: "CMACGM", name: "CMA CGM", market: "Private" },
  QE: { ticker: "QE", name: "QatarEnergy", market: "State" },
  XOM: { ticker: "XOM", name: "ExxonMobil", market: "NYSE" },
  SHEL: { ticker: "SHEL", name: "Shell", market: "NYSE" },
  HII: { ticker: "HII", name: "Huntington Ingalls", market: "NYSE" },
  "011200": { ticker: "011200", name: "HMM", market: "KOSPI" },
  "028670": { ticker: "028670", name: "팬오션", market: "KOSPI" },
};

const INITIAL_NODES = [
  // L1 원자재
  { id: "n1", layerId: "L1", name: "조선용 후판", status: "neutral", note: "조선 원가의 약 20%. 조선-철강 가격 협상 매년 난항. 공급 3사 과점.", companies: ["005490", "004020", "460860"], metric: "후판 톤당 ~90만원대" },
  { id: "n2", layerId: "L1", name: "특수강 · 단조", status: "positive", note: "엔진 크랭크샤프트, 프로펠러 샤프트. DF 엔진 증설 동반 수혜.", companies: ["017850"], metric: "" },

  // L2 조선기자재
  { id: "n3", layerId: "L2", name: "LNG 보냉재 (Mark III · NO96)", status: "strong-positive", note: "국내 듀오폴리. LNG선 1척당 ~300억. GTT 로열티 있지만 수주잔고 3년치+.", companies: ["017960", "033500"], metric: "LNG선당 보냉재 300억" },
  { id: "n4", layerId: "L2", name: "선박엔진 (2-stroke DF)", status: "strong-positive", note: "메탄올/암모니아 DF 수요 폭증. HD현대마린엔진 '24 IPO, 한화엔진 실적 턴어라운드.", companies: ["071970", "082740", "077970"], metric: "HD현마린엔 2025 수주 +50% YoY" },
  { id: "n5", layerId: "L2", name: "파이프 · 피팅", status: "positive", note: "LNG선 극저온 배관 특수 피팅. 인코넬·스테인리스 고마진 품목.", companies: ["014620", "023160"], metric: "" },
  { id: "n6", layerId: "L2", name: "전장 · 추진전력", status: "strong-positive", note: "변압기 슈퍼사이클 + 선박 전장 동시 수혜. AI·해상풍력 레버리지까지.", companies: ["267260"], metric: "HD현대일렉 2026E OPM 22%+" },
  { id: "n7", layerId: "L2", name: "블록 · 데크하우스", status: "positive", note: "조선소 풀가동으로 외주 확대. LPG 탱크 특화.", companies: ["075580"], metric: "" },
  { id: "n8", layerId: "L2", name: "MRO · 선박 애프터마켓", status: "strong-positive", note: "'24.5 상장. 친환경 개조 수요. 선박 운영 전주기 고마진 구조.", companies: ["443060"], metric: "2026E ROE 35%+" },

  // L3 조선소 Big 3 (CENTER)
  { id: "n9", layerId: "L3", name: "HD현대 조선 (韓·글로벌 1위)", status: "strong-positive", note: "도크 2028년까지 풀부킹. 한국조선해양(지주) 아래 HD현대중공업·HD현대미포·HD현대삼호. LNG·메탄올 리더.", companies: ["009540", "329180", "010620"], metric: "그룹 수주잔고 ~$900억" },
  { id: "n10", layerId: "L3", name: "삼성중공업", status: "strong-positive", note: "LNG선 · FLNG 특화. 고정비 부담 완화로 턴어라운드 본격. 2025 흑자 정상화.", companies: ["010140"], metric: "2026E OPM 10%+" },
  { id: "n11", layerId: "L3", name: "한화오션", status: "strong-positive", note: "필리조선소 인수 → 미국 MRO·해군 진출 유일 교두보. 방산·상선·해양 3축.", companies: ["042660"], metric: "필리조선소 · Jones Act 독점" },

  // L4 선종 · 해양
  { id: "n12", layerId: "L4", name: "LNG 운반선 (174K DF)", status: "strong-positive", note: "한국 점유율 70%+. 카타르 2차 발주 지속. 척당 ~$2.6억. 중국과의 진입장벽 건재.", companies: [], metric: "신조선가 지수 190선" },
  { id: "n13", layerId: "L4", name: "메탄올 · 암모니아 DF", status: "strong-positive", note: "IMO NetZero 2050. 머스크 메탄올 DF 대량 발주. 프리미엄 선가 +15~20%.", companies: [], metric: "친환경선 비중 2030E 50%+" },
  { id: "n14", layerId: "L4", name: "FLNG · 해양플랜트", status: "positive", note: "삼성중 FLNG 강점. 유가 변수 있으나 LNG 수출 확대로 프로젝트 재개. 한화오션 부상.", companies: [], metric: "" },
  { id: "n15", layerId: "L4", name: "컨테이너선", status: "neutral", note: "중국 점유율 60%+. 한국은 초대형·친환경 위주 선별 수주로 물량 포기.", companies: [], metric: "" },
  { id: "n16", layerId: "L4", name: "탱커 · VLCC · LPG선", status: "positive", note: "선대 고령화 교체 수요. HD현대미포 LPG 강점. VLCC 용선료 강세.", companies: [], metric: "" },

  // L5 선주 · 에너지 메이저
  { id: "n17", layerId: "L5", name: "글로벌 컨테이너 선사", status: "positive", note: "홍해 사태 이후 운임 정상화. 친환경 선대 교체 가속. 머스크 메탄올 DF 선도.", companies: ["MAERSK", "2603", "CMACGM"], metric: "" },
  { id: "n18", layerId: "L5", name: "LNG 에너지 메이저", status: "strong-positive", note: "카타르 North Field 확장. LNG선 100+척 순차 발주, 사실상 전량 한국 수주.", companies: ["QE", "XOM", "SHEL"], metric: "카타르 2차 ~$200억 발주" },
  { id: "n19", layerId: "L5", name: "미국 해군 · Jones Act 선주", status: "strong-positive", note: "트럼프 행정명령. 중국 조선 견제. 한화오션 필리조선소 유일 한국 진입 루트.", companies: ["HII"], metric: "" },
  { id: "n20", layerId: "L5", name: "국내 해운", status: "neutral", note: "HMM 민영화 장기화. 벌크선 교체 수요는 꾸준.", companies: ["011200", "028670"], metric: "" },

  // L6 최종수요 · 정책
  { id: "n21", layerId: "L6", name: "글로벌 LNG 수요", status: "strong-positive", note: "미국·카타르·호주 LNG 수출 확대. 유럽 러시아 가스 대체 고착. 2030까지 +50%.", companies: [], metric: "2030E LNG 교역 600Mt+" },
  { id: "n22", layerId: "L6", name: "IMO 환경규제 (NetZero 2050)", status: "strong-positive", note: "EEXI · CII 강제. 2030부터 탄소세 단계 도입. 노후선 강제 교체 사이클.", companies: [], metric: "" },
  { id: "n23", layerId: "L6", name: "미국 MASGA · 재건정책", status: "strong-positive", note: "Make American Shipbuilding Great Again. 중국 조선 제재 + 한국 파트너십. 한화오션 직접 수혜.", companies: [], metric: "" },
  { id: "n24", layerId: "L6", name: "글로벌 해운 물동량", status: "neutral", note: "WTO 물동량 증가율 둔화. 관세 변수. 다만 신조 수요는 교체 사이클이 주도.", companies: [], metric: "" },
];

const INITIAL_EDGES = [
  // L1 → L3 (후판)
  { id: "e1", from: "n1", to: "n9" }, { id: "e2", from: "n1", to: "n10" }, { id: "e3", from: "n1", to: "n11" },
  // L1 → L2 (특수강)
  { id: "e4", from: "n2", to: "n4" },
  // L2 → L3 (보냉재)
  { id: "e5", from: "n3", to: "n9" }, { id: "e6", from: "n3", to: "n10" }, { id: "e7", from: "n3", to: "n11" },
  // L2 → L3 (엔진)
  { id: "e8", from: "n4", to: "n9" }, { id: "e9", from: "n4", to: "n10" }, { id: "e10", from: "n4", to: "n11" },
  // L2 → L3 (피팅)
  { id: "e11", from: "n5", to: "n9" }, { id: "e12", from: "n5", to: "n10" },
  // L2 → L3 (전장)
  { id: "e13", from: "n6", to: "n9" },
  // L2 → L3 (블록)
  { id: "e14", from: "n7", to: "n9" }, { id: "e15", from: "n7", to: "n11" },
  // L2 → L3 (MRO)
  { id: "e16", from: "n8", to: "n9" },
  // L3 → L4 (HD현대)
  { id: "e17", from: "n9", to: "n12" }, { id: "e18", from: "n9", to: "n13" }, { id: "e19", from: "n9", to: "n16" },
  // L3 → L4 (삼성중)
  { id: "e20", from: "n10", to: "n12" }, { id: "e21", from: "n10", to: "n13" }, { id: "e22", from: "n10", to: "n14" },
  // L3 → L4 (한화오션)
  { id: "e23", from: "n11", to: "n12" }, { id: "e24", from: "n11", to: "n13" }, { id: "e25", from: "n11", to: "n14" },
  // 컨테이너
  { id: "e26", from: "n9", to: "n15" },
  // L3 → L5 (한화오션 → 미 해군)
  { id: "e27", from: "n11", to: "n19" },
  // L4 → L5
  { id: "e28", from: "n12", to: "n18" },
  { id: "e29", from: "n13", to: "n17" },
  { id: "e30", from: "n14", to: "n18" },
  { id: "e31", from: "n15", to: "n17" },
  { id: "e32", from: "n16", to: "n20" },
  // L5 → L6
  { id: "e33", from: "n18", to: "n21" },
  { id: "e34", from: "n17", to: "n22" },
  { id: "e35", from: "n17", to: "n24" },
  { id: "e36", from: "n19", to: "n23" },
  { id: "e37", from: "n20", to: "n24" },
];

/* ============================ THEME TOKENS ============================ */
const T = {
  bg:        "#ffffff",
  bgCard:    "#ffffff",
  bgPanel:   "#fafafa",
  bgSubtle:  "#f5f5f5",
  border:    "#d4d4d4",
  borderHover: "#737373",
  borderActive: "#262626",
  text1:     "#171717",
  text2:     "#404040",
  text3:     "#737373",
  text4:     "#a3a3a3",
  accent:    "#262626",
};

const STATUSES = [
  { id: "strong-positive", label: "Strong +", color: "#166534" },
  { id: "positive",        label: "Positive", color: "#4d7c0f" },
  { id: "neutral",         label: "Neutral",  color: "#525252" },
  { id: "caution",         label: "Caution",  color: "#b45309" },
  { id: "negative",        label: "Negative", color: "#991b1b" },
];

const statusColor = (s) => STATUSES.find((x) => x.id === s)?.color || T.text3;

/* ============================ SVG EDGES ============================ */

function ChainEdges({ edges, nodePositions, nodes, selectedNodeId, hoveredNodeId, edgesVisible }) {
  const nodeById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  if (!edgesVisible) return null;

  const activeNodeId = hoveredNodeId || selectedNodeId;

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: "visible" }}>
      {edges.map((edge) => {
        const from = nodePositions[edge.from];
        const to = nodePositions[edge.to];
        if (!from || !to) return null;

        const x1 = from.cx, y1 = from.bottom;
        const x2 = to.cx, y2 = to.top;
        const midY = (y1 + y2) / 2;
        const path = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

        const isRelated = activeNodeId && (edge.from === activeNodeId || edge.to === activeNodeId);
        const isDim = activeNodeId && !isRelated;
        const fromNode = nodeById[edge.from];
        const color = fromNode ? statusColor(fromNode.status) : T.border;

        const strokeColor = isDim ? "#ededed" : isRelated ? color : "#bdbdbd";
        const strokeOpacity = isDim ? 0.7 : isRelated ? 1 : 0.85;
        const strokeWidth = isRelated ? 1.8 : 1.1;

        return (
          <g key={edge.id}>
            <path d={path} fill="none" stroke={strokeColor} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} style={{ transition: "all 0.2s ease" }} />
            {isRelated && <circle cx={x2} cy={y2} r={3} fill={color} opacity={0.95} />}
          </g>
        );
      })}
    </svg>
  );
}

/* ============================ COMPANY TAG ============================ */

function CompanyTag({ ticker, name, onClick, count }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="text-[10px] font-mono px-1.5 py-0.5 inline-flex items-center gap-1 cursor-pointer transition-colors"
      style={{
        color: T.text2,
        background: T.bgSubtle,
        border: `1px solid ${T.border}`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = T.text1;
        e.currentTarget.style.borderColor = T.borderHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = T.text2;
        e.currentTarget.style.borderColor = T.border;
      }}
      title={`${name} (${ticker}) — 클릭해서 역조회`}
    >
      {name}
      {count && count > 1 && (
        <span style={{ color: T.text4, fontSize: "8.5px" }}>×{count}</span>
      )}
    </button>
  );
}

/* ============================ NODE CARD ============================ */

function NodeCard({ node, companies, companyNodeCounts, isSelected, isDimmed, onClick, onHover, onLeave, onCompanyClick, nodeRef }) {
  const color = statusColor(node.status);
  const nodeCompanies = node.companies.map((t) => companies[t]).filter(Boolean);

  return (
    <div
      ref={nodeRef}
      data-node-id={node.id}
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className="group text-left transition-all px-3.5 py-3 min-w-[185px] max-w-[225px] cursor-pointer"
      style={{
        background: T.bgCard,
        borderWidth: "1px",
        borderStyle: "solid",
        borderLeftWidth: "3px",
        borderLeftColor: color,
        borderRightColor: isSelected ? T.borderActive : T.border,
        borderTopColor: isSelected ? T.borderActive : T.border,
        borderBottomColor: isSelected ? T.borderActive : T.border,
        opacity: isDimmed ? 0.3 : 1,
        transition: "opacity 0.2s ease, border-color 0.15s ease",
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div
          className="leading-tight"
          style={{
            fontFamily: "'Fraunces', 'Pretendard Variable', serif",
            fontWeight: 500,
            fontSize: "14px",
            color: T.text1,
          }}
        >
          {node.name}
        </div>
        <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: color }} />
      </div>

      {node.metric && (
        <div
          className="mb-1.5 tabular-nums"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "10.5px",
            color: T.text2,
          }}
        >
          {node.metric}
        </div>
      )}

      <div className="flex items-center gap-1 flex-wrap mt-2">
        {nodeCompanies.slice(0, 3).map((c) => (
          <CompanyTag
            key={c.ticker}
            ticker={c.ticker}
            name={c.name}
            count={companyNodeCounts[c.ticker]}
            onClick={() => onCompanyClick(c.ticker)}
          />
        ))}
        {nodeCompanies.length > 3 && (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: T.text3 }}>
            +{nodeCompanies.length - 3}
          </span>
        )}
      </div>
    </div>
  );
}

/* ============================ NODE DETAIL ============================ */

function NodeDetail({ node, layer, layers, nodes, edges, companies, companyNodeCounts, onChange, onDelete, onClose, onAddEdge, onRemoveEdge, onSelectNode, onCompanyClick }) {
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompanyTicker, setNewCompanyTicker] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyMarket, setNewCompanyMarket] = useState("KOSPI");
  const [showAddUpstream, setShowAddUpstream] = useState(false);
  const [showAddDownstream, setShowAddDownstream] = useState(false);

  if (!node) return null;

  const currentLayerOrder = layer.order;
  const availableCompanies = Object.values(companies).filter((c) => !node.companies.includes(c.ticker));

  const upstreamEdges = edges.filter((e) => e.to === node.id);
  const downstreamEdges = edges.filter((e) => e.from === node.id);
  const connectedUpstreamIds = new Set(upstreamEdges.map((e) => e.from));
  const connectedDownstreamIds = new Set(downstreamEdges.map((e) => e.to));

  const possibleUpstreamNodes = nodes.filter((n) => {
    const nLayer = layers.find((l) => l.id === n.layerId);
    return nLayer && nLayer.order < currentLayerOrder && !connectedUpstreamIds.has(n.id) && n.id !== node.id;
  });
  const possibleDownstreamNodes = nodes.filter((n) => {
    const nLayer = layers.find((l) => l.id === n.layerId);
    return nLayer && nLayer.order > currentLayerOrder && !connectedDownstreamIds.has(n.id) && n.id !== node.id;
  });

  const getNodeLabel = (n) => {
    const l = layers.find((ll) => ll.id === n.layerId);
    return `${l?.id ?? ""} · ${n.name}`;
  };

  const labelStyle = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "10px",
    color: T.text3,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    fontWeight: 500,
  };

  return (
    <div
      className="fixed right-0 top-0 bottom-0 w-[460px] overflow-y-auto z-40"
      style={{ background: T.bgPanel, borderLeft: `1px solid ${T.border}` }}
    >
      <div
        className="sticky top-0 p-5 flex items-start justify-between z-10"
        style={{ background: T.bgPanel, borderBottom: `1px solid ${T.border}` }}
      >
        <div className="flex-1 pr-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span style={{ ...labelStyle, fontSize: "9.5px" }}>
              {layer.id} · {layer.name}
            </span>
          </div>
          <input
            value={node.name}
            onChange={(e) => onChange({ ...node, name: e.target.value })}
            className="bg-transparent w-full focus:outline-none"
            style={{
              fontFamily: "'Fraunces', 'Pretendard Variable', serif",
              fontWeight: 500,
              fontSize: "22px",
              color: T.text1,
            }}
          />
        </div>
        <button onClick={onClose} style={{ color: T.text3 }} className="hover:opacity-100" onMouseEnter={(e) => e.currentTarget.style.color = T.text1} onMouseLeave={(e) => e.currentTarget.style.color = T.text3}>
          <X size={18} />
        </button>
      </div>

      <div className="p-5 space-y-6">
        {/* status */}
        <div>
          <div style={{ ...labelStyle, marginBottom: "8px" }}>Status</div>
          <div className="grid grid-cols-5 gap-1">
            {STATUSES.map((s) => (
              <button
                key={s.id}
                onClick={() => onChange({ ...node, status: s.id })}
                className="py-2 transition-colors"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "10.5px",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  borderColor: node.status === s.id ? T.borderActive : T.border,
                  borderTopColor: node.status === s.id ? s.color : T.border,
                  borderTopWidth: node.status === s.id ? "2px" : "1px",
                  color: node.status === s.id ? T.text1 : T.text3,
                  background: node.status === s.id ? T.bgCard : "transparent",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* metric */}
        <div>
          <div style={{ ...labelStyle, marginBottom: "8px" }}>Key Metric</div>
          <input
            value={node.metric || ""}
            onChange={(e) => onChange({ ...node, metric: e.target.value })}
            placeholder="수주잔고 +32% 같은 핵심 숫자 한 줄"
            className="w-full px-3 py-2 focus:outline-none"
            style={{
              background: T.bgCard,
              border: `1px solid ${T.border}`,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "12.5px",
              color: T.text1,
            }}
          />
        </div>

        {/* note */}
        <div>
          <div style={{ ...labelStyle, marginBottom: "8px" }}>Note</div>
          <textarea
            value={node.note}
            onChange={(e) => onChange({ ...node, note: e.target.value })}
            placeholder="이 노드의 현재 상황, 모니터링 포인트, 위험 요소..."
            rows={4}
            className="w-full px-3 py-2 focus:outline-none resize-none leading-relaxed"
            style={{
              background: T.bgCard,
              border: `1px solid ${T.border}`,
              fontSize: "12.5px",
              color: T.text1,
            }}
          />
        </div>

        {/* upstream */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <ArrowUp size={12} style={{ color: T.text3 }} />
              <div style={labelStyle}>Upstream ({upstreamEdges.length})</div>
            </div>
            <button
              onClick={() => setShowAddUpstream(!showAddUpstream)}
              className="flex items-center gap-1 transition-colors"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "10.5px",
                color: possibleUpstreamNodes.length === 0 ? T.text4 : T.text3,
                opacity: possibleUpstreamNodes.length === 0 ? 0.5 : 1,
              }}
              disabled={possibleUpstreamNodes.length === 0}
              onMouseEnter={(e) => { if (possibleUpstreamNodes.length > 0) e.currentTarget.style.color = T.accent; }}
              onMouseLeave={(e) => { if (possibleUpstreamNodes.length > 0) e.currentTarget.style.color = T.text3; }}
            >
              <Plus size={11} />연결
            </button>
          </div>
          <div className="space-y-1 mb-1">
            {upstreamEdges.length === 0 && (
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: T.text4, fontStyle: "italic", padding: "4px 0" }}>
                상류 연결 없음
              </div>
            )}
            {upstreamEdges.map((e) => {
              const n = nodes.find((x) => x.id === e.from);
              if (!n) return null;
              return (
                <div
                  key={e.id}
                  className="flex items-center justify-between px-3 py-1.5"
                  style={{ background: T.bgCard, border: `1px solid ${T.border}` }}
                >
                  <button
                    onClick={() => onSelectNode(n.id)}
                    className="flex items-center gap-2 transition-colors"
                    style={{ fontSize: "12px", color: T.text2 }}
                    onMouseEnter={(ev) => ev.currentTarget.style.color = T.text1}
                    onMouseLeave={(ev) => ev.currentTarget.style.color = T.text2}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor(n.status) }} />
                    {getNodeLabel(n)}
                  </button>
                  <button onClick={() => onRemoveEdge(e.id)} style={{ color: T.text4 }} onMouseEnter={(ev) => ev.currentTarget.style.color = "#991b1b"} onMouseLeave={(ev) => ev.currentTarget.style.color = T.text4}>
                    <Minus size={12} />
                  </button>
                </div>
              );
            })}
          </div>
          {showAddUpstream && possibleUpstreamNodes.length > 0 && (
            <div
              className="p-2 max-h-48 overflow-y-auto space-y-0.5"
              style={{ background: T.bgCard, border: `1px solid ${T.border}` }}
            >
              {possibleUpstreamNodes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { onAddEdge(n.id, node.id); setShowAddUpstream(false); }}
                  className="w-full text-left px-2 py-1 flex items-center gap-2 transition-colors"
                  style={{ fontSize: "11.5px", color: T.text2 }}
                  onMouseEnter={(ev) => { ev.currentTarget.style.color = T.text1; ev.currentTarget.style.background = T.bgSubtle; }}
                  onMouseLeave={(ev) => { ev.currentTarget.style.color = T.text2; ev.currentTarget.style.background = "transparent"; }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor(n.status) }} />
                  {getNodeLabel(n)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* downstream */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <ArrowDown size={12} style={{ color: T.text3 }} />
              <div style={labelStyle}>Downstream ({downstreamEdges.length})</div>
            </div>
            <button
              onClick={() => setShowAddDownstream(!showAddDownstream)}
              className="flex items-center gap-1 transition-colors"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "10.5px",
                color: possibleDownstreamNodes.length === 0 ? T.text4 : T.text3,
                opacity: possibleDownstreamNodes.length === 0 ? 0.5 : 1,
              }}
              disabled={possibleDownstreamNodes.length === 0}
              onMouseEnter={(e) => { if (possibleDownstreamNodes.length > 0) e.currentTarget.style.color = T.accent; }}
              onMouseLeave={(e) => { if (possibleDownstreamNodes.length > 0) e.currentTarget.style.color = T.text3; }}
            >
              <Plus size={11} />연결
            </button>
          </div>
          <div className="space-y-1 mb-1">
            {downstreamEdges.length === 0 && (
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: T.text4, fontStyle: "italic", padding: "4px 0" }}>
                하류 연결 없음
              </div>
            )}
            {downstreamEdges.map((e) => {
              const n = nodes.find((x) => x.id === e.to);
              if (!n) return null;
              return (
                <div
                  key={e.id}
                  className="flex items-center justify-between px-3 py-1.5"
                  style={{ background: T.bgCard, border: `1px solid ${T.border}` }}
                >
                  <button
                    onClick={() => onSelectNode(n.id)}
                    className="flex items-center gap-2 transition-colors"
                    style={{ fontSize: "12px", color: T.text2 }}
                    onMouseEnter={(ev) => ev.currentTarget.style.color = T.text1}
                    onMouseLeave={(ev) => ev.currentTarget.style.color = T.text2}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor(n.status) }} />
                    {getNodeLabel(n)}
                  </button>
                  <button onClick={() => onRemoveEdge(e.id)} style={{ color: T.text4 }} onMouseEnter={(ev) => ev.currentTarget.style.color = "#991b1b"} onMouseLeave={(ev) => ev.currentTarget.style.color = T.text4}>
                    <Minus size={12} />
                  </button>
                </div>
              );
            })}
          </div>
          {showAddDownstream && possibleDownstreamNodes.length > 0 && (
            <div
              className="p-2 max-h-48 overflow-y-auto space-y-0.5"
              style={{ background: T.bgCard, border: `1px solid ${T.border}` }}
            >
              {possibleDownstreamNodes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { onAddEdge(node.id, n.id); setShowAddDownstream(false); }}
                  className="w-full text-left px-2 py-1 flex items-center gap-2 transition-colors"
                  style={{ fontSize: "11.5px", color: T.text2 }}
                  onMouseEnter={(ev) => { ev.currentTarget.style.color = T.text1; ev.currentTarget.style.background = T.bgSubtle; }}
                  onMouseLeave={(ev) => { ev.currentTarget.style.color = T.text2; ev.currentTarget.style.background = "transparent"; }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor(n.status) }} />
                  {getNodeLabel(n)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* companies */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div style={labelStyle}>Companies ({node.companies.length})</div>
            <button
              onClick={() => setShowAddCompany(!showAddCompany)}
              className="flex items-center gap-1 transition-colors"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", color: T.text3 }}
              onMouseEnter={(e) => e.currentTarget.style.color = T.accent}
              onMouseLeave={(e) => e.currentTarget.style.color = T.text3}
            >
              <Plus size={11} />추가
            </button>
          </div>

          <div className="space-y-1 mb-3">
            {node.companies.map((ticker) => {
              const c = companies[ticker];
              if (!c) return null;
              const cnt = companyNodeCounts[ticker] || 1;
              return (
                <div
                  key={ticker}
                  className="flex items-center justify-between px-3 py-2"
                  style={{ background: T.bgCard, border: `1px solid ${T.border}` }}
                >
                  <button
                    onClick={() => onCompanyClick(ticker)}
                    className="flex-1 text-left group"
                    title="기업 역조회"
                  >
                    <div className="flex items-center gap-2">
                      <div style={{ fontSize: "12.5px", color: T.text1 }} className="group-hover:opacity-80">{c.name}</div>
                      {cnt > 1 && (
                        <span
                          className="leading-tight"
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: "9.5px",
                            color: T.accent,
                            border: `1px solid ${T.accent}`,
                            padding: "0 4px",
                          }}
                        >
                          {cnt}개 노드
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: T.text3, marginTop: "2px" }}>
                      {c.ticker} · {c.market}
                    </div>
                  </button>
                  <button
                    onClick={() => onChange({ ...node, companies: node.companies.filter((t) => t !== ticker) })}
                    className="ml-2"
                    style={{ color: T.text4 }}
                    onMouseEnter={(e) => e.currentTarget.style.color = "#991b1b"}
                    onMouseLeave={(e) => e.currentTarget.style.color = T.text4}
                  >
                    <Minus size={13} />
                  </button>
                </div>
              );
            })}
          </div>

          {showAddCompany && (
            <div
              className="p-3 space-y-2"
              style={{ background: T.bgCard, border: `1px solid ${T.border}` }}
            >
              <div style={labelStyle}>기존 기업 선택</div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {availableCompanies.length === 0 ? (
                  <div style={{ fontSize: "10.5px", color: T.text4, fontStyle: "italic" }}>모든 등록 기업이 이미 태깅됨</div>
                ) : (
                  availableCompanies.map((c) => (
                    <button
                      key={c.ticker}
                      onClick={() => onChange({ ...node, companies: [...node.companies, c.ticker] })}
                      className="w-full text-left px-2 py-1 flex justify-between transition-colors"
                      style={{ fontSize: "11.5px", color: T.text2 }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = T.text1; e.currentTarget.style.background = T.bgSubtle; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = T.text2; e.currentTarget.style.background = "transparent"; }}
                    >
                      <span>{c.name}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: T.text3 }}>{c.ticker}</span>
                    </button>
                  ))
                )}
              </div>
              <div className="pt-2 mt-2" style={{ borderTop: `1px solid ${T.border}` }}>
                <div style={{ ...labelStyle, marginBottom: "6px" }}>또는 새 기업 등록</div>
                <div className="grid grid-cols-[1fr_1.5fr] gap-1 mb-1.5">
                  <input
                    placeholder="티커"
                    value={newCompanyTicker}
                    onChange={(e) => setNewCompanyTicker(e.target.value)}
                    className="px-2 py-1 focus:outline-none"
                    style={{ background: T.bgSubtle, border: `1px solid ${T.border}`, fontFamily: "'JetBrains Mono', monospace", fontSize: "11.5px", color: T.text1 }}
                  />
                  <input
                    placeholder="이름"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    className="px-2 py-1 focus:outline-none"
                    style={{ background: T.bgSubtle, border: `1px solid ${T.border}`, fontSize: "11.5px", color: T.text1 }}
                  />
                </div>
                <div className="flex gap-1">
                  <select
                    value={newCompanyMarket}
                    onChange={(e) => setNewCompanyMarket(e.target.value)}
                    className="flex-1 px-2 py-1 focus:outline-none"
                    style={{ background: T.bgSubtle, border: `1px solid ${T.border}`, fontFamily: "'JetBrains Mono', monospace", fontSize: "11.5px", color: T.text2 }}
                  >
                    <option>KOSPI</option><option>KOSDAQ</option><option>NASDAQ</option><option>NYSE</option><option>TSE</option><option>HKEX</option>
                  </select>
                  <button
                    onClick={() => {
                      if (!newCompanyTicker || !newCompanyName) return;
                      onChange(
                        { ...node, companies: [...node.companies, newCompanyTicker] },
                        { newCompany: { ticker: newCompanyTicker, name: newCompanyName, market: newCompanyMarket } }
                      );
                      setNewCompanyTicker(""); setNewCompanyName(""); setShowAddCompany(false);
                    }}
                    disabled={!newCompanyTicker || !newCompanyName}
                    className="px-3 py-1"
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "10.5px",
                      border: `1px solid ${(!newCompanyTicker || !newCompanyName) ? T.border : T.accent}`,
                      color: (!newCompanyTicker || !newCompanyName) ? T.text4 : T.accent,
                    }}
                  >
                    등록
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="pt-4" style={{ borderTop: `1px solid ${T.border}` }}>
          <button
            onClick={onDelete}
            className="flex items-center gap-2 transition-colors"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "10.5px",
              color: "#991b1b",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = "#7f1d1d"}
            onMouseLeave={(e) => e.currentTarget.style.color = "#991b1b"}
          >
            <Trash2 size={12} />노드 삭제 (연결도 함께 삭제)
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================ COMPANY DETAIL MODAL ============================ */

function CompanyDetail({ ticker, companies, nodes, layers, onClose, onNodeSelect }) {
  const company = companies[ticker];
  if (!company) return null;

  const containingNodes = nodes.filter((n) => n.companies.includes(ticker));
  const byLayer = containingNodes.reduce((acc, n) => { (acc[n.layerId] = acc[n.layerId] || []).push(n); return acc; }, {});
  const sortedLayerIds = layers.filter((l) => byLayer[l.id]).map((l) => l.id);
  const statusCounts = containingNodes.reduce((acc, n) => { acc[n.status] = (acc[n.status] || 0) + 1; return acc; }, {});

  const labelStyle = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "10px",
    color: T.text3,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    fontWeight: 500,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      style={{ background: "rgba(0, 0, 0, 0.35)" }}
      onClick={onClose}
    >
      <div
        className="w-[580px] max-h-[82vh] overflow-y-auto"
        style={{ background: T.bgPanel, border: `1px solid ${T.border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sticky top-0 p-5 flex items-start justify-between"
          style={{ background: T.bgPanel, borderBottom: `1px solid ${T.border}` }}
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={12} style={{ color: T.text3 }} />
              <span style={labelStyle}>Company · Reverse Lookup</span>
            </div>
            <h2
              className="mt-1"
              style={{
                fontFamily: "'Fraunces', 'Pretendard Variable', serif",
                fontWeight: 500,
                fontSize: "30px",
                color: T.text1,
              }}
            >
              {company.name}
            </h2>
            <div
              className="tabular-nums mt-1"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "12px",
                color: T.text3,
              }}
            >
              {company.ticker} · {company.market}
            </div>
          </div>
          <button onClick={onClose} style={{ color: T.text3 }} onMouseEnter={(e) => e.currentTarget.style.color = T.text1} onMouseLeave={(e) => e.currentTarget.style.color = T.text3}>
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div
            className="grid grid-cols-[1fr_auto] gap-4 items-center pb-4"
            style={{ borderBottom: `1px solid ${T.border}` }}
          >
            <div>
              <div style={{ ...labelStyle, marginBottom: "4px" }}>체인 내 위치</div>
              <div style={{ fontSize: "13.5px", color: T.text1 }}>
                {containingNodes.length}개 노드 · {sortedLayerIds.length}개 레이어
              </div>
            </div>
            <div className="flex gap-1">
              {STATUSES.map((s) =>
                statusCounts[s.id] ? (
                  <div
                    key={s.id}
                    className="px-2 py-1"
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "10.5px",
                      border: `1px solid ${s.color}66`,
                      color: s.color,
                    }}
                  >
                    {s.label.replace(" ", "")}·{statusCounts[s.id]}
                  </div>
                ) : null
              )}
            </div>
          </div>

          <div>
            <div style={{ ...labelStyle, marginBottom: "12px" }}>속한 노드</div>

            {containingNodes.length === 0 ? (
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11.5px", color: T.text4, fontStyle: "italic", padding: "16px 0" }}>
                이 기업이 태깅된 노드가 없습니다.
              </div>
            ) : (
              <div className="space-y-4">
                {sortedLayerIds.map((lid) => {
                  const layer = layers.find((l) => l.id === lid);
                  const layerNodes = byLayer[lid];
                  return (
                    <div key={lid}>
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: "10px",
                            letterSpacing: "0.2em",
                            textTransform: "uppercase",
                            color: layer.isCenter ? T.accent : T.text3,
                          }}
                        >
                          {layer.id} · {layer.name}
                        </span>
                        <div className="flex-1 h-px" style={{ background: T.border }} />
                      </div>
                      <div className="space-y-1">
                        {layerNodes.map((n) => {
                          const color = statusColor(n.status);
                          return (
                            <button
                              key={n.id}
                              onClick={() => onNodeSelect(n.id)}
                              className="w-full text-left px-3 py-2.5 transition-colors group"
                              style={{
                                background: T.bgCard,
                                border: `1px solid ${T.border}`,
                                borderLeftWidth: "3px",
                                borderLeftColor: color,
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.borderColor = T.borderHover}
                              onMouseLeave={(e) => e.currentTarget.style.borderColor = T.border}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div
                                    style={{
                                      fontFamily: "'Fraunces', 'Pretendard Variable', serif",
                                      fontWeight: 500,
                                      fontSize: "13.5px",
                                      color: T.text1,
                                    }}
                                  >
                                    {n.name}
                                  </div>
                                  {n.metric && (
                                    <div
                                      className="tabular-nums truncate"
                                      style={{
                                        fontFamily: "'JetBrains Mono', monospace",
                                        fontSize: "10.5px",
                                        color: T.text2,
                                        marginTop: "2px",
                                      }}
                                    >
                                      {n.metric}
                                    </div>
                                  )}
                                  {n.note && (
                                    <div
                                      className="line-clamp-1"
                                      style={{
                                        fontSize: "11px",
                                        color: T.text3,
                                        marginTop: "4px",
                                      }}
                                    >
                                      {n.note}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span
                                    style={{
                                      fontFamily: "'JetBrains Mono', monospace",
                                      fontSize: "10px",
                                      letterSpacing: "0.15em",
                                      textTransform: "uppercase",
                                      color,
                                    }}
                                  >
                                    {STATUSES.find((s) => s.id === n.status)?.label}
                                  </span>
                                  <ChevronRight size={14} style={{ color: T.text3 }} />
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div
            className="pt-2"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "10.5px",
              color: T.text3,
              borderTop: `1px solid ${T.border}`,
            }}
          >
            노드 클릭 → 체인에서 해당 노드로 점프
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================ COMPANY SEARCH ============================ */

function CompanySearch({ companies, nodes, onSelect }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return Object.values(companies)
      .filter((c) => c.name.toLowerCase().includes(q) || c.ticker.toLowerCase().includes(q))
      .map((c) => ({ ...c, nodeCount: nodes.filter((n) => n.companies.includes(c.ticker)).length }))
      .slice(0, 8);
  }, [query, companies, nodes]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 transition-colors"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "10.5px",
          color: T.text3,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = T.text1}
        onMouseLeave={(e) => e.currentTarget.style.color = T.text3}
      >
        <Search size={12} />기업 찾기
      </button>
      {open && (
        <div
          className="absolute right-0 top-7 w-[300px] z-30 shadow-xl"
          style={{ background: T.bgPanel, border: `1px solid ${T.border}` }}
        >
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="기업 이름 또는 티커..."
            className="w-full px-3 py-2.5 focus:outline-none"
            style={{ background: T.bgCard, borderBottom: `1px solid ${T.border}`, fontSize: "12.5px", color: T.text1 }}
          />
          <div className="max-h-64 overflow-y-auto">
            {query.trim() && results.length === 0 && (
              <div className="px-3 py-3" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: T.text4, fontStyle: "italic" }}>
                일치하는 기업 없음
              </div>
            )}
            {results.map((c) => (
              <button
                key={c.ticker}
                onClick={() => { onSelect(c.ticker); setOpen(false); setQuery(""); }}
                className="w-full text-left px-3 py-2 flex items-center justify-between transition-colors"
                style={{ borderBottom: `1px solid ${T.bgSubtle}` }}
                onMouseEnter={(e) => e.currentTarget.style.background = T.bgCard}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <div>
                  <div style={{ fontSize: "12.5px", color: T.text1 }}>{c.name}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: T.text3 }}>
                    {c.ticker} · {c.market}
                  </div>
                </div>
                <span
                  className="px-1.5 py-0.5"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "9.5px",
                    color: T.text2,
                    border: `1px solid ${T.border}`,
                  }}
                >
                  {c.nodeCount}개
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ LAYER ROW ============================ */

function LayerRow({ layer, nodes, companies, companyNodeCounts, selectedNodeId, hoveredNodeId, connectedNodeIds, onSelect, onHover, onLeave, onAddNode, onCompanyClick, registerNodeRef }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "10.5px",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: layer.isCenter ? T.accent : T.text2,
              fontWeight: 500,
            }}
          >
            {layer.id} · {layer.name}
          </span>
          {layer.isCenter && (
            <span
              className="px-1.5 py-0.5"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "9.5px",
                color: T.accent,
                border: `1px solid ${T.accent}`,
                letterSpacing: "0.15em",
              }}
            >
              CENTER
            </span>
          )}
        </div>
        <div className="flex-1 h-px" style={{ background: T.border }} />
        <button
          onClick={onAddNode}
          style={{ color: T.text3 }}
          onMouseEnter={(e) => e.currentTarget.style.color = T.text1}
          onMouseLeave={(e) => e.currentTarget.style.color = T.text3}
          title="노드 추가"
        >
          <Plus size={14} />
        </button>
      </div>
      <div
        className="flex flex-wrap gap-2.5 relative"
        style={layer.isCenter ? {
          background: T.bgPanel,
          border: `1px solid ${T.border}`,
          padding: "12px",
          margin: "0 -4px",
        } : { padding: "4px 0" }}
      >
        {nodes.length === 0 ? (
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11.5px", color: T.text4, fontStyle: "italic", padding: "16px 8px" }}>
            이 레이어에 노드 없음 — + 버튼으로 추가
          </div>
        ) : (
          nodes.map((n) => {
            const activeId = hoveredNodeId || selectedNodeId;
            const isSelected = selectedNodeId === n.id;
            const isDimmed = activeId && activeId !== n.id && !connectedNodeIds.has(n.id);
            return (
              <NodeCard
                key={n.id}
                node={n}
                companies={companies}
                companyNodeCounts={companyNodeCounts}
                isSelected={isSelected}
                isDimmed={isDimmed}
                onClick={() => onSelect(n.id)}
                onHover={() => onHover(n.id)}
                onLeave={onLeave}
                onCompanyClick={onCompanyClick}
                nodeRef={(el) => registerNodeRef(n.id, el)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

/* ============================ MAIN ============================ */

/* __PERSISTENCE_WIRED__ */
export default function ShipbuildingChainEditorV15White({ initialData = null, onChange = null } = {}) {
  const [layers, setLayers] = useState(() => initialData?.layers ?? INITIAL_LAYERS);
  const [nodes, setNodes] = useState(() => initialData?.nodes ?? INITIAL_NODES);
  const [companies, setCompanies] = useState(() => initialData?.companies ?? INITIAL_COMPANIES);
  const [edges, setEdges] = useState(() => initialData?.edges ?? INITIAL_EDGES);


  // Persistence: notify parent on any state change (debounced externally).
  useEffect(() => {
    if (!onChange) return;
    onChange({ layers, nodes, edges, companies });
  }, [layers, nodes, edges, companies, onChange]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [edgesVisible, setEdgesVisible] = useState(true);
  const [activeCompanyTicker, setActiveCompanyTicker] = useState(null);

  const canvasRef = useRef(null);
  const nodeRefs = useRef({});
  const [nodePositions, setNodePositions] = useState({});
  const [tick, setTick] = useState(0);

  const registerNodeRef = useCallback((id, el) => {
    if (el) nodeRefs.current[id] = el;
    else delete nodeRefs.current[id];
  }, []);

  const recomputePositions = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    const newPos = {};
    Object.entries(nodeRefs.current).forEach(([id, el]) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      newPos[id] = {
        left: r.left - canvasRect.left, right: r.right - canvasRect.left,
        top: r.top - canvasRect.top, bottom: r.bottom - canvasRect.top,
        cx: r.left - canvasRect.left + r.width / 2,
        cy: r.top - canvasRect.top + r.height / 2,
        width: r.width, height: r.height,
      };
    });
    setNodePositions(newPos);
  }, []);

  useEffect(() => { recomputePositions(); }, [nodes, edges, layers, tick, recomputePositions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => recomputePositions());
    ro.observe(canvas);
    const onResize = () => recomputePositions();
    window.addEventListener("resize", onResize);
    const t = setTimeout(() => setTick((x) => x + 1), 150);
    return () => { ro.disconnect(); window.removeEventListener("resize", onResize); clearTimeout(t); };
  }, [recomputePositions]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedLayer = selectedNode && layers.find((l) => l.id === selectedNode.layerId);

  const companyNodeCounts = useMemo(() => {
    const m = {};
    nodes.forEach((n) => n.companies.forEach((t) => { m[t] = (m[t] || 0) + 1; }));
    return m;
  }, [nodes]);

  const connectedNodeIds = useMemo(() => {
    const activeId = hoveredNodeId || selectedNodeId;
    if (!activeId) return new Set();
    const set = new Set([activeId]);
    edges.forEach((e) => { if (e.from === activeId) set.add(e.to); if (e.to === activeId) set.add(e.from); });
    return set;
  }, [hoveredNodeId, selectedNodeId, edges]);

  const stats = useMemo(() => {
    const byStatus = {};
    STATUSES.forEach((s) => (byStatus[s.id] = 0));
    nodes.forEach((n) => byStatus[n.status]++);
    return { byStatus, total: nodes.length, companies: Object.keys(companyNodeCounts).length, edges: edges.length };
  }, [nodes, edges, companyNodeCounts]);

  const updateNode = (updatedNode, extras = {}) => {
    setNodes((prev) => prev.map((n) => (n.id === updatedNode.id ? updatedNode : n)));
    if (extras.newCompany) setCompanies((prev) => ({ ...prev, [extras.newCompany.ticker]: extras.newCompany }));
  };

  const deleteNode = () => {
    if (!selectedNodeId) return;
    setNodes((prev) => prev.filter((n) => n.id !== selectedNodeId));
    setEdges((prev) => prev.filter((e) => e.from !== selectedNodeId && e.to !== selectedNodeId));
    setSelectedNodeId(null);
  };

  const addNodeToLayer = (layerId) => {
    const newId = `n${Date.now()}`;
    setNodes((prev) => [...prev, { id: newId, layerId, name: "새 노드", status: "neutral", note: "", companies: [], metric: "" }]);
    setSelectedNodeId(newId);
  };

  const addEdge = (from, to) => {
    if (edges.some((e) => e.from === from && e.to === to)) return;
    if (from === to) return;
    setEdges((prev) => [...prev, { id: `e${Date.now()}`, from, to }]);
  };

  const removeEdge = (edgeId) => setEdges((prev) => prev.filter((e) => e.id !== edgeId));

  const handleNodeSelectFromCompany = (nodeId) => {
    setActiveCompanyTicker(null);
    setSelectedNodeId(nodeId);
    setTimeout(() => {
      const el = nodeRefs.current[nodeId];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  const labelStyle = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "10.5px",
    color: T.text3,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    fontWeight: 500,
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Figtree:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css');
        body { font-family: 'Figtree', 'Pretendard Variable', sans-serif; background: ${T.bg}; }
        input, textarea, select { font-family: inherit; }
        input::placeholder, textarea::placeholder { color: ${T.text4}; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: ${T.bg}; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; }
        ::-webkit-scrollbar-thumb:hover { background: ${T.borderHover}; }
        .line-clamp-1 { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
      ` }} />

      <div style={{ minHeight: "100vh", background: T.bg, color: T.text1 }}>
        <div className="max-w-[1400px] mx-auto px-10 py-8">
          <div
            className="flex items-center justify-between pb-5 mb-8"
            style={{ borderBottom: `1px solid ${T.border}` }}
          >
            <div className="flex items-center gap-3">
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "10.5px",
                  letterSpacing: "0.3em",
                  textTransform: "uppercase",
                  color: T.text2,
                  fontWeight: 500,
                }}
              >
                Value Chain Editor
              </span>
              <span style={{ color: T.text4 }}>/</span>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "10.5px",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: T.text3,
                }}
              >
                sector map · MVP v1.5
              </span>
            </div>
            <div className="flex items-center gap-5">
              <CompanySearch companies={companies} nodes={nodes} onSelect={(t) => setActiveCompanyTicker(t)} />
              <button
                onClick={() => setEdgesVisible(!edgesVisible)}
                className="flex items-center gap-1.5 transition-colors"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "10.5px",
                  color: T.text3,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = T.text1}
                onMouseLeave={(e) => e.currentTarget.style.color = T.text3}
              >
                {edgesVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                {edgesVisible ? "edges on" : "edges off"}
              </button>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", color: T.text4 }}>in-memory</span>
            </div>
          </div>

          <div className="mb-10">
            <div className="flex items-baseline gap-4 mb-1">
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "10.5px",
                  letterSpacing: "0.25em",
                  textTransform: "uppercase",
                  color: T.text3,
                }}
              >
                sector · kr + global
              </span>
            </div>
            <h1
              className="tracking-tight"
              style={{
                fontFamily: "'Fraunces', 'Pretendard Variable', serif",
                fontWeight: 500,
                fontSize: "52px",
                color: T.text1,
              }}
            >
              조선업{" "}
              <span
                className="italic"
                style={{
                  color: T.text3,
                  fontSize: "32px",
                }}
              >
                Shipbuilding
              </span>
            </h1>

            <div
              className="grid grid-cols-8 gap-0 mt-6"
              style={{ borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}
            >
              <div className="py-3 px-4" style={{ borderRight: `1px solid ${T.border}` }}>
                <div style={{ ...labelStyle, fontSize: "10px", marginBottom: "4px" }}>노드</div>
                <div
                  className="tabular-nums"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "18px", color: T.text1 }}
                >
                  {stats.total}
                </div>
              </div>
              <div className="py-3 px-4" style={{ borderRight: `1px solid ${T.border}` }}>
                <div style={{ ...labelStyle, fontSize: "10px", marginBottom: "4px" }}>연결</div>
                <div className="tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "18px", color: T.text1 }}>
                  {stats.edges}
                </div>
              </div>
              <div className="py-3 px-4" style={{ borderRight: `1px solid ${T.border}` }}>
                <div style={{ ...labelStyle, fontSize: "10px", marginBottom: "4px" }}>기업</div>
                <div className="tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "18px", color: T.text1 }}>
                  {stats.companies}
                </div>
              </div>
              {STATUSES.map((s, i) => (
                <div
                  key={s.id}
                  className="py-3 px-4"
                  style={{ borderRight: i === STATUSES.length - 1 ? "none" : `1px solid ${T.border}` }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "9.5px",
                        letterSpacing: "0.15em",
                        textTransform: "uppercase",
                        color: T.text3,
                      }}
                    >
                      {s.label}
                    </div>
                  </div>
                  <div
                    className="tabular-nums"
                    style={{ color: s.color, fontFamily: "'JetBrains Mono', monospace", fontSize: "18px" }}
                  >
                    {stats.byStatus[s.id]}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div ref={canvasRef} className="relative space-y-10 mb-16">
            <ChainEdges
              edges={edges}
              nodePositions={nodePositions}
              nodes={nodes}
              selectedNodeId={selectedNodeId}
              hoveredNodeId={hoveredNodeId}
              edgesVisible={edgesVisible}
            />
            {layers.map((layer) => {
              const layerNodes = nodes.filter((n) => n.layerId === layer.id);
              return (
                <LayerRow
                  key={layer.id}
                  layer={layer}
                  nodes={layerNodes}
                  companies={companies}
                  companyNodeCounts={companyNodeCounts}
                  selectedNodeId={selectedNodeId}
                  hoveredNodeId={hoveredNodeId}
                  connectedNodeIds={connectedNodeIds}
                  onSelect={setSelectedNodeId}
                  onHover={setHoveredNodeId}
                  onLeave={() => setHoveredNodeId(null)}
                  onAddNode={() => addNodeToLayer(layer.id)}
                  onCompanyClick={(t) => setActiveCompanyTicker(t)}
                  registerNodeRef={registerNodeRef}
                />
              );
            })}
          </div>

          <div
            className="pt-5 flex justify-between items-center flex-wrap gap-3"
            style={{
              borderTop: `1px solid ${T.border}`,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "11px",
              color: T.text3,
            }}
          >
            <div className="flex gap-4 items-center">
              <span><span style={{ color: T.text2 }}>호버/클릭</span>으로 연결 강조</span>
              <span>·</span>
              <span><span style={{ color: T.text2 }}>기업 태그 클릭</span>으로 역조회</span>
              <span>·</span>
              <span>상단 <span style={{ color: T.text2 }}>기업 찾기</span>로 빠른 이동</span>
            </div>
            <span style={{ color: T.text4 }}>mvp v1.5 · data resets on refresh</span>
          </div>
        </div>

        {selectedNode && (
          <NodeDetail
            node={selectedNode}
            layer={selectedLayer}
            layers={layers}
            nodes={nodes}
            edges={edges}
            companies={companies}
            companyNodeCounts={companyNodeCounts}
            onChange={updateNode}
            onDelete={deleteNode}
            onClose={() => setSelectedNodeId(null)}
            onAddEdge={addEdge}
            onRemoveEdge={removeEdge}
            onSelectNode={setSelectedNodeId}
            onCompanyClick={(t) => setActiveCompanyTicker(t)}
          />
        )}

        {activeCompanyTicker && (
          <CompanyDetail
            ticker={activeCompanyTicker}
            companies={companies}
            nodes={nodes}
            layers={layers}
            onClose={() => setActiveCompanyTicker(null)}
            onNodeSelect={handleNodeSelectFromCompany}
          />
        )}
      </div>
    </>
  );
}
