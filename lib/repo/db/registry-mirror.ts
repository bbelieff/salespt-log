/**
 * Layer: repo — 레지스트리(users/cohorts) dual-write 미러 훅 (BBE-55, R7 Phase1).
 *
 * lib/repo/db/mirror.ts(개인 시트 sheet_rows 미러)와 **같은 계약**, 다른 대상:
 *   • 시트 쓰기 성공 **후** 호출되는 fire-and-forget — `await` 하지 말 것(비차단).
 *   • DB 실패는 warn 로그 + PostHog `db_mirror_error` 만 — 앱 응답·시트 정본 무영향.
 *   • DATABASE_URL 미설정이면 dbEnabled 가드로 즉시 no-op.
 *   • 선형 백오프 3회 재시도(mirror.ts 와 동일) — 일시 blip 이 결손으로 굳지 않게.
 *
 * 자연키: users=(email,cohort,name) · cohorts=(label).
 *   users 에 name 이 들어가는 이유 = prep 행(email 빈값)·멀티계정 공유 시트 때문
 *   (실측 근거·유실 행수는 migrations/0002_users_natural_key.sql 주석 참조).
 * 정합 복구는 backfill(scripts/ops/backfill-registry.mjs) 재실행이 담당한다(시트가 정본).
 */
import { captureServerEvent } from "@/lib/analytics/api-timing";
import { dbEnabled } from "./client";
import {
  cohortColumnForLetter,
  deleteUserRow,
  rekeyUserRow,
  upsertCohortCells,
  upsertCohortRow,
  upsertUserCells,
  upsertUserRow,
  userColumnForLetter,
  type CohortCellColumn,
  type RegistryCohortRow,
  type RegistryUserRow,
  type UserCellColumn,
} from "./registry";

/** users 자연키 — 미러 호출부가 시트 행에서 그대로 뽑아 넘긴다. */
export interface UserKey {
  email: string;
  cohort: string;
  name: string;
}

/** 공통 실행기 — 3회 선형 백오프 후 최종 실패는 삼킨다(호출부로 절대 throw 안 함). */
function fireAndForget(label: string, run: () => Promise<void>): void {
  if (!dbEnabled()) return;
  void (async () => {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await run();
        return;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 300 * attempt));
      }
    }
    throw lastErr;
  })().catch((e) => {
    const msg = (e instanceof Error ? e.message : "unknown").replace(
      /postgres(ql)?:\/\/\S+/gi,
      "[DATABASE_URL]",
    );
    console.warn(`[registry-mirror] 실패 ${label}: ${msg}`);
    captureServerEvent("db_mirror_error", { tab: "registry" });
  });
}

/** 레지스트리 users 행 전체 미러(claim·신규등록·prep 등 행 단위 쓰기 짝). */
export function mirrorUserRow(u: RegistryUserRow): void {
  fireAndForget(`users row ${u.cohort}`, () => upsertUserRow(u));
}

/** users 부분 셀 미러 — 시트 열 문자(A~T) 기준. updateUserCell 등 단일/소수 셀 쓰기 짝.
 * ⚠️ 자연키 열(A email·B cohort·C name)을 바꾸는 쓰기는 여기로 오면 안 된다 —
 * 옛 키 행이 유령으로 남는다. 그 경우 호출부가 mirrorUserRekey 를 쓴다. */
export function mirrorUserCells(
  key: UserKey,
  cellsByLetter: Record<string, string | number>,
): void {
  // ⚠️ 열문자→컬럼 변환은 **비동기 경계 안**에서 한다 — 밖에서 하면 알 수 없는 열문자가
  // 동기 throw 로 새어나가, 이미 성공한 시트 쓰기를 사용자에게 500 으로 되돌린다(적대검증 4).
  fireAndForget(`users cells ${Object.keys(cellsByLetter).join(",")}`, async () => {
    const cells: Partial<Record<UserCellColumn, string | number>> = {};
    for (const [letter, value] of Object.entries(cellsByLetter)) {
      cells[userColumnForLetter(letter)] = value;
    }
    await upsertUserCells(key, cells);
  });
}

/** users 행 삭제 미러(deleteUserByEmail 짝). */
export function mirrorUserDelete(key: UserKey): void {
  fireAndForget(`users delete ${key.cohort}`, () => deleteUserRow(key));
}

/** 자연키(email·cohort·name) 자체가 바뀌는 쓰기 — A/B/C 열 갱신 짝.
 * 부분 upsert 로는 옛 키 행이 남아 유령이 되므로 **옛 키 삭제 → 새 행 upsert** 를
 * 한 작업으로 묶는다(순서 보장 위해 같은 fireAndForget 안에서 순차 실행). */
export function mirrorUserRekey(prev: UserKey, next: RegistryUserRow): void {
  fireAndForget(`users rekey ${prev.cohort}→${next.cohort}`, () => rekeyUserRow(prev, next));
}

/** User(zod 모델) → 미러 행. 레지스트리 A~T 와 1:1. */
export function registryRowFromUser(u: RegistryUserRow): RegistryUserRow {
  return { ...u };
}

/** 시트 원시 행(A~T 배열) → 미러 행. 시트를 이미 읽은 쓰기 경로가 그대로 넘긴다.
 * `overrides` 로 이번 쓰기가 바꾼 셀만 덮어쓴다(시트 재조회 없이 최종 상태 반영). */
export function registryRowFromSheetRow(
  r: unknown[],
  overrides: Partial<RegistryUserRow> = {},
): RegistryUserRow {
  const s = (i: number) => String(r[i] ?? "").trim();
  const rawSort = parseInt(s(12), 10);
  // role/status 는 **모르는 값도** 기본값으로 접는다 — `lib/repo/users.ts:parseRow` 와 동일 규칙.
  // 빈값만 접으면 손편집된 "Trainee"·"보류" 같은 값이 CHECK 제약을 때려 그 행만 조용히
  // 미러에서 누락된다(적대검증 3 — 화면엔 정상 표시돼 아무도 눈치채지 못한다).
  const role = s(4);
  const status = s(5);
  return {
    email: s(0), cohort: s(1), name: s(2), spreadsheetId: s(3),
    role: role === "trainer" || role === "admin" ? role : "trainee",
    status: status === "pending" || status === "archived" ? status : "active",
    assignedTrainer: s(6), team: s(7),
    cohortLabel: s(8), nameLabel: s(9), courseStartISO: s(10), graduationISO: s(11),
    sortOrder: Number.isFinite(rawSort) && rawSort >= 0 ? rawSort : 0,
    driveParentPath: s(13), feedbackFolderId: s(14), driveLinkStatus: s(15),
    memo: s(16), captainOf: s(17), gcalToken: s(18), gcalSettings: s(19),
    ...overrides,
  };
}

/** cohorts 행 전체 미러(시드·신규 append 짝). */
export function mirrorCohortRow(c: RegistryCohortRow): void {
  fireAndForget(`cohorts row ${c.label}`, () => upsertCohortRow(c));
}

/** cohorts 시트 원시 행(A~J 배열) → 미러 행. */
export function cohortRowFromSheetRow(r: unknown[]): RegistryCohortRow {
  const s = (i: number) => String(r[i] ?? "").trim();
  return {
    label: s(0),
    status: s(1) === "archived" ? "archived" : "active",
    note: s(2),
    type: s(3) === "arena" ? "arena" : "cohort",
    templateSheetId: s(4), rootFolderId: s(5), rosterSheetId: s(6),
    sheetsFolderId: s(7), companyParentFolderId: s(8), seasonStartISO: s(9),
  };
}

/** cohorts 부분 셀 미러 — 시트 열 문자(A~J) 기준. */
export function mirrorCohortCells(
  label: string,
  cellsByLetter: Record<string, string>,
): void {
  fireAndForget(`cohorts cells ${label}`, async () => {
    const cells: Partial<Record<CohortCellColumn, string>> = {};
    for (const [letter, value] of Object.entries(cellsByLetter)) {
      cells[cohortColumnForLetter(letter)] = value;
    }
    await upsertCohortCells(label, cells);
  });
}
