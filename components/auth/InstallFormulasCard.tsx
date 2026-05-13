/**
 * InstallFormulasCard — 모든 trainee 시트의 자동 집계 수식 일괄 복원 (admin 전용).
 *
 * 사용 시점: 사용자가 시트 셀 서식·수식을 실수로 지운 경우 한 번 클릭으로
 * 17개+ 시트 전체 복원. installFormulas() 가 멱등이라 안전.
 *
 * UX:
 *   1. [수식 복원 실행] 클릭 → confirm 대화
 *   2. 확인 → POST /api/admin/install-formulas-bulk
 *   3. 결과 alert: 성공 N개 / 실패 M개 + 실패 사유
 *
 * AdminUserPicker 500줄 cap 회피를 위해 별도 파일.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SuccessItem {
  email: string;
  name: string;
  cohort: string;
  installed: number;
}
interface FailedItem {
  email: string;
  name: string;
  cohort: string;
  error: string;
}

export default function InstallFormulasCard() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function installAll() {
    if (
      !window.confirm(
        "모든 수강생 시트에 04 업체관리 + 01 영업관리 자동 수식을 일괄 재설치합니다.\n" +
          "기존 수식은 덮어쓰지만 사용자 입력 데이터(미팅 기록 등)는 건드리지 않습니다.\n" +
          "처리에 약 1분 소요됩니다. 계속하시겠습니까?",
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/install-formulas-bulk", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      const success: SuccessItem[] = data.success ?? [];
      const failed: FailedItem[] = data.failed ?? [];
      const summary =
        `처리: ${data.processed ?? 0}개 시트\n` +
        `✓ 성공: ${success.length}개\n` +
        (success.length > 0
          ? success
              .map((s) => `  · ${s.cohort}기 ${s.name} (${s.installed} cells)`)
              .join("\n") + "\n"
          : "") +
        `\n✗ 실패: ${failed.length}개` +
        (failed.length > 0
          ? "\n" +
            failed
              .map(
                (f) =>
                  `  · ${f.cohort}기 ${f.name}: ${f.error.slice(0, 100)}`,
              )
              .join("\n")
          : "");
      window.alert(summary);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-violet-800">
          🛠️ 모든 시트 수식 복원
        </div>
        <p className="mt-0.5 text-[11px] text-violet-700/80 leading-relaxed">
          04 업체관리 N/O/Q + 01 영업관리 I~P 컬럼의 자동 집계 수식을 모든 수강생
          시트에 일괄 재설치 (멱등). 시트 셀 서식·수식이 지워진 경우 사용.
        </p>
        {error && (
          <p className="mt-1 text-[11px] text-red-600">에러: {error}</p>
        )}
      </div>
      <button
        type="button"
        onClick={installAll}
        disabled={busy}
        className="rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50"
      >
        {busy ? "복원 중..." : "수식 복원 실행"}
      </button>
    </div>
  );
}
