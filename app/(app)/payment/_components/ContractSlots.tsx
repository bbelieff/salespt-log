/**
 * ContractSlots — 계약 카드의 분할수납 슬롯 목록 (1~3) + 회차 추가 버튼.
 * ContractRow 500줄 캡 분리 — 동작·판정은 그대로, 렌더만 위임.
 */
"use client";

import type { ContractPayment, PaymentSlot, Todo } from "@/types";
import PaymentSlotForm from "./PaymentSlotForm";
import { fmtMoney } from "./nameHighlight";
import { EMPTY_SLOT } from "../_lib/payment-progress";

interface Props {
  draft: ContractPayment;
  cp: ContractPayment;
  contractRef: string;
  slotInstitutionOptions: string[];
  todos: Todo[];
  focusTodoId?: string | null;
  visiblePayments: 1 | 2 | 3;
  totalApproved: number;
  totalReceived: number;
  onAddSlot: () => void;
  onRemoveSlot: (slotIdx: 2 | 3) => void;
  onSlotChange: (index: 1 | 2 | 3, next: PaymentSlot) => void;
  onEnsureSaved: () => void;
}

export default function ContractSlots({
  draft,
  cp,
  contractRef,
  slotInstitutionOptions,
  todos,
  focusTodoId,
  visiblePayments,
  totalApproved,
  totalReceived,
  onAddSlot,
  onRemoveSlot,
  onSlotChange,
  onEnsureSaved,
}: Props) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">📈 실무 진행</span>
        <span className="text-xs text-gray-500" style={{ fontVariantNumeric: "tabular-nums" }}>
          <span className="font-medium text-gray-700">₩{fmtMoney(totalReceived)}</span>
          <span className="mx-0.5 text-gray-400">/</span>
          <span className="font-medium text-gray-700">₩{fmtMoney(totalApproved)}</span>
        </span>
      </div>
      <div className="space-y-2">
        <PaymentSlotForm
          slotId={`payment-slot-${cp.row}-1`}
          index={1}
          slot={draft.수납1}
          contractRef={contractRef}
          companyName={cp.업체명}
          savedInstitution={cp.수납1.진행기관}
          institutionOptions={slotInstitutionOptions}
          todos={todos}
          focusTodoId={focusTodoId}
          onEnsureSaved={onEnsureSaved}
          onChange={(next) => onSlotChange(1, next)}
        />
        {visiblePayments >= 2 && (
          <PaymentSlotForm
            slotId={`payment-slot-${cp.row}-2`}
            index={2}
            slot={draft.수납2}
            removable={visiblePayments === 2}
            contractRef={contractRef}
            companyName={cp.업체명}
            savedInstitution={cp.수납2.진행기관}
            institutionOptions={slotInstitutionOptions}
            todos={todos}
            focusTodoId={focusTodoId}
            onEnsureSaved={onEnsureSaved}
            onChange={(next) => onSlotChange(2, next)}
            onRemove={() => onRemoveSlot(2)}
          />
        )}
        {visiblePayments >= 3 && (
          <PaymentSlotForm
            slotId={`payment-slot-${cp.row}-3`}
            index={3}
            slot={draft.수납3}
            removable
            contractRef={contractRef}
            companyName={cp.업체명}
            savedInstitution={cp.수납3.진행기관}
            institutionOptions={slotInstitutionOptions}
            todos={todos}
            focusTodoId={focusTodoId}
            onEnsureSaved={onEnsureSaved}
            onChange={(next) => onSlotChange(3, next)}
            onRemove={() => onRemoveSlot(3)}
          />
        )}
        {visiblePayments < 3 && (
          <button
            type="button"
            onClick={onAddSlot}
            className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-dashed border-slate-300 bg-transparent px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-700"
          >
            <span className="text-base leading-none">+</span>
            <span>진행 추가 ({visiblePayments + 1}회차)</span>
          </button>
        )}
      </div>
    </div>
  );
}
