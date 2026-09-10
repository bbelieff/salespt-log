/**
 * SaveBar — 컨택탭 하단 고정 저장 바 (page.tsx 분할, 500줄 캡).
 * 바 배경은 full-bleed, 버튼은 본문과 동일 6xl 한계선(PageContainer wide).
 */
"use client";

import PageContainer from "@/components/PageContainer";

interface Props {
  pending: boolean;
  incompleteCount?: number;
  onSave: () => void;
}

export default function SaveBar({ pending, incompleteCount = 0, onSave }: Props) {
  return (
    <div className="fixed bottom-[64px] left-0 right-0 z-[49] bg-gradient-to-t from-white via-white to-transparent pb-3 pt-3">
      <PageContainer width="wide" className="px-4">
        {incompleteCount > 0 && <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span role="status">필수 입력이 빠진 미팅 {incompleteCount}건</span>
          <button type="button" className="shrink-0 rounded px-2 py-1 font-bold underline" onClick={() => {
            const card = document.querySelector<HTMLElement>("[data-incomplete-slot]");
            card?.scrollIntoView({ behavior: "smooth", block: "start" });
            card?.focus({ preventScroll: true });
          }}>확인하기</button>
        </div>}
        <button
          type="button"
          onClick={onSave}
          disabled={pending || incompleteCount > 0}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 py-3.5 font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:bg-blue-600 active:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
        >
          {pending ? (
            <>
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              시트 저장중...
            </>
          ) : (
            <>💾 저장하기</>
          )}
        </button>
      </PageContainer>
    </div>
  );
}
