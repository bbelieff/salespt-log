"use client";

import { useEffect, useState } from "react";
import type { ContractPayment } from "@/types";
import { parsePaymentSlotTarget, type PaymentSlotTarget } from "@/util/payment-focus";

/** 캘린더 Todo와 대시보드 진행 회차의 진입 링크를 열고 표시 위치로 이동한다. */
export default function usePaymentFocus(rows: ContractPayment[] | undefined, isPc: boolean) {
  const [focusTodoId, setFocusTodoId] = useState<string | null>(null);
  const [focusPayment, setFocusPayment] = useState<PaymentSlotTarget | null>(null);

  useEffect(() => {
    const search = window.location.search;
    const todoId = new URLSearchParams(search).get("focus");
    if (todoId) setFocusTodoId(todoId);
    const target = parsePaymentSlotTarget(search);
    if (target) setFocusPayment(target);
  }, []);

  useEffect(() => {
    if (!focusPayment || !rows?.some((cp) => cp.row === focusPayment.row)) return;
    const timer = window.setTimeout(() => document.getElementById(`payment-slot-${focusPayment.row}-${focusPayment.slot}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 180);
    return () => window.clearTimeout(timer);
  }, [focusPayment, rows, isPc]);

  return { focusTodoId, focusPayment };
}
