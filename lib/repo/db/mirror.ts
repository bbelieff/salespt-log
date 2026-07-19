/**
 * Layer: repo — dual-write 미러 훅 (db-migration-pilot §1 P1·§3).
 *
 * 시트 쓰기 성공 **후** 호출되는 fire-and-forget upsert:
 *   • 비차단 — DB 실패는 warn 로그 + PostHog `db_mirror_error` 카운트만, 앱 응답 무영향.
 *   • DATABASE_URL 미설정이면 dbEnabled 가드로 즉시 no-op(호출 비용 0에 수렴).
 *   • cohort/email 은 spreadsheetId → 레지스트리 역조회(60s 캐시) — 실패해도 미러는
 *     "?"/"" 로 진행(파일럿 목적 = 파이프라인 검증·데이터 축적).
 *
 * row_key 규칙 (backfill 스크립트와 반드시 동일 — scripts/ops/backfill-sheet-rows.mjs):
 *   meetings(04)·todos(05) = A열 앱 id · contracts(02) = r{행번호} ·
 *   db(03) = {섹션}:r{행번호} · sales(01) = {날짜}:{채널} · company_archive(06) = C열 계약ref.
 *   clear 계열 = {_cleared:true} 병합(행 삭제 대신 마킹 — 대조 시 제외).
 */
import { findOwnerBySpreadsheetId } from "../users";
import { captureServerEvent } from "@/lib/analytics/api-timing";
import { dbEnabled, upsertSheetRow } from "./client";

/** 파일럿 미러 대상 탭 (기획 §2 enum — 개인 시트만, 레지스트리 제외). */
export type MirrorTab =
  | "meetings"
  | "contracts"
  | "todos"
  | "sales"
  | "db"
  | "company_archive";

/** fire-and-forget — await 하지 말 것(비차단 원칙). 시트 쓰기 성공 직후 호출.
 * R2 방향(시트 정본 → DB 미러): 일시 DB blip 이 반쪽쓰기로 굳지 않게 **선형 백오프 3회** 재시도
 * (2026-07-19, mirror_pending 안전망 동반 — 계획서 §486 silent 반쪽쓰기 완화). 최종 실패는
 * warn + PostHog(db_mirror_error) 만 — 이 방향은 DB 행이 아예 없어 pending 표식이 불가하므로
 * durable 정합은 backfill/parity 스크립트가 담당(R2 는 시트가 정본이라 손실 아님). */
export function mirrorSheetRow(p: {
  spreadsheetId: string;
  tab: MirrorTab;
  rowKey: string;
  payload: Record<string, unknown>;
}): void {
  if (!dbEnabled()) return; // 파일럿 밖 환경 — 완전 no-op
  void (async () => {
    const owner = await findOwnerBySpreadsheetId(p.spreadsheetId).catch(() => null);
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await upsertSheetRow({
          cohort: owner?.cohort ?? "?",
          email: owner?.email ?? "",
          spreadsheetId: p.spreadsheetId,
          tab: p.tab,
          rowKey: p.rowKey,
          payload: p.payload,
        });
        return;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 300 * attempt));
      }
    }
    throw lastErr;
  })().catch((e) => {
    const msg = (e instanceof Error ? e.message : "unknown").replace(
      /postgres(ql)?:\/\/\S+/gi,
      "[DATABASE_URL]",
    );
    console.warn(`[db-mirror] 실패 tab=${p.tab} key=${p.rowKey}: ${msg}`);
    captureServerEvent("db_mirror_error", { tab: p.tab });
  });
}

/** clear 계열 공용 — 행 삭제 대신 _cleared 마킹(대조·backfill 정합 규칙). */
export function mirrorClearRow(p: {
  spreadsheetId: string;
  tab: MirrorTab;
  rowKey: string;
}): void {
  mirrorSheetRow({ ...p, payload: { _cleared: true } });
}
