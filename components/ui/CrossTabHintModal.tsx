/**
 * CrossTabHintModal — 탭 간 cascade 안내 모달 (2026-05-17 [DB-1/C-2]).
 *
 * "X 입력하셨나요? [바로가기 / 화면유지]" 패턴 통일.
 * 2026-11-10 AppDialog 로 통일 — 안내 창이라 Esc·바깥 누르기 = 「화면 유지」.
 */
"use client";

import AppDialog, { AppDialogClose } from "./AppDialog";

interface Props {
  open: boolean;
  title: string;
  body: React.ReactNode;
  navLabel: string;
  onNavigate: () => void;
  onClose: () => void;
}

export default function CrossTabHintModal({
  open,
  title,
  body,
  navLabel,
  onNavigate,
  onClose,
}: Props) {
  if (!open) return null;
  return (
    <AppDialog title={title} onClose={onClose} dismissOnBackdrop className="rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="mb-1 text-base font-black text-slate-900">{title}</h3>
        <div className="mb-4 text-sm leading-relaxed text-slate-700">{body}</div>
        <div className="flex gap-2">
          <AppDialogClose className="flex-1 rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            화면 유지
          </AppDialogClose>
          <button
            type="button"
            onClick={onNavigate}
            className="flex-1 rounded-lg bg-blue-700 py-2.5 text-sm font-bold text-white hover:bg-blue-800"
          >
            {navLabel}
          </button>
        </div>
    </AppDialog>
  );
}
