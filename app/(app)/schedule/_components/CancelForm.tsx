/**
 * CancelForm — 🔴 취소 인라인 폼.
 * 정본: docs/design/prototypes/schedule-weekly.html `cancel` action
 *
 * 입력: 사유(선택, 왜 취소됐는지) — 노쇼/일정충돌/사장님요청 등
 * 확정 → 상태=취소, 미팅사유 patch
 */
"use client";

import { useState } from "react";

interface Props {
  initialReason: string;
  vendor: string;
  onConfirm: (reason: string) => void;
  pending: boolean;
}

const PRESETS = ["노쇼", "사장님 사유", "내 사유", "일정 충돌", "기타"];

export default function CancelForm({
  initialReason,
  vendor,
  onConfirm,
  pending,
}: Props) {
  const [reason, setReason] = useState(initialReason);

  const submit = () => onConfirm(reason.trim());

  return (
    <div className="space-y-2.5 rounded-lg border-2 border-red-300 bg-red-50 p-3">
      <div className="flex items-center gap-1 text-xs font-bold text-red-800">
        🔴 취소 / 노쇼
      </div>

      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setReason(`${vendor}, ${p}`)}
            className="rounded-md border border-red-200 bg-white px-2 py-0.5 text-xs text-red-800 transition-colors hover:bg-red-100"
          >
            {p}
          </button>
        ))}
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600">
          취소 사유{" "}
          <span className="font-normal text-gray-400">· 시트 M열</span>
        </label>
        <textarea
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={`예: ${vendor}, 노쇼`}
          className="w-full resize-none rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-red-500 focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="w-full rounded-lg bg-red-500 py-2.5 text-sm font-bold text-white transition-all hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {pending ? "저장중..." : "🔴 취소 확정"}
      </button>
    </div>
  );
}
