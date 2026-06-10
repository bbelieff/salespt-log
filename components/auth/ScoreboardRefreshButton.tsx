/**
 * ScoreboardRefreshButton — 전광판 수동 새로고침 (30분 캐시 무효화).
 * GET /api/admin/scoreboard?refresh=1 (revalidateTag) → router.refresh() 재렌더.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ScoreboardRefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/admin/scoreboard?refresh=1");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={busy}
      className="rounded-full border border-gray-200 px-3 py-1 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
    >
      {busy ? "갱신 중…" : "🔄 새로고침"}
    </button>
  );
}
