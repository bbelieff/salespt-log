/**
 * 일정 항목별 구글 캘린더 담기/빼기 토글 (gcal-2b, google-calendar-sync §2).
 * 제어형 — 부모(캘린더 페이지)가 on 상태 맵 보유. 낙관적 갱신 후 /api/gcal/toggle POST,
 * 실패 시 롤백. 항목 클릭(네비게이션)과 분리하려 stopPropagation. 금지 용어(동기화 등) 미노출.
 */
"use client";

import { useState } from "react";

export default function GcalItemToggle({
  kind,
  id,
  on,
  onChange,
  onToast,
}: {
  kind: "meeting" | "todo";
  id: string;
  on: boolean;
  onChange: (id: string, on: boolean) => void;
  onToast: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    const next = !on;
    setBusy(true);
    onChange(id, next); // 낙관적
    try {
      const res = await fetch("/api/gcal/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, on: next }),
      });
      if (res.ok) onToast(next ? "구글 캘린더에 담았어요" : "구글 캘린더에서 뺐어요");
      else {
        onChange(id, !next); // 롤백
        onToast(res.status === 409 ? "먼저 구글 캘린더를 연결해 주세요" : "잠시 후 다시 시도해 주세요");
      }
    } catch {
      onChange(id, !next);
      onToast("잠시 후 다시 시도해 주세요");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={on}
      aria-label={on ? "구글 캘린더에서 빼기" : "구글 캘린더에 담기"}
      title={on ? "구글 캘린더에 담김 (눌러서 빼기)" : "구글 캘린더에서 뺌 (눌러서 담기)"}
      className={`shrink-0 rounded-md p-1 transition-colors ${on ? "text-blue-600" : "text-gray-300"} ${busy ? "opacity-50" : ""}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="4.5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="2" />
        <path d="M3 9h18M8 3v3M16 3v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {on ? (
          <path d="M9 14l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        ) : null}
      </svg>
    </button>
  );
}
