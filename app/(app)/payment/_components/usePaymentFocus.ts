"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ContractPayment } from "@/types";
import { PAYMENT_FOCUS_EVENT, paymentFocusedSlot, parsePaymentRowTarget, type PaymentRowTarget } from "@/util/payment-focus";

/** Resolve once after rows arrive, so a cold mobile entry selects its actual company too. */
export default function usePaymentFocus(rows: ContractPayment[] | undefined, isPc: boolean) {
  const [focusTodoId, setFocusTodoId] = useState<string | null>(null);
  const [requested, setRequested] = useState<PaymentRowTarget | null>(null);
  const [focusPayment, setFocusPayment] = useState<PaymentRowTarget | null>(null);
  useEffect(() => {
    const read = (search: string) => {
      setFocusTodoId(new URLSearchParams(search).get("focus"));
      setRequested(parsePaymentRowTarget(search));
    };
    read(window.location.search);
    // 이미 이 화면일 때 — 주소만 바뀌고 다시 마운트되지 않으므로 알림으로 받는다.
    const onRequest = (e: Event) => {
      const href = (e as CustomEvent<unknown>).detail;
      if (typeof href === "string") read(new URL(href, window.location.origin).search);
    };
    window.addEventListener(PAYMENT_FOCUS_EVENT, onRequest);
    return () => window.removeEventListener(PAYMENT_FOCUS_EVENT, onRequest);
  }, []);
  useEffect(() => {
    if (!requested || !rows?.some(cp => cp.row === requested.row && !cp.해지숨김)) return;
    setFocusPayment(requested);
    setRequested(null);
  }, [requested, rows]);
  const clearPaymentFocus = useCallback(() => {
    setRequested(null); setFocusPayment(null); setFocusTodoId(null);
  }, []);
  useEffect(() => {
    if (!focusPayment?.slot) return;
    const timer = window.setTimeout(() => document.getElementById(`payment-slot-${focusPayment.row}-${focusPayment.slot}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 180);
    return () => window.clearTimeout(timer);
  }, [focusPayment, isPc]);
  const companyOnlyTodoFocus = !!focusTodoId && focusPayment?.slot === null;
  const safeFocusTodoId = companyOnlyTodoFocus ? null : focusTodoId;
  return { safeFocusTodoId, companyOnlyTodoFocus, focusPayment, clearPaymentFocus };
}

/** Apply a resolved entry once; data refresh and callback identity never reset user selection. */
export function usePaymentFocusSelection(target: PaymentRowTarget | null, onSelect: (target: PaymentRowTarget) => void) {
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  useEffect(() => { if (target) selectRef.current(target); }, [target]);
}

/** Header uses the same target as the open form, including company-only ambiguity. */
export function paymentCompanyDetailLabel(target: PaymentRowTarget | null, cp: ContractPayment | undefined, fallback: 1 | 2 | 3 | null): string {
  const slot = paymentFocusedSlot(target, cp?.row, fallback);
  const data = slot && cp ? cp[`수납${slot}`] : null;
  return data
    ? `진행 ${slot} · ${data.진행기관 || "기관 미입력"}${data.진행상품 ? ` · ${data.진행상품}` : ""}`
    : target?.row === cp?.row ? "연결 진행건 확인 필요" : "진행건 미등록";
}
