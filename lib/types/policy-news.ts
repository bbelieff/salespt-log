/**
 * Layer: types — 정책자금뉴스 공고 피드(2026-10-26 맞춤공고 2단계). 계약: docs/domains/policy-news-feed.md.
 * VPS export_news_json.py 가 xlsx_to_rows 출력(한국어 칸 이름)을 그대로 싣는다. 모르는 칸은 버리지 않고 통과,
 * 빠진 칸은 빈 글로 읽는다. 칸 이름을 바꾸거나 빼면 schema 가 오른다 — 지금 읽는 것은 1.
 */
import { z } from "zod";

const text = z.string().catch("").default("");

export const PolicyNewsRow = z
  .object({
    확인상태: text,
    사업명: text,
    주관기관: text,
    지역: text,
    성격: text,
    대상업종태그: text,
    최대지원금액: text,
    공고일: text,
    마감일: text,
    지원대상: text,
    업종제한: text,
    창업업력제한: text,
    특정타겟: text,
    대출종류: text,
    공고원문링크: text,
  })
  .passthrough();
export type PolicyNewsRow = z.infer<typeof PolicyNewsRow>;

export const PolicyNewsDay = z.object({
  schema: z.literal(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rows: z.array(PolicyNewsRow),
});
export type PolicyNewsDay = z.infer<typeof PolicyNewsDay>;

export const PolicyNewsIndex = z.object({
  schema: z.literal(1),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});
export type PolicyNewsIndex = z.infer<typeof PolicyNewsIndex>;
