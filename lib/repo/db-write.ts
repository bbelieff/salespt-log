/**
 * Layer: repo — 03 DB관리 4섹션 update/clear (R3-4 dual-sync). db.ts 에서 분리(500줄 캡 — db.ts 가
 * BBE-59 UUID 키 발급 추가로 초과, db-production-cell.ts 와 같은 이유의 분리).
 * append 는 행번호 발급(findFirstEmptyRow)과 묶여 있어 db.ts 에 남는다. 셀 쓰기 헬퍼(writeRow·
 * clearRowRange·SPEC)는 db-tab-writers.ts 공유 — 순환참조 방지(이 파일은 db.ts 를 import 하지 않는다).
 *
 * row_key (BBE-59, R7-#10 Phase 1): `resolveWriteKey` 로 그 물리 행에 **현재 매핑된** 키(레거시
 * `{섹션}:r{row}` 또는 신규 uuid)를 조회해서 쓴다 — db/row-key.ts 헤더 참고.
 */
import type { DBBanner, DBLead, DBProduction, DBPurchase } from "@/types";
import { SPEC, clearRowRange, writeRow } from "./db-tab-writers";
import { clearDbRow, persistDbRow, type DbTabWriteOpts } from "./db/db-tab-sync";
import { resolveWriteKey } from "./db/row-key";

// ── update (특정 row) ─────────────────────────────────────────

export async function updatePurchase(
  spreadsheetId: string,
  row: number,
  p: DBPurchase,
  opts?: DbTabWriteOpts,
): Promise<void> {
  await writeRow(spreadsheetId, SPEC.매입DB, row, [
    p.구매일,
    p.업체명,
    p.개당단가,
    p.주문개수,
    p.부가세여부, // F
    p.기타, // G
    "", // H 정리
  ]);
  const key = await resolveWriteKey(spreadsheetId, "매입DB", row); // BBE-59: 레거시/신규 키 중 현재 매핑된 것
  await persistDbRow(spreadsheetId, key, { ...p, _row: row, _cleared: false }, opts); // R3-4 dual-sync
}

export async function updateProduction(
  spreadsheetId: string,
  row: number,
  p: DBProduction,
  opts?: DbTabWriteOpts,
): Promise<void> {
  await writeRow(spreadsheetId, SPEC.직접생산, row, [
    p.시작일, // I
    p.종료일, // J
    p.소재, // K
    p.기간예산, // L
    p.생산개수, // M
    p.부가세여부, // N
    p.기타, // O
  ]);
  const key = await resolveWriteKey(spreadsheetId, "직접생산", row); // BBE-59: 레거시/신규 키 중 현재 매핑된 것
  await persistDbRow(spreadsheetId, key, { ...p, _row: row, _cleared: false }, opts); // R3-4 dual-sync
}

export async function updateBanner(
  spreadsheetId: string,
  row: number,
  b: DBBanner,
  opts?: DbTabWriteOpts,
): Promise<void> {
  await writeRow(spreadsheetId, SPEC.현수막, row, [
    b.날짜,
    b.업체명,
    b.도착일,
    b.개당단가,
    b.주문개수,
    b.부가세여부, // U
    b.기타, // V
    "", // W 정리
  ]);
  const key = await resolveWriteKey(spreadsheetId, "현수막", row); // BBE-59: 레거시/신규 키 중 현재 매핑된 것
  await persistDbRow(spreadsheetId, key, { ...b, _row: row, _cleared: false }, opts); // R3-4 dual-sync
}

export async function updateLead(
  spreadsheetId: string,
  row: number,
  l: DBLead,
  opts?: DbTabWriteOpts,
): Promise<void> {
  await writeRow(spreadsheetId, SPEC.콜지기소, row, [
    l.구분,
    l.접수일,
    l.대표자명,
    l.업체명,
    l.소개처,
    l.연락처,
    l.조건,
  ]);
  const key = await resolveWriteKey(spreadsheetId, "콜지기소", row); // BBE-59: 레거시/신규 키 중 현재 매핑된 것
  await persistDbRow(spreadsheetId, key, { ...l, _row: row, _cleared: false }, opts); // R3-4 dual-sync
}

// ── clear (특정 row) ──────────────────────────────────────────

export async function clearPurchase(spreadsheetId: string, row: number, opts?: DbTabWriteOpts) {
  await clearRowRange(spreadsheetId, SPEC.매입DB, row);
  const key = await resolveWriteKey(spreadsheetId, "매입DB", row); // BBE-59
  await clearDbRow(spreadsheetId, key, opts); // R3-4 dual-sync
}
export async function clearProduction(spreadsheetId: string, row: number, opts?: DbTabWriteOpts) {
  await clearRowRange(spreadsheetId, SPEC.직접생산, row);
  const key = await resolveWriteKey(spreadsheetId, "직접생산", row); // BBE-59
  await clearDbRow(spreadsheetId, key, opts); // R3-4 dual-sync
}
export async function clearBanner(spreadsheetId: string, row: number, opts?: DbTabWriteOpts) {
  await clearRowRange(spreadsheetId, SPEC.현수막, row);
  const key = await resolveWriteKey(spreadsheetId, "현수막", row); // BBE-59
  await clearDbRow(spreadsheetId, key, opts); // R3-4 dual-sync
}
export async function clearLead(spreadsheetId: string, row: number, opts?: DbTabWriteOpts) {
  await clearRowRange(spreadsheetId, SPEC.콜지기소, row);
  const key = await resolveWriteKey(spreadsheetId, "콜지기소", row); // BBE-59
  // 발굴id:"" 함께 무효화(R14) — 행 재사용 시 죽은 발굴id 가 새 lead 로 상속되는 것 차단(lead-chain §4-3 B3).
  await clearDbRow(spreadsheetId, key, opts, { 발굴id: "" });
}
