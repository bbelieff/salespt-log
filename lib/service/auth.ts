/**
 * Layer: service — 인증·계정 매칭 (Self-claim).
 *
 * 흐름:
 *   1. Drive API로 시트 이름 정확 일치 검색 (`세일즈PT_ N기 이름 수강생 경영일지`)
 *   2. 매칭 시트 1개면 → registry email 갱신 + 시트 B3/C3 자동 작성
 *   3. 0개/복수면 → ClaimError 로 호출 측에 안내 위임
 *
 * SSOT: docs/plans/active/login-prototype.md
 */
import {
  findSheetByCohortName,
  claimRegistry,
  findUserByEmail,
} from "@/repo/users";
import { writeProfile } from "@/repo/sales";

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
}

/**
 * Self-claim 트랜잭션:
 *  - 이미 등록된 email 이면 그대로 반환 (idempotent — 재로그인 시 중복 작업 X)
 *  - 신규: Drive 검색 → registry update → 시트 B3/C3 작성 → 반환
 */
export async function claimAccount(
  email: string,
  cohort: string,
  name: string,
): Promise<ClaimResult> {
  // Idempotent: 이미 등록된 email 이면 그대로 반환
  const existing = await findUserByEmail(email);
  if (existing) {
    return {
      email: existing.email,
      cohort: existing.cohort,
      name: existing.name,
      spreadsheetId: existing.spreadsheetId,
    };
  }

  // Drive 검색
  const spreadsheetId = await findSheetByCohortName(cohort, name);
  if (!spreadsheetId) {
    throw new ClaimError("not_found");
  }

  // registry 갱신 + 시트 프로필 작성 — 둘 다 성공해야 완료.
  // Drive API search 가 1개 매칭만 통과하므로 ambiguous 는 not_found 로 흡수.
  await claimRegistry(email, cohort, name, spreadsheetId);
  await writeProfile(spreadsheetId, cohort, name);

  const cohortNum = String(cohort).replace(/기\s*$/, "").trim();
  return { email, cohort: cohortNum, name: name.trim(), spreadsheetId };
}
