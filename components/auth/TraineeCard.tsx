/**
 * TraineeCard — /admin/users (admin) + /trainer (trainer view) 공통 수강생 카드.
 *
 * AdminUserPickerSections.tsx 의 CohortSection / 팀 박스 안에서 사용.
 * 카드 안 액션:
 *   - 정보: 이름·email·다중계정 배지·담당 트레이너
 *   - 팀명 inline input (Enter/blur 시 자동 저장) — admin only
 *   - **[유보]**: admin only (`!viewOnly`)
 *   - **admin**: [주간목표] / [웹앱 →] (`!viewOnly`,
 *     `/weekly-goals?student=…&returnTo=%2Fadmin%2Fusers`, spreadsheetId 무관).
 *   - **트레이너 뷰** (`viewOnly` + `trainerEmailLc` + 본인 담당):
 *     중립 outlined [주간목표] (`/weekly-goals?student=…&returnTo=%2Ftrainer`,
 *     spreadsheetId 무관, impersonation 미사용) + [웹앱 →] 유지. 미배정은 액션 없음.
 *   - **PR C-1**: dragListeners 가 있으면 좌측 [⋮⋮] 드래그 핸들 렌더링.
 *     핸들만 dnd-kit 의 listeners 받아 카드 본문 클릭(버튼) 과 분리.
 *
 * 500줄 cap 회피로 별도 파일.
 */
"use client";

import Link from "next/link";
import DisclosureChevron from "@/components/ui/DisclosureChevron";
import { useEffect, useState, type CSSProperties, type HTMLAttributes } from "react";
import { courseWeeksForCohort } from "@/config/cohort-dates";
import { parseAssigned, type Trainee, type Trainer } from "./AdminUserPickerTypes";

/** dnd-kit useSortable() 의 listeners 타입을 단순화한 alias.
 *  unknown 으로 받아 TraineeCard 가 dnd-kit 에 직접 의존 안 하게 차단. */
export type DragHandleListeners = HTMLAttributes<HTMLElement> | undefined;

function LinkedAccountsBadge({ siblings }: { siblings: string[] }) {
  if (siblings.length === 0) return null;
  return (
    <span
      title={`같은 시트 공유: ${siblings.join(", ")}`}
      className="ml-1 text-px-10 font-medium text-sky-600"
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
  onReserve: _onReserve, // 2026-05-17 [A5]: 헤더 통합 후 미사용 (prop 호환 유지)
  onSetTeam,
  dragListeners,
  dragAttributes,
  dragStyle,
  dragRef,
  isDragging,
  onAssignTrainers,
  activeTrainers,
  trainerEmailLc,
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
  /** 트레이너 뷰 — 본인 email (lowercase). 본인 담당 trainee 의 시트/웹앱만 노출.
   *  미제공이면 viewOnly 모드에서 시트/웹앱 다 안 보임 (관리부서 read-only 등). */
  trainerEmailLc?: string;
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

  // team input 로컬 state — prop 갱신 시 sync. 입력칸은 「팀 변경」을 눌렀을 때만 연다.
  const [team, setTeam] = useState(u.team ?? "");
  const [teamOpen, setTeamOpen] = useState(false);
  useEffect(() => {
    setTeam(u.team ?? "");
  }, [u.team]);

  const trimmed = team.trim();
  const dirty = trimmed !== (u.team ?? "").trim();

  function commit() {
    if (!dirty) return;
    onSetTeam(u.email, trimmed);
  }

  // 주간목표 진입 — impersonation 없이 서버 권한이 있는
  // /weekly-goals?student=... 로 이동 (spreadsheetId 무관).
  // admin(!viewOnly): returnTo=/admin/users, 트레이너 담당: returnTo=/trainer.
  // 웹앱 노출 게이트(showSheetWebBtns)는 그대로 — read-only 는 둘 다 없음.
  const isAssignedToTrainer =
    !!trainerEmailLc &&
    parseAssigned(u.assignedTrainer).includes(trainerEmailLc.toLowerCase());
  const showSheetWebBtns = !viewOnly || isAssignedToTrainer;
  const isTrainerGoalView = !!viewOnly && !!trainerEmailLc && isAssignedToTrainer;
  const isAdminGoalView = !viewOnly;
  const trainerGoalHref = `/weekly-goals?student=${encodeURIComponent(u.email)}&returnTo=${encodeURIComponent("/trainer")}` as const;
  const adminGoalHref = `/weekly-goals?student=${encodeURIComponent(u.email)}&returnTo=${encodeURIComponent("/admin/users")}` as const;

  const canAssign = !viewOnly && onAssignTrainers && (activeTrainers?.length ?? 0) > 0;

  return (
    <div
      ref={dragRef}
      style={dragStyle}
      {...(dragAttributes ?? {})}
      className={`border-b border-gray-100 last:border-b-0 ${archived ? "text-gray-500" : ""} ${isDragging ? "rounded-lg bg-white opacity-50 ring-2 ring-indigo-300" : ""}`}
    >
      {/* 2026-10-26 박스 다이어트(belie 승인 기획): 카드 상자 대신 줄 + 아래 구분선, 한 사람 2줄.
          1줄 = 이름·누적 진도 ↔ 주간목표·웹앱 / 2줄 = 담당(눌러서 변경) · 팀 변경(눌러야 입력칸).
          팀 입력칸은 팀 묶음 제목과 같은 정보라 평소엔 숨긴다 — 끌기는 같은 팀 안 순서만 바꾸므로 팀 이동은 이 입력칸이 유일. */}
      <div className="flex items-center gap-1.5 py-2">
        {dragListeners && (
          // 드래그 핸들 — 모바일에서도 노출. touch-action: none 으로 page scroll 충돌 차단(dnd-kit TouchSensor long-press).
          <button
            type="button"
            aria-label="드래그하여 순서 변경"
            title="드래그하여 같은 팀 안 순서 변경"
            {...dragListeners}
            style={{ touchAction: "none" }}
            className="inline-flex h-6 w-4 shrink-0 cursor-grab select-none items-center justify-center rounded text-gray-300 hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing"
          >
            <span className="text-sm leading-none">⋮⋮</span>
          </button>
        )}
        <div className="min-w-0 flex-1">
          {/* 1줄: 이름 + 다중계정 배지 + 누적 진도. email 은 숨김(시트 공유는 +N 배지 hover).
              좁은 화면은 「12주 누적」 칩·예정/완료/계약 글자를 숨겨(아이콘·숫자·title 유지) 2줄을 지킨다. */}
            <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5">
              <span className="flex min-w-0 items-baseline">
                <span className="truncate text-sm font-black text-gray-900">
                  {u.name || "(이름 없음)"}
                  {u.captainOf ? <span title="회장"> 👑</span> : null}
                </span>
                <LinkedAccountsBadge siblings={siblingEmails(u, linkedBySheet)} />
              </span>
              {/* 누적 funnel(예정·완료·계약) — stats 없는 trainee(시트 미설정·조회 실패)는 안 그림.
                  SSOT: 시트 01 영업관리!E4/E5/E6 (= /schedule funnel 과 동일). */}
              {u.stats && (
                <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-px-11 text-gray-500">
                  <span className="hidden shrink-0 rounded bg-gray-100 px-1.5 py-0.5 font-semibold text-gray-500 2xl:inline">
                    {courseWeeksForCohort(u.cohort)}주 누적
                  </span>
                  <span title={`${courseWeeksForCohort(u.cohort)}주 누적 미팅 예정`}>
                    📅<span className="hidden 2xl:inline"> 예정</span> <span className="font-bold text-amber-700">{u.stats.미팅예정}</span>
                  </span>
                  <span title="미팅 완료">
                    ✓<span className="hidden 2xl:inline"> 완료</span> <span className="font-bold text-indigo-700">{u.stats.미팅완료}</span>
                  </span>
                  <span title="계약">
                    💼<span className="hidden 2xl:inline"> 계약</span> <span className="font-bold text-green-700">{u.stats.계약}</span>
                  </span>
                </span>
              )}
            </div>
          {/* 2줄: 담당(글자 버튼) · 팀 변경. */}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-px-11 text-gray-500">
            {canAssign ? (
              <button
                type="button"
                onClick={() => setTrainerOpen((v) => !v)}
                aria-expanded={trainerOpen}
                className="inline-flex min-w-0 items-center gap-1 rounded text-left font-bold text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                title="담당 트레이너 변경 — 토글 즉시 저장"
              >
                <span className="shrink-0 font-semibold text-gray-400">담당</span>
                <span className="min-w-0 break-words">{trainerNames}</span>
                <DisclosureChevron open={trainerOpen} />
              </button>
            ) : (
              <span className="inline-flex min-w-0 items-center gap-1">
                <span className="shrink-0 text-gray-400">담당</span>
                <span className="min-w-0 break-words font-semibold text-gray-600">{trainerNames}</span>
              </span>
            )}
            {!viewOnly && (teamOpen || dirty ? (
              <span className="inline-flex shrink-0 items-center gap-1">
                <span className="text-gray-400">팀</span>
                <input
                  type="text"
                  value={team}
                  autoFocus={teamOpen}
                  aria-label={`${u.name || u.email} 팀`}
                  onChange={(e) => setTeam(e.target.value)}
                  onBlur={() => { commit(); setTeamOpen(false); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      (e.target as HTMLInputElement).blur();
                    }
                    if (e.key === "Escape") {
                      setTeam(u.team ?? "");
                      setTeamOpen(false);
                    }
                  }}
                  placeholder="미배정"
                  className={`rounded border px-1 py-0.5 text-px-11 outline-none ${
                    dirty ? "border-indigo-400 bg-indigo-50" : "border-gray-200 bg-white"
                  } focus:border-indigo-500`}
                  style={{ width: `calc(${Math.max(3, team.length + 1)}em + 0.75rem)` }}
                />
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setTeamOpen(true)}
                className="shrink-0 rounded text-gray-400 hover:text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                title="이 수강생의 팀을 바꿔요(같은 팀 안 순서는 왼쪽 ⋮⋮ 를 끌어서)"
              >
                {u.team?.trim() ? "팀 변경" : "팀 정하기"}
              </button>
            ))}
          </div>
        </div>
        {/* 액션 — 두 줄 높이 가운데, 오른쪽 고정. */}
        {showSheetWebBtns && (
          <div className="flex shrink-0 items-center gap-1">
            {/* admin(!viewOnly)·트레이너 담당: 중립 outlined [주간목표](student 인코딩, spreadsheetId 무관). */}
            {(isAdminGoalView || isTrainerGoalView) && (
              <Link
                href={isAdminGoalView ? adminGoalHref : trainerGoalHref}
                title="주간 목표·PT과제 열기"
                className="rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs font-bold text-gray-700 hover:bg-gray-50"
              >
                주간목표
              </Link>
            )}
            <button
              type="button"
              onClick={() => onPick(u.email)}
              disabled={busy !== null}
              title="웹앱 (5탭 UI) 으로 진입 — impersonation"
              className="rounded-full bg-gray-900 px-3 py-2 text-xs font-bold text-white hover:bg-black disabled:opacity-50"
            >
              {busy === u.email ? "여는 중..." : "웹앱 →"}
            </button>
          </div>
        )}
      </div>
      {canAssign && trainerOpen && (
        <div className="mb-2 ml-5 rounded-lg bg-indigo-50/60 px-3 py-2">
          <div className="mb-1.5 text-px-10 font-bold text-indigo-700">
            담당 트레이너 — 누르면 바로 저장
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
                  className={`rounded-full border px-3 py-1 text-px-11 font-bold transition disabled:opacity-50 ${
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

