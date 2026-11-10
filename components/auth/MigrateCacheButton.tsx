/**
 * MigrateCacheButton — registry I~L 캐시 일괄 동기화 (헤더용 작은 버튼, PR B-3).
 *
 * 동작:
 *   1. [🔄 동기화] 클릭 → confirm
 *   2. POST /api/admin/migrate-registry-cache
 *   3. 결과 alert (갱신 N / 스킵 M / 실패 K 목록) + router.refresh()
 *
 * 사용 시점:
 *   - PR B-1 머지 직후: 기존 row 전체 빈 I~L backfill.
 *   - PR B-2 운영 중: prep/claim 시 시트 권한 미부여로 실패한 row retry.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface MigrateFailed {
  row: number;
  email: string;
  cohort: string;
  name: string;
  error: string;
}

interface MigrateResponse {
  processed: number;
  updated: number;
  skipped: number;
  failed: MigrateFailed[];
}

export default function MigrateCacheButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function migrate() {
    if (
      !window.confirm(
        "모든 수강생의 기수·이름·시작일·종강일 표시를 시트에서 다시 불러옵니다.\n" +
          "이미 채워진 칸은 그대로 두고, 빈 칸만 채워요.\n" +
          "30초~1분쯤 걸려요. 계속할까요?",
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/migrate-registry-cache", {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as
        | MigrateResponse
        | { error: string };
      if (!res.ok) {
        const err = "error" in data ? data.error : `HTTP ${res.status}`;
        window.alert(`에러: ${err}`);
        return;
      }
      const result = data as MigrateResponse;
      const summary =
        `처리: ${result.processed}개 row\n` +
        `✓ 갱신: ${result.updated}개\n` +
        `∘ 스킵: ${result.skipped}개 (이미 캐시됨 또는 시트 없음)` +
        (result.failed.length > 0
          ? `\n✗ 실패: ${result.failed.length}개\n` +
            result.failed
              .slice(0, 10)
              .map(
                (f) =>
                  `  · ${f.row}번째 줄 ${f.cohort}기 ${f.name}: ${f.error.slice(0, 60)}`,
              )
              .join("\n") +
            (result.failed.length > 10
              ? `\n  … ${result.failed.length - 10}개 더`
              : "")
          : "");
      window.alert(summary);
      router.refresh();
    } catch (e) {
      window.alert(
        `네트워크 오류: ${e instanceof Error ? e.message : "unknown"}`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={migrate}
      disabled={busy}
      title="수강생 표시 정보 빈 칸 채우기 (여러 번 눌러도 안전)"
      className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-px-11 font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
    >
      {busy ? "동기화 중..." : "🔄 동기화"}
    </button>
  );
}
