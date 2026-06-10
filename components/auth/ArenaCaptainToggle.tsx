/**
 * ArenaCaptainToggle — admin "아레나 관리"에서 참가자를 기수 회장으로 지정/해제.
 *
 * POST /api/admin/set-arena-captain { email, cohort, on } → registry R 토글.
 * 미클레임(email 없음) 참가자는 비활성(클레임 후 지정 가능).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  email: string;
  cohort: string; // 정규화된 아레나 라벨 (예 "A1-1")
  initialOn: boolean;
}

export default function ArenaCaptainToggle({ email, cohort, initialOn }: Props) {
  const router = useRouter();
  const [on, setOn] = useState(initialOn);
  const [busy, setBusy] = useState(false);

  const claimed = email.trim() !== "";

  async function toggle() {
    if (!claimed || busy) return;
    setBusy(true);
    const next = !on;
    try {
      const res = await fetch("/api/admin/set-arena-captain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, cohort, on: next }),
      });
      if (res.ok) {
        setOn(next);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!claimed) {
    return (
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-400">
        미클레임
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-colors disabled:opacity-50 ${
        on
          ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
          : "border border-gray-200 text-gray-500 hover:bg-gray-50"
      }`}
    >
      {on ? "★ 회장" : "회장 지정"}
    </button>
  );
}
