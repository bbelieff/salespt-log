/**
 * 관리자 왼쪽 메뉴(admin-side-nav) 승인 대기 수 — 홈과 같은 registry 캐시.
 * 읽기 실패는 0 으로 둔다(메뉴 숫자 때문에 관리자 화면이 막히지 않게).
 *
 * getAdminTodoCounts(admin-phase1, 2026-11-16): 관리자 홈 「오늘 할 일」 다섯 숫자. 전부 읽기.
 * 한 항목이 실패해도 나머지는 보이게 항목별로 null(=모름)로 둔다.
 */
import { listDistinctUsers, listPendingTrainees, listPendingTrainers, isReservedTrainee } from "@/repo/users";
import { getArchivedCohortSet } from "@/repo/cohorts";
import { countPendingCohortCreates } from "@/repo/db/cohort-pending";
import { cohortGroupKey } from "@/types";
import { countNewBugReportsForTodo } from "./bug-reports-admin";

export async function getAdminPendingCounts(): Promise<{ trainees: number; trainers: number }> {
  const [trainees, trainers] = await Promise.all([
    listPendingTrainees().catch(() => []),
    listPendingTrainers().catch(() => []),
  ]);
  return { trainees: trainees.length, trainers: trainers.length };
}

export interface AdminTodoCounts {
  pendingTrainees: number | null;
  pendingTrainers: number | null;
  /** 활성 기수의 활성 수강생 중 담당이 한 명도 없는 사람(유보·보관 기수 제외). */
  unassignedTrainees: number | null;
  /** 시트 복제가 실패해 대기 중인 기수 생성 건. */
  cohortCreateFailures: number | null;
  /** 최근 7일 안의 새 오류 신고. */
  newBugReports: number | null;
}

type TodoUser = Parameters<typeof isReservedTrainee>[0] & {
  role: string;
  status?: string;
  captainOf?: string;
  assignedTrainer?: string;
};

/** 담당 없는 활성 수강생 수 — 수강생 관리의 「활성 기수」 명단과 같은 범위. */
export function countUnassignedActiveTrainees(users: TodoUser[], archived: Set<string>): number {
  return users.filter(
    (u) =>
      u.role === "trainee" &&
      u.status === "active" &&
      !isReservedTrainee(u) &&
      !archived.has(cohortGroupKey(u.cohort, u.captainOf)) &&
      !(u.assignedTrainer ?? "").split(",").some((e) => e.trim()),
  ).length;
}

const orNull = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

export async function getAdminTodoCounts(): Promise<AdminTodoCounts> {
  const [pendingTrainees, pendingTrainers, users, archived, cohortCreateFailures, newBugReports] = await Promise.all([
    orNull(listPendingTrainees()),
    orNull(listPendingTrainers()),
    orNull(listDistinctUsers()),
    orNull(getArchivedCohortSet()),
    orNull(countPendingCohortCreates()),
    orNull(countNewBugReportsForTodo()),
  ]);
  return {
    pendingTrainees: pendingTrainees ? pendingTrainees.length : null,
    pendingTrainers: pendingTrainers ? pendingTrainers.length : null,
    unassignedTrainees: users && archived ? countUnassignedActiveTrainees(users, archived) : null,
    cohortCreateFailures,
    newBugReports,
  };
}
