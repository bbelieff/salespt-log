/**
 * Layer: repo — 02 계약 행 찾기: **DB 먼저**, 못 찾으면 예전처럼 시트(화석 조사 B1, 2026-10-15).
 *
 * 예전: 파일럿(DB 정본) 기수도 계약을 고치거나 지울 때마다 시트 02 의 C:AK 전체를 읽어 줄을 찾았다
 * (`findRowByLink`). 시트는 비동기 미러라 반영이 밀리면 엉뚱한 줄(같은 날·같은 업체명의 다른 계약)을
 * 고를 수 있었고, 요청마다 시트 API 를 불렀다.
 * 지금: opts.syncDb(파일럿)면 DB 의 계약들로 **같은 규칙**(미팅 id 우선 → 계약일+업체명, 수동 행 제외,
 * 가장 앞 줄)으로 찾는다. DB 에 없거나 DB 읽기가 실패하면 예전 시트 경로로 — 동작은 예전의 상위집합.
 * DB row_key(r{N})가 곧 시트 줄번호라, 찾은 번호는 이후 clearRow·persistContractRow 와 그대로 맞는다.
 */
import type { ContractPayment } from "@/types";
import { isManualContractLink } from "@/util/contract-link";
import { findRowByLink } from "./contract-payment";
import { readContractsFromDb } from "./db/read-daily";
import type { ContractWriteOpts } from "./db/contracts-clear";

export type ContractLinkKey = { meetingId?: string; 계약일?: string; 업체명?: string };

/** 시트 경로(findRowByLink)와 같은 매칭 규칙 — 순수 함수. */
export function matchContractRow(rows: ContractPayment[], key: ContractLinkKey): number | null {
  const sorted = [...rows].filter((r) => typeof r.row === "number").sort((a, b) => a.row! - b.row!);
  const id = key.meetingId?.trim();
  if (id) {
    const hit = sorted.find((r) => (r.linkedMeetingId ?? "").trim() === id);
    if (hit) return hit.row!;
  }
  if (key.계약일 && key.업체명) {
    const name = key.업체명.trim();
    const hit = sorted.find(
      (r) => !isManualContractLink(r.linkedMeetingId ?? "") && r.계약일 === key.계약일 && r.업체명.trim() === name,
    );
    if (hit) return hit.row!;
  }
  return null;
}

export async function findContractRow(
  spreadsheetId: string,
  key: ContractLinkKey,
  opts?: ContractWriteOpts,
): Promise<number | null> {
  if (opts?.syncDb) {
    try {
      const fromDb = matchContractRow(await readContractsFromDb(spreadsheetId), key);
      if (fromDb !== null) return fromDb;
    } catch (e) {
      console.warn("[contract-row-lookup] DB 조회 실패 — 시트로 찾음:", e instanceof Error ? e.message : e);
    }
  }
  return findRowByLink(spreadsheetId, key);
}
