/**
 * Layer: service — sales(01 영업관리) 4지표 쓰기 정본 오케스트레이션 (R3-1, db-write-flip §2).
 *
 * 게이트(chooseWriteSource)로 분기:
 *   • "db"(파일럿 기수 + DB 켜짐) → **DB 동기 저장(정본)** + 시트 **비동기 미러**.
 *       DB 저장 실패 = 저장 실패로 throw(시트 폴백 금지 — §0 정본 이원화 금지).
 *   • "sheet"(그 외) → R2 그대로: batchWriteChannelDailyRows = 시트 정본 + 비동기 DB 미러.
 * 롤백 = chooseWriteSource 한 곳만 뒤집으면 즉시 R2 복귀(§4).
 * 정본 뒤집기 로직을 이 한 파일에 모아 saveContactMetrics 를 얇게 유지.
 */
import * as Sentry from "@sentry/nextjs";
import { dbEnabled, writeSalesRowsToDb, type SalesRowForDb } from "@/repo/db/client";
import { salesDbPayload } from "@/repo/db/sales-payload";
import { batchWriteChannelDailyRows } from "@/repo/sales";
import { captureServerEvent } from "@/lib/analytics/api-timing";
import type { ChannelDailyRow } from "@/types";
import { chooseWriteSource } from "./daily-source";

/** 컨택 저장 → DB payload. 채널별 규칙은 `salesDbPayload`(시트 쓰기와 1:1) 단일 원천. */
export function toDbRows(rows: ChannelDailyRow[]): SalesRowForDb[] {
  return rows.map(salesDbPayload);
}

/** rows 를 정본에 저장. DB 정본 경로 실패는 throw(저장 실패 응답). 시트 미러는 비차단. */
export async function persistSalesRows(
  cohort: string,
  email: string,
  spreadsheetId: string,
  rows: ChannelDailyRow[],
): Promise<void> {
  if (chooseWriteSource(cohort, dbEnabled()) === "db") {
    await writeSalesRowsToDb({ spreadsheetId, cohort, email, rows: toDbRows(rows) });
    fireSheetMirror(spreadsheetId, rows); // 비차단
  } else {
    await batchWriteChannelDailyRows(spreadsheetId, rows);
  }
}

/** DB 정본 경로의 시트 비동기 미러 — 비차단·선형 백오프(3회). 시트만 씀(mirror:false → DB 재미러 X).
 * 정본은 이미 DB 에 있으므로 최종 실패해도 저장은 성공, Sentry(sheet_mirror_error) 카운트만
 * (시트=운영자용 사본·롤백 근거, D3). VPS(pm2, 장수 프로세스)라 응답 후 fire-and-forget 완주. */
function fireSheetMirror(spreadsheetId: string, rows: ChannelDailyRow[]): void {
  void (async () => {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await batchWriteChannelDailyRows(spreadsheetId, rows, { mirror: false });
        return;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 300 * attempt));
      }
    }
    Sentry.captureException(lastErr, { tags: { where: "sales-sheet-mirror" } });
    captureServerEvent("sheet_mirror_error", { tab: "sales" });
  })();
}
