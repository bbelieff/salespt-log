/**
 * DoneForm — 🟠 완료(계약X) 인라인 폼.
 * 정본: docs/design/prototypes/schedule-weekly.html `done` action
 *
 * 입력: 미팅사유(선택, 왜 계약 안 됐는지)
 * 확정 → 상태=완료, 미팅사유 patch (계약여부=false 유지)
 */
"use client";

import { useState } from "react";

interface Props {
  initialReason: string;
  vendor: string; // 미팅사유 prefix용 ("업체명, 사유" 형식)
  onConfirm: (reason: string) => void;
  pending: boolean;
}

const PRESETS = [
  "결정권 X",
  "예산 부족",
  "타사 비교",
  "재방문 요청",
  "긍정적, 검토중",
];

export default function DoneForm({
  initialReason,
  vendor,
  onConfirm,
  pending,
}: Props) {
  const [reason, setReason] = useState(initialReason);

  const submit = () => onConfirm(reason.trim());

  return (
    <div className="space-y-2.5 rounded-lg border-2 border-orange-300 bg-orange-50 p-3">
      <div className="flex items-center gap-1 text-xs font-bold text-orange-800">
        🟠 완료 (계약X) — 사유 기록
      </div>

      {/* 빠른 선택 */}
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setReason(`${vendor}, ${p}`)}
            className="rounded-md border border-orange-200 bg-white px-2 py-0.5 text-xs text-orange-800 transition-colors hover:bg-orange-100"
          >
            {p}
          </button>
        ))}
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600">
          미팅사유{" "}
          <span className="font-normal text-gray-400">· 시트 M열</span>
        </label>
        <textarea
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={`예: ${vendor}, 결정권자 부재로 보류`}
          className="w-full resize-none rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-bold text-white transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {pending ? "저장중..." : "🟠 완료 확정"}
      </button>
    </div>
  );
}
