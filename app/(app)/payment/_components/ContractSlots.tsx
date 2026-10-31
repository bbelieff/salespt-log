/**
 * ContractSlots — 계약 카드의 진행건 목록(개수 제한 없음 — 4번부터 추가진행) + 회차 추가 버튼.
 * ContractRow 500줄 캡 분리 — 동작·판정은 그대로, 렌더만 위임.
 */
"use client";

import { useState } from "react";
import type { ContractPayment, PaymentSlot, Todo } from "@/types";
import PaymentSlotForm from "./PaymentSlotForm";
import { fmtMoney } from "./nameHighlight";
import { slotOf } from "@/lib/analytics/contract-slots";

interface Props {
  desktopHeading?: boolean;
  draft: ContractPayment;
  cp: ContractPayment;
  contractRef: string;
  slotInstitutionOptions: string[];
  todos: Todo[];
  focusTodoId?: string | null;
  focusedSlot?: number | null;
  focusRequestId?: number;
  visiblePayments: number;
  totalApproved: number;
  totalReceived: number;
  onAddSlot: () => void;
  onRemoveSlot: (slotIdx: number) => void;
  onSlotChange: (index: number, next: PaymentSlot) => void;
  onEnsureSaved: () => void;
}

export default function ContractSlots({
  desktopHeading = false,
  draft,
  cp,
  contractRef,
  slotInstitutionOptions,
  todos,
  focusTodoId,
  focusedSlot,
  focusRequestId,
  visiblePayments,
  totalApproved,
  totalReceived,
  onAddSlot,
  onRemoveSlot,
  onSlotChange,
  onEnsureSaved,
}: Props) {
  // 방금 「진행 추가」로 만든 진행건만 펼친 채 — 나머지는 모두 접힘(PaymentSlotForm).
  const [added, setAdded] = useState<number | null>(null);
  const opens = (n: number) => focusedSlot === n || added === n;
  return (
    <div>
      {/* 실무/수납 상세(desktopHeading)에서는 제목이 스크롤 중 위에 붙는다 — payment-sticky-title(globals.css). */}
      <div className={desktopHeading ? "payment-sticky-title -mx-3 -mt-3 mb-2 flex items-center justify-between rounded-t-lg bg-amber-50 px-3 py-2" : "mb-2 flex items-center justify-between"}>
        <span className={`text-sm text-slate-800 ${desktopHeading ? "font-bold" : "font-semibold"}`}>📈 {desktopHeading ? "실무진행" : "실무 진행"}</span>
        <span className="text-xs text-gray-500" style={{ fontVariantNumeric: "tabular-nums" }}>
          <span className="font-medium text-gray-700">₩{fmtMoney(totalReceived)}</span>
          <span className="mx-0.5 text-gray-400">/</span>
          <span className="font-medium text-gray-700">₩{fmtMoney(totalApproved)}</span>
        </span>
      </div>
      <div className="space-y-2">
        {Array.from({ length: visiblePayments }, (_, i) => i + 1).map((n) => (
          <PaymentSlotForm
            key={n}
            slotId={`payment-slot-${cp.row}-${n}`}
            index={n}
            slot={slotOf(draft, n)}
            removable={n > 1 && n === visiblePayments}
            contractRef={contractRef}
            companyName={cp.업체명}
            savedInstitution={slotOf(cp, n).진행기관}
            savedContract={cp}
            institutionOptions={slotInstitutionOptions}
            todos={todos}
            focusTodoId={focusTodoId}
            autoOpen={opens(n)}
            focusRequestId={focusRequestId}
            onEnsureSaved={onEnsureSaved}
            onChange={(next) => onSlotChange(n, next)}
            onRemove={n > 1 ? () => onRemoveSlot(n) : undefined}
          />
        ))}
        {/* 진행건 개수 제한 없음(2026-10-31 belie). */}
        <button
          type="button"
          onClick={() => { setAdded(visiblePayments + 1); onAddSlot(); }}
          className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-dashed border-slate-300 bg-transparent px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-700"
        >
          <span className="text-base leading-none">+</span>
          <span>진행 추가 ({visiblePayments + 1}회차)</span>
        </button>
      </div>
    </div>
  );
}
