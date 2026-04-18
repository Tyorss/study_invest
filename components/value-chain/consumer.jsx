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
  { id: "L1", name: "원재료 · 원부자재", order: 0, isCenter: false },
  { id: "L2", name: "용기 · 포장 · 부자재", order: 1, isCenter: false },
  { id: "L3", name: "ODM · OEM 제조", order: 2, isCenter: false },
  { id: "L4", name: "브랜드", order: 3, isCenter: true },
  { id: "L5", name: "유통 · 플랫폼", order: 4, isCenter: false },
  { id: "L6", name: "최종 수요", order: 5, isCenter: false },
];

const INITIAL_COMPANIES = {
  // L1 원재료
  "086710": { ticker: "086710", name: "선진뷰티사이언스", market: "KOSDAQ" },
  "078140": { ticker: "078140", name: "대봉엘에스", market: "KOSDAQ" },
  "001680": { ticker: "001680", name: "대상", market: "KOSPI" },
  "298020": { ticker: "298020", name: "효성티앤씨", market: "KOSPI" },
  "003240": { ticker: "003240", name: "태광산업", market: "KOSPI" },
  // L2 용기·포장
  "115960": { ticker: "115960", name: "연우", market: "KOSDAQ" },
  "251970": { ticker: "251970", name: "펌텍코리아", market: "KOSDAQ" },
  "008730": { ticker: "008730", name: "율촌화학", market: "KOSPI" },
  "014970": { ticker: "014970", name: "삼륭물산", market: "KOSDAQ" },
  // L3 ODM/OEM
  "192820": { ticker: "192820", name: "코스맥스", market: "KOSPI" },
  "161890": { ticker: "161890", name: "한국콜마", market: "KOSPI" },
  "241710": { ticker: "241710", name: "코스메카코리아", market: "KOSDAQ" },
  "111770": { ticker: "111770", name: "영원무역", market: "KOSPI" },
  "105630": { ticker: "105630", name: "한세실업", market: "KOSPI" },
  "111110": { ticker: "111110", name: "호전실업", market: "KOSDAQ" },
  // L4 브랜드 — 화장품
  "257720": { ticker: "257720", name: "실리콘투", market: "KOSDAQ" },
  "278470": { ticker: "278470", name: "APR", market: "KOSPI" },
  "237880": { ticker: "237880", name: "클리오", market: "KOSDAQ" },
  "018290": { ticker: "018290", name: "브이티", market: "KOSDAQ" },
  "214450": { ticker: "214450", name: "파마리서치", market: "KOSDAQ" },
  "090430": { ticker: "090430", name: "아모레퍼시픽", market: "KOSPI" },
  "051900": { ticker: "051900", name: "LG생활건강", market: "KOSPI" },
  // L4 브랜드 — 식품
  "003230": { ticker: "003230", name: "삼양식품", market: "KOSPI" },
  "004370": { ticker: "004370", name: "농심", market: "KOSPI" },
  "271560": { ticker: "271560", name: "오리온", market: "KOSPI" },
  "097950": { ticker: "097950", name: "CJ제일제당", market: "KOSPI" },
  "280360": { ticker: "280360", name: "롯데웰푸드", market: "KOSPI" },
  "005300": { ticker: "005300", name: "롯데칠성", market: "KOSPI" },
  "005180": { ticker: "005180", name: "빙그레", market: "KOSPI" },
  // L4 브랜드 — 패션·생활
  "383220": { ticker: "383220", name: "F&F", market: "KOSPI" },
  "298540": { ticker: "298540", name: "더네이쳐홀딩스", market: "KOSDAQ" },
  "081660": { ticker: "081660", name: "휠라홀딩스", market: "KOSPI" },
  "020000": { ticker: "020000", name: "한섬", market: "KOSPI" },
  "018250": { ticker: "018250", name: "애경산업", market: "KOSPI" },
  // L5 유통
  "001040": { ticker: "001040", name: "CJ (올리브영 지주)", market: "KOSPI" },
  CPNG: { ticker: "CPNG", name: "Coupang", market: "NYSE" },
  "035420": { ticker: "035420", name: "NAVER", market: "KOSPI" },
  "035720": { ticker: "035720", name: "카카오", market: "KOSPI" },
  "139480": { ticker: "139480", name: "이마트", market: "KOSPI" },
  "023530": { ticker: "023530", name: "롯데쇼핑", market: "KOSPI" },
  "069960": { ticker: "069960", name: "현대백화점", market: "KOSPI" },
  "004170": { ticker: "004170", name: "신세계", market: "KOSPI" },
  "282330": { ticker: "282330", name: "BGF리테일", market: "KOSPI" },
  "007070": { ticker: "007070", name: "GS리테일", market: "KOSPI" },
  "008770": { ticker: "008770", name: "호텔신라", market: "KOSPI" },
  AMZN: { ticker: "AMZN", name: "Amazon", market: "NASDAQ" },
  BABA: { ticker: "BABA", name: "Alibaba (Tmall)", market: "NYSE" },
  TT: { ticker: "TT", name: "TikTok Shop", market: "PRIVATE" },
};

const INITIAL_NODES = [
  /* ---------------- L1 원재료 ---------------- */
  {
    id: "n1",
    layerId: "L1",
    name: "화장품 원료 · 소재",
    status: "positive",
    note: "K뷰티 ODM 수주 폭증에 따라 원료 업체 가동률 상승. 선진뷰티 징크옥사이드, 대봉엘에스 기능성 원료 확장.",
    companies: ["086710", "078140"],
    metric: "선진뷰티 '26E 매출 +30%",
  },
  {
    id: "n2",
    layerId: "L1",
    name: "식품 원료 · 소재",
    status: "neutral",
    note: "곡물가 안정화로 마진 정상화 중. 다만 환율·물류비 변동성 상존.",
    companies: ["001680"],
    metric: "",
  },
  {
    id: "n3",
    layerId: "L1",
    name: "섬유 · 원사",
    status: "caution",
    note: "중국 저가 공급 과잉 지속. 스판덱스 업황 회복 지연.",
    companies: ["298020", "003240"],
    metric: "",
  },

  /* ---------------- L2 용기·포장 ---------------- */
  {
    id: "n4",
    layerId: "L2",
    name: "화장품 용기 · 펌프",
    status: "strong-positive",
    note: "인디 브랜드 신제품 발주 급증. 연우·펌텍 생산 캐파 풀가동, 증설 진행.",
    companies: ["115960", "251970"],
    metric: "연우 가동률 95%+",
  },
  {
    id: "n5",
    layerId: "L2",
    name: "식품 · 생활 포장재",
    status: "neutral",
    note: "연포장·필름 수요는 안정적. K푸드 수출용 레토르트 파우치 증가.",
    companies: ["008730", "014970"],
    metric: "",
  },

  /* ---------------- L3 ODM/OEM 제조 ---------------- */
  {
    id: "n6",
    layerId: "L3",
    name: "화장품 ODM",
    status: "strong-positive",
    note: "인디 K뷰티 글로벌 진출의 핵심 파트너. 코스맥스·콜마·코스메카 3사 모두 수주잔고 사상 최대, 미국·동남아 법인 흑자 전환.",
    companies: ["192820", "161890", "241710"],
    metric: "코스맥스 '26E OPM 10%+",
  },
  {
    id: "n7",
    layerId: "L3",
    name: "의류 OEM",
    status: "caution",
    note: "미국 의류 소비 둔화 · 바이어 재고 조정 장기화. 영원무역은 스캇 자전거 부문 부담도 혼재.",
    companies: ["111770", "105630", "111110"],
    metric: "",
  },

  /* ---------------- L4 브랜드 (CENTER) ---------------- */
  {
    id: "n8",
    layerId: "L4",
    name: "인디 K-뷰티",
    status: "strong-positive",
    note: "미국·일본·동남아 동시 폭발. 실리콘투는 글로벌 유통 허브로 자리잡음. APR 메디큐브 부스터프로, 브이티 리들샷, 파마리서치 리쥬란 각자 해외 히트.",
    companies: ["257720", "278470", "237880", "018290", "214450"],
    metric: "실리콘투 '26E 매출 2조+",
  },
  {
    id: "n9",
    layerId: "L4",
    name: "전통 대형 화장품",
    status: "neutral",
    note: "중국 의존도 낮추고 미국·일본으로 무게중심 이동 중. 아모레 코스알엑스 인수효과, LG생건 더후 리브랜딩. 속도는 인디 대비 느림.",
    companies: ["090430", "051900"],
    metric: "",
  },
  {
    id: "n10",
    layerId: "L4",
    name: "K-라면 · 스낵",
    status: "strong-positive",
    note: "불닭볶음면 글로벌 신드롬 지속. 삼양 밀양2공장 가동, 미국 법인 설립 추진. 농심 신라면 미국 2공장, 오리온 초코파이 인도·베트남 확대.",
    companies: ["003230", "004370", "271560"],
    metric: "삼양 해외매출 비중 80%+",
  },
  {
    id: "n11",
    layerId: "L4",
    name: "종합식품 · HMR",
    status: "positive",
    note: "비비고 만두 미국 냉동만두 1위 고수. CJ 슈완스 통합 시너지. K-만두·김치·소스 중심 미국·유럽 확장.",
    companies: ["097950", "280360"],
    metric: "CJ 해외식품 매출 비중 50%+",
  },
  {
    id: "n12",
    layerId: "L4",
    name: "음료 · 주류",
    status: "neutral",
    note: "내수 중심, 제로탄산 성장세 유지. 소주 해외 수출 점진적 증가.",
    companies: ["005300", "005180"],
    metric: "",
  },
  {
    id: "n13",
    layerId: "L4",
    name: "K-패션 브랜드",
    status: "caution",
    note: "F&F MLB 중국 성장률 둔화, 내셔널지오그래픽 국내 시장 피크아웃 우려. 내수 의류 소비 부진과 맞물림.",
    companies: ["383220", "298540", "081660", "020000"],
    metric: "",
  },
  {
    id: "n14",
    layerId: "L4",
    name: "생활용품 · 홈케어",
    status: "neutral",
    note: "필수재 방어력, 카테고리 성장성은 제한적.",
    companies: ["051900", "018250"],
    metric: "",
  },

  /* ---------------- L5 유통·플랫폼 ---------------- */
  {
    id: "n15",
    layerId: "L5",
    name: "H&B (올리브영)",
    status: "strong-positive",
    note: "국내 H&B 사실상 독점. 인디 K뷰티 런칭·성장 채널이자 인바운드 관광객 필수 방문지. IPO 재추진 이슈 지속.",
    companies: ["001040"],
    metric: "올리브영 '25 매출 5조+",
  },
  {
    id: "n16",
    layerId: "L5",
    name: "국내 이커머스",
    status: "strong-positive",
    note: "쿠팡 점유율 확대 지속 · 로켓그로스 · 대만 진출 흑자 전환. 네이버는 쇼핑·AI 결합으로 방어.",
    companies: ["CPNG", "035420", "035720"],
    metric: "쿠팡 활성고객 2,300만+",
  },
  {
    id: "n17",
    layerId: "L5",
    name: "대형마트 · 백화점",
    status: "negative",
    note: "쿠팡·올리브영에 점유 지속 잠식. 이마트 트레이더스 리브랜딩, 롯데쇼핑 구조조정 진행 중이나 매출 성장은 정체.",
    companies: ["139480", "023530", "069960", "004170"],
    metric: "",
  },
  {
    id: "n18",
    layerId: "L5",
    name: "편의점",
    status: "caution",
    note: "점포 포화 · 인구 감소 · 객단가 저하 우려. 신규 출점 경쟁 축소 국면.",
    companies: ["282330", "007070"],
    metric: "",
  },
  {
    id: "n19",
    layerId: "L5",
    name: "면세점",
    status: "negative",
    note: "중국 다이궁 축소 고착. 호텔신라 TR 영업적자 지속, 송객수수료 부담 여전.",
    companies: ["008770", "004170"],
    metric: "TR 영업적자 지속",
  },
  {
    id: "n20",
    layerId: "L5",
    name: "글로벌 이커머스",
    status: "positive",
    note: "아마존 K뷰티 · K푸드 판매 급증, TikTok Shop 미국 K뷰티 매출 주도. Tmall 글로벌 역직구는 회복 약함.",
    companies: ["AMZN", "TT", "BABA"],
    metric: "K뷰티 Amazon US '25 +60%",
  },

  /* ---------------- L6 최종 수요 ---------------- */
  {
    id: "n21",
    layerId: "L6",
    name: "미국 · 유럽 K-Wave",
    status: "strong-positive",
    note: "K뷰티 美 수입 화장품 1위 (일본 추월). K푸드 Z세대 침투, 유럽도 라면·만두·스낵 가속. Sephora · Ulta · Target 입점 확대.",
    companies: [],
    metric: "美 K뷰티 수입 '25 +55%",
  },
  {
    id: "n22",
    layerId: "L6",
    name: "일본 · 동남아 수요",
    status: "strong-positive",
    note: "일본 수입화장품 점유 1위 유지. 동남아 K뷰티·K푸드 충성도 높음. 실리콘투·APR·삼양 모두 동남아 현지 법인 성장.",
    companies: [],
    metric: "일본 K뷰티 점유 25%+",
  },
  {
    id: "n23",
    layerId: "L6",
    name: "중국 수요",
    status: "negative",
    note: "로컬 브랜드 굴기(프로야 · 위노나) · 더우인 알고리즘이 K브랜드 노출 축소. 회복 지연 장기화 시나리오.",
    companies: [],
    metric: "",
  },
  {
    id: "n24",
    layerId: "L6",
    name: "국내 소비",
    status: "caution",
    note: "고금리 · 가계부채 · 고물가 삼중고. 필수소비재 외 선택소비 위축. 면세·백화점·의류 체감 약세.",
    companies: [],
    metric: "내수 소매판매 YoY 마이너스",
  },
  {
    id: "n25",
    layerId: "L6",
    name: "인바운드 관광",
    status: "positive",
    note: "방한 외국인 2,000만명 돌파 · 일본·동남아 비중 확대. 화장품·편의점·면세점(일부 회복)·K팝 굿즈 수혜.",
    companies: [],
    metric: "방한 외국인 '25 20M+",
  },
];

const INITIAL_EDGES = [
  // L1 → L3
  { id: "e1", from: "n1", to: "n6" },
  { id: "e2", from: "n2", to: "n10" },
  { id: "e3", from: "n2", to: "n11" },
  { id: "e4", from: "n3", to: "n7" },
  { id: "e5", from: "n3", to: "n13" },
  // L2 → L3 / L4
  { id: "e6", from: "n4", to: "n6" },
  { id: "e7", from: "n4", to: "n8" },
  { id: "e8", from: "n5", to: "n10" },
  { id: "e9", from: "n5", to: "n11" },
  { id: "e10", from: "n5", to: "n14" },
  // L3 → L4
  { id: "e11", from: "n6", to: "n8" },
  { id: "e12", from: "n6", to: "n9" },
  { id: "e13", from: "n7", to: "n13" },
  // L4 → L5
  { id: "e14", from: "n8", to: "n15" },
  { id: "e15", from: "n8", to: "n16" },
  { id: "e16", from: "n8", to: "n20" },
  { id: "e17", from: "n9", to: "n15" },
  { id: "e18", from: "n9", to: "n17" },
  { id: "e19", from: "n9", to: "n19" },
  { id: "e20", from: "n10", to: "n16" },
  { id: "e21", from: "n10", to: "n17" },
  { id: "e22", from: "n10", to: "n18" },
  { id: "e23", from: "n10", to: "n20" },
  { id: "e24", from: "n11", to: "n16" },
  { id: "e25", from: "n11", to: "n17" },
  { id: "e26", from: "n11", to: "n20" },
  { id: "e27", from: "n12", to: "n17" },
  { id: "e28", from: "n12", to: "n18" },
  { id: "e29", from: "n13", to: "n16" },
  { id: "e30", from: "n13", to: "n17" },
  { id: "e31", from: "n14", to: "n17" },
  { id: "e32", from: "n14", to: "n18" },
  // L5 → L6
  { id: "e33", from: "n15", to: "n24" },
  { id: "e34", from: "n15", to: "n25" },
  { id: "e35", from: "n16", to: "n24" },
  { id: "e36", from: "n17", to: "n24" },
  { id: "e37", from: "n18", to: "n24" },
  { id: "e38", from: "n19", to: "n23" },
  { id: "e39", from: "n19", to: "n25" },
  { id: "e40", from: "n20", to: "n21" },
  { id: "e41", from: "n20", to: "n22" },
  { id: "e42", from: "n20", to: "n23" },
];

/* ============================ THEME TOKENS ============================ */
const T = {
  bg: "#ffffff",
  bgCard: "#ffffff",
  bgPanel: "#fafafa",
  bgSubtle: "#f5f5f5",
  border: "#d4d4d4",
  borderHover: "#737373",
  borderActive: "#262626",
  text1: "#171717",
  text2: "#404040",
  text3: "#737373",
  text4: "#a3a3a3",
  accent: "#262626",
};

const STATUSES = [
  { id: "strong-positive", label: "Strong +", color: "#166534" },
  { id: "positive", label: "Positive", color: "#4d7c0f" },
  { id: "neutral", label: "Neutral", color: "#525252" },
  { id: "caution", label: "Caution", color: "#b45309" },
  { id: "negative", label: "Negative", color: "#991b1b" },
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
            placeholder="해외매출 +40% 같은 핵심 숫자 한 줄"
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
                    <option>KOSPI</option><option>KOSDAQ</option><option>NASDAQ</option><option>NYSE</option><option>TSE</option><option>HKEX</option><option>PRIVATE</option>
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
export default function ConsumerChainEditor({ initialData = null, onChange = null } = {}) {
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
                sector · consumer · kr + global
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
              종합 소비재{" "}
              <span
                className="italic"
                style={{
                  color: T.text3,
                  fontSize: "32px",
                }}
              >
                Consumer Goods
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
