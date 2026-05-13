/**
 * ImpersonationBanner — /admin 랜딩 상단에 현재 impersonation 대상 표시.
 *
 * 주 액션: 배너 클릭 → /dashboard (그 시트로 진입).
 * 부 액션: 우측 작은 ✕ → 해제 (POST /api/admin/switch null).
 *
 * 2026-05-11: 이전엔 "해제" 메인 버튼만 있어 쓸모 적었음. 클릭으로 그 시트로
 * 바로 진입하는 게 본 의도.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

export default function ImpersonationBanner({
  impersonating,
}: {
  impersonating: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  function visit() {
    router.push("/dashboard");
  }

  async function clear(e: React.MouseEvent) {
    e.stopPropagation();
    setBusy(true);
    try {
      await fetch("/api/admin/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: null }),
      });
      // impersonation 해제 시 ['me'] 외에 trainee 별 데이터 캐시도 모두
      // 비워야 함 — admin 본인 페이지로 돌아갔는데 옛 trainee dashboard
      // 데이터가 남아 있으면 admin 화면이 잠시 그 데이터로 깜빡임.
      queryClient.clear();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={visit}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") visit();
      }}
      className="mb-4 flex cursor-pointer items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm transition-all hover:border-red-300 hover:bg-red-100"
      title="클릭하여 이 시트로 진입"
    >
      <span className="rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
        Impersonating
      </span>
      <span className="min-w-0 flex-1 truncate text-red-800">
        <strong>{impersonating}</strong> 으로 시트 이동 →
      </span>
      <button
        type="button"
        onClick={clear}
        disabled={busy}
        aria-label="impersonation 해제"
        title="해제 (본인 모드로 돌아가기)"
        className="shrink-0 rounded-full border border-red-200 bg-white px-2 py-0.5 text-[10px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        {busy ? "…" : "✕"}
      </button>
    </div>
  );
}
