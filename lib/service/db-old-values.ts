/**
 * Layer: service — 03 DB관리 patch/remove 전 "옛 값" 조회 헬퍼 (db.ts 에서 분리 — 500줄 캡,
 * BBE-246 이 db.ts 를 캡 초과시켜 다른 500줄 분리와 같은 이유로 뗐다).
 *
 * patch/remove 는 옛 값(날짜·발굴id)을 알아야 한다 — 날짜는 생산(E) 재집계(옛 날짜 차감·새
 * 날짜 반영), 발굴id 는 안정 키 보존(remint 방지, lead-chain §4-3). 이 파일은 그 두 조회만 담당.
 */
import { readLeads, readProductions, readPurchases } from "@/repo/db";
import { readDbTabFromDb, type DbTabSections } from "@/repo/db/read-db-tab";
import type { Channel, DBBanner, DBLead, DBProduction, DBPurchase } from "@/types";

export async function readChannelRows(spreadsheetId: string, channel: Channel) {
  if (channel === "매입DB") return (await readPurchases(spreadsheetId)).rows;
  if (channel === "직접생산") return (await readProductions(spreadsheetId)).rows;
  return (await readLeads(spreadsheetId)).rows;
}

/** raw 행에서 그 (채널, 날짜)의 날짜 필드 값 (patch/remove 의 옛 날짜 식별용). */
function dateOfRow(channel: Channel, row: DBPurchase | DBProduction | DBBanner | DBLead): string {
  if (channel === "매입DB") return (row as DBPurchase).구매일;
  if (channel === "콜·지·기·소") return (row as DBLead).접수일;
  if (channel === "직접생산") return (row as DBProduction).종료일; // 집계 기준 = 종료일
  return (row as DBBanner).날짜; // 현수막
}

/** DB 4섹션에서 (채널, row) 의 옛 값 찾기 — oldDateOf 의 DB 경로 전용(BBE-246). */
function findInDbSections(
  sections: DbTabSections,
  channel: Channel,
  row: number,
): DBPurchase | DBProduction | DBBanner | DBLead | undefined {
  if (channel === "매입DB") return sections.purchases.find((r) => r.row === row);
  if (channel === "직접생산") return sections.productions.find((r) => r.row === row);
  if (channel === "현수막") return sections.banners.find((r) => r.row === row);
  return sections.leads.find((r) => r.row === row);
}

/** patch/remove 전 해당 row 의 옛 날짜 읽기 (날짜 변경·삭제 시 옛 날짜 E 재집계용).
 *
 * BBE-246: syncDb(파일럿)면 **DB 를 먼저** 시도한다(readDbTabFromDb — oldLeadIdOf 와 동일
 * 근거: 시트 read 를 요청 경로에서 없애는 게 목적). DB 실패/미발견 시에만 시트로 폴백 —
 * 이 read 는 재집계(E 셀) 보조용이라 실패해도 저장 자체(이미 끝남)엔 영향 없다. */
export async function oldDateOf(
  spreadsheetId: string,
  channel: Channel,
  row: number,
  syncDb: boolean,
): Promise<string> {
  if (syncDb) {
    try {
      const sections = await readDbTabFromDb(spreadsheetId);
      const hit = findInDbSections(sections, channel, row);
      if (hit) return dateOfRow(channel, hit);
    } catch {
      /* DB 실패 — 아래 시트 폴백 */
    }
  }
  const rows = await readChannelRows(spreadsheetId, channel);
  const hit = (rows as Array<{ row: number }>).find((r) => r.row === row);
  return hit ? dateOfRow(channel, hit as never) : "";
}

/** oldLeadId 3-state — "없음(mint)" 과 "읽기 실패(보존)" 을 구분한다(핵심).
 *  · string  = 기존 발굴id (보존)
 *  · "mint"  = 기존 id 확실히 없음(백필/legacy/비파일럿) → 새로 부여
 *  · "keep"  = DB read 실패로 알 수 없음 → **발굴id 를 payload 에서 omit**(jsonb 병합이 기존 값 보존) */
export type OldLeadId = string | "mint" | "keep";

/** 콜·지·기·소 특정 row 의 기존 발굴id. ⚠️ 시트 리더(readLeads=X:AD 파서 7필드)는 **발굴id 를 못 만든다**
 * (발굴id=DB payload 전용·시트 컬럼 0). 발굴id 를 실어오는 read 는 **readDbTabFromDb**(DB overlay)뿐 —
 * read-db-tab.ts 헤더가 경고한 "시트 db.ts vs Postgres db/" 혼동에 빠지지 말 것.
 * read 실패를 "없음"과 혼동하면 순단 시 remint 로 안정 id 를 파괴하므로, 실패는 "keep"(보존)으로 분리한다. */
export async function oldLeadIdOf(spreadsheetId: string, row: number, syncDb: boolean): Promise<OldLeadId> {
  if (!syncDb) return "mint"; // 비파일럿=시트 read라 발굴id 부재 → 새로 부여
  try {
    const { leads } = await readDbTabFromDb(spreadsheetId);
    return leads.find((l) => l.row === row)?.발굴id || "mint";
  } catch {
    return "keep"; // DB 순단 등 — 알 수 없음 → 덮지 말고 기존 값 보존(omit)
  }
}
