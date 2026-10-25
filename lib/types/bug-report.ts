/**
 * Layer: types — 오류신고(2026-10-25 belie). 수강생이 「오늘 챙길 일」 창의 오류신고로 보내는 한 건.
 * 그림은 실제 화면(탭 찍기, 전화번호·이름·계좌 칸 가림) 또는 직접 찍은 사진에 표시(박스·펜·글자)를 합친 JPEG 한 장(data URL).
 */
import { z } from "zod";

export const BUG_REPORT_CATEGORIES = ["저장이 안 돼요", "버튼이 안 눌려요", "숫자·날짜가 이상해요", "화면이 깨져요", "느려요", "기타"] as const;
export const BugReportCategory = z.enum(BUG_REPORT_CATEGORIES);

/** 캡처 한 장 상한 — JPEG 화면 1장은 보통 0.2~1MB. 넘으면 캡처 없이 보내게 안내한다. */
export const BUG_REPORT_IMAGE_MAX = 3_000_000;

export const BugReportContext = z.object({
  /** 보던 화면 주소(쿼리 포함, 최대 500자) · 화면 제목. */
  path: z.string().max(500).default(""),
  title: z.string().max(200).default(""),
  viewport: z.string().max(40).default(""),
  userAgent: z.string().max(400).default(""),
  /** 화면 움직임 재생 링크(PostHog) — 없으면 빈 값. */
  replayUrl: z.string().max(600).default(""),
  /** 최근 오류 메시지(최대 10개, 각 300자). */
  errors: z.array(z.string().max(300)).max(10).default([]),
  /** 그림 출처: tab = 실제 탭을 찍음 · upload = 직접 찍은 사진을 붙임 · none = 그림 없음. */
  captureMethod: z.enum(["tab", "upload", "none"]).default("none"),
  /** 그린 표시 개수(박스·펜·글자). */
  marks: z.number().int().min(0).max(200).default(0),
});
export type BugReportContext = z.infer<typeof BugReportContext>;

export const BugReportInput = z.object({
  category: BugReportCategory,
  text: z.string().max(2000).default(""),
  image: z.string().max(BUG_REPORT_IMAGE_MAX).regex(/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/).or(z.literal("")).default(""),
  context: BugReportContext.default({}),
});
export type BugReportInput = z.infer<typeof BugReportInput>;

export const BUG_REPORT_STATUSES = ["new", "checking", "done"] as const;
export type BugReportStatus = (typeof BUG_REPORT_STATUSES)[number];
