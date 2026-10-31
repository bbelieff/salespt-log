/**
 * 실무/수납 목록 맨 아래 「장기관리 업체 N곳」 접는 묶음(2026-10-31 belie 승인안).
 * 진행 중인 업체가 위, 장기관리 업체는 이 묶음 안 — 기본 접힘, 펼침 여부는 기기에 기억(usePaymentLongTermOpen).
 */
"use client";

import { useEffect, useState, type ReactNode } from "react";
import DisclosureChevron from "@/components/ui/DisclosureChevron";

const KEY = "payment-long-term-open";

/** 펼침 기억 — 저장소가 막힌 기기에서는 접힌 채로 시작하고 이번 화면에서만 기억한다. */
export function usePaymentLongTermOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => { try { setOpen(localStorage.getItem(KEY) === "1"); } catch { /* 기본 접힘 */ } }, []);
  const set = (next: boolean) => {
    setOpen(next);
    try { localStorage.setItem(KEY, next ? "1" : "0"); } catch { /* 이번 화면만 */ }
  };
  return [open, set];
}

export default function LongTermFold({ count, open, onToggle, unit = "곳", label = "장기관리 업체", children }: {
  count: number;
  open: boolean;
  onToggle: () => void;
  unit?: string;
  label?: string;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div data-payment-long-term-fold className="px-2 pb-2">
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="flex min-h-9 w-full items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 text-left text-xs font-semibold text-amber-900 hover:bg-amber-100/80">
        <span>{label} <b className="tabular-nums">{count}</b>{unit}</span>
        <DisclosureChevron open={open} />
      </button>
      {open && <div className="-mx-2">{children}</div>}
    </div>
  );
}
