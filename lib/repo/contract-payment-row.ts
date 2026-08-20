/**
 * Layer: repo — 02 계약수납관리 행 ↔ ContractPayment 순수 변환 (contract-payment.ts 에서 분리 —
 * 500줄 캡, BBE-246 이 cpToFullRow 추가로 캡 초과시켜 R3-3 잔여 분리 선례(-link/-sync/-termination)
 * 와 같은 이유로 뗐다). googleapis 비의존 — 시트 셀 배열 ↔ 타입 변환만 담당.
 */
import { ContractPayment, type PaymentSlot, Progress } from "@/types";

// ── 시트 직렬값 ↔ 표시값 변환 ──────────────────────────────────
export function serialToISODate(v: unknown): string {
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return toISO(d);
    return v;
  }
  if (typeof v === "number") {
    const ms = (v - 25569) * 86_400_000;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return "";
    return toISO(d);
  }
  return "";
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "y" || s === "ㅇ" || s === "1" || s === "✓") return true;
    return false;
  }
  if (typeof v === "number") return v !== 0;
  return false;
}

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[₩,]/g, "").trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

/** 체크박스 write — true→"ㅇ", false→"". 시트의 한글 표기 유지. */
function boolToCheck(b: boolean): string {
  return b ? "ㅇ" : "";
}

/** 진행률 read — 시트 셀이 "100%"/"60%" 텍스트 또는 숫자(0.6)일 수 있음.
 *  Progress enum 값으로 정규화. unmatched는 빈 문자열로. */
function toProgress(v: unknown): Progress {
  if (typeof v === "number" && Number.isFinite(v)) {
    // 0~1 범위 (셀 서식 = 백분율) 또는 0~100 범위 모두 허용
    const pct = v <= 1 ? Math.round(v * 100) : Math.round(v);
    const candidate = `${pct}%`;
    const parsed = Progress.safeParse(candidate);
    return parsed.success ? parsed.data : "";
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "") return "";
    // "100%" 그대로 일치
    const parsed = Progress.safeParse(s);
    if (parsed.success) return parsed.data;
    // "100" → "100%" 보정
    const numOnly = Progress.safeParse(`${s}%`);
    if (numOnly.success) return numOnly.data;
    return "";
  }
  return "";
}

// ── A~AD 한 행을 ContractPayment 객체로 ───────────────────────
export function rowToCP(r: unknown[], rowNumber: number): ContractPayment | null {
  // C/D/E (계약일/업체명/수임비) 중 하나라도 의미있게 채워진 row만 인정.
  // 시트에 미리 박혀있는 F~L 체크박스 data validation의 기본값(FALSE)이나
  // M~AD 슬롯의 default 0 으로는 row 인정 X — "(업체명 없음)" phantom row 방지.
  // (round-trip 검증에서 발견된 이슈 — fix/contract-payment-empty-rows)
  const 계약일Cell = toStr(r[2]).trim();
  const 업체명Cell = toStr(r[3]).trim();
  const 수임비Cell = toNum(r[4]);
  const hasMeaningfulContent =
    계약일Cell !== "" || 업체명Cell !== "" || 수임비Cell > 0;
  if (!hasMeaningfulContent) return null;

  // 컬럼 인덱스 (A=0..., AE=30, AF=31, AG=32, AH=33).
  // 슬롯 데이터: M=12 / S=18 / Y=24, 각 6필드.
  // 슬롯 메모 (2026-05-17): AF=31 / AG=32 / AH=33.
  const slot = (start: number, memoCol: number): PaymentSlot => ({
    진행기관: toStr(r[start]),
    진행률: toProgress(r[start + 1]),
    현황: toStr(r[start + 2]),
    승인금액: toNum(r[start + 3]),
    수납액: toNum(r[start + 4]),
    수납일: serialToISODate(r[start + 5]),
    메모: toStr(r[memoCol]),
  });

  const parsed = ContractPayment.safeParse({
    row: rowNumber,
    계약일: serialToISODate(r[2]),
    업체명: toStr(r[3]),
    수임비: toNum(r[4]),
    공동인증서: toBool(r[5]),
    임대차계약서: toBool(r[6]),
    신분증: toBool(r[7]),
    드라이브업로드: toBool(r[8]),
    사업계획서초안발송: toBool(r[9]),
    컨설팅5종서류발송: toBool(r[10]),
    플러그이관: toBool(r[11]),
    수납1: slot(12, 31), // M~R + AF
    수납2: slot(18, 32), // S~X + AG
    수납3: slot(24, 33), // Y~AD + AH
    로드맵메모: toStr(r[30]), // AE
    구분: toStr(r[34]).trim(), // AI — 이월 깃발 (arena-carryover §3)
    이월원본행id: toStr(r[35]).trim(), // AJ
    linkedMeetingId: toStr(r[36]).trim(), // AK — 연결 미팅 id
    // AL~AO 계약해지 (contract-termination) — 쓰기는 contract-payment-termination.ts
    해지일: serialToISODate(r[37]), // AL
    해지사유: toStr(r[38]), // AM
    반환액: toNum(r[39]), // AN
    해지숨김: toBool(r[40]), // AO ("Y"|빈값)
  });
  return parsed.success ? parsed.data : null;
}

// ── ContractPayment → A~AH 셀 배열 (34 컬럼, 2026-05-17 v3) ──────
// 변경: 카드 메모사항(AF) 제거 → 슬롯별 메모 (AF/AG/AH) 도입.
export function cpToRow(cp: ContractPayment): (string | number | boolean)[] {
  const out = new Array(34).fill(""); // A~AH = 34 컬럼
  // A 공란, B 순번 — 빈 문자열 (시트 자동 또는 사용자 책임)
  out[2] = cp.계약일;
  out[3] = cp.업체명;
  out[4] = cp.수임비;
  // F~L 체크박스 7개 — "ㅇ"/"" 표기
  out[5] = boolToCheck(cp.공동인증서);
  out[6] = boolToCheck(cp.임대차계약서);
  out[7] = boolToCheck(cp.신분증);
  out[8] = boolToCheck(cp.드라이브업로드);
  out[9] = boolToCheck(cp.사업계획서초안발송);
  out[10] = boolToCheck(cp.컨설팅5종서류발송);
  out[11] = boolToCheck(cp.플러그이관);
  // 수납1 (M~R = 12~17): 진행기관/진행률/현황/승인금액/수납액/수납일
  out[12] = cp.수납1.진행기관;
  out[13] = cp.수납1.진행률;
  out[14] = cp.수납1.현황;
  out[15] = cp.수납1.승인금액;
  out[16] = cp.수납1.수납액;
  out[17] = cp.수납1.수납일;
  // 수납2 (S~X = 18~23)
  out[18] = cp.수납2.진행기관;
  out[19] = cp.수납2.진행률;
  out[20] = cp.수납2.현황;
  out[21] = cp.수납2.승인금액;
  out[22] = cp.수납2.수납액;
  out[23] = cp.수납2.수납일;
  // 수납3 (Y~AD = 24~29)
  out[24] = cp.수납3.진행기관;
  out[25] = cp.수납3.진행률;
  out[26] = cp.수납3.현황;
  out[27] = cp.수납3.승인금액;
  out[28] = cp.수납3.수납액;
  out[29] = cp.수납3.수납일;
  // 2026-05-17 v3:
  // AE=30 로드맵메모 (카드)
  // AF=31 / AG=32 / AH=33 슬롯별 메모
  out[30] = cp.로드맵메모;
  out[31] = cp.수납1.메모;
  out[32] = cp.수납2.메모;
  out[33] = cp.수납3.메모;
  return out;
}

/** 숫자/날짜로 오해석될 수 있는 텍스트에 apostrophe 접두어로 plain text 강제.
 *  writeContractRow(AJ·AK) 와 동일 규칙 — USER_ENTERED 에서 멱등 키가 깨지는 사고 방지
 *  (rejoin 카나리아 2026-06-11 실증). */
function textForce(v: string): string {
  return v ? `'${v}` : "";
}

/** ContractPayment → C~AO 전체 행(39컬럼) — 시트 수렴 미러 전용(BBE-246, contract-sheet-sync.ts).
 *  cpToRow(A~AH)에 이월(AI·AJ)·연결id(AK)·해지(AL~AO)를 이어붙인다. */
export function cpToFullRow(cp: ContractPayment): (string | number | boolean)[] {
  const cToAh = cpToRow(cp).slice(2); // A~AH(idx0-33) 중 C~AH(idx2-33) — A/B 는 시트 자동/보존이라 제외
  return [
    ...cToAh,
    cp.구분 ?? "", // AI
    textForce(cp.이월원본행id ?? ""), // AJ
    textForce(cp.linkedMeetingId ?? ""), // AK
    cp.해지일, // AL
    cp.해지사유, // AM
    cp.반환액, // AN
    cp.해지숨김 ? "Y" : "", // AO
  ];
}
