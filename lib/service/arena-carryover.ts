/**
 * Layer: service — 아레나 재참가 이월 마이그레이션 (arena-carryover §2).
 *
 * 읽기 = 이전 기수 시트(쓰기 금지), 쓰기 = 아레나 시트.
 * 대상: 04 상태=예약 미팅 전부 + 02 계약 행 전부. 복사 행 = 구분 "이월" + 원본키.
 * 멱등: 04 AP / 02 AJ 원본키로 중복 방지. 완료 후 이전 행 status=archived (§1).
 */
import { randomUUID } from "node:crypto";
import {
  findActiveArenaRowByEmail,
  findPriorCohortRow,
  markPriorRowArchived,
} from "@/repo/users-arena";
import {
  appendCarriedMeeting,
  carriedMeetingPayload,
  listCarriedMeetingKeys,
  listCarrySourceMeetings,
} from "@/repo/carryover";
import { chooseWriteSource } from "./daily-source";
import { dbEnabled, writeRowToDb } from "@/repo/db/client";
import { listCarriedMeetingKeysFromDb } from "@/repo/db/read-daily";
import { queueMeetingSheetSync } from "./meetings-write";
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
  // 이월은 항상 '아레나 행' 기준 — 선호 행(trainer)을 잡는 findUserByEmail 금지.
  // (수강생출신 트레이너+아레나에서 T 행이 잡혀 이월이 막히던 버그, §B 2026-06-18.)
  const arenaUser = await findActiveArenaRowByEmail(email);
  if (!arenaUser || !arenaUser.spreadsheetId) {
    report.reason = "아레나 활성 행이 아님 — 이월 대상 아님";
    return report;
  }
  const arenaSheetId = arenaUser.spreadsheetId;
  const prior = await findPriorCohortRow(email, arenaSheetId);
  if (!prior) {
    report.reason = "이전 기수 행 없음 — 이월 생략";
    report.ok = true; // 대상 없음은 정상 종료
    return report;
  }
  report.prior = { cohort: prior.cohort, spreadsheetId: prior.spreadsheetId };

  // ── 04 예약 미팅 이월 (멱등: AP 원본키 — 파일럿은 시트∪DB 양 키 합집합) ──
  // R3-2: 아레나(항상 파일럿)는 DB 동기 정본 + 시트 수렴 잡. 전환기 재실행 중복 방지를 위해
  // 멱등키를 시트 AP 와 DB(신형 AP·구형 원본행id) 합집합으로 판정.
  const dbPrimary = chooseWriteSource(arenaUser.cohort, dbEnabled()) === "db";
  const [sources, carried] = await Promise.all([
    listCarrySourceMeetings(prior.spreadsheetId),
    listCarriedMeetingKeys(arenaSheetId),
  ]);
  if (dbPrimary) {
    for (const k of await listCarriedMeetingKeysFromDb(arenaSheetId)) carried.add(k);
  }
  const arenaCtx = {
    spreadsheetId: arenaSheetId,
    cohort: arenaUser.cohort,
    email,
  };
  for (const src of sources) {
    if (carried.has(src.원본id)) {
      report.meetings.skipped++;
      continue;
    }
    try {
      const newId = randomUUID();
      if (dbPrimary) {
        await writeRowToDb({
          ...arenaCtx,
          tab: "meetings",
          rowKey: newId,
          payload: carriedMeetingPayload(src, newId),
        });
        queueMeetingSheetSync(arenaCtx, newId); // 시트는 수렴 잡이 반영(재실행 드리프트 자기수정)
      } else {
        await appendCarriedMeeting(arenaSheetId, src, newId);
      }
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
      // 파일럿(dbPrimary)은 DB 반영을 **동기 정본**으로 — append 미러(fire-and-forget)가 1회 실패하면
      // DB 에 구분='이월' 이 안 남아 시트(AI='이월')와 갈린다(#558 PARTIAL ②, DevD). 여기선 시트 AJ
      // 원본키가 멱등키라 실패 후 재실행이 skip 되므로 throw 해도 중복 계약행이 안 생긴다
      // (addPriorContract/addFromContract 는 멱등키가 없어 기존대로 no-throw 미러 유지 — §6 R3-3).
      const writeOpts = { syncDb: dbPrimary };
      const { row } = await appendFromContract(
        arenaSheetId,
        { 계약일: cp.계약일, 업체명: cp.업체명, 수임비: cp.수임비 },
        { 원본행id: key },
        writeOpts,
      );
      // 체크박스·슬롯·메모(F:AH)까지 통째 복사 — updateUserFields 재사용(미러는 F:AH 화이트리스트).
      await updateUserFields(arenaSheetId, { ...cp, row }, writeOpts);
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
