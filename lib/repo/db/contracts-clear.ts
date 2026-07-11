/**
 * Layer: repo — 02 계약 행 삭제의 DB **동기** 반영 (Dev3-A 작업1: 조용한 반쪽 삭제 금지).
 *
 * 배경: 실무/수납 화면이 DB read(R2-4)인 파일럿에서, 삭제의 DB 미러(fire-and-forget,
 * 무재시도)가 한 번이라도 실패하면 시트만 지워지고 화면엔 유령 카드가 영구 잔존한다.
 * 삭제만큼은 시트+DB 를 한 동작으로: 실패 시 사용자에게 에러(재시도 유도 — 시트 clear 는
 * 이미 완료라 재삭제는 멱등). 비파일럿(시트 read)은 기존 fire-and-forget 유지(호출부 게이트).
 */
import { findOwnerBySpreadsheetId } from "../users";
import { dbEnabled, upsertSheetRow } from "./client";

/** _cleared 마킹을 await + 1회 재시도. 최종 실패 = throw(사용자 에러). */
export async function clearContractRowInDbSync(
  spreadsheetId: string,
  row: number,
): Promise<void> {
  if (!dbEnabled()) return; // DB 미설정 환경(로컬 등) — no-op
  const owner = await findOwnerBySpreadsheetId(spreadsheetId).catch(() => null);
  const doUpsert = () =>
    upsertSheetRow({
      cohort: owner?.cohort ?? "?",
      email: owner?.email ?? "",
      spreadsheetId,
      tab: "contracts",
      rowKey: `r${row}`,
      payload: { _cleared: true },
    });
  try {
    await doUpsert();
  } catch {
    try {
      await doUpsert(); // 멱등 — 1회 재시도
    } catch {
      throw new Error(
        "삭제가 화면 데이터에 아직 반영되지 않았어요. 잠시 후 한 번 더 삭제해 주세요.",
      );
    }
  }
}
