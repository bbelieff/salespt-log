/**
 * CohortCategoryBoxes — 수강생관리(/admin/users) activeGroups 를 상위 카테고리
 * 3박스(수강생/아레나/테스트)로 묶어 표시(admin-cohort-category-boxes).
 * 데이터·정렬 불변, 표시만. 각 박스 안은 기존 CohortSection 그대로.
 * 비어있는 카테고리 박스는 렌더 안 함. AdminUserPicker 500줄 cap 분리용.
 */
"use client";

import { cohortCategory, COHORT_CATEGORY_ORDER } from "@/types";
import { CohortSection, type Trainee, type Trainer } from "./AdminUserPickerSections";
import ArenaSeasonGroups from "./ArenaSeasonGroups";

const STYLE: Record<string, [string, string]> = {
  수강생: ["border-blue-200", "text-blue-800"],
  아레나: ["border-purple-200", "text-purple-800"],
  테스트: ["border-gray-200", "text-gray-600"],
};

export default function CohortCategoryBoxes({
  activeGroups,
  busy,
  nameByEmail,
  onPick,
  onReserve,
  onSetTeam,
  onReorder,
  onAssignTrainers,
  activeTrainers,
  linkedBySheet,
  viewOnly,
}: {
  activeGroups: [string, Trainee[]][];
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
}) {
  return (
    <>
      {COHORT_CATEGORY_ORDER.map((cat) => {
        const groups = activeGroups.filter(([k]) => cohortCategory(k) === cat);
        if (groups.length === 0) return null;
        const [box, head] = STYLE[cat]!;
        const cnt = groups.reduce((s, [, l]) => s + l.length, 0);
        return (
          <div key={cat} className={`rounded-2xl border-2 ${box} p-3`}>
            <div className={`mb-3 px-1 text-sm font-black ${head}`}>
              {cat} · {cnt}명
            </div>
            {/* 아레나만 시즌 우산으로 한 겹 더 묶는다(AR-1). 나머지는 기존 그대로. */}
            {cat === "아레나" ? (
              <ArenaSeasonGroups
                groups={groups}
                busy={busy}
                nameByEmail={nameByEmail}
                onPick={onPick}
                onReserve={onReserve}
                onSetTeam={onSetTeam}
                onReorder={onReorder}
                onAssignTrainers={onAssignTrainers}
                activeTrainers={activeTrainers}
                linkedBySheet={linkedBySheet}
                viewOnly={viewOnly}
              />
            ) : (
              <div className="space-y-8">
                {groups.map(([cohort, list]) => (
                  <CohortSection
                    key={cohort}
                    cohort={cohort}
                    list={list}
                    busy={busy}
                    nameByEmail={nameByEmail}
                    onPick={onPick}
                    onReserve={onReserve}
                    onSetTeam={onSetTeam}
                    onReorder={onReorder}
                    onAssignTrainers={onAssignTrainers}
                    activeTrainers={activeTrainers}
                    linkedBySheet={linkedBySheet}
                    viewOnly={viewOnly}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
