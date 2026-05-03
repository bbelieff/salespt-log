/**
 * ContractRow — 1 계약수납 row 카드 (접힘/펼침).
 *
 * 접힘: 업체명 + 계약일·수임비 + 체크 진척(N/7) + 수납 진척(₩수납/₩승인)
 * 펼침: 7 체크박스 + 3 수납 슬롯 + 저장/삭제 버튼
 */
"use client";

import { useState } from "react";
import type { ContractPayment } from "@/types";
import CheckboxList, { TOTAL_CHECKBOXES, checkedCount } from "./CheckboxList";
import PaymentSlotForm from "./PaymentSlotForm";

interface Props {
  cp: ContractPayment;
  pending: boolean;
  onSave: (next: ContractPayment) => void;
  onDeleteRequest: () => void;
}

function fmtMoney(n: number): string {
  return n.toLocaleString("ko-KR");
}

function fmtDate(s: string): string {
  if (!s) return "—";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  return `${parseInt(m[2]!, 10)}/${parseInt(m[3]!, 10)}`;
}

export default function ContractRow({
  cp,
  pending,
  onSave,
  onDeleteRequest,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ContractPayment>(cp);

  const totalApproved =
    draft.수납1.승인금액 + draft.수납2.승인금액 + draft.수납3.승인금액;
  const totalReceived =
    draft.수납1.수납액 + draft.수납2.수납액 + draft.수납3.수납액;
  const docsDone = checkedCount(draft);

  const allDone = docsDone === TOTAL_CHECKBOXES && totalReceived > 0;

  return (
    <div
      className={`mb-2 overflow-hidden rounded-xl border bg-white shadow-sm transition-all ${
        allDone ? "border-green-300" : "border-gray-200"
      }`}
    >
      {/* 헤더 (접힘) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-3 text-left transition-colors active:bg-black/5"
        aria-expanded={open}
      >
        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-slate-600 num-mono"
              style={{ fontVariantNumeric: "tabular-nums" }}>
          row{cp.row}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-gray-900">
            {cp.업체명 || "(업체명 없음)"}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
            <span>{fmtDate(cp.계약일)}</span>
            <span>·</span>
            <span className="num-mono" style={{ fontVariantNumeric: "tabular-nums" }}>
              수임비 {fmtMoney(cp.수임비)}원
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right text-[11px]">
          <div className="flex items-center gap-1">
            <span
              className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                docsDone === TOTAL_CHECKBOXES
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              📋 {docsDone}/{TOTAL_CHECKBOXES}
            </span>
            {totalApproved > 0 && (
              <span
                className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                  totalReceived >= totalApproved
                    ? "bg-green-100 text-green-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                💰 {Math.round((totalReceived / totalApproved) * 100)}%
              </span>
            )}
          </div>
        </div>
        <svg
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* 펼침 */}
      {open && (
        <div className="space-y-3 border-t border-gray-200 px-3 py-3">
          {/* 자동 연동 정보 (read-only) */}
          <div className="rounded-md bg-gray-50 p-2 text-[11px] text-gray-500">
            🔗 자동 연동: 04 업체관리에서 가져옴 (수정 불가)
            <div className="mt-0.5 text-gray-700">
              <span className="font-medium">{cp.업체명}</span> · {cp.계약일} · 수임비{" "}
              <span className="num-mono font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
                {fmtMoney(cp.수임비)}원
              </span>
            </div>
          </div>

          {/* 7 체크박스 */}
          <div>
            <div className="mb-2 text-xs font-bold text-gray-700">
              📋 서류 진행 (계약 직후 + 실무진행)
            </div>
            <CheckboxList
              draft={draft}
              onChange={(key, next) => setDraft((d) => ({ ...d, [key]: next }))}
            />
          </div>

          {/* 3 수납 슬롯 */}
          <div>
            <div className="mb-2 text-xs font-bold text-gray-700">
              💰 분할 수납 (최대 3건)
            </div>
            <div className="space-y-2">
              <PaymentSlotForm
                index={1}
                slot={draft.수납1}
                onChange={(next) => setDraft((d) => ({ ...d, 수납1: next }))}
              />
              <PaymentSlotForm
                index={2}
                slot={draft.수납2}
                onChange={(next) => setDraft((d) => ({ ...d, 수납2: next }))}
              />
              <PaymentSlotForm
                index={3}
                slot={draft.수납3}
                onChange={(next) => setDraft((d) => ({ ...d, 수납3: next }))}
              />
            </div>
          </div>

          {/* 액션 */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onDeleteRequest}
              disabled={pending}
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
            >
              🗑 삭제
            </button>
            <button
              type="button"
              onClick={() => onSave(draft)}
              disabled={pending}
              className="flex-1 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-600 disabled:bg-gray-300"
            >
              {pending ? "저장중..." : "💾 저장"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
