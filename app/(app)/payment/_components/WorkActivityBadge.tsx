/** 업체·진행기관 목록에서 같은 Todo/History 날짜 표현을 쓴다. */
import type { WorkActivitySummary } from "../_lib/institution-view";

export type ActivityLoadState = "loading" | "ready" | "error";

export default function WorkActivityBadge({ activity, state = "ready" }: {
  activity?: WorkActivitySummary;
  state?: ActivityLoadState;
}) {
  const kind = activity?.activityKind ?? "none";
  const label = activity?.activityLabel ?? "D-??";
  const description = state === "loading" ? "활동 불러오는 중" : state === "error" ? "활동 조회 실패" :
    kind === "none" ? "Todo·History 없음" : kind === "history" ? `최근 History ${label}` : `미완료 Todo ${label}`;
  return (
    <span aria-label={description} className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
      state !== "ready" || kind === "none" ? "bg-slate-100 text-slate-600" :
        kind === "history" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
    }`}>
      {state === "loading" ? "…" : state === "error" ? "조회 실패" : <>{kind === "history" ? "History " : kind === "todo" ? "Todo " : ""}{label}</>}
    </span>
  );
}
