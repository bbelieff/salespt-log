/**
 * PaymentSortControl — 실무수납 계약 카드 정렬 세그먼트 (payment-sort §P8).
 * 활동순, 계약등록일 빠른/늦은순, 진행도 낮은/높은순. CompanySearchBar 아래 배치.
 */
"use client";

import type { PaymentSortKey } from "../_lib/payment-progress";

const OPTIONS: { key: PaymentSortKey; label: string }[] = [
  { key: "activity", label: "활동순" },
  { key: "date-asc", label: "등록 빠른순" },
  { key: "date-desc", label: "등록 늦은순" },
  { key: "progress-asc", label: "진행 낮은순" },
  { key: "progress-desc", label: "진행 높은순" },
];

export default function PaymentSortControl({
  value,
  onChange,
}: {
  value: PaymentSortKey;
  onChange: (k: PaymentSortKey) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-1.5" role="group" aria-label="정렬">
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium transition-colors sm:px-3 sm:text-xs ${
            value === o.key
              ? "border-brand-red bg-red-50 text-brand-red"
              : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
