/**
 * DB관리 4채널 메타데이터.
 * 정본: docs/design/prototypes/db-management.html v11 — `CHANNELS` 객체 1:1 매핑.
 */
export type ChannelKey = "purchase" | "direct" | "banner" | "referral";

export type FieldType = "text" | "number" | "date" | "select";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  unit?: string; // "원", "건", "장"
  placeholder?: string;
  options?: readonly string[]; // for select
  formula?: boolean; // 시트 자동 수식 — 입력 X
  /** 폼 grid에서 2칸 차지. */
  span?: 2;
  /** 클라이언트 미리보기 계산식 (formula=true일 때). */
  calc?: (row: Record<string, unknown>) => number;
}

export interface ChannelMeta {
  name: string;
  cls: "purchase" | "direct" | "banner" | "referral";
  color: string;
  bgLight: string;
  borderLight: string;
  textDark: string;
  /** 채널별 "목록" 자연어 (구매목록 / 생산목록 / 제작목록 / 영업기회). */
  recordsLabel: string;
  countUnit: string;
  hint: string;
  isCost: boolean;
  fields: readonly FieldDef[];
}

const num = (r: Record<string, unknown>, k: string): number =>
  Number(r[k] ?? 0) || 0;

export const CHANNELS: Record<ChannelKey, ChannelMeta> = {
  purchase: {
    name: "매입DB",
    cls: "purchase",
    color: "#1d4ed8",
    bgLight: "#eff6ff",
    borderLight: "#bfdbfe",
    textDark: "#1d4ed8",
    recordsLabel: "구매목록",
    countUnit: "건",
    hint: "외부에서 매입한 DB 비용",
    isCost: true,
    fields: [
      { key: "구매일", label: "구매일", type: "date" },
      { key: "업체명", label: "업체명", type: "text", placeholder: "예: 디비딩프로" },
      { key: "개당단가", label: "부가세 제외 개당단가", type: "number", unit: "원" },
      { key: "주문개수", label: "주문개수", type: "number", unit: "건" },
      {
        key: "주문금액",
        label: "부가세 제외 주문금액",
        type: "number",
        unit: "원",
        formula: true,
        calc: (r) => num(r, "개당단가") * num(r, "주문개수"),
      },
      { key: "기타", label: "기타", type: "text", placeholder: "메모", span: 2 },
    ],
  },
  direct: {
    name: "직접생산",
    cls: "direct",
    color: "#16a34a",
    bgLight: "#f0fdf4",
    borderLight: "#bbf7d0",
    textDark: "#15803d",
    recordsLabel: "생산목록",
    countUnit: "건",
    hint: "광고비·메타 등 직접 집행 비용",
    isCost: true,
    fields: [
      { key: "날짜", label: "날짜", type: "date" },
      { key: "소재", label: "소재", type: "text", placeholder: "예: 메타, 구글" },
      { key: "기간예산", label: "기간예산", type: "number", unit: "원" },
      { key: "생산개수", label: "생산개수", type: "number", unit: "건" },
      {
        key: "개당단가",
        label: "부가세 제외 개당단가",
        type: "number",
        unit: "원",
        formula: true,
        calc: (r) => {
          const b = num(r, "기간예산"),
            c = num(r, "생산개수");
          return c > 0 ? Math.round(b / c) : 0;
        },
      },
      { key: "기타", label: "기타", type: "text", placeholder: "메모", span: 2 },
    ],
  },
  banner: {
    name: "현수막",
    cls: "banner",
    color: "#d97706",
    bgLight: "#fffbeb",
    borderLight: "#fde68a",
    textDark: "#b45309",
    recordsLabel: "제작목록",
    countUnit: "장",
    hint: "현수막 제작 및 배송 비용",
    isCost: true,
    fields: [
      { key: "날짜", label: "발주일", type: "date" },
      { key: "업체명", label: "업체명", type: "text", placeholder: "예: (주)코리아광고" },
      { key: "도착일", label: "도착일", type: "date" },
      { key: "개당단가", label: "부가세 제외 개당단가", type: "number", unit: "원" },
      { key: "주문개수", label: "주문개수", type: "number", unit: "장" },
      {
        key: "주문금액",
        label: "부가세 제외 주문금액",
        type: "number",
        unit: "원",
        formula: true,
        calc: (r) => num(r, "개당단가") * num(r, "주문개수"),
      },
      { key: "기타", label: "기타", type: "text", placeholder: "메모", span: 2 },
    ],
  },
  referral: {
    name: "콜·지·기·소",
    cls: "referral",
    color: "#7c3aed",
    bgLight: "#faf5ff",
    borderLight: "#e9d5ff",
    textDark: "#7c3aed",
    recordsLabel: "영업기회",
    countUnit: "건",
    hint: "콜드콜·지인·기고객·소개 등의 영업기회",
    isCost: false,
    fields: [
      {
        key: "구분",
        label: "구분",
        type: "select",
        options: ["콜드콜", "지인", "기고객", "소개"],
      },
      { key: "접수일", label: "접수일", type: "date" },
      { key: "대표자명", label: "대표자명", type: "text", placeholder: "예: 김믿음" },
      { key: "업체명", label: "업체명", type: "text", placeholder: "예: ㈜에이스" },
      { key: "소개처", label: "소개처", type: "text", placeholder: "예: 잠실" },
      { key: "연락처", label: "연락처", type: "text", placeholder: "010-0000-0000" },
      { key: "조건", label: "조건", type: "text", placeholder: "메모", span: 2 },
    ],
  },
};

export const CHANNEL_KEYS: readonly ChannelKey[] = [
  "purchase",
  "direct",
  "banner",
  "referral",
];

/** ChannelKey ↔ 백엔드 한글 채널명 (API 경로용). */
export const KEY_TO_BACKEND: Record<
  ChannelKey,
  "매입DB" | "직접생산" | "현수막" | "콜·지·기·소"
> = {
  purchase: "매입DB",
  direct: "직접생산",
  banner: "현수막",
  referral: "콜·지·기·소",
};

// ── 합계 계산 (prototype의 summarize 함수 1:1 포팅) ─────────────
export function summarizeCost(
  ch: ChannelKey,
  rows: Array<Record<string, unknown>>,
): {
  totalCost: number;
  totalCount: number;
  avgUnit: number;
  unitLabel: string;
} {
  if (ch === "direct") {
    const totalCost = rows.reduce((s, r) => s + num(r, "기간예산"), 0);
    const totalCount = rows.reduce((s, r) => s + num(r, "생산개수"), 0);
    const avgUnit = totalCount > 0 ? Math.round(totalCost / totalCount) : 0;
    return { totalCost, totalCount, avgUnit, unitLabel: "건" };
  }
  // purchase / banner: 개당단가 × 주문개수
  const totalCost = rows.reduce(
    (s, r) => s + num(r, "개당단가") * num(r, "주문개수"),
    0,
  );
  const totalCount = rows.reduce((s, r) => s + num(r, "주문개수"), 0);
  const avgUnit = totalCount > 0 ? Math.round(totalCost / totalCount) : 0;
  return {
    totalCost,
    totalCount,
    avgUnit,
    unitLabel: ch === "banner" ? "장" : "건",
  };
}

export function fmtWon(n: number | null | undefined): string {
  if (n === null || n === undefined) return "0";
  return Math.round(Number(n) || 0).toLocaleString("ko-KR");
}
