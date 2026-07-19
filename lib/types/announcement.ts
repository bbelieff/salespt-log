/**
 * Layer: types — 새소식(레지스트리 updates·notices 탭). 다른 레이어 import 안 함.
 * index.ts 배럴에서 재수출(2026-07-19, 500줄 캡 분리). 소비자는 `@/types` 유지.
 * SSOT: sheet-structure.md §6.2~6.3 · announcement-popup §1.
 */
import { z } from "zod";

// ── 새소식 (레지스트리 updates·notices 탭 — announcement-popup §1) ──
// 시트 매핑: docs/domains/sheet-structure.md §6.2~6.3. 개인 시트가 아니라
// SHEETS_REGISTRY_ID 의 탭 2개. updates=배포 시 자동 수집, notices=운영자 공지.

/** 배포 시 자동 수집된 업데이트 1행 (updates A~H). 키=pr (멱등 가드). */
export const UpdateItem = z.object({
  pr: z.number(), // PR 번호 (A)
  date: z.string().default(""), // 머지 날짜 YYYY-MM-DD (B)
  type: z.string().default(""), // feat/fix/perf/chore/docs/refactor (C)
  titleUser: z.string().default(""), // 수강생용 한 줄 — 커밋 Changelog: 줄 (D)
  bodyMd: z.string().default(""), // 상세 MD, admin 작성 (E)
  milestone: z.string().default(""), // 큰 묶음 라벨, admin 수동 (F)
  visible: z.boolean().default(false), // 기본 feat·fix=TRUE (G)
  anchor: z.string().default(""), // 앱 내 NEW 앵커 키 — Changelog-Anchor 수집 (H)
});
export type UpdateItem = z.infer<typeof UpdateItem>;

/** 공지 대상 — arena 판정 = cohort 라벨 `A` 접두 (예 A1-6). */
export const NoticeAudience = z.enum(["all", "arena", "regular"]);
export type NoticeAudience = z.infer<typeof NoticeAudience>;

/** 노출 빈도 — 제어는 클라 localStorage (서버 기록 금지, §3). */
export const NoticeDisplayMode = z.enum(["once", "daily", "always"]);
export type NoticeDisplayMode = z.infer<typeof NoticeDisplayMode>;

/** 운영자 공지 1행 (notices A~K). MD 본문은 렌더 시 sanitize 필수. */
export const Notice = z.object({
  id: z.string(), // 타임스탬프 기반 (A)
  created: z.string().default(""), // ISO (B)
  updated: z.string().default(""), // ISO (C)
  title: z.string().default(""),
  bodyMd: z.string().default(""),
  audience: NoticeAudience.default("all"),
  displayMode: NoticeDisplayMode.default("once"),
  start: z.string().default(""), // YYYY-MM-DD, 빈값=무제한 (H)
  end: z.string().default(""), // YYYY-MM-DD, 빈값=무제한 (I)
  pinned: z.boolean().default(false),
  active: z.boolean().default(true),
});
export type Notice = z.infer<typeof Notice>;
