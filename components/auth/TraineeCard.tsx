/**
 * TraineeCard — /admin/users 의 개별 수강생 카드.
 *
 * AdminUserPickerSections.tsx 의 CohortSection / 팀 박스 안에서 사용.
 * 카드 안 액션:
 *   - 정보: 이름·email·다중계정 배지·담당 트레이너
 *   - 팀명 inline input (Enter/blur 시 자동 저장)
 *   - [유보] / [📊 시트 ↗] / [웹앱 →]
 *   - **PR C-1**: dragListeners 가 있으면 좌측 [⋮⋮] 드래그 핸들 렌더링.
 *     핸들만 dnd-kit 의 listeners 받아 카드 본문 클릭(버튼) 과 분리.
 *
 * 500줄 cap 회피로 별도 파일.
 */
"use client";

import { useEffect, useState, type CSSProperties, type HTMLAttributes } from "react";
import { parseAssigned, type Trainee, type Trainer } from "./AdminUserPickerTypes";

/** dnd-kit useSortable() 의 listeners 타입을 단순화한 alias.
 *  unknown 으로 받아 TraineeCard 가 dnd-kit 에 직접 의존 안 하게 차단. */
export type DragHandleListeners = HTMLAttributes<HTMLElement> | undefined;

function LinkedAccountsBadge({ siblings }: { siblings: string[] }) {
  if (siblings.length === 0) return null;
  return (
    <span
      title={`같은 시트 공유: ${siblings.join(", ")}`}
      className="ml-1 inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700"
    >
      🔗 +{siblings.length}
    </span>
  );
}

function siblingEmails(
  u: Trainee,
  linkedBySheet?: Map<string, string[]>,
): string[] {
  if (!linkedBySheet || !u.spreadsheetId) return [];
  const all = linkedBySheet.get(u.spreadsheetId) ?? [];
  const meLc = u.email.toLowerCase();
  return all.filter((e) => e.toLowerCase() !== meLc);
}

export default function TraineeCard({
  u,
  archived,
  viewOnly,
  busy,
  nameByEmail,
  linkedBySheet,
  onPick,
  onReserve,
  onSetTeam,
  dragListeners,
  dragAttributes,
  dragStyle,
  dragRef,
  isDragging,
  onAssignTrainers,
  activeTrainers,
}: {
  u: Trainee;
  archived: boolean;
  viewOnly: boolean;
  busy: string | null;
  nameByEmail: Map<string, string>;
  linkedBySheet?: Map<string, string[]>;
  onPick: (email: string) => void;
  onReserve: (email: string) => void;
  onSetTeam: (email: string, team: string) => void;
  /** PR C-1: dnd-kit useSortable listeners. 좌측 핸들에만 부착 — 본문 버튼 클릭 보존. */
  dragListeners?: DragHandleListeners;
  /** dnd-kit attributes (aria-roledescription 등). 루트 div 에 spread. */
  dragAttributes?: HTMLAttributes<HTMLElement>;
  /** dnd-kit transform/transition CSS. */
  dragStyle?: CSSProperties;
  /** dnd-kit setNodeRef. */
  dragRef?: (el: HTMLElement | null) => void;
  /** 드래그 중 시각 피드백. */
  isDragging?: boolean;
  /** 트레이너 multi-select 변경 — assignedTrainer 컬럼 전체 update.
   *  /admin/trainers 의 TrainerAssignCard 와 동일 API 호출하므로 last-write-wins. */
  onAssignTrainers?: (traineeEmail: string, trainerEmails: string[]) => void;
  /** 활성 트레이너 풀 — 펼침 시 체크박스 후보. */
  activeTrainers?: Trainer[];
}) {
  // 옵티미스틱 토글 — 체크박스 클릭 즉시 시각 반영 (서버 응답 전).
  // prop(u.assignedTrainer) 갱신 시 useEffect 로 클리어.
  const [optimistic, setOptimistic] = useState<Map<string, boolean>>(new Map());
  useEffect(() => {
    setOptimistic(new Map());
  }, [u.assignedTrainer]);

  function isChecked(trainerEmailLc: string): boolean {
    if (optimistic.has(trainerEmailLc)) return optimistic.get(trainerEmailLc)!;
    return parseAssigned(u.assignedTrainer).includes(trainerEmailLc);
  }

  function toggleTrainer(trainerEmailLc: string) {
    if (!onAssignTrainers) return;
    const newChecked = !isChecked(trainerEmailLc);
    setOptimistic((prev) => new Map(prev).set(trainerEmailLc, newChecked));
    const current = parseAssigned(u.assignedTrainer);
    const next = newChecked
      ? Array.from(new Set([...current, trainerEmailLc]))
      : current.filter((e) => e !== trainerEmailLc);
    onAssignTrainers(u.email, next);
  }

  // 펼침 토글.
  const [trainerOpen, setTrainerOpen] = useState(false);

  // 현재 배정된 트레이너 라벨 (옵티미스틱 반영).
  const assignedLc = (activeTrainers ?? []).map((t) => t.email.toLowerCase());
  const checkedLcs = assignedLc.filter(isChecked);
  // 옛 assigned 중 activeTrainers 에 없는 케이스 (트레이너 퇴출 잔재) 도 포함해서 표시.
  const allChecked = Array.from(
    new Set([...checkedLcs, ...parseAssigned(u.assignedTrainer)]),
  ).filter((lc) => {
    if (optimistic.has(lc) && !optimistic.get(lc)) return false;
    return true;
  });
  const trainerNames =
    allChecked.length > 0
      ? allChecked.map((e) => nameByEmail.get(e) ?? e).join(", ")
      : "미배정";

  // team input 로컬 state — prop 갱신 시 sync.
  const [team, setTeam] = useState(u.team ?? "");
  useEffect(() => {
    setTeam(u.team ?? "");
  }, [u.team]);

  const trimmed = team.trim();
  const dirty = trimmed !== (u.team ?? "").trim();

  function commit() {
    if (!dirty) return;
    onSetTeam(u.email, trimmed);
  }

  const canAssign = !viewOnly && onAssignTrainers && (activeTrainers?.length ?? 0) > 0;

  return (
    <div
      ref={dragRef}
      style={dragStyle}
      {...(dragAttributes ?? {})}
      className={`overflow-hidden rounded-xl border ${archived ? "border-gray-200 bg-gray-50" : "border-gray-200 bg-white"} ${isDragging ? "opacity-50 ring-2 ring-indigo-300" : ""}`}
    >
      <div className="flex items-stretch gap-2 p-3 sm:gap-3 sm:p-4">
        {dragListeners && (
          // 드래그 핸들 — 모바일에서도 노출 (이전엔 `hidden sm:inline-flex` 라
          // 모바일에서 보이지 않아 순서 변경 불가). touch-action: none 으로 page
          // scroll 와 충돌 차단 — dnd-kit TouchSensor long-press(200ms)+8px tolerance
          // 와 자연스럽게 연동. (2026-05-14)
          <button
            type="button"
            aria-label="드래그하여 순서 변경"
            title="드래그하여 박스 내 순서 변경"
            {...dragListeners}
            style={{ touchAction: "none" }}
            className="inline-flex w-7 shrink-0 cursor-grab select-none items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 active:cursor-grabbing"
          >
            <span className="text-base leading-none">⋮⋮</span>
          </button>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        {/* 이름 + 다중계정 배지. email 은 일부러 숨김 — 관리 화면에서 가독성 우선
            (사용자 피드백 2026-05-14). 같은 시트 공유 정보는 +N 배지 hover 로 확인. */}
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-black text-gray-900">
            {u.name || "(이름 없음)"}
          </span>
          <LinkedAccountsBadge siblings={siblingEmails(u, linkedBySheet)} />
        </div>
        {/* 팀 (윗줄, compact) → 담당 (아랫줄, 카드 우측 끝까지 + 줄바꿈 허용).
            담당이 트레이너 여러 명으로 늘어나도 위로(이름) 위치는 고정, 아래로 (다음
            카드 방향) 확장 → 같은 row 의 [유보/시트/웹앱] 버튼을 가리지 않음.
            (사용자 피드백 2026-05-14: "취지가 아래로 긴게 들어가게 하는거야") */}
        {!viewOnly && (
          <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-gray-600">
            <span className="text-gray-400">팀</span>
            <input
              type="text"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="미배정"
              className={`rounded border px-1.5 py-0.5 text-[11px] outline-none ${
                dirty
                  ? "border-indigo-400 bg-indigo-50"
                  : "border-gray-200 bg-white"
              } focus:border-indigo-500`}
              style={{ width: 70 }}
            />
          </div>
        )}
        <div className="mt-1 text-[11px] text-gray-600">
          {canAssign ? (
            <button
              type="button"
              onClick={() => setTrainerOpen((v) => !v)}
              className="flex w-full items-start gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-left text-[11px] font-bold text-indigo-700 hover:bg-indigo-100"
              title="담당 트레이너 변경 — 토글 즉시 저장"
            >
              <span className="shrink-0">담당:</span>
              <span className="min-w-0 flex-1 break-words font-bold">
                {trainerNames}
              </span>
              <svg
                className={`mt-0.5 h-3 w-3 shrink-0 transition-transform ${trainerOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          ) : (
            <span className="flex w-full items-start gap-1">
              <span className="shrink-0 text-gray-400">담당:</span>
              <span className="min-w-0 flex-1 break-words font-semibold">
                {trainerNames}
              </span>
            </span>
          )}
        </div>
      </div>
      {!viewOnly && (
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onReserve(u.email)}
            disabled={busy !== null}
            title="명단에서 숨김 (유보로 이동, row 는 살아있음)"
            className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
          >
            {busy === u.email ? "..." : "유보"}
          </button>
          {u.spreadsheetId && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${u.spreadsheetId}/edit`}
              target="_blank"
              rel="noopener noreferrer"
              title="구글 시트 원본 새 탭으로 열기"
              className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100"
            >
              📊 시트 ↗
            </a>
          )}
          <button
            type="button"
            onClick={() => onPick(u.email)}
            disabled={busy !== null}
            title="웹앱 (5탭 UI) 으로 진입 — impersonation"
            className="rounded-full bg-gray-900 px-4 py-2 text-xs font-bold text-white hover:bg-black disabled:opacity-50"
          >
            {busy === u.email ? "여는 중..." : "웹앱 →"}
          </button>
        </div>
      )}
        </div>
      </div>
      {canAssign && trainerOpen && (
        <div className="border-t border-indigo-100 bg-indigo-50/40 px-4 py-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
            담당 트레이너 — 토글 즉시 저장
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(activeTrainers ?? []).map((t) => {
              const lc = t.email.toLowerCase();
              const checked = isChecked(lc);
              const isBusy = busy === `assign:${u.email}`;
              return (
                <button
                  key={t.email}
                  type="button"
                  onClick={() => toggleTrainer(lc)}
                  disabled={isBusy}
                  className={`rounded-full border px-3 py-1 text-[11px] font-bold transition disabled:opacity-50 ${
                    checked
                      ? "border-indigo-500 bg-indigo-500 text-white"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                  title={t.email}
                >
                  {checked ? "✓ " : ""}
                  {t.name || t.email}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
