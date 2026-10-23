"use client";

import { useEffect } from "react";

/** 업체정보 커스텀 필드를 지운 직후 그 자리에 잠깐 보여 주는 「되돌리기」 줄(10초 뒤 자동으로 닫힘). */
export default function CustomFieldUndo({ label, onUndo, onDismiss, inline }: {
  label: string;
  onUndo: () => void;
  onDismiss: () => void;
  inline: boolean;
}) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, 10_000);
    return () => window.clearTimeout(t);
  }, [label, onDismiss]);
  return (
    <div role="status" data-custom-field-undo
      className={`${inline ? "" : "sm:col-span-2 "}flex min-w-0 items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-600`}>
      <span className="flex min-w-0 items-center gap-1"><span className="min-w-0 truncate">「{label}」</span><span className="shrink-0">지웠어요</span></span>
      <button type="button" onClick={onUndo}
        className="shrink-0 rounded-md border border-purple-200 bg-white px-2 py-0.5 text-px-11 font-semibold text-purple-600 hover:bg-purple-50">
        되돌리기
      </button>
    </div>
  );
}
