/** 진행건 지우기 확인 (belie 2026-11-05 「오타로 실수 삭제 가능 — 번호와 내용 보여 주고 확인받고 삭제」).
 *  2026-11-10 AppDialog 로 통일 — 브라우저 최상단 층(포털 불필요), Esc·바깥 누르기 = 취소, [취소] 기본 초점. */
"use client";

import AppDialog, { AppDialogClose } from "@/components/ui/AppDialog";
import type { PaymentSlot } from "@/types";
import { fmtDate, fmtMoney } from "./nameHighlight";

export default function SlotDeleteConfirmModal({ n, slot, onCancel, onConfirm }: {
  n: number;
  slot: PaymentSlot;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const rows: Array<[string, string]> = [
    ["진행기관", slot.진행기관.trim()],
    ["진행상품", slot.진행상품.trim()],
    ["진행률", slot.진행률],
    ["승인금액", slot.승인금액 ? fmtMoney(slot.승인금액) : ""],
    ["수납액", slot.수납액 ? fmtMoney(slot.수납액) : ""],
    ["수납일", slot.수납일 ? fmtDate(slot.수납일) : ""],
    ["메모", slot.메모.trim()],
  ];
  const filled = rows.filter(([, v]) => v);
  return (
    <AppDialog role="alertdialog" labelledBy="slot-delete-title" onClose={onCancel} dismissOnBackdrop className="rounded-xl bg-white p-5 shadow-xl">
      <h3 id="slot-delete-title" className="mb-1 text-base font-semibold text-gray-900">진행 {n}번을 지울까요?</h3>
      <p className="mb-3 text-sm text-gray-600">아래 내용이 이 진행건에서 지워져요.</p>
      {filled.length ? (
        <dl className="mb-4 space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs">
          {filled.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="w-14 shrink-0 text-gray-500">{k}</dt>
              <dd className="min-w-0 break-words font-medium text-gray-800">{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">적은 내용이 없는 빈 진행건이에요.</p>
      )}
      <div className="flex gap-2">
        <AppDialogClose data-autofocus className="h-11 flex-1 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">취소</AppDialogClose>
        <button type="button" onClick={onConfirm} className="h-11 flex-1 rounded-lg bg-red-600 text-sm font-bold text-white hover:bg-red-700">진행 {n} 지우기</button>
      </div>
    </AppDialog>
  );
}
