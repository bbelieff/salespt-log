/**
 * CohortPendingRetryButton — Admin 전용 "기수 생성 대기 재시도" (R3-5 phase-2b).
 *
 * 기수 생성 시 Drive 시트 복제가 실패하면 그 멤버는 DB pending 큐에 적재된다(생성 비차단).
 * 이 버튼이 `POST /api/admin/retry-cohort-creates` 를 호출해 큐를 비운다 — 복제→prep row→
 * (아레나) roster→O1/O2 세팅까지 완주(멱등). 실패분은 pending 유지(다음 클릭에서 재시도).
 *
 * pending 이 0 이면 버튼을 숨긴다(pendingCount 는 서버 페이지가 조회해 넘김).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface RetryResult {
  processed: number;
  done: { name: string; sheetId: string }[];
  stillPending: { name: string; reason: string }[];
  remaining: number | null;
}

export default function CohortPendingRetryButton({
  pendingCount,
}: {
  pendingCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RetryResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (pendingCount <= 0 && !result) return null;

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/retry-cohort-creates", {
        method: "POST",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(d.hint ?? d.error ?? `HTTP ${res.status}`);
        return;
      }
      setResult({
        processed: d.processed ?? 0,
        done: d.done ?? [],
        stillPending: d.stillPending ?? [],
        remaining: d.remaining ?? null,
      });
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
      >
        {busy
          ? "재시도 중…"
          : `⏳ 복제 대기 ${pendingCount}건 재시도`}
      </button>
      {err && <span className="text-[11px] text-red-600">{err}</span>}
      {result && (
        <span className="text-[11px] text-gray-600">
          완료 {result.done.length} · 대기 {result.stillPending.length}
          {result.remaining != null && ` · 남음 ${result.remaining}`}
        </span>
      )}
    </div>
  );
}
