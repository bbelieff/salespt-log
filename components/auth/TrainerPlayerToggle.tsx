/**
 * TrainerPlayerToggle — 수강생출신 트레이너 [트레이너 관리]/[내 아레나 일지] 세그먼트(P14).
 * me.ownArenaSheetId 있을 때만 노출. 클릭 → POST /api/arena-self(쿠키 토글) → 라우팅.
 * 양 화면(트레이너 페이지·대시보드)에서 공용 — 표시=전환 겸용.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TrainerPlayerToggle({
  mode,
}: {
  mode: "manager" | "arena";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const go = async (to: "manager" | "arena") => {
    if (to === mode || busy) return;
    setBusy(true);
    try {
      await fetch("/api/arena-self", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on: to === "arena" }),
      });
      router.push(to === "arena" ? "/dashboard" : "/trainer");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const seg = (to: "manager" | "arena", label: string) => (
    <button
      type="button"
      onClick={() => go(to)}
      aria-pressed={mode === to}
      disabled={busy}
      className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${
        mode === to
          ? "bg-white text-gray-900 shadow-sm"
          : "text-gray-500 hover:text-gray-700"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mb-3 flex gap-1 rounded-xl bg-gray-100 p-1">
      {seg("manager", "트레이너 관리")}
      {seg("arena", "내 아레나 일지")}
    </div>
  );
}
