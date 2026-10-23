/**
 * PaymentSortControl — 실무수납 계약 카드 정렬 세그먼트 (payment-sort §P8).
 * 계약등록일 빠른/늦은순과 D-day순. CompanySearchBar 아래 배치.
 * 끝에 「장기관리 N」 칩(2026-10-23 belie) — 켜면 장기관리 업체만, 끄면 장기관리 업체는 숨긴다.
 * 기관 보기는 정렬이 없어 칩만 보인다(showSort=false).
 */
"use client";

import type { PaymentSortKey } from "../_lib/company-work-view";

const OPTIONS: { key: PaymentSortKey; label: string }[] = [
  { key: "date-asc", label: "등록 빠른순" },
  { key: "date-desc", label: "등록 늦은순" },
  { key: "dday", label: "D-day순" },
];

export default function PaymentSortControl({
  value,
  onChange,
  showSort = true,
  longTermCount,
  longTermOnly = false,
  onLongTermToggle,
}: {
  value: PaymentSortKey;
  onChange: (k: PaymentSortKey) => void;
  showSort?: boolean;
  longTermCount?: number;
  longTermOnly?: boolean;
  onLongTermToggle?: () => void;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-1.5" role="group" aria-label="정렬">
      {showSort && OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          className={`shrink-0 rounded-full border px-2 py-1 text-px-11 font-medium transition-colors sm:px-3 sm:text-xs ${
            value === o.key
              ? "border-brand-red bg-red-50 text-brand-red"
              : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
          }`}
        >
          {o.label}
        </button>
      ))}
      {onLongTermToggle && <>
        {showSort && <span aria-hidden className="mx-0.5 h-3.5 w-px shrink-0 bg-gray-200" />}
        <button type="button" onClick={onLongTermToggle} aria-pressed={longTermOnly} data-payment-long-term-chip
          title={longTermOnly ? "진행 중인 업체 보기" : "장기관리 업체만 보기"}
          className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-px-11 font-medium transition-colors sm:px-3 sm:text-xs ${
            longTermOnly ? "border-amber-300 bg-amber-50 text-amber-800" : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
          }`}>
          장기관리 <b className="font-bold tabular-nums">{longTermCount ?? 0}</b>
        </button>
      </>}
    </div>
  );
}
