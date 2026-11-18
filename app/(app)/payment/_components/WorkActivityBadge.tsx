/** 업체·진행기관 목록에서 같은 Todo/History 날짜 표현을 쓴다. */
import type { WorkActivitySummary } from "../_lib/institution-view";

export type ActivityLoadState = "loading" | "ready" | "error";

/** 미지정/History는 중립, 오늘·미래 Todo는 노랑, 연체 Todo는 빨강. */
export function ddayTone(label: string): "none" | "upcoming" | "overdue" {
  if (label.startsWith("D+")) return "overdue";
  if (label === "D0" || /^D-\d/.test(label)) return "upcoming";
  return "none";
}

const TONE_CLASS = {
  none: "bg-slate-100 text-slate-600",
  upcoming: "bg-yellow-100 text-yellow-800",
  overdue: "bg-red-100 text-red-700",
} as const;

export default function WorkActivityBadge({ activity, state = "ready" }: {
  activity?: WorkActivitySummary;
  state?: ActivityLoadState;
}) {
  const kind = activity?.activityKind ?? "none";
  const label = activity?.activityLabel ?? "D?";
  const description = state === "loading" ? "활동 불러오는 중" : state === "error" ? "활동 조회 실패" :
    kind === "none" ? "Todo·History 없음" : kind === "history" ? `최근 History ${label}` : `미완료 Todo ${label}`;
  if (state !== "ready") {
    return (
      <span aria-label={description} className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-px-11 font-semibold text-slate-600">
        {state === "loading" ? "…" : "조회 실패"}
      </span>
    );
  }
  // 칩 하나만 — 「History/Todo」 글자 칩은 뺐다(2026-11-18 belie 「정보 과다」). 첫 글자(H = History, D = Todo)와 색이 종류를 말하고,
  // 풀어 쓴 설명은 마우스를 올리면(title) · 화면 낭독기(aria-label)로 읽힌다.
  return (
    <span aria-label={description} title={description} className={`shrink-0 rounded px-1.5 py-0.5 text-px-11 font-semibold tabular-nums ${TONE_CLASS[ddayTone(label)]}`}>
      {label}
    </span>
  );
}
