/**
 * Layer: service — Self-claim (수강생 / 트레이너 두 경로).
 *
 * 수강생 (cohort = 숫자):
 *   1. Drive API 시트 이름 정확 일치 검색 (`세일즈PT_ N기 이름 수강생 경영일지`)
 *   2. 매칭 1개 → registry email 갱신 + 시트 B3/C3 작성
 *   3. 0개/복수 → ClaimError("not_found")
 *
 * 트레이너 (cohort = "T"):
 *   1. Drive 검색 X (트레이너는 본인 시트 없음)
 *   2. registry 에 role=trainer, status=pending 으로 신규 append
 *   3. 관리자가 /admin 에서 승인 → status=active 로 전환
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

  await claimRegistry(email, cohortTrim, name, spreadsheetId, "trainee", "active");
  await writeProfile(spreadsheetId, cohortTrim, name);

  const cohortNum = cohortTrim.replace(/기\s*$/, "").trim();
  return {
    email,
    cohort: cohortNum,
    name: name.trim(),
    spreadsheetId,
    role: "trainee",
    status: "active",
  };
}
