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
  isNumericCohortArchived,
} from "@/repo/users";
import { getArchivedCohortSet } from "@/repo/cohorts";
import { writeProfile, readProfileBundle } from "@/repo/sales";
import { arenaCohortLabelParts } from "@/service/cohort-token";
import { migrateArenaCarryover } from "@/service/arena-carryover";
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
  status: "active" | "pending" | "archived";
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
  // 보관(행 status=archived 또는 cohorts 탭 보관 기수)뿐이면 short-circuit 하지 않고
  // 신규 클레임 진행(아레나 재참가 합류 — rejoin §2). cohorts read 는 클레임 1회뿐이라
  // hot-path 아님(findUserByEmail 에선 분리, claim-stuck 2026-06-12).
  let existingArchived = existing?.status === "archived";
  if (existing && !existingArchived) {
    const archivedLabels = await getArchivedCohortSet().catch(() => new Set<string>());
    existingArchived = isNumericCohortArchived(existing.role, existing.cohort, archivedLabels);
  }
  if (existing && !existingArchived) {
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
  // 첫 등록자만 시트 B3/C3 작성 (이미 등록된 사람 있으면 덮어쓰지 않음).
  if (!existingSheetId) {
    await writeProfile(spreadsheetId, cohortTrim, name);
  }

  // 실제 등록된 status 를 다시 읽어 정확한 결과 반환 (prep row 매칭이면 active,
  // 신규 append 면 pending).
  const persisted = await findUserByEmail(email);
  const status: "active" | "pending" = persisted?.status === "active" ? "active" : "pending";

  // 아레나면 "A{시즌}-{기수}기" 라벨 유지, 일반은 숫자(기 strip).
  const parts = arenaCohortLabelParts(cohortTrim);
  const cohortLabel = parts
    ? `A${parts.season}-${parts.gisu}기`
    : cohortTrim.replace(/기\s*$/, "").trim();

  // 아레나 클레임 완료 → 이전 기수 파이프라인 자동 이월 1회 (carryover §2, 멱등).
  // 실패해도 클레임은 성공(warn) — backfill 은 admin "이월 실행" 버튼.
  if (parts) {
    try {
      const r = await migrateArenaCarryover(email);
      if (r.prior) {
        console.warn(
          `[claim] carryover ${email}: 미팅 ${r.meetings.copied}복사/${r.meetings.skipped}스킵, ` +
            `계약 ${r.contracts.copied}복사/${r.contracts.skipped}스킵, failed ${r.meetings.failed.length + r.contracts.failed.length}`,
        );
      }
    } catch (e) {
      console.warn("[claim] carryover 실패 (클레임은 성공):", e instanceof Error ? e.message : e);
    }
  }
  return {
    email,
    cohort: cohortLabel,
    name: name.trim(),
    spreadsheetId,
    role: "trainee",
    status,
  };
}
