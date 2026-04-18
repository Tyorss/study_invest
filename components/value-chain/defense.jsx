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
  { id: "L1", name: "소재 · 탄약 · 장갑재", order: 0, isCenter: false },
  { id: "L2", name: "센서 · 전자 · 엔진", order: 1, isCenter: false },
  { id: "L3", name: "완성체계 Prime", order: 2, isCenter: true },
  { id: "L4", name: "무기 플랫폼 · 프로그램", order: 3, isCenter: false },
  { id: "L5", name: "수출 · 국방 고객", order: 4, isCenter: false },
  { id: "L6", name: "매크로 · 재무장 사이클", order: 5, isCenter: false },
];

const INITIAL_COMPANIES = {
  // Prime integrators
  "012450": { ticker: "012450", name: "한화에어로스페이스", market: "KOSPI" },
  "272210": { ticker: "272210", name: "한화시스템", market: "KOSPI" },
  "042660": { ticker: "042660", name: "한화오션", market: "KOSPI" },
  "064350": { ticker: "064350", name: "현대로템", market: "KOSPI" },
  "079550": { ticker: "079550", name: "LIG넥스원", market: "KOSPI" },
  "047810": { ticker: "047810", name: "한국항공우주", market: "KOSPI" },
  "329180": { ticker: "329180", name: "HD현대중공업", market: "KOSPI" },
  // Materials / ammo
  "103140": { ticker: "103140", name: "풍산", market: "KOSPI" },
  "004020": { ticker: "004020", name: "현대제철", market: "KOSPI" },
  "003570": { ticker: "003570", name: "SNT다이내믹스", market: "KOSPI" },
  // Subsystems & electronics
  "005870": { ticker: "005870", name: "휴니드", market: "KOSPI" },
  "065450": { ticker: "065450", name: "빅텍", market: "KOSDAQ" },
  "189300": { ticker: "189300", name: "인텔리안테크", market: "KOSDAQ" },
  "214430": { ticker: "214430", name: "아이쓰리시스템", market: "KOSDAQ" },
  "361390": { ticker: "361390", name: "제노코", market: "KOSDAQ" },
  "484870": { ticker: "484870", name: "엠앤씨솔루션", market: "KOSPI" },
  "010820": { ticker: "010820", name: "퍼스텍", market: "KOSDAQ" },
  "077970": { ticker: "077970", name: "STX엔진", market: "KOSPI" },
  // Global primes
  LMT: { ticker: "LMT", name: "Lockheed Martin", market: "NYSE" },
  RTX: { ticker: "RTX", name: "RTX (Raytheon)", market: "NYSE" },
  GD: { ticker: "GD", name: "General Dynamics", market: "NYSE" },
  NOC: { ticker: "NOC", name: "Northrop Grumman", market: "NYSE" },
  RHM: { ticker: "RHM", name: "Rheinmetall", market: "XETRA" },
  BA: { ticker: "BA", name: "Boeing Defense", market: "NYSE" },
};

const INITIAL_NODES = [
  /* ---------------- L1: 소재 · 탄약 · 장갑재 ---------------- */
  {
    id: "n1",
    layerId: "L1",
    name: "탄약 · 화약 · 추진제",
    status: "strong-positive",
    note: "우크라 155mm 포탄 재고 소진 → 서방 구조적 증설. 풍산 수주잔고 사상 최대, 한화 Chunmoo 로켓탄 폴란드 공급.",
    companies: ["103140", "012450"],
    metric: "풍산 '26E 방산 OPM 15%+",
  },
  {
    id: "n2",
    layerId: "L1",
    name: "특수강 · 장갑재",
    status: "neutral",
    note: "전차·자주포·함정용 장갑판. 철강 본업 약세에 방산 비중 아직 작음. 내수 중심.",
    companies: ["004020"],
    metric: "",
  },
  {
    id: "n3",
    layerId: "L1",
    name: "화포 · 구동부품",
    status: "positive",
    note: "K9 포신, K2 포탑 구동 등. 수출 물량 동반 확대. 산업용 엔진·변속기 겸영.",
    companies: ["003570"],
    metric: "",
  },

  /* ---------------- L2: 센서 · 전자 · 엔진 ---------------- */
  {
    id: "n4",
    layerId: "L2",
    name: "AESA 레이더",
    status: "strong-positive",
    note: "KF-21 탑재 AESA 국산화 양산. FFX Batch-III 함정용 다기능 레이더. 방공레이더 수출 확대.",
    companies: ["272210", "079550"],
    metric: "",
  },
  {
    id: "n5",
    layerId: "L2",
    name: "전자광학 · 적외선 센서",
    status: "positive",
    note: "감시·정찰·표적 추적 모듈. 아이쓰리시스템 IR 검출기 국산화, 수리온·무인기 탑재.",
    companies: ["272210", "214430"],
    metric: "",
  },
  {
    id: "n6",
    layerId: "L2",
    name: "전술통신 · C4I · 전자전",
    status: "positive",
    note: "육군 전술정보통신체계(TICN) 양산. 빅텍 전자전·통신 장비. 상대적 저평가 구간.",
    companies: ["005870", "065450"],
    metric: "",
  },
  {
    id: "n7",
    layerId: "L2",
    name: "위성 · 광대역 안테나",
    status: "positive",
    note: "저궤도 위성 군통신, 정찰위성 지상국. 인텔리안테크 LEO 안테나, 제노코 군용 단말.",
    companies: ["189300", "361390"],
    metric: "",
  },
  {
    id: "n8",
    layerId: "L2",
    name: "유도장치 · 구동 · 추진",
    status: "positive",
    note: "미사일 구동부, 신관, 추진기관. 천궁·현궁 수출 확대로 간접 수혜.",
    companies: ["484870", "010820"],
    metric: "",
  },
  {
    id: "n9",
    layerId: "L2",
    name: "항공 · 함정 엔진",
    status: "positive",
    note: "KF-21 엔진 면허생산, 수리온 엔진, 함정용 디젤. KF-21 엔진 국산화 R&D 가속.",
    companies: ["012450", "077970"],
    metric: "",
  },

  /* ---------------- L3: 완성체계 Prime (CENTER) ---------------- */
  {
    id: "n10",
    layerId: "L3",
    name: "전차 · 장갑 Prime",
    status: "strong-positive",
    note: "K2 흑표 플랫폼 독점. 폴란드 2차 실행계약 체결로 장기 공급 가시화. 중동·동유럽 추가 기회.",
    companies: ["064350"],
    metric: "현대로템 방산 수주잔고 15조+",
  },
  {
    id: "n11",
    layerId: "L3",
    name: "자주포 · 장갑차 Prime",
    status: "strong-positive",
    note: "K9 글로벌 자주포 점유율 ~50%. 호주 Redback(AS21) 양산, 루마니아·이집트 공급. 우주·엔진 사업 병행.",
    companies: ["012450"],
    metric: "한화에어로 '26E OP 2조+",
  },
  {
    id: "n12",
    layerId: "L3",
    name: "항공기 Prime",
    status: "strong-positive",
    note: "KF-21 보라매 체계개발 완료·최초양산 진입. FA-50 폴란드·이집트·말레이시아 납품. 수리온·LAH.",
    companies: ["047810"],
    metric: "KAI 수주잔고 30조+ 지속 갱신",
  },
  {
    id: "n13",
    layerId: "L3",
    name: "수상함 Prime",
    status: "positive",
    note: "FFX Batch-III 차세대 호위함, KDDX 차세대 구축함 경쟁. 양사 분할 수주 구도.",
    companies: ["329180", "042660"],
    metric: "",
  },
  {
    id: "n14",
    layerId: "L3",
    name: "잠수함 Prime",
    status: "strong-positive",
    note: "장보고-III Batch-II 연속 건조. 캐나다 CPSP, 폴란드 Orka 수주 경쟁 본격화. 건당 조 단위 딜.",
    companies: ["042660"],
    metric: "캐나다 CPSP 프로젝트 $20B 잠재",
  },
  {
    id: "n15",
    layerId: "L3",
    name: "유도무기 Prime",
    status: "strong-positive",
    note: "천궁-II(M-SAM) 사우디·UAE·이라크 수출. 현궁·해궁·L-SAM 라인업. 한국형 미사일방어의 핵심.",
    companies: ["079550"],
    metric: "LIG넥스원 수주잔고 20조+",
  },

  /* ---------------- L4: 무기 플랫폼 · 프로그램 ---------------- */
  {
    id: "n16",
    layerId: "L4",
    name: "K2 흑표 프로그램",
    status: "strong-positive",
    note: "폴란드 1차 180대 인도 진행, 2차 실행계약(~820대) 본계약 체결. 루마니아·중동 후속 파이프라인.",
    companies: ["064350"],
    metric: "폴란드 2차 계약 ~$6B 규모",
  },
  {
    id: "n17",
    layerId: "L4",
    name: "K9 · Chunmoo 프로그램",
    status: "strong-positive",
    note: "K9 누적 수출 10개국 돌파. Chunmoo(다연장) 폴란드 신규 시장. 루마니아·이집트 K9 실행 단계.",
    companies: ["012450"],
    metric: "",
  },
  {
    id: "n18",
    layerId: "L4",
    name: "FA-50 · KF-21 프로그램",
    status: "strong-positive",
    note: "FA-50 이집트·말레이 진출. KF-21 인니 공동개발 지분 조정 지속. 미국 T-7 협력 논의.",
    companies: ["047810"],
    metric: "FA-50 글로벌 수요 파이프라인 200+기",
  },
  {
    id: "n19",
    layerId: "L4",
    name: "천궁-II · L-SAM",
    status: "strong-positive",
    note: "사우디 4.25B 체결. UAE·이라크 후속. L-SAM 전력화로 한국형 3축 체계 완성.",
    companies: ["079550"],
    metric: "천궁-II 수출 누적 ~$10B",
  },
  {
    id: "n20",
    layerId: "L4",
    name: "장보고-III · 함정 수출",
    status: "positive",
    note: "캐나다·폴란드 잠수함, 필리핀 초계함, 페루 프리깃 등. 독일 TKMS와 글로벌 양강 구도.",
    companies: ["042660", "329180"],
    metric: "",
  },

  /* ---------------- L5: 수출 · 국방 고객 ---------------- */
  {
    id: "n21",
    layerId: "L5",
    name: "국내 방위력개선",
    status: "positive",
    note: "국방예산 60조+ 유지, 방위력개선비 비중 33%+. K-방산의 베이스 수요. 3축 체계·무인·우주 집중.",
    companies: [],
    metric: "'26 국방예산 증가율 +4~5%",
  },
  {
    id: "n22",
    layerId: "L5",
    name: "폴란드",
    status: "strong-positive",
    note: "2022 Framework $14.5B+. 2차 실행 체결분 포함 누적 $20B 규모. 현지 생산·기술이전 단계 진입.",
    companies: ["064350", "012450", "047810"],
    metric: "",
  },
  {
    id: "n23",
    layerId: "L5",
    name: "중동 (사우디 · UAE · 이라크)",
    status: "strong-positive",
    note: "사우디 천궁-II $4.2B, UAE $3.5B, 이라크 추가. 방공망 패키지 + 탄약 재충전 장기 모멘텀.",
    companies: ["079550", "272210"],
    metric: "",
  },
  {
    id: "n24",
    layerId: "L5",
    name: "동남아 · 호주",
    status: "positive",
    note: "호주 Redback $2.4B 양산, 필리핀 FA-50·초계함, 말레이시아 FA-50M, 인니 KF-21 지분 참여.",
    companies: ["012450", "047810", "042660"],
    metric: "",
  },
  {
    id: "n25",
    layerId: "L5",
    name: "유럽 (루마니아 · 노르웨이 · 영국)",
    status: "positive",
    note: "루마니아 K9 ~$1B, K2 협상. 노르웨이 K9 기 도입. NATO 인증·현지화가 관건.",
    companies: ["012450", "064350"],
    metric: "",
  },
  {
    id: "n26",
    layerId: "L5",
    name: "미국 · 공동개발 · MRO",
    status: "positive",
    note: "한화오션 미 해군 MRO 수주(워싱턴급). SM-3·차세대 미사일 공동개발 논의. 미 조선업 재건 수혜.",
    companies: ["042660", "012450", "LMT"],
    metric: "",
  },

  /* ---------------- L6: 매크로 · 재무장 사이클 ---------------- */
  {
    id: "n27",
    layerId: "L6",
    name: "NATO GDP 2%+ 재무장",
    status: "strong-positive",
    note: "NATO 신규 목표 GDP 3% 논의, 유럽 5년 재무장 계획 2조€+. 독일 RHM·한국 동시 수혜 구도.",
    companies: ["RHM", "LMT", "RTX"],
    metric: "유럽 방산 capex 2030까지 +60%",
  },
  {
    id: "n28",
    layerId: "L6",
    name: "우크라이나 전쟁 장기화",
    status: "strong-positive",
    note: "휴전·협정 논의와 별개로 서방 재고 보충·전후 재건 수요 지속. 155mm 포탄·MLRS·방공 핵심.",
    companies: ["RHM", "LMT", "103140"],
    metric: "서방 155mm 생산량 4배+ 증설",
  },
  {
    id: "n29",
    layerId: "L6",
    name: "인태전략 · 중국 견제",
    status: "positive",
    note: "한·미·일 3자 협력, 대만해협 긴장. 호주 AUKUS, 필리핀 EDCA 등 역내 방산 파트너십 확장.",
    companies: ["LMT", "GD", "BA"],
    metric: "",
  },
  {
    id: "n30",
    layerId: "L6",
    name: "자주국방 · 3축 체계",
    status: "positive",
    note: "Kill Chain·KAMD·KMPR 완성형 지향. 유도무기·정찰위성·무인체계에 예산 집중 편성.",
    companies: [],
    metric: "",
  },
];

const INITIAL_EDGES = [
  // L1 → L3
  { id: "e1", from: "n1", to: "n11" },  // 탄약 → 자주포
  { id: "e2", from: "n1", to: "n10" },  // 탄약 → 전차 (포탄)
  { id: "e3", from: "n2", to: "n10" },  // 특수강 → 전차
  { id: "e4", from: "n2", to: "n11" },  // 특수강 → 자주포
  { id: "e5", from: "n2", to: "n13" },  // 특수강 → 수상함
  { id: "e6", from: "n3", to: "n10" },  // 화포 → 전차
  { id: "e7", from: "n3", to: "n11" },  // 화포 → 자주포
  // L2 → L3
  { id: "e8", from: "n4", to: "n12" },  // AESA → 항공 (KF-21)
  { id: "e9", from: "n4", to: "n13" },  // AESA → 수상함
  { id: "e10", from: "n4", to: "n15" }, // AESA → 유도무기
  { id: "e11", from: "n5", to: "n12" }, // EO/IR → 항공
  { id: "e12", from: "n5", to: "n15" }, // EO/IR → 유도무기
  { id: "e13", from: "n6", to: "n10" }, // C4I → 전차
  { id: "e14", from: "n6", to: "n13" }, // C4I → 수상함
  { id: "e15", from: "n7", to: "n13" }, // 위성 → 수상함
  { id: "e16", from: "n7", to: "n12" }, // 위성 → 항공
  { id: "e17", from: "n8", to: "n15" }, // 유도 구동 → 유도무기
  { id: "e18", from: "n9", to: "n12" }, // 엔진 → 항공
  { id: "e19", from: "n9", to: "n13" }, // 엔진 → 수상함
  { id: "e20", from: "n9", to: "n14" }, // 엔진 → 잠수함
  // L3 → L4
  { id: "e21", from: "n10", to: "n16" }, // 전차 → K2
  { id: "e22", from: "n11", to: "n17" }, // 자주포 → K9/Chunmoo
  { id: "e23", from: "n12", to: "n18" }, // 항공 → FA-50/KF-21
  { id: "e24", from: "n14", to: "n20" }, // 잠수함 → 함정 수출
  { id: "e25", from: "n13", to: "n20" }, // 수상함 → 함정 수출
  { id: "e26", from: "n15", to: "n19" }, // 유도무기 → 천궁
  // L4 → L5
  { id: "e27", from: "n16", to: "n22" }, // K2 → 폴란드
  { id: "e28", from: "n17", to: "n22" }, // K9/Chunmoo → 폴란드
  { id: "e29", from: "n17", to: "n25" }, // K9 → 유럽
  { id: "e30", from: "n18", to: "n22" }, // FA-50 → 폴란드
  { id: "e31", from: "n18", to: "n24" }, // FA-50 → 동남아
  { id: "e32", from: "n19", to: "n23" }, // 천궁 → 중동
  { id: "e33", from: "n20", to: "n24" }, // 함정수출 → 동남아
  { id: "e34", from: "n20", to: "n26" }, // 함정수출 → 미국
  { id: "e35", from: "n19", to: "n21" }, // 천궁/L-SAM → 국내
  // L5 → L6
  { id: "e36", from: "n22", to: "n27" }, // 폴란드 → NATO 재무장
  { id: "e37", from: "n22", to: "n28" }, // 폴란드 → 우크라
  { id: "e38", from: "n25", to: "n27" }, // 유럽 → NATO
  { id: "e39", from: "n25", to: "n28" }, // 유럽 → 우크라
  { id: "e40", from: "n23", to: "n27" }, // 중동 → NATO(연계 약하지만 지정학 공통)
  { id: "e41", from: "n24", to: "n29" }, // 동남아·호주 → 인태
  { id: "e42", from: "n26", to: "n29" }, // 미국 → 인태
  { id: "e43", from: "n21", to: "n30" }, // 국내 → 자주국방
  { id: "e44", from: "n21", to: "n29" }, // 국내 → 인태
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
                    <option>KOSPI</option><option>KOSDAQ</option><option>NASDAQ</option><option>NYSE</option><option>XETRA</option><option>LSE</option><option>TSE</option>
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
export default function DefenseChainEditor({ initialData = null, onChange = null } = {}) {
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
              방위산업{" "}
              <span
                className="italic"
                style={{
                  color: T.text3,
                  fontSize: "32px",
                }}
              >
                K-Defense
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
