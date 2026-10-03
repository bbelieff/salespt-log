/**
 * Layer: repo — append 전용 DB 미러 내구성 강화 (BBE-248 ③).
 *
 * writeContractRow(append 경로, opts.syncDb 미설정)의 DB 반영은 fire-and-forget 이어야 한다 —
 * 동기+throw 로 바꾸면 사용자 재시도가 findFirstEmptyRow 를 다시 태워 새 행에 중복 기재된다
 * (첫 시도의 시트쓰기는 이미 성공해 있으므로, 매출 이중계상 위험 — BBE-246 이 append 를
 * dual-sync 에서 제외한 이유와 동일). 그래서 mirror.ts 의 표준 3회/선형백오프(~1.8초)보다
 * 재시도창을 늘려, BBE-244 급 순간적 DB pool 고갈 blip 의 실제 커버리지를 넓힌다 — 응답은
 * 여전히 무차단(호출부가 await 하지 않음), 다른 탭(meetings/todos/sales/db/company_archive)의
 * 미러 동작은 전혀 건드리지 않는다(mirror.ts 비공유, contracts append 전용 신규 경로).
 *
 * 한계(정직하게 수용): 이것도 "재시도 확률을 높이는 것"이지 durable 보장이 아니다. DB 가
 * 진짜 장시간 죽어있으면 이 함수도 결국 포기한다 — 그 경우의 진짜 안전망은 여전히
 * sheet-backfill.ts(목록조회 union). 이 함수는 그 안전망이 발동해야 하는 빈도를 줄일 뿐이다.
 */
import { captureServerEvent } from "@/lib/analytics/api-timing";
import { dbEnabled, upsertSheetRow } from "./db/client";
import { findOwnerBySpreadsheetId } from "./users";

const MAX_ATTEMPTS = 8;
const BACKOFF_MS = 700; // 700+1400+...+5600 ≈ 25초 총 재시도창 (mirror.ts 표준 1.8초의 ~14배)

async function attemptDurableAppendUpsert(
  spreadsheetId: string,
  row: number,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const owner = await findOwnerBySpreadsheetId(spreadsheetId).catch(() => null);
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await upsertSheetRow({
        cohort: owner?.cohort ?? "?",
        email: owner?.email ?? "",
        spreadsheetId,
        tab: "contracts",
        rowKey: `r${row}`,
        payload,
      });
      return true;
    } catch {
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, BACKOFF_MS * attempt));
      }
    }
  }
  console.warn(`[contract-append-mirror] 최종 실패 row=${row} (재시도 ${MAX_ATTEMPTS}회 소진)`);
  captureServerEvent("db_mirror_error", { tab: "contracts" });
  return false;
}

/** fire-and-forget — await 하지 말 것. writeContractRow 의 opts.syncDb 미설정 경로 전용. */
export function mirrorContractRowDurable(
  spreadsheetId: string,
  row: number,
  payload: Record<string, unknown>,
): void {
  if (!dbEnabled()) return;
  void attemptDurableAppendUpsert(spreadsheetId, row, payload);
}
