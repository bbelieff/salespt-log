/**
 * CrossTabHintModal — 탭 간 cascade 안내 모달 (2026-05-17 [DB-1/C-2]).
 *
 * "X 입력하셨나요? [바로가기 / 화면유지]" 패턴 통일.
 */
"use client";

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
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-base font-black text-gray-900">{title}</h3>
        <div className="mb-4 text-sm leading-relaxed text-gray-700">{body}</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            화면 유지
          </button>
          <button
            type="button"
            onClick={onNavigate}
            className="flex-1 rounded-lg bg-blue-500 py-2.5 text-sm font-bold text-white hover:bg-blue-600"
          >
            {navLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
