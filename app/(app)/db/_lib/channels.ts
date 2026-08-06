/**
 * DB관리 4채널 메타데이터.
 * 정본: docs/design/prototypes/db-management.html v11 — `CHANNELS` 객체 1:1 매핑.
 */
import { unitPriceFromTotal } from "@/lib/pricing";
import { formatMoney } from "@/lib/format/money";

export type ChannelKey = "purchase" | "direct" | "banner" | "referral";

/** phone = 연락처 — 자동 하이픈 입력(PhoneInput). setField 는 number 만 캐스트하므로 문자열 유지. */
export type FieldType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "toggle"
  | "phone";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  unit?: string; // "원", "건", "장"
  placeholder?: string;
  options?: readonly string[]; // for select
  formula?: boolean; // 자동 계산값 — 입력 X (시트 수식 또는 클라 역산)
  /** 입력 도우미 전용 — DB 컬럼 아님(저장 시 제외). 예: 부가세 역산용 총액·토글. */
  formOnly?: boolean;
  /** 추가(생산 시작) 폼에선 숨김 — 2단계용(직접생산 생산개수는 완료 시 입력). */
  hideInAdd?: boolean;
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
      // 부가세 역산: 총액+개수+부가세토글 → 개당단가. 총액은 입력 도우미(저장 X),
      // 부가세여부는 H열에 저장(재편집 시 토글 복원).
      { key: "총액", label: "결제 총액", type: "number", unit: "원", formOnly: true, placeholder: "실제 결제한 금액" },
      { key: "부가세여부", label: "부가세 포함 금액", type: "toggle" },
      { key: "주문개수", label: "주문개수", type: "number", unit: "건" },
      {
        key: "개당단가",
        label: "부가세 제외 개당단가",
        type: "number",
        unit: "원",
        formula: true,
        calc: (r) =>
          unitPriceFromTotal(num(r, "총액"), num(r, "주문개수"), Boolean(r["부가세여부"])),
      },
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
      // 생산개수(M)는 입력칸 없음 — 컨택 유입 저장 시 그 기간 유입합으로 자동 동기화(ADR-0024).
      { key: "시작일", label: "생산 시작일", type: "date" },
      { key: "종료일", label: "생산 종료일", type: "date" },
      { key: "소재", label: "소재", type: "text", placeholder: "예: 메타, 구글" },
      // 부가세 역산: 예산입력+부가세토글 → 부가세 제외 기간예산(저장). 예산입력은 도우미(저장 X).
      { key: "예산입력", label: "기간예산", type: "number", unit: "원", formOnly: true, placeholder: "집행 예산" },
      { key: "부가세여부", label: "부가세 포함 금액", type: "toggle" },
      {
        key: "기간예산",
        label: "부가세 제외 기간예산",
        type: "number",
        unit: "원",
        formula: true,
        calc: (r) => unitPriceFromTotal(num(r, "예산입력"), 1, Boolean(r["부가세여부"])),
      },
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
      // 부가세 역산(매입DB와 동일): 총액+장수+부가세토글 → 장당단가. 총액은 입력 도우미(저장 X).
      { key: "총액", label: "결제 총액", type: "number", unit: "원", formOnly: true, placeholder: "실제 결제한 금액" },
      { key: "부가세여부", label: "부가세 포함 금액", type: "toggle" },
      { key: "주문개수", label: "주문개수", type: "number", unit: "장" },
      {
        key: "개당단가",
        label: "부가세 제외 개당단가",
        type: "number",
        unit: "원",
        formula: true,
        calc: (r) =>
          unitPriceFromTotal(num(r, "총액"), num(r, "주문개수"), Boolean(r["부가세여부"])),
      },
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
      { key: "연락처", label: "연락처", type: "phone", placeholder: "010-0000-0000" },
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

/**
 * 금액 표시 — 공용 `formatMoney` 별칭(중복 구현 제거, PR-1 부품이 단일 원천).
 * 기존 호출부(OverallCard·RowCard·RowForm·SummaryCard) 호환 위해 이름 유지.
 */
export const fmtWon = formatMoney;

/** 풀 ISO(YYYY-MM-DD) → 짧은 M/D 표기 (모바일 카드 sub줄 절약). 비ISO는 원문 유지. */
export function mdShort(iso: string | null | undefined): string {
  const s = String(iso ?? "");
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(s);
  return m ? `${Number(m[1])}/${Number(m[2])}` : s;
}

/**
 * RowCard 의 React key — 채널까지 포함해 유일하게 만든다.
 *
 * 배경(BBE-79, 2026-08-06): 4채널(매입DB/직접생산/현수막/콜·지·기·소)이 `lib/repo/db.ts`
 * 의 같은 기본 `firstDataRow` 를 공유해 row 번호가 채널 간에 우연히 겹친다(각 채널 1건씩만
 * 입력해도 발생). `row` 숫자만 key 로 쓰면 채널 전환 시 React 가 이전 채널의 RowCard/RowForm
 * 인스턴스를 재사용(리마운트 안 함) → 마운트 1회만 초기화되는 draft state 가 이전 채널 필드값을
 * 그대로 들고 있어 거짓 dirty·얼어붙은 이탈가드가 재현되고, 저장 시 이전 채널 값이 새 채널
 * row 에 PATCH 될 위험까지 있었다(#596 재검증에서 발굴). 채널을 key 에 포함시키면 채널이
 * 바뀔 때마다 React 가 전체 리마운트해 draft 가 항상 신선하게 초기화된다.
 */
export function dbRowKey(chKey: ChannelKey, row: number): string {
  return `${chKey}-${row}`;
}
