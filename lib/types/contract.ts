/**
 * Layer: types — 02 계약수납관리 v2 (계약·분할수납). 다른 레이어 import 안 함.
 * index.ts 배럴에서 재수출(2026-07-19, 500줄 캡 분리). 소비자는 `@/types` 유지.
 * SSOT: sheet-structure.md §4 v2 · data-model.md.
 */
import { z } from "zod";

// ── 계약수납 v2 (PR 11 contract-payment-tab) ───────────────────
// 시트 매핑: docs/domains/sheet-structure.md §4 v2 — 02 계약수납관리 A~AD
// 자동 연동: 일정·계약 탭 계약 액션 시 04 업체관리!D/G/L에서 C/D/E
// 사용자 입력: F~L (체크박스 7, "ㅇ"/"" 표기) + M~AD (분할수납 3슬롯 × 6필드)

/** 진행률 dropdown — 시트 N/T/Z 컬럼 data validation과 정확히 일치. */
export const Progress = z.enum([
  "",
  "0%",
  "20%",
  "40%",
  "60%",
  "80%",
  "100%",
]);
export type Progress = z.infer<typeof Progress>;

/** 분할 수납 1 슬롯 (v3, 2026-05-17): 메모 추가 — 총 7필드.
 *  시트 매핑 (수정):
 *    수납1 = M~R + AF (메모)
 *    수납2 = S~X + AG (메모)
 *    수납3 = Y~AD + AH (메모)
 *  - 메모는 슬롯별 별도 컬럼 — 기존 슬롯 stride 깨지지 않게 분리.
 */
export const PaymentSlot = z.object({
  진행기관: z.string().default(""),
  진행률: Progress.default(""),
  현황: z.string().default(""), // UI 라벨: '진행내용' (2026-05-17)
  승인금액: z.number().nonnegative().default(0),
  수납액: z.number().nonnegative().default(0),
  수납일: z.string().default(""), // YYYY-MM-DD 또는 빈 문자열
  /** 슬롯별 메모 — 진행기관 다음 위치 표시 (2026-05-17). 시트 AF/AG/AH. */
  메모: z.string().default(""),
});
export type PaymentSlot = z.infer<typeof PaymentSlot>;

const EMPTY_SLOT: PaymentSlot = {
  진행기관: "",
  진행률: "",
  현황: "",
  승인금액: 0,
  수납액: 0,
  수납일: "",
  메모: "",
};

/** 1 계약 row. row=시트 행번호, 자동연동 3필드 + 체크박스 7 + 수납슬롯 3. */
export const ContractPayment = z.object({
  row: z.number().int().min(3).optional(), // 시트 row (3행~)
  // 자동 연동 (04 업체관리에서)
  계약일: z.string().default(""),
  업체명: z.string().default(""),
  수임비: z.number().nonnegative().default(0),
  // 7 체크박스 (서류 6 + 플러그 이관 1)
  공동인증서: z.boolean().default(false),
  임대차계약서: z.boolean().default(false),
  신분증: z.boolean().default(false),
  드라이브업로드: z.boolean().default(false),
  사업계획서초안발송: z.boolean().default(false),
  컨설팅5종서류발송: z.boolean().default(false),
  플러그이관: z.boolean().default(false),
  // 3 분할 수납 (각 슬롯 메모 포함)
  수납1: PaymentSlot.default(EMPTY_SLOT),
  수납2: PaymentSlot.default(EMPTY_SLOT),
  수납3: PaymentSlot.default(EMPTY_SLOT),
  /** 로드맵 메모 (카드 차원, 슬롯들 위) — 시트 AE. 2026-05-17 재배치. */
  로드맵메모: z.string().default(""),
  // 2026-05-17: 카드 차원 메모사항 제거 — 슬롯별 PaymentSlot.메모 로 이동 (AF/AG/AH).
  /** 이월 깃발 (AI, arena-carryover §3) — "이월"=아레나 집계 제외, 미설정=native. 출발 미팅(04 AO) 상속. */
  구분: z.string().optional(),
  /** 이월 원본행 식별자 (AJ) — 멱등 중복 가드. */
  이월원본행id: z.string().optional(),
  /** 연결 미팅 id (AK, 04 업체관리 A) — 02↔04 매칭 키. 개명·계약일변경에도 링크 유지. */
  linkedMeetingId: z.string().optional(),
  // ── 계약해지 AL~AO (contract-termination 2026-07-12): 해지일 존재=해지, 매출=수임비+수납−반환액 ──
  해지일: z.string().default(""), // AL (ISO)
  해지사유: z.string().default(""), // AM — 해지 시 필수(서비스 검증)
  반환액: z.number().nonnegative().default(0), // AN (원) — 매출 차감, soft delete 여도 유지
  해지숨김: z.boolean().default(false), // AO — soft delete 카드 숨김(데이터 보존)
});
export type ContractPayment = z.infer<typeof ContractPayment>;

// 계약 분류 판정(이월·해지)·건수 정책 상수 — contract-status.ts 로 분리(500줄 캡). 배럴 재수출.
export {
  isCarryoverContract,
  isTerminatedContract,
  TERMINATED_IN_CONTRACT_COUNT,
} from "./contract-status";
