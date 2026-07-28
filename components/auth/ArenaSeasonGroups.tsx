/**
 * ArenaSeasonGroups — 아레나 카테고리 안을 **시즌 collapsible** 로 묶는다 (AR-1).
 *
 * 전(前): A1-1기 ~ A1-6기가 아레나 박스 안에 세로로 6개 나열 → 스크롤 길고 시즌 경계 없음.
 * 후(後): 시즌 헤더("시즌1 · 33명 · 6/12~8/1 · D-N") 한 줄 → 펼치면 기존 기수 카드 그대로.
 *   A2 기수가 등록되면 시즌2 그룹이 **자동** 생성된다(데이터 파생, 하드코딩 없음).
 *
 * 그룹핑 로직은 순수함수 `groupArenaBySeason`(./arena-season, 시즌 파싱은 cohort-token
 * 의 arenaCohortLabelParts 재사용)에 있고 회귀 테스트로 고정. 여긴 표시만 담당.
 * 기간·D-day 는 시즌 소속 trainee 의 개강/종강에서 파생 — 날짜 하드코딩 금지.
 */
"use client";

import PersistentDetails from "./PersistentDetails";
import { CohortSection, type Trainee, type Trainer } from "./AdminUserPickerSections";
import { fmtDateYY, cohortProgress } from "./AdminUserPickerTypes";
import { groupArenaBySeason } from "./arena-season";

/** CohortSection 에 그대로 흘려보내는 핸들러 묶음 — prop drilling 축약. */
export interface ArenaSeasonHandlers {
  busy: string | null;
  nameByEmail: Map<string, string>;
  onPick: (email: string) => void;
  onReserve: (email: string) => void;
  onSetTeam: (email: string, team: string) => void;
  onReorder?: (emails: string[]) => void | Promise<void>;
  onAssignTrainers?: (traineeEmail: string, trainerEmails: string[]) => void;
  activeTrainers?: Trainer[];
  linkedBySheet?: Map<string, string[]>;
  viewOnly?: boolean;
}

/** 기수 카드 리스트 — 시즌 안/밖(orphan) 공용. */
function CohortList({
  groups,
  h,
}: {
  groups: Array<[string, Trainee[]]>;
  h: ArenaSeasonHandlers;
}) {
  return (
    <div className="space-y-8">
      {groups.map(([cohort, list]) => (
        <CohortSection
          key={cohort}
          cohort={cohort}
          list={list}
          busy={h.busy}
          nameByEmail={h.nameByEmail}
          onPick={h.onPick}
          onReserve={h.onReserve}
          onSetTeam={h.onSetTeam}
          onReorder={h.onReorder}
          onAssignTrainers={h.onAssignTrainers}
          activeTrainers={h.activeTrainers}
          linkedBySheet={h.linkedBySheet}
          viewOnly={h.viewOnly}
        />
      ))}
    </div>
  );
}

export default function ArenaSeasonGroups({
  groups,
  ...h
}: { groups: Array<[string, Trainee[]]> } & ArenaSeasonHandlers) {
  const { seasons, orphans } = groupArenaBySeason(groups);

  return (
    <div className="space-y-4">
      {seasons.map((s) => {
        const start = fmtDateYY(s.startISO);
        const end = fmtDateYY(s.endISO);
        const { dday } = cohortProgress(s.startISO, s.endISO);
        // group/season(named) 필수 — 시즌은 기수 카드(CohortSection)의 **조상**이라, 익명
        // `group` 을 쓰면 Tailwind 가 뽑는 `.group[open] .group-open\:*` 가 descendant
        // 셀렉터여서 시즌이 열려 있는 동안 **접힌 기수 박스까지** 펼침 모양(흰 헤더·셰브론
        // 90°)이 된다. 이름을 붙여 시즌 전용으로 격리한다(적대 리뷰 CONFIRMED).
        return (
          <PersistentDetails
            key={s.season}
            persistKey={`arena-season:${s.season}`}
            defaultOpen
            className="group/season overflow-hidden rounded-2xl border-2 border-purple-200 bg-purple-50/40 open:bg-white"
          >
            <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-2 gap-y-0.5 border-l-4 border-purple-500 bg-purple-50 px-4 py-3 group-open/season:bg-white hover:bg-purple-100">
              <svg
                className="h-3.5 w-3.5 shrink-0 text-purple-500 transition-transform group-open/season:rotate-90"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-base font-black tracking-tight text-gray-900">
                시즌{s.season}
              </span>
              <span className="text-xs font-bold text-purple-700">· {s.count}명</span>
              <span className="text-[11px] font-medium text-gray-400">
                · {s.groups.length}개 기수
              </span>
              {start && end && (
                <span className="ml-1 text-xs font-medium text-gray-500">
                  · <span className="font-bold text-gray-800">{start}</span> ~{" "}
                  <span className="font-bold text-gray-800">{end}</span>
                  {dday !== null && (
                    <span className="ml-1 rounded-md bg-red-50 px-1.5 py-0.5 font-black text-brand-red">
                      D{dday >= 0 ? "-" : "+"}
                      {Math.abs(dday)}
                    </span>
                  )}
                </span>
              )}
            </summary>
            <div className="border-t border-purple-100 px-3 py-4">
              <CohortList groups={s.groups} h={h} />
            </div>
          </PersistentDetails>
        );
      })}
      {/* 시즌 파싱 실패분 — 삼키지 않고 그대로 노출(유실 방지). */}
      {orphans.length > 0 && <CohortList groups={orphans} h={h} />}
    </div>
  );
}
