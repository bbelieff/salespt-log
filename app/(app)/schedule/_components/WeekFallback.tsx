/**
 * WeekFallback — 일정·계약 주간 로딩/에러 상태 (schedule/page.tsx 500줄 캡 분리).
 * 에러 시 "다시 시도"(refetch) 버튼 — 네트워크 단절(Failed to fetch) 새로고침 없이 재요청.
 */
"use client";

interface Props {
  state: "loading" | "error";
  onRetry: () => void;
  retrying: boolean;
}

export default function WeekFallback({ state, onRetry, retrying }: Props) {
  // 로딩은 전역 오버레이(LoadingProvider)가 일관 표시 → 여기선 빈 화면(깜빡임 방지).
  if (state === "loading") return null;
  return (
    <section className="px-4 pt-6">
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p>불러오지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.</p>
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
        >
          {retrying ? "다시 시도 중…" : "다시 시도"}
        </button>
      </div>
    </section>
  );
}
