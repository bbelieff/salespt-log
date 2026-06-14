/**
 * TrainerAssignCard — /admin/trainers SectionAssign 의 카드.
 *
 * TrainerMgmtSections.tsx 가 500줄 cap 넘어 분리 (PR C-2, 2026-05-13).
 *
 * 기능:
 *   - 카드 헤더: 트레이너 이름·email·담당 N명·[관리부서]·[퇴출] 버튼.
 *   - 펼침: 기수별 수강생 다중 체크박스 (옵티미스틱 토글) + 기수/전체 일괄.
 *   - PR C-2: 좌측 [⋮⋮] 드래그 핸들 — SortableList 가 props 통해 부착.
 *
 * 본문 헤더 클릭(open 토글) 과 드래그 핸들 분리 — 카드 헤더 좌측 1개 button 으로 격리.
 */
"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type HTMLAttributes,
} from "react";
import { type PanelUser, parseAssigned, groupByCohort } from "./TrainerMgmtSections";

export default function TrainerAssignCard({
  trainer,
  trainees,
  busy,
  onSave,
  onRemoveTrainer,
  onMoveToManagement,
  viewOnly = false,
  dragRef,
  dragStyle,
  dragAttributes,
  dragListeners,
  isDragging,
}: {
  trainer: PanelUser;
  trainees: PanelUser[];
  busy: string | null;
  onSave: (traineeEmail: string, trainerEmails: string[], key: string) => void;
  onRemoveTrainer?: (email: string) => void;
  onMoveToManagement?: (email: string) => void;
  viewOnly?: boolean;
  /** PR C-2: dnd handle. SortableList 가 제공. 미제공이면 dnd 비활성. */
  dragRef?: (el: HTMLElement | null) => void;
  dragStyle?: CSSProperties;
  dragAttributes?: HTMLAttributes<HTMLElement>;
  dragListeners?: HTMLAttributes<HTMLElement> | undefined;
  isDragging?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const trainerLc = trainer.email.toLowerCase();

  // 옵티미스틱 토글 — 체크박스 클릭 즉시 시각 반영 (서버 응답 전).
  // trainees prop 갱신 시 useEffect 로 클리어 (서버가 진실).
  const [optimistic, setOptimistic] = useState<Map<string, boolean>>(new Map());
  useEffect(() => {
    setOptimistic(new Map());
  }, [trainees]);

  function isChecked(t: PanelUser): boolean {
    if (optimistic.has(t.email)) return optimistic.get(t.email)!;
    return parseAssigned(t.assignedTrainer).includes(trainerLc);
  }

  const assignedCount = useMemo(
    () => trainees.filter(isChecked).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trainees, trainerLc, optimistic],
  );

  function toggle(t: PanelUser) {
    const newChecked = !isChecked(t);
    setOptimistic((prev) => new Map(prev).set(t.email, newChecked));
    const current = parseAssigned(t.assignedTrainer);
    const next = newChecked
      ? Array.from(new Set([...current, trainerLc]))
      : current.filter((e) => e !== trainerLc);
    onSave(t.email, next, `assign:${trainer.email}:${t.email}`);
  }

  function bulkApply(targets: PanelUser[], state: "add" | "remove") {
    const newOpt = new Map(optimistic);
    for (const t of targets) {
      const has = isChecked(t);
      if (state === "add" && has) continue;
      if (state === "remove" && !has) continue;
      newOpt.set(t.email, state === "add");
      const current = parseAssigned(t.assignedTrainer);
      const next =
        state === "add"
          ? Array.from(new Set([...current, trainerLc]))
          : current.filter((e) => e !== trainerLc);
      onSave(t.email, next, `assign:${trainer.email}:${t.email}`);
    }
    setOptimistic(newOpt);
  }

  const grouped = groupByCohort(trainees);
  const bulkBusy = busy?.startsWith(`assign:${trainer.email}:`) ?? false;

  // 박스 위계 — 수강생관리의 CohortSection 과 동일 패턴 (border-2 + slate 톤 +
  // 좌측 indigo accent + shadow). 시각 일관성. (2026-05-13 위계 통일)
  return (
    <div
      ref={dragRef}
      style={dragStyle}
      {...(dragAttributes ?? {})}
      className={`overflow-hidden rounded-2xl border-2 border-slate-300 shadow-sm ${
        open ? "bg-white shadow-md" : "bg-slate-100"
      } ${isDragging ? "opacity-50 ring-2 ring-indigo-300" : ""}`}
    >
      <div
        className={`flex items-center gap-3 border-l-4 border-indigo-500 px-4 py-3 ${
          open ? "bg-white" : "bg-slate-50"
        } hover:bg-slate-100`}
      >
        {dragListeners && (
          // 드래그 핸들 — 모바일 노출 + touch-action: none 으로 page scroll 충돌 차단.
          // TraineeCard 와 동일 패턴 (PR fix/admin-roster-and-mobile, 2026-05-14).
          <button
            type="button"
            aria-label="드래그하여 트레이너 카드 순서 변경"
            title="드래그하여 순서 변경"
            {...dragListeners}
            style={{ touchAction: "none" }}
            className="inline-flex w-7 shrink-0 cursor-grab select-none items-center justify-center self-stretch rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 active:cursor-grabbing"
          >
            <span className="text-base leading-none">⋮⋮</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
        >
          <div className="min-w-0">
            <div className="truncate text-base font-black tracking-tight text-gray-900">
              {trainer.name || trainer.email}
              <span className="ml-1.5 text-xs font-bold text-indigo-700">
                · 담당 {assignedCount}명
              </span>
            </div>
            <div className="truncate text-xs text-gray-500">
              {trainer.email}
            </div>
          </div>
          <svg
            className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {onMoveToManagement && (
          <button
            type="button"
            onClick={() => onMoveToManagement(trainer.email)}
            disabled={
              busy === `dept:${trainer.email}` ||
              busy === `remove:${trainer.email}`
            }
            className="shrink-0 rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
            title="이 사람을 관리부서로 이동 (담당 매핑 자동 정리)"
          >
            {busy === `dept:${trainer.email}` ? "..." : "관리부서"}
          </button>
        )}
        {onRemoveTrainer && (
          <button
            type="button"
            onClick={() => onRemoveTrainer(trainer.email)}
            disabled={
              busy === `dept:${trainer.email}` ||
              busy === `remove:${trainer.email}`
            }
            className="shrink-0 rounded-full border border-red-200 bg-white px-2.5 py-1 text-[11px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
            title="이 트레이너를 퇴출 (담당 매핑 자동 정리 + row 삭제)"
          >
            {busy === `remove:${trainer.email}` ? "..." : "퇴출"}
          </button>
        )}
      </div>
      {open && (
        <div className="border-t border-gray-100 bg-gray-50 p-3">
          {/* 전체 일괄 토글 — 트레이너 연습용 시트 등 모두 배정 필요할 때. */}
          {trainees.length > 0 && (
            <div className="mb-3 flex items-center justify-end gap-1.5 border-b border-gray-200 pb-2 text-[11px]">
              <span className="mr-auto text-gray-500">일괄 토글:</span>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => bulkApply(trainees, "add")}
                className="rounded-full border border-red-200 bg-white px-2.5 py-1 font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                전체 선택
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => bulkApply(trainees, "remove")}
                className="rounded-full border border-gray-300 bg-white px-2.5 py-1 font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                전체 해제
              </button>
            </div>
          )}

          {grouped.length === 0 ? (
            <p className="py-3 text-center text-xs text-gray-400">수강생 없음</p>
          ) : (
            <div className="space-y-3">
              {grouped.map(([cohort, list]) => (
                <div key={cohort}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    <span>
                      {cohort === "—" ? "미분류" : `${cohort}기`} · {list.length}명
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={bulkBusy}
                        onClick={() => bulkApply(list, "add")}
                        className="rounded border border-red-200 bg-white px-1.5 py-0.5 text-[9px] font-bold normal-case text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        기수 선택
                      </button>
                      <button
                        type="button"
                        disabled={bulkBusy}
                        onClick={() => bulkApply(list, "remove")}
                        className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[9px] font-bold normal-case text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        기수 해제
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {list.map((s) => {
                      const checked = isChecked(s);
                      const key = `assign:${trainer.email}:${s.email}`;
                      // disabled 는 본인 셀이 진행 중일 때만 — 다른 셀 차단 X.
                      return (
                        <label
                          key={s.email}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors ${checked ? "bg-red-50" : "hover:bg-white"} ${busy === key ? "opacity-50" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={busy === key || viewOnly}
                            onChange={() => !viewOnly && toggle(s)}
                            className="h-4 w-4 rounded border-gray-300 text-brand-red focus:ring-red-200"
                          />
                          <span className="min-w-0 flex-1 truncate font-semibold text-gray-800">
                            {s.name || s.email}
                            {s.captainOf ? <span title="회장"> 👑</span> : null}
                          </span>
                          <span className="shrink-0 text-[10px] text-gray-400">
                            {s.email}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
