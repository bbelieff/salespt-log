/**
 * Layer: types — 05 실무투두(계약×기관 단위 ToDo). 다른 레이어 import 안 함.
 * index.ts 배럴에서 재수출(2026-07-19, 500줄 캡 분리). 소비자는 `@/types` 유지.
 * SSOT: sheet-structure.md §5-2 · ADR-0006.
 */
import { z } from "zod";

// ── 실무투두 (05 실무투두 1행 = 1투두) — Scope 2, ADR-0006 ──────
// 시트 매핑: docs/domains/sheet-structure.md §5-2 (A~M 13컬럼)
//   A=id, B=contractRef, C=institutionRef, D=업체명, E=type, F=제목,
//   G=예정일자, H=예정시각, I=장소, J=상세, K=showOnCalendar,
//   L=완료여부, M=생성시각
// (계약 × 기관) 단위. 04 미팅·02 수납과 격리(미팅 집계 수식 영향 0).
// 수식 컬럼 없음 → split-write 불필요.
// "일반" = 캘린더 일반이벤트(기존고객/개인 일정, 통계·아레나 비집계 — consultation-log §1-3).
export const TodoType = z.enum(["기타", "미팅", "전화", "메시지", "일반"]);
export type TodoType = z.infer<typeof TodoType>;

export const Todo = z.object({
  id: z.string(),
  contractRef: z.string(), // "계약일|업체명" — 02 계약 안정키 (행번호 아님)
  institutionRef: z.string().default(""), // 슬롯 진행기관 (Scope 3 조인 키)
  업체명: z.string().default(""),
  type: TodoType.default("기타"),
  제목: z.string().min(1, "제목 필수"),
  예정일자: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  예정시각: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "HH:MM")
    .or(z.literal(""))
    .default(""), // 빈 허용
  장소: z.string().default(""),
  상세: z.string().default(""),
  showOnCalendar: z.boolean().default(true),
  완료여부: z.boolean().default(false),
  생성시각: z.string().default(""), // ISO
  /** 일반이벤트(type=일반) 카테고리 — N 컬럼: "기존"(기존 고객) | "기타"(개인 일정). 그 외 type 은 빈값. */
  분류: z.string().default(""),
});
export type Todo = z.infer<typeof Todo>;
