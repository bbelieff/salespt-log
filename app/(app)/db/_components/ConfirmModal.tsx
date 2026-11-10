/**
 * ConfirmModal — 삭제 확인 모달.
 * 정본: db-management.html v11 `customConfirm`
 * 2026-11-10 AppDialog 로 통일 — Esc·바깥 누르기 = 취소, 열리면 [취소]에 초점, 닫히면 연 버튼으로 복귀.
 */
"use client";

import AppDialog, { AppDialogClose } from "@/components/ui/AppDialog";

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = "삭제",
  onConfirm,
  onCancel,
}: Props) {
  return (
    <AppDialog
      role="alertdialog"
      title={title}
      onClose={onCancel}
      dismissOnBackdrop
      className="rounded-xl bg-white p-5 shadow-xl"
    >
      <h3 className="mb-1 text-base font-semibold text-gray-900">{title}</h3>
      <p className="mb-4 text-sm leading-relaxed text-gray-600">{message}</p>
      <div className="flex gap-2">
        <AppDialogClose
          data-autofocus
          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          취소
        </AppDialogClose>
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600"
        >
          {confirmLabel}
        </button>
      </div>
    </AppDialog>
  );
}
