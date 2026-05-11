/**
 * ImpersonationBanner — admin 페이지 상단에 현재 impersonation 대상 표시 + 해제 버튼.
 * 클라이언트 컴포넌트 (POST /api/admin/switch + router.refresh).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ImpersonationBanner({
  impersonating,
}: {
  impersonating: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function clear() {
    setBusy(true);
    try {
      await fetch("/api/admin/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: null }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
      <span className="rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
        Impersonating
      </span>
      <span className="min-w-0 flex-1 truncate text-red-800">
        현재 <strong>{impersonating}</strong> 으로 시트 보기 중
      </span>
      <button
        type="button"
        onClick={clear}
        disabled={busy}
        className="shrink-0 rounded-full border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        {busy ? "..." : "해제"}
      </button>
    </div>
  );
}
