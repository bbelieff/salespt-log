/**
 * ArenaCarryoverButton — admin 아레나 관리: 사용자 단위 "이월 실행" (backfill, §2-b).
 * POST /api/admin/arena-carryover { email }. 멱등 — 재실행 안전. 결과 inline 표시.
 */
"use client";

import { useState } from "react";

export default function ArenaCarryoverButton({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    if (!email || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/arena-carryover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(`✕ ${d.error ?? res.status}`);
      } else if (d.reason && !d.prior) {
        setMsg(`— ${d.reason}`);
      } else {
        const fails =
          (d.meetings?.failed?.length ?? 0) + (d.contracts?.failed?.length ?? 0);
        setMsg(
          `✓ 미팅 ${d.meetings?.copied ?? 0}복사/${d.meetings?.skipped ?? 0}스킵 · ` +
            `계약 ${d.contracts?.copied ?? 0}복사/${d.contracts?.skipped ?? 0}스킵` +
            (fails ? ` · 실패 ${fails}` : ""),
        );
      }
    } catch (e) {
      setMsg(`✕ ${e instanceof Error ? e.message : "네트워크 오류"}`);
    } finally {
      setBusy(false);
    }
  }

  if (!email) return null;
  return (
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 hover:bg-sky-100 disabled:opacity-50"
        title="이전 기수 예약 미팅·계약을 이월 깃발로 복사 (멱등)"
      >
        {busy ? "이월 중…" : "↩ 이월 실행"}
      </button>
      {msg && <span className="text-[10px] text-gray-500">{msg}</span>}
    </span>
  );
}
