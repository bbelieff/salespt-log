/**
 * Layer: repo — 02 계약 행의 시트 수렴 미러 (BBE-246, db-write-flip §2 후속).
 *
 * db/contracts-clear.ts(R3-3)가 만든 "파일럿=DB 동기 정본" 의 절반만 실제로 요청 경로에서
 * 시트를 제거했다 — 지금까지는 DB 동기 여부와 무관하게 시트도 **항상** 동기로 썼다(BBE-242
 * 실측: contract-payment.ts:455,462 등). 이 파일은 company-info-archive.ts(BBE-60, R7-#11)의
 * 큐/수렴 골격을 02 탭에 이식해 그 나머지 절반을 완성한다.
 *
 * 스코프: update/clear 만(행번호가 이미 확정된 경로). append(findFirstEmptyRow)는 제외 —
 * db/contracts-clear.ts 헤더가 이미 명시한 이유(행번호=시트 할당, 재시도 시 중복행=매출
 * 이중계상) 그대로 적용(db-write-flip §6 R3-3, 03 DB관리 db/db-tab-sync.ts 의 동일 결정과 대칭).
 */
import { captureServerEvent } from "@/lib/analytics/api-timing";
import { ensureGridColumns, sheetsClient } from "./sheets-client";
import { contractFromDbPayload } from "./db/read-daily";
import { readContractRowPayload } from "./db/contracts-clear";
import { clearMirrorPending, listMirrorPending, markMirrorPending } from "./db/mirror-pending";
import { dbEnabled } from "./db/client";
import { resolveLayout, tabRef } from "./contract-payment";
import { cpToFullRow } from "./contract-payment-row";

const sheetSyncTails = new Map<string, Promise<void>>();

/** 한 row 수렴 미러를 큐에 태운다(비차단). 같은 시트 잡은 **직렬**(company-info-archive.ts 동일 패턴)
 *  — 인터리빙으로 옛 값이 이기지 않게. 잡 끝에 같은 시트의 다른 pending 행도 재드라이브(self-heal). */
export function queueContractRowSync(spreadsheetId: string, row: number): void {
  const key = spreadsheetId;
  const tail = (sheetSyncTails.get(key) ?? Promise.resolve())
    .then(() => runContractRowSync(spreadsheetId, row))
    .then(() => drainPendingContractSheet(spreadsheetId, row))
    .catch(() => {}); // runContractRowSync 가 실패를 계수 — 큐는 항상 전진
  sheetSyncTails.set(key, tail);
  void tail.finally(() => {
    if (sheetSyncTails.get(key) === tail) sheetSyncTails.delete(key);
  });
}

/** 1행 수렴 동기화 — 실행 시점 **최신 DB 상태** 기준(스냅샷 재생 금지, sales-write.ts 동일 원칙).
 *  선형 백오프 3회. 성공 → mirror_pending 해제. 최종 실패 → 마킹 + 계수(§2.2·§7-3 동일 정책). */
async function runContractRowSync(spreadsheetId: string, row: number): Promise<void> {
  const ref = { spreadsheetId, tab: "contracts" as const, rowKey: `r${row}` };
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await syncContractRowToSheet(spreadsheetId, row);
      await clearMirrorPending(ref).catch(() => {});
      return;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
  await markMirrorPending(ref).catch(() => {});
  console.warn(
    `[contract-sheet-sync] 시트 수렴 실패 row=${row}: ${lastErr instanceof Error ? lastErr.message : lastErr}`,
  );
  captureServerEvent("sheet_mirror_error", { tab: "contracts" });
}

/** 1회 시트 반영(최신 DB 상태) — 실패 시 throw(runContractRowSync 가 재시도·표식 관리).
 *  DB 행이 없거나(_cleared 포함) 의미있는 내용이 없으면(rowToCP 가드) 시트를 clear 한다 —
 *  삭제·미기록 양쪽 다 "시트에 남길 게 없다"는 같은 결론이라 한 분기로 처리. */
async function syncContractRowToSheet(spreadsheetId: string, row: number): Promise<void> {
  const { tab } = await resolveLayout(spreadsheetId);
  const range = `${tabRef(tab)}!C${row}:AO${row}`;
  const payload = await readContractRowPayload(spreadsheetId, row);
  const cp = payload && !payload._cleared ? contractFromDbPayload(payload, row) : null;
  if (!cp) {
    await sheetsClient().spreadsheets.values.clear({ spreadsheetId, range });
    return;
  }
  await ensureGridColumns(spreadsheetId, tab, 41); // AO = 41열 — 매 동기화가 AL~AO 까지 쓰므로 항상 보장
  await sheetsClient().spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [{ range, values: [cpToFullRow(cp)] }],
    },
  });
}

/** self-heal: 같은 시트의 밀린(mirror_pending) 02 행을 재드라이브. 1회 최대 25행. */
async function drainPendingContractSheet(spreadsheetId: string, justSyncedRow: number): Promise<void> {
  if (!dbEnabled()) return;
  const keys = await listMirrorPending(spreadsheetId, "contracts", 25).catch(() => []);
  for (const key of keys) {
    const n = Number(key.replace(/^r/, ""));
    if (!Number.isFinite(n) || n === justSyncedRow) continue;
    await runContractRowSync(spreadsheetId, n);
  }
}
