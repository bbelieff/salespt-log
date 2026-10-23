/**
 * 진행률 「조건 대기」 입력 — 사유 한 줄 + 기간 칩(단기관리 2개월 내 / 장기관리 3개월 이상). 2026-10-23 belie.
 * 단기관리 = 진행 중(오늘 챙길 일 맨 뒤), 장기관리 = 그 진행건만 오늘 챙길 일에서 빠진다(규칙: lib/analytics).
 * WaitBadge 는 접힌 카드·업체 목록에서 같은 표시를 쓴다.
 */
"use client";

import type { PaymentSlot } from "@/types";
import { waitTermOf } from "@/lib/analytics/contract-slots";

const TERMS = [
  { value: "단기", label: "단기관리 (2개월 내)", hint: "진행건으로 남고, 오늘 챙길 일 맨 뒤로 가요." },
  { value: "장기", label: "장기관리 (3개월 이상)", hint: "이 진행건은 오늘 챙길 일에서 빠져요." },
] as const;

export default function ProgressWaitFields({ slot, onChange }: {
  slot: PaymentSlot;
  onChange: (patch: Pick<PaymentSlot, "대기사유" | "대기기간">) => void;
}) {
  const term = waitTermOf(slot) ?? "단기";
  const hint = TERMS.find((t) => t.value === term)?.hint;
  return (
    <div data-payment-wait-fields className="space-y-1.5 rounded-md border border-violet-200 bg-violet-50/60 p-2">
      <label className="block text-xs text-violet-800">
        사유
        <input
          data-payment-draft-input type="text" value={slot.대기사유 ?? ""}
          placeholder="예: 담보 설정 완료 기다림"
          onChange={(e) => onChange({ 대기사유: e.target.value, 대기기간: term })}
          className="mt-0.5 h-8 w-full rounded-md border border-violet-200 bg-white px-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-violet-500 focus:outline-none"
        />
      </label>
      <div className="flex flex-wrap gap-1" role="group" aria-label="조건 대기 기간">
        {TERMS.map((t) => (
          <button key={t.value} type="button" aria-pressed={term === t.value}
            onClick={() => onChange({ 대기사유: slot.대기사유 ?? "", 대기기간: t.value })}
            className={`h-6 rounded-md border px-2 text-px-11 font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${term === t.value ? "border-violet-500 bg-violet-100 text-violet-800" : "border-slate-300 bg-white text-slate-600 hover:border-violet-300"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-px-11 text-violet-700">{hint}</p>
    </div>
  );
}

/** 「조건 대기 · 단기관리/장기관리」 작은 표시. 조건 대기가 아니면 아무것도 그리지 않는다. */
export function WaitBadge({ slot, size = "11" }: { slot: Pick<PaymentSlot, "진행률" | "대기기간">; size?: "10" | "11" }) {
  const term = waitTermOf(slot);
  if (!term) return null;
  return (
    <span data-payment-wait-badge className={`shrink-0 rounded bg-violet-100 px-1.5 py-0.5 font-bold text-violet-700 ${size === "10" ? "text-px-10" : "text-px-11"}`}>
      조건 대기 · {term}관리
    </span>
  );
}
