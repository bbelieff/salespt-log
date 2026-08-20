/**
 * Layer: repo — 03 DB관리 행의 시트 수렴 미러 (BBE-246, db-write-flip §2 후속).
 *
 * db/db-tab-sync.ts(R3-4)가 만든 "파일럿=DB 동기 정본" 의 절반만 실제로 요청 경로에서 시트를
 * 제거했다 — 지금까지는 DB 동기 여부와 무관하게 시트도 **항상** 동기로 썼다(BBE-242 실측).
 * 이 파일은 company-info-archive.ts(BBE-60, R7-#11)·contract-sheet-sync.ts(BBE-246, 02 탭 판)의
 * 큐/수렴 골격을 03 탭에 이식해 그 나머지 절반을 완성한다.
 *
 * 스코프: update/clear 만(행번호가 이미 확정된 경로). append(findFirstEmptyRow)는 제외 —
 * db/db-tab-sync.ts 헤더가 이미 명시한 이유(행번호=시트 할당, Phase 3 별도 카드) 그대로 적용.
 *
 * 재구성 방식: 섹션별 개별 read 헬퍼를 새로 만들지 않고 `readDbTabFromDb`(read-db-tab.ts, 4섹션
 * 배치 read — 이미 열문자/필드명 overlay·Zod 방어를 갖춘 테스트된 경로)를 그대로 재사용해 해당
 * (섹션, row) 항목만 골라 쓴다. 이 파일은 백그라운드 잡이라 "필요 이상 read" 비용보다 파싱 로직
 * 중복(Hashimoto 드리프트 위험)을 피하는 쪽을 우선했다.
 */
import { captureServerEvent } from "@/lib/analytics/api-timing";
import { SPEC, clearRowRange, writeRow, type SectionWriteSpec } from "./db-tab-writers";
import { readDbTabFromDb, type DbTabSections } from "./db/read-db-tab";
import { resolveWriteKey } from "./db/row-key";
import { readDbRowPayload } from "./db/db-tab-sync";
import { clearMirrorPending, listMirrorPending, markMirrorPending } from "./db/mirror-pending";
import { dbEnabled } from "./db/client";

export type DbSection = "매입DB" | "직접생산" | "현수막" | "콜지기소";

const sheetSyncTails = new Map<string, Promise<void>>();

/** 한 row 수렴 미러를 큐에 태운다(비차단). 같은 시트 잡은 **직렬**(contract-sheet-sync.ts 동일 패턴)
 *  — 인터리빙으로 옛 값이 이기지 않게. 잡 끝에 같은 시트의 다른 pending 행도 재드라이브(self-heal). */
export function queueDbTabRowSync(spreadsheetId: string, section: DbSection, row: number): void {
  const key = spreadsheetId;
  const tail = (sheetSyncTails.get(key) ?? Promise.resolve())
    .then(() => runDbTabRowSync(spreadsheetId, section, row))
    .then((rowKey) => drainPendingDbTabSheet(spreadsheetId, rowKey))
    .catch(() => {}); // runDbTabRowSync 가 실패를 계수 — 큐는 항상 전진
  sheetSyncTails.set(key, tail);
  void tail.finally(() => {
    if (sheetSyncTails.get(key) === tail) sheetSyncTails.delete(key);
  });
}

/** 1행 수렴 동기화 — 실행 시점 **최신 DB 상태** 기준(스냅샷 재생 금지). 선형 백오프 3회.
 *  성공 → mirror_pending 해제. 최종 실패 → 마킹 + 계수(§2.2·§7-3 동일 정책). 반환값(rowKey) 은
 *  drain 이 "방금 처리한 키"를 실제 저장 형식(`{섹션}:r{row}`/uuid)으로 스킵할 수 있게 한다. */
async function runDbTabRowSync(spreadsheetId: string, section: DbSection, row: number): Promise<string> {
  const rowKey = await resolveWriteKey(spreadsheetId, section, row); // 레거시/신규 키 중 현재 매핑된 것
  const ref = { spreadsheetId, tab: "db" as const, rowKey };
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await syncDbTabRowToSheet(spreadsheetId, section, row);
      await clearMirrorPending(ref).catch(() => {});
      return rowKey;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
  await markMirrorPending(ref).catch(() => {});
  console.warn(
    `[db-tab-sheet-sync] 시트 수렴 실패 ${section} row=${row}: ${lastErr instanceof Error ? lastErr.message : lastErr}`,
  );
  captureServerEvent("sheet_mirror_error", { tab: "db" });
  return rowKey;
}

const SPEC_OF: Record<DbSection, SectionWriteSpec> = {
  매입DB: SPEC.매입DB,
  직접생산: SPEC.직접생산,
  현수막: SPEC.현수막,
  콜지기소: SPEC.콜지기소,
};

function rowValuesOf(section: DbSection, sections: DbTabSections, row: number): (string | number | boolean)[] | null {
  if (section === "매입DB") {
    const p = sections.purchases.find((r) => r.row === row);
    if (!p) return null;
    return [p.구매일, p.업체명, p.개당단가, p.주문개수, p.부가세여부, p.기타, ""];
  }
  if (section === "직접생산") {
    const p = sections.productions.find((r) => r.row === row);
    if (!p) return null;
    return [p.시작일, p.종료일, p.소재, p.기간예산, p.생산개수, p.부가세여부, p.기타];
  }
  if (section === "현수막") {
    const b = sections.banners.find((r) => r.row === row);
    if (!b) return null;
    return [b.날짜, b.업체명, b.도착일, b.개당단가, b.주문개수, b.부가세여부, b.기타, ""];
  }
  const l = sections.leads.find((r) => r.row === row);
  if (!l) return null;
  return [l.구분, l.접수일, l.대표자명, l.업체명, l.소개처, l.연락처, l.조건];
}

/** 1회 시트 반영(최신 DB 상태) — 실패 시 throw(runDbTabRowSync 가 재시도·표식 관리).
 *  DB 행이 없거나(_cleared 포함) 의미있는 내용이 없으면 시트를 clear 한다. */
async function syncDbTabRowToSheet(spreadsheetId: string, section: DbSection, row: number): Promise<void> {
  const sections = await readDbTabFromDb(spreadsheetId);
  const values = rowValuesOf(section, sections, row);
  const spec = SPEC_OF[section];
  if (!values) {
    await clearRowRange(spreadsheetId, spec, row);
    return;
  }
  await writeRow(spreadsheetId, spec, row, values);
}

/** self-heal: 같은 시트의 밀린(mirror_pending) 03 행을 재드라이브. 1회 최대 25행.
 *  row_key = `{섹션}:r{row}`(레거시, 파싱) 또는 `{섹션}:{uuid}`(BBE-59 신규 — payload._row 로
 *  행번호 역조회, row-key.ts:rowNumOf 와 동일 규칙). */
async function drainPendingDbTabSheet(spreadsheetId: string, justSyncedKey: string): Promise<void> {
  if (!dbEnabled()) return;
  const keys = await listMirrorPending(spreadsheetId, "db", 25).catch(() => []);
  for (const key of keys) {
    if (key === justSyncedKey) continue;
    const idx = key.indexOf(":");
    if (idx < 0) continue;
    const section = key.slice(0, idx) as DbSection;
    if (!(section in SPEC_OF)) continue;
    const row = await rowNumberFromPendingKey(spreadsheetId, key);
    if (row === null) continue;
    await runDbTabRowSync(spreadsheetId, section, row);
  }
}

/** pending row_key → 행번호. 레거시(`{섹션}:r{row}`)는 문자열에서 바로 파싱, 신규(uuid)는 그
 *  키의 DB payload 를 직접 읽어 `_row`(신규 append 가 명시 기록, row-key.ts 헤더 참고)를 쓴다. */
async function rowNumberFromPendingKey(spreadsheetId: string, key: string): Promise<number | null> {
  const legacy = key.match(/^.*:r(\d+)$/);
  if (legacy) return Number(legacy[1]);
  const payload = await readDbRowPayload(spreadsheetId, key).catch(() => null);
  const explicit = Number(payload?._row);
  return Number.isFinite(explicit) && explicit > 0 ? explicit : null;
}
