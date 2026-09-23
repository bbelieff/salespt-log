/**
 * AutosaveStatus — compact aria-live autosave state. Place near the relevant
 * section heading. Never a card, never a footer. Routine success is quiet text.
 */
"use client";

import type { AutosaveStatus as Status } from "./useAutosave";

export default function AutosaveStatus({
  status,
  error,
  savedAt,
  onRetry,
  canUndo,
  onUndo,
}: {
  status: Status;
  error?: string;
  savedAt?: number | null;
  onRetry?: () => void;
  canUndo?: boolean;
  onUndo?: () => void;
}) {
  const time =
    savedAt != null
      ? new Date(savedAt).toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;
  return (
    <span aria-live="polite" className="inline-flex min-w-0 flex-wrap items-center justify-end gap-1 text-right text-xs text-gray-400">
      {status === "pending" && <span>저장 중…</span>}
      {status === "saved" && <span>저장됨{time ? ` ${time}` : ""}</span>}
      {status === "error" && (
        <span title={error || undefined} aria-label={error ? `저장 실패: ${error}` : "저장 실패"} className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-red-600">
          저장 실패
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="min-h-11 underline underline-offset-2"
            >
              다시 시도
            </button>
          )}
        </span>
      )}
      {status !== "error" && canUndo && onUndo && (
        <button
          type="button"
          onClick={onUndo}
          className="min-h-11 underline underline-offset-2"
        >
          되돌리기
        </button>
      )}
    </span>
  );
}
