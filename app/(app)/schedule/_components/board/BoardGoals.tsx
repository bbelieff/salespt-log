"use client";
/**
 * 주간 보드 왼쪽 「주간 트레이닝 목표」 판 — 시안 v44 구성: 정량(목표별 실적/목표 + 막대, 달성은 초록) · 정성(PT 과제 번호 목록).
 * 접힌 제목 줄에는 「정량 달성/전체 · 과제 수」. 값은 주간 목표 화면과 같은 조회(useGoalView)를 쓴다.
 */
import { GOAL_KEYS, GOAL_LABELS } from "@/types/weekly-goals";
import { useGoalView } from "@/components/weekly-goals/client";
import { splitTaskRows } from "@/util/weekly-goal-tasks";
import { Panel } from "./SidePanels";

export default function GoalPanel({ courseWeekFri }: { courseWeekFri: string }) {
  const q = useGoalView(new URLSearchParams({ date: courseWeekFri }).toString());
  const cur = q.isError ? undefined : q.data?.current;
  const items = cur ? GOAL_KEYS.map((k) => ({ k, goal: cur.record.goals[k], actual: cur.actuals[k] })) : [];
  const hit = items.filter((g) => g.goal !== null && g.goal > 0 && g.actual >= g.goal).length;
  const tasks = cur ? splitTaskRows(cur.record.task ?? "") : [];

  return (
    <Panel title="주간 트레이닝 목표" defaultOpen={false} closedSummary={cur ? `정량 ${hit}/${items.length} · 과제 ${tasks.length}` : undefined}
      icon={<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /></svg>}>
      {q.isPending && <p role="status" className="text-xs text-slate-500">불러오는 중…</p>}
      {q.isError && <p role="alert" className="text-xs text-red-600">목표를 불러오지 못했어요. <button type="button" className="underline" onClick={() => void q.refetch()}>다시 시도</button></p>}
      {cur && (
        <>
          <div className="wb-subh">정량 <small>달성 {hit} / {items.length}</small></div>
          <ul className="wb-qn">
            {items.map(({ k, goal, actual }) => {
              const done = goal !== null && goal > 0 && actual >= goal;
              return (
                <li key={k} className={done ? "wb-hit" : undefined}>
                  <div className="wb-qn-top"><span>{GOAL_LABELS[k]}</span><em>{actual.toLocaleString("ko-KR")} <small>/ {goal === null ? "—" : goal.toLocaleString("ko-KR")}</small></em></div>
                  <div className="wb-bar2" role="progressbar" aria-label={GOAL_LABELS[k]} aria-valuenow={actual} aria-valuemin={0} aria-valuemax={goal ?? 0}>
                    <b style={{ width: `${goal ? Math.min(100, (actual / goal) * 100) : 0}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="wb-subh">정성 <small>PT 과제</small></div>
          {tasks.length > 0
            ? <ol className="wb-ptask">{tasks.map((t, i) => <li key={i}><span className="wb-ptask-no">{i + 1}</span><span className="min-w-0">{t}</span></li>)}</ol>
            : <p className="text-px-11 text-slate-500">아직 받은 과제가 없어요</p>}
        </>
      )}
    </Panel>
  );
}
