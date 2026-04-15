/**
 * Layer: types — 도메인 모델.
 * 이 레이어는 다른 레이어를 import 하지 않는다. (구조 테스트가 강제)
 */
import { z } from "zod";

// 4대 핵심 지표 (게이미피케이션 대상)
export const MetricKey = z.enum(["production", "contact", "meeting", "contract"]);
export type MetricKey = z.infer<typeof MetricKey>;

export const METRIC_LABEL: Record<MetricKey, string> = {
  production: "생산",
  contact: "컨택",
  meeting: "미팅",
  contract: "계약",
};

// 사용자 — 마스터 레지스트리에 저장되는 단위
export const User = z.object({
  email: z.string().email(),
  cohort: z.string(),               // 예: "PRM 5기"
  name: z.string(),                 // 수강생 이름
  spreadsheetId: z.string(),        // 본인 전용 시트 ID
  role: z.enum(["trainee", "trainer", "admin"]).default("trainee"),
});
export type User = z.infer<typeof User>;

// 일일 입력 — 수강생이 앱에서 찍는 단위
export const DailyEntry = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  production: z.number().int().nonnegative().default(0),
  contact: z.number().int().nonnegative().default(0),
  meeting: z.number().int().nonnegative().default(0),
  contract: z.number().int().nonnegative().default(0),
  note: z.string().max(500).optional(),
});
export type DailyEntry = z.infer<typeof DailyEntry>;

// 계약 상세 — 탭2 하단 로그 한 행
export const ContractRow = z.object({
  seq: z.number().int().positive(),
  contractDate: z.string(),           // yy/mm/dd
  vendor: z.string(),
  fee: z.number().nonnegative(),      // 수임비
  hasCert: z.boolean(),               // 공동인증서
  hasLease: z.boolean(),              // 임대차계약서
  hasId: z.boolean(),                 // 신분증
  expectedInst: z.string().optional(),// 예상기관-한도
  uploadedToChannel: z.boolean(),
  enteredInCrm: z.boolean(),
});
export type ContractRow = z.infer<typeof ContractRow>;
