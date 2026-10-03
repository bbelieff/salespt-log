/**
 * Layer: repo — 03 DB관리 4섹션 append 전용 DB 미러 내구성 강화 (BBE-259, BBE-248/#824 이식).
 *
 * 4섹션 append(appendPurchase/Production/Banner/Lead)는 시트쓰기(findFirstEmptyRow) 이후 DB
 * 반영을 fire-and-forget 으로 한다 — 동기+throw 로 바꾸면 사용자 재시도가 findFirstEmptyRow
 * 를 다시 태워 새 행에 중복 기재된다(첫 시도의 시트쓰기는 이미 성공했으므로, 매출 이중계상
 * 위험 — BBE-248 코멘트 근거와 동일). BBE-59 UUID row_key(행번호 무관)라 DB 쪽 키 충돌은
 * 없지만, 시트 쪽 물리 행 중복은 키 스킴과 무관하게 동일하게 발생한다.
 *
 * mirror.ts 표준(3회/선형백오프 ~1.8초)보다 재시도창을 늘려(8회/700ms 배수 ≈25초, contracts
 * 판과 동일 상수) BBE-244 급 순간 DB pool 고갈 blip 의 실제 커버리지를 넓힌다. db/mirror.ts
 * 는 비공유(이 전용 경로만 사용 — 다른 탭 무영향, BBE-259 카드 경계).
 */
import { captureServerEvent } from "@/lib/analytics/api-timing";
import { dbEnabled, upsertSheetRow } from "./db/client";
import { findOwnerBySpreadsheetId } from "./users";

const MAX_ATTEMPTS = 8;
const BACKOFF_MS = 700; // 700+1400+...+5600 ≈ 25초 총 재시도창 (mirror.ts 표준 1.8초의 ~14배)

async function attemptDurableAppendUpsert(
  spreadsheetId: string,
  rowKey: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const owner = await findOwnerBySpreadsheetId(spreadsheetId).catch(() => null);
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await upsertSheetRow({
        cohort: owner?.cohort ?? "?",
        email: owner?.email ?? "",
        spreadsheetId,
        tab: "db",
        rowKey,
        payload,
      });
      return true;
    } catch {
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, BACKOFF_MS * attempt));
      }
    }
  }
  console.warn(`[db-tab-append-mirror] 최종 실패 rowKey=${rowKey} (재시도 ${MAX_ATTEMPTS}회 소진)`);
  captureServerEvent("db_mirror_error", { tab: "db" });
  return false;
}

/** fire-and-forget — await 하지 말 것. 4섹션 appendX 함수(db.ts) 전용. */
export function mirrorDbTabRowDurable(
  spreadsheetId: string,
  rowKey: string,
  payload: Record<string, unknown>,
): void {
  if (!dbEnabled()) return;
  void attemptDurableAppendUpsert(spreadsheetId, rowKey, payload);
}
