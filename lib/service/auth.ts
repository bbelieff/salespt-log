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
  role: "trainee" | "trainer";
  status: "active" | "pending";
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

  const spreadsheetId = await findSheetByCohortName(cohortTrim, name);
  if (!spreadsheetId) throw new ClaimError("not_found");

  // claimRegistry 는 (cohort,name) 매칭되는 prep row 가 있으면 email 만 갱신
  // (status 보존 — 보통 active), 없으면 인자대로 새 row append.
  // 새 row 인 경우만 pending 으로 — admin 승인 후 활성.
  await claimRegistry(email, cohortTrim, name, spreadsheetId, "trainee", "pending");
  await writeProfile(spreadsheetId, cohortTrim, name);

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
