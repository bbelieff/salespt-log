/**
 * 「오늘 챙길 일」 줄의 종류·이유 칩(2026-11-25 belie 승인 B안) — 화면 안내용 분류. 세는 규칙은 건드리지 않는다.
 * - 종류 = 손이 하는 일: 전화 · 날짜 · 미팅 · 기록 · 정하기 · 할 일. 항목이 만들어진 곳(key 앞머리)과 kind·action 으로 정한다.
 * - 이유 = 그 일이 생긴 까닭을 쉬운 말로. dashboard-follow-ups 가 이미 계산한 reasons 를 그대로 받아 문구만 바꾼다.
 * 문구가 바뀌어 어긋나지 않도록 tests/analytics/follow-up-work-kind.test.ts 가 실제 생성 함수의 결과로 고정한다.
 */
import { TODAY_MEETING_REASON, type FollowUpItem } from "./dashboard-follow-ups";

export type FollowUpWorkKind = "call" | "date" | "meeting" | "record" | "plan" | "todo";
export const FOLLOW_UP_WORK_KINDS: readonly FollowUpWorkKind[] = ["call", "date", "meeting", "record", "plan", "todo"];
export const FOLLOW_UP_WORK_KIND_LABEL: Record<FollowUpWorkKind, string> = { call: "전화", date: "날짜", meeting: "미팅", record: "기록", plan: "정하기", todo: "할 일" };

export function followUpWorkKind(item: Pick<FollowUpItem, "key" | "kind" | "action">): FollowUpWorkKind {
  if (item.key.startsWith("lead:")) return item.action === "다음 연락일 정하기" ? "date" : "call";
  if (item.key.startsWith("meeting:")) return item.action === "미팅 결과 입력" ? "record" : "meeting";
  if (item.key.startsWith("stalled:")) return "plan";
  // 직접 등록한 할 일·공고 신청 준비(todo:) — 제목이 자유라 더 나누지 않는다.
  return "todo";
}

/** 정보가 없는 이유(직접 등록한 할 일의 기본 표시)는 칩으로 만들지 않는다. */
const SILENT = new Set(["미완료 할 일", "미완료 투두"]);
const REWORD: Record<string, string> = {
  "진행기관 없음": "기관 없음",
  "다음 할 일 없음": "다음 할 일 비어 있음",
  "조건 대기(단기관리)": "조건 대기",
  "공고 신청 준비": "공고",
  "연결 진행건 확인 필요": "진행건 연결 필요",
  "미팅 결과 미입력": "결과 안 적음",
  [TODAY_MEETING_REASON]: "오늘 미팅",
};

/** 쉬운 말로 바꾼 이유 전부(겹침 없음). 「재통화 · 다음 연락일 없음」처럼 묶인 이유는 나눈다. */
export function followUpReasonLabels(item: Pick<FollowUpItem, "reasons">): string[] {
  const out: string[] = [];
  for (const raw of item.reasons.flatMap(reason => reason.split(" · "))) {
    const text = raw.trim();
    if (!text || SILENT.has(text)) continue;
    const stalled = text.match(/^(\d+)일 이상 진행 정체$/);
    const label = stalled ? `${stalled[1]}일 넘게 멈춤` : REWORD[text] ?? text;
    if (!out.includes(label)) out.push(label);
  }
  return out;
}

/** 줄에 보이는 이유 칩 — 최대 두 개. 나머지는 줄을 펼치면 보인다. */
export const ROW_REASON_CHIPS = 2;
export function followUpReasonChips(item: Pick<FollowUpItem, "reasons">): string[] {
  return followUpReasonLabels(item).slice(0, ROW_REASON_CHIPS);
}

/** 오른쪽 열 「이유」 보기 — 이유별 건수, 많은 순(같으면 가나다). 한 줄에 이유가 둘이면 양쪽에 다 센다. */
export function countFollowUpReasons(items: readonly Pick<FollowUpItem, "reasons">[]): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) for (const label of followUpReasonLabels(item)) counts.set(label, (counts.get(label) ?? 0) + 1);
  return [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ko"));
}
