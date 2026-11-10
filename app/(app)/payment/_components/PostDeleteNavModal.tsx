/**
 * 삭제 후 바로가기 팝업 — 2026-05-17 [3]. cascade 로 미팅이 예약으로 되돌아갔을 때 일정·계약으로 안내.
 * page.tsx 500줄 캡으로 분리(2026-10-23). 문구 무변경.
 * 2026-11-10 AppDialog 로 통일 — 안내 창이라 Esc·바깥 누르기 = 「현재 화면 유지」.
 */
"use client";

import AppDialog, { AppDialogClose } from "@/components/ui/AppDialog";

export interface PostDeleteNavTarget {
  미팅날짜: string;
  업체명: string;
}

export default function PostDeleteNavModal({ target, onClose, onGo }: {
  target: PostDeleteNavTarget;
  onClose: () => void;
  onGo: () => void;
}) {
  return (
    <AppDialog
      title="지웠어요 · 미팅도 되돌렸어요"
      onClose={onClose}
      dismissOnBackdrop
      className="rounded-xl bg-white p-5 shadow-xl"
    >
      <h3 className="mb-1 text-base font-semibold text-slate-900">
        지웠어요 · 미팅도 되돌렸어요
      </h3>
      <p className="mb-4 text-sm leading-relaxed text-slate-600">
        <b>{target.업체명}</b> 미팅이
        <br />
        예약 상태로 돌아갔어요 ({target.미팅날짜}).
        <br />
        그 미팅 카드로 이동할까요?
      </p>
      <div className="flex gap-2">
        <AppDialogClose className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          현재 화면 유지
        </AppDialogClose>
        <button
          type="button"
          onClick={onGo}
          className="flex-1 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
        >
          📅 일정·계약으로 이동
        </button>
      </div>
    </AppDialog>
  );
}
