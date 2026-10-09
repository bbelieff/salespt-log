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
  // 「Todo/History」 종류와 D-day 는 따로 떼어 보여 준다 — History는 중립, Todo는 기한에 따라 색을 구분한다.
  // 종류 칩 테두리는 ring(inset)으로 — border 는 높이·폭을 2px 늘려 D-day 칩과 키가 달라지고 좁은 목록에서 넘친다.
  return (
    <span aria-label={description} className="inline-flex shrink-0 items-center gap-0.5">
      {kind !== "none" && (
        <span aria-hidden className="rounded bg-white px-1 py-0.5 text-px-11 font-semibold text-slate-500 ring-1 ring-inset ring-slate-200">
          {kind === "history" ? "History" : "Todo"}
        </span>
      )}
      <span aria-hidden className={`rounded px-1.5 py-0.5 text-px-11 font-semibold tabular-nums ${TONE_CLASS[ddayTone(label)]}`}>
        {label}
      </span>
    </span>
  );
}
