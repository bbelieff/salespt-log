/**
 * Layer: service — 아레나 재참가 이월 마이그레이션 (arena-carryover §2).
 *
 * 읽기 = 이전 기수 시트(쓰기 금지), 쓰기 = 아레나 시트.
 * 대상: 04 상태=예약 미팅 전부 + 02 계약 행 전부. 복사 행 = 구분 "이월" + 원본키.
 * 멱등: 04 AP / 02 AJ 원본키로 중복 방지. 완료 후 이전 행 status=archived (§1).
 */
import { randomUUID } from "node:crypto";
import { findUserByEmail } from "@/repo/users";
import {
  findPriorCohortRow,
  isArenaCohort,
  markPriorRowArchived,
} from "@/repo/users-arena";
import {
  appendCarriedMeeting,
  listCarriedMeetingKeys,
  listCarrySourceMeetings,
} from "@/repo/carryover";
import {
  appendFromContract,
  readAll as readAllContracts,
  updateUserFields,
} from "@/repo/contract-payment";

export interface CarryoverReport {
  ok: boolean;
  reason?: string;
  prior?: { cohort: string; spreadsheetId: string };
  meetings: { copied: number; skipped: number; failed: string[] };
  contracts: { copied: number; skipped: number; failed: string[] };
  archivedMarked: boolean;
}

const empty = (): CarryoverReport => ({
  ok: false,
  meetings: { copied: 0, skipped: 0, failed: [] },
  contracts: { copied: 0, skipped: 0, failed: [] },
  archivedMarked: false,
});

/**
 * 이월 실행 — 클레임 자동 트리거 + admin backfill 양쪽이 사용. 멱등(재실행 안전).
 */
export async function migrateArenaCarryover(
  email: string,
): Promise<CarryoverReport> {
  const report = empty();
  const user = await findUserByEmail(email);
  if (!user || !user.spreadsheetId || !isArenaCohort(user.cohort)) {
    report.reason = "아레나 활성 행이 아님 — 이월 대상 아님";
    return report;
  }
  const arenaSheetId = user.spreadsheetId;
  const prior = await findPriorCohortRow(email, arenaSheetId);
  if (!prior) {
    report.reason = "이전 기수 행 없음 — 이월 생략";
    report.ok = true; // 대상 없음은 정상 종료
    return report;
  }
  report.prior = { cohort: prior.cohort, spreadsheetId: prior.spreadsheetId };

  // ── 04 예약 미팅 이월 (멱등: AP 원본키) ──
  const [sources, carried] = await Promise.all([
    listCarrySourceMeetings(prior.spreadsheetId),
    listCarriedMeetingKeys(arenaSheetId),
  ]);
  for (const src of sources) {
    if (carried.has(src.원본id)) {
      report.meetings.skipped++;
      continue;
    }
    try {
      await appendCarriedMeeting(arenaSheetId, src, randomUUID());
      report.meetings.copied++;
    } catch (e) {
      report.meetings.failed.push(
        `${src.원본id}: ${e instanceof Error ? e.message : "unknown"}`,
      );
    }
  }

  // ── 02 계약 행 이월 (멱등: AJ 원본키 = "02:{이전행번호}") ──
  const [oldContracts, arenaContracts] = await Promise.all([
    readAllContracts(prior.spreadsheetId),
    readAllContracts(arenaSheetId),
  ]);
  const carriedC = new Set(
    arenaContracts.map((c) => (c.이월원본행id ?? "").trim()).filter(Boolean),
  );
  for (const cp of oldContracts) {
    const key = `02:${cp.row}`;
    if (carriedC.has(key)) {
      report.contracts.skipped++;
      continue;
    }
    try {
      const { row } = await appendFromContract(
        arenaSheetId,
        { 계약일: cp.계약일, 업체명: cp.업체명, 수임비: cp.수임비 },
        { 원본행id: key },
      );
      // 체크박스·슬롯·메모(F:AH)까지 통째 복사 — updateUserFields 재사용.
      await updateUserFields(arenaSheetId, { ...cp, row });
      report.contracts.copied++;
    } catch (e) {
      report.contracts.failed.push(
        `row${cp.row}: ${e instanceof Error ? e.message : "unknown"}`,
      );
    }
  }

  // ── 이전 행 archived 마킹 (라우팅 active 우선 — §1) ──
  if (prior.status !== "archived") {
    try {
      await markPriorRowArchived(email, prior.cohort);
      report.archivedMarked = true;
    } catch (e) {
      console.warn(
        "[carryover] archived 마킹 실패:",
        e instanceof Error ? e.message : e,
      );
    }
  }

  report.ok =
    report.meetings.failed.length === 0 && report.contracts.failed.length === 0;
  return report;
}
