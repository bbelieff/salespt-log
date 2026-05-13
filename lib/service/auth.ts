/**
 * Layer: service — Self-claim (수강생 / 트레이너 두 경로).
 *
 * 수강생 (cohort = 숫자):
 *   1. Drive API 시트 이름 정확 일치 검색 (`세일즈PT_ N기 이름 수강생 경영일지`)
 *   2. 매칭 1개 →
 *      - admin 사전 등록 row 가 이미 있으면 → email 만 갱신, status 그대로 (즉시 활성).
 *      - row 없으면 → 새 row append (status=pending). 관리자 승인 필요.
 *   3. 0개/복수 → ClaimError("not_found")
 *
 * 트레이너 (cohort = "T"):
 *   1. Drive 검색 X (트레이너는 본인 시트 없음)
 *   2. registry 에 role=trainer, status=pending 으로 신규 append
 *   3. 관리자가 /admin 에서 승인 → status=active 로 전환
 *
 * 승인 흐름 통일 (2026-05-12):
 *   - 트레이너·수강생 모두 self-claim 신규 row 는 status=pending.
 *   - admin 이 미리 만들어둔 row (cohort/name 입력 + email 비어있는 prep row) 가
 *     있는 경우는 즉시 활성 (claimRegistry 가 email 만 채우고 status 보존).
 *   - 기존 active trainee row 들은 영향 없음 (이미 status=active).
 *
 * PR B-2 (2026-05-13):
 *   trainee 신규 append 경로 (prep row 없는 케이스) 에서도 시트 B3/C3/O1/O2 를
 *   readProfileBundle 로 1회 fetch → registry I~L 캐시에 stamp. 평시 시트 read 0회
 *   목표의 두 번째 단계. 실패 시 빈값으로 진행 (B-3 sync 버튼이 backfill).
 */
import {
  findSheetByCohortName,
  findExistingSheetIdByCohortName,
  claimRegistry,
  findUserByEmail,
} from "@/repo/users";
import { writeProfile, readProfileBundle, readProfile } from "@/repo/sales";
import type { CachedLabels } from "@/repo/users-claim";

export type ClaimErrorReason = "not_found" | "ambiguous";

export class ClaimError extends Error {
  constructor(public reason: ClaimErrorReason) {
    super(`claim error: ${reason}`);
    this.name = "ClaimError";
  }
}

export interface ClaimResult {
  email: string;
  cohort: string;
  name: string;
  spreadsheetId: string;
  role: "trainee" | "trainer";
  status: "active" | "pending";
}

const EMPTY_CACHED: CachedLabels = {
  cohortLabel: "",
  nameLabel: "",
  courseStartISO: "",
  graduationISO: "",
};

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * 시트 메타 1회 fetch → registry I~L 캐시 stamp 용. 실패는 빈값으로 흡수.
 * spreadsheetId 가 빈 문자열이면 fetch 안 함 (트레이너 케이스).
 */
async function fetchCachedLabels(spreadsheetId: string): Promise<CachedLabels> {
  if (!spreadsheetId) return EMPTY_CACHED;
  try {
    const b = await readProfileBundle(spreadsheetId);
    return {
      cohortLabel: b.cohort,
      nameLabel: b.name,
      courseStartISO: toISO(b.courseStart),
      graduationISO: toISO(b.graduation),
    };
  } catch (e) {
    console.warn(
      `[auth] cached labels fetch 실패 (sheet=${spreadsheetId}) — 빈값으로 등록. ` +
        `admin /admin/users [🔄 동기화] 에서 backfill 가능.`,
      e instanceof Error ? e.message : e,
    );
    return EMPTY_CACHED;
  }
}

export async function claimAccount(
  email: string,
  cohort: string,
  name: string,
): Promise<ClaimResult> {
  const existing = await findUserByEmail(email);
  if (existing) {
    return {
      email: existing.email,
      cohort: existing.cohort,
      name: existing.name,
      spreadsheetId: existing.spreadsheetId,
      role: existing.role === "admin" ? "trainer" : existing.role,
      status: existing.status,
    };
  }

  const cohortTrim = String(cohort).trim();
  const isTrainer = cohortTrim.toUpperCase() === "T";

  if (isTrainer) {
    // 트레이너는 시트 없음 → cached 빈값.
    await claimRegistry(email, "T", name, "", "trainer", "pending");
    return {
      email,
      cohort: "T",
      name: name.trim(),
      spreadsheetId: "",
      role: "trainer",
      status: "pending",
    };
  }

  // 멀티 계정 per 시트: 같은 (cohort, name) 으로 이미 누군가 등록되어 있으면
  // 그 spreadsheetId 재사용 (Drive 매칭 우회 — 시트 이름이 prep 패턴과
  // 달라도 추가 계정 OK). 신규는 Drive 검색 fallback.
  const existingSheetId = await findExistingSheetIdByCohortName(cohortTrim, name);
  const spreadsheetId =
    existingSheetId ?? (await findSheetByCohortName(cohortTrim, name));
  if (!spreadsheetId) throw new ClaimError("not_found");

  // 시트 메타 1회 fetch — prep row 케이스에선 claimRegistry 가 cached 무시하므로
  // 헛수고지만, 신규 append 가 압도적으로 흔한 경로이고 readProfileBundle 은
  // 단일 batchGet 이라 비용 무시 가능. prep row 면 빠르게 통과.
  const cached = await fetchCachedLabels(spreadsheetId);

  // claimRegistry 는 prep row(빈 email) 발견 시 그 자리 채움(I~L 보존), 다른
  // 계정으로 점유된 row 있으면 새 row append(같은 spreadsheetId + cached 공유),
  // 신규면 fresh append(cached 포함).
  await claimRegistry(
    email,
    cohortTrim,
    name,
    spreadsheetId,
    "trainee",
    "pending",
    cached,
  );
  // 시트 B3/C3 작성 — 멱등 동작.
  //   - 신규 시트(existingSheetId === null): 무조건 write
  //   - prep row 매칭(existingSheetId 있음): admin 이 시트를 복제만 하고 B3/C3
  //     안 채운 경우가 흔함 → 빈 셀만 채움. 이미 채워진 셀은 다른 계정의
  //     이름일 수 있어 덮어쓰지 않음 (multi-account-per-sheet 케이스 보존).
  // (2026-05-13 7기 5명 + 4기 손기학 C3 비어있음 사고 후 도입)
  if (!existingSheetId) {
    await writeProfile(spreadsheetId, cohortTrim, name);
  } else {
    const profile = await readProfile(spreadsheetId);
    if (!profile.cohort || !profile.name) {
      await writeProfile(spreadsheetId, cohortTrim, name);
    }
  }

  // 실제 등록된 status 를 다시 읽어 정확한 결과 반환 (prep row 매칭이면 active,
  // 신규 append 면 pending).
  const persisted = await findUserByEmail(email);
  const status: "active" | "pending" = persisted?.status === "active" ? "active" : "pending";

  const cohortNum = cohortTrim.replace(/기\s*$/, "").trim();
  return {
    email,
    cohort: cohortNum,
    name: name.trim(),
    spreadsheetId,
    role: "trainee",
    status,
  };
}
