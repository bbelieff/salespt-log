/**
 * InstallFormulasButton — 모든 trainee 시트 자동 수식 일괄 복원 (헤더용 작은 버튼).
 *
 * 기존 InstallFormulasCard 가 페이지 본문 공간 차지해서 헤더 우측 상단에
 * 작은 버튼만 노출 (사용자 피드백 2026-05-13).
 *
 * 동작:
 *   1. [🛠️ 수식 복원] 클릭 → confirm
 *   2. POST /api/admin/install-formulas-bulk
 *   3. 결과 alert (성공 N개 / 실패 M개)
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SuccessItem {
  email: string;
  name: string;
  cohort: string;
  installed: number;
  preserved: number;
  preservedCells: string[];
}
interface FailedItem {
  email: string;
  name: string;
  cohort: string;
  error: string;
}

export default function InstallFormulasButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function installAll() {
    if (
      !window.confirm(
        "모든 수강생 시트에 04 업체관리 + 01 영업관리 자동 수식을 일괄 재설치합니다.\n\n" +
          "✓ 사용자 raw 입력값은 자동 보존됩니다 (수식·빈 셀만 덮어씀).\n" +
          "  (2026-05-14 안전 가드 도입 — 옛 admin 수동 백필 데이터 사고 후)\n\n" +
          "🆕 최근 업데이트:\n" +
          "  · 2026-05-18 — 영업관리 D 컬럼 콜·지·기·소 라벨 정상화\n" +
          "    (hyphen → middle dot, 6/7기 I/J/K 누락 사고 fix)\n" +
          "  · 2026-05-18 — 영업관리 M3:M5 비율 수식 install 포함\n" +
          "    (M3=DB!F56/L3, M4=DB!K56/L4, M5=DB!U56/L5)\n" +
          "  · 2026-05-18 — J~M 채널 필터 제거 (4채널 셀병합 통합 표시)\n" +
          "    J=오늘미팅일정 / K=오늘미팅수 / L=완료수 / M=미팅사유\n\n" +
          "약 1분 소요. 계속하시겠습니까?",
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/install-formulas-bulk", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(`에러: ${data.error ?? `HTTP ${res.status}`}`);
        return;
      }
      const success: SuccessItem[] = data.success ?? [];
      const failed: FailedItem[] = data.failed ?? [];
      // 보존된 셀 보고 — 사용자가 raw 값 입력해둔 시트가 있으면 명시.
      const withPreserved = success.filter((s) => s.preserved > 0);
      const preservedSummary =
        withPreserved.length > 0
          ? `\n\n⚠️ 사용자 raw 입력 보존된 시트 ${withPreserved.length}개:\n` +
            withPreserved
              .map(
                (s) =>
                  `  · ${s.cohort}기 ${s.name}: ${s.preserved}개 셀 (${s.preservedCells.slice(0, 5).join(", ")}${s.preservedCells.length > 5 ? " 외" : ""})`,
              )
              .join("\n")
          : "";
      const summary =
        `처리: ${data.processed ?? 0}개 시트\n` +
        `✓ 성공: ${success.length}개` +
        (failed.length > 0
          ? `\n✗ 실패: ${failed.length}개\n` +
            failed
              .map(
                (f) => `  · ${f.cohort}기 ${f.name}: ${f.error.slice(0, 80)}`,
              )
              .join("\n")
          : "") +
        preservedSummary;
      window.alert(summary);
      router.refresh();
    } catch (e) {
      window.alert(`네트워크 오류: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={installAll}
      disabled={busy}
      title="모든 수강생 시트에 자동 집계 수식 일괄 재설치 (멱등)"
      className="rounded-full border border-violet-300 bg-violet-50 px-3 py-1.5 text-[11px] font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-50"
    >
      {busy ? "복원 중..." : "🛠️ 수식 복원"}
    </button>
  );
}
