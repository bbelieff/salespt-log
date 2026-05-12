/**
 * SheetAccessAdminCard — 시트 권한 진단 + 일괄 공유 (admin 전용).
 *
 * 두 액션:
 *   - [접근 점검] → GET /api/admin/sheet-access-check
 *     SA 가 등록된 모든 trainee 시트를 read 가능한지 확인. 실패 시트 목록 alert.
 *   - [일괄 공유 실행] → POST /api/admin/share-all-sheets
 *     admin OAuth token 으로 모든 시트에 SA writer 권한 자동 추가.
 *
 * AdminUserPicker.tsx 500줄 cap 초과 회피로 별도 파일.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SheetAccessAdminCard() {
  const router = useRouter();
  const [busy, setBusy] = useState<"check" | "share" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkSheetAccess() {
    setBusy("check");
    setError(null);
    try {
      const res = await fetch("/api/admin/sheet-access-check");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      const {
        serviceAccountEmail,
        hasOAuthToken,
        summary,
        sheets = [],
      } = data;
      const failedList = sheets
        .filter((s: { accessOk: boolean }) => !s.accessOk)
        .map(
          (s: { cohort: string; name: string; error?: string }) =>
            `  ${s.cohort}기 ${s.name}: ${(s.error ?? "unknown").slice(0, 80)}`,
        )
        .join("\n");
      const msg =
        `Service Account: ${serviceAccountEmail}\n` +
        `OAuth scope 보유: ${hasOAuthToken ? "✓" : "✗ (재로그인 필요)"}\n` +
        `\n점검 결과 (총 ${summary.total}개 시트):\n` +
        `  접근 OK: ${summary.ok}개\n` +
        `  권한 부족(forbidden): ${summary.forbidden}개\n` +
        `  찾을 수 없음(404): ${summary.notFound}개\n` +
        `  기타 오류: ${summary.other}개` +
        (failedList ? `\n\n실패 시트:\n${failedList}` : "");
      window.alert(msg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setBusy(null);
    }
  }

  async function shareAllSheets() {
    if (
      !window.confirm(
        "등록된 모든 수강생 시트에 Service Account 권한을 자동 추가합니다. 계속할까요?",
      )
    )
      return;
    setBusy("share");
    setError(null);
    try {
      const res = await fetch("/api/admin/share-all-sheets", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.hint ?? data.error ?? `HTTP ${res.status}`);
      } else {
        const { processed, shared, alreadyShared, shareFailed = [] } = data;
        window.alert(
          `처리: ${processed}개 시트\n` +
            `신규 공유: ${shared}개\n` +
            `이미 공유됨: ${alreadyShared}개` +
            (shareFailed.length > 0
              ? `\n실패 ${shareFailed.length}개:\n` +
                shareFailed
                  .map(
                    (f: { sheetId: string; error: string }) =>
                      `  - ${f.sheetId.slice(0, 12)}... : ${f.error}`,
                  )
                  .join("\n")
              : ""),
        );
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-purple-200 bg-purple-50/50 p-4">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-purple-800">
          🔗 시트 권한 진단 + 일괄 공유
        </div>
        <p className="mt-0.5 text-[11px] text-purple-700/80">
          OAuth scope 확장 후 [일괄 공유 실행] 한 번이면 모든 시트에 SA 권한
          자동 추가. 점검은 현재 어떤 시트가 권한 부족인지 확인용.
        </p>
        {error && (
          <p className="mt-1 text-[11px] text-red-600">{error}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={checkSheetAccess}
          disabled={busy !== null}
          title="SA 가 등록 시트들을 read 가능한지 점검"
          className="rounded-full border border-purple-300 bg-white px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-50 disabled:opacity-50"
        >
          {busy === "check" ? "점검 중..." : "접근 점검"}
        </button>
        <button
          type="button"
          onClick={shareAllSheets}
          disabled={busy !== null}
          className="rounded-full bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {busy === "share" ? "공유 중..." : "일괄 공유 실행"}
        </button>
      </div>
    </div>
  );
}
