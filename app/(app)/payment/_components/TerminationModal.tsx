/**
 * 계약해지 입력 모달 (contract-termination — components.md 등재).
 * 사유(필수) + 반환(없음/일부/전액) + 처리(보존/숨김 soft delete).
 * 매출 규칙: 수임비·수납은 유지, **반환액만 매출에서 차감**(숨겨도 유지).
 * 2026-11-10 AppDialog 로 통일 — 입력 창이라 바깥 누르기로 안 닫힘, Esc·취소는 적은 게 있으면 묻는다.
 */
"use client";

import { useState } from "react";
import AppDialog, { AppDialogClose } from "@/components/ui/AppDialog";
import type { ContractPayment } from "@/types";
import MoneyInput from "@/components/ui/MoneyInput";
import { formatMoney } from "@/lib/format/money";
import { slotTotals } from "@/lib/analytics/contract-slots";

type RefundMode = "none" | "partial" | "full";

interface Props {
  cp: ContractPayment;
  pending: boolean;
  onClose: () => void;
  onConfirm: (input: { 사유: string; 반환액: number; 숨김: boolean }) => void;
}

/** 공용 부품 별칭 — 중복 구현 제거(PR-1 단일 원천). */
const fmtMoney = formatMoney;

export default function TerminationModal({ cp, pending, onClose, onConfirm }: Props) {
  const [사유, set사유] = useState("");
  const [mode, setMode] = useState<RefundMode>("none");
  // 반환액(일부) — 공용 MoneyInput 이 number 를 방출하므로 state 도 number(기존 raw string → 정리).
  const [partial, setPartial] = useState(0);
  const [숨김, set숨김] = useState(false);
  const [err, setErr] = useState("");

  // 전액 = 이 계약으로 받은 돈 전부(수임비 + 수납액 합) — 반환 상한 안내용이기도.
  const receivedSum =
    slotTotals(cp).received;
  const fullAmount = (cp.수임비 || 0) + receivedSum;
  const 반환액 = mode === "none" ? 0 : mode === "full" ? fullAmount : partial;

  // 사유·반환액을 적었으면 Esc·취소 전에 묻는다(AppDialog dirty).
  const dirty = !!사유.trim() || mode !== "none" || 숨김;

  const submit = () => {
    if (!사유.trim()) {
      setErr("해지 사유를 입력해 주세요");
      return;
    }
    if (mode === "partial" && 반환액 <= 0) {
      setErr("반환 금액을 입력해 주세요");
      return;
    }
    setErr("");
    onConfirm({ 사유: 사유.trim(), 반환액, 숨김 });
  };

  return (
    <AppDialog
      title="이 계약을 해지할까요?"
      onClose={onClose}
      dirty={dirty}
      className="rounded-xl bg-white p-5 shadow-xl"
    >
        <h3 className="mb-1 text-base font-semibold text-slate-900">
          이 계약을 해지할까요?
        </h3>
        <p className="mb-3 text-sm leading-relaxed text-slate-600">
          <b>{cp.업체명 || "(업체명 없음)"}</b> 계약을 해지 처리해요.
          <br />
          <span className="text-slate-500">반환한 금액만 매출에서 빠져요.</span>
        </p>

        <label className="mb-1 block text-xs font-medium text-slate-700">
          해지 사유 <span className="text-red-500">*</span>
        </label>
        <textarea
          value={사유}
          onChange={(e) => set사유(e.target.value)}
          rows={2}
          placeholder="예: 고객 요청으로 계약 취소, 환불 완료"
          className="mb-3 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-slate-500 focus:outline-none"
        />

        <div className="mb-1 text-xs font-medium text-slate-700">반환(환불)</div>
        <div className="mb-3 space-y-1.5 text-sm text-slate-700">
          {(
            [
              ["none", "없음"],
              ["partial", "일부 반환"],
              ["full", `전액 반환 (₩${fmtMoney(fullAmount)})`],
            ] as [RefundMode, string][]
          ).map(([m, label]) => (
            <label key={m} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="refund"
                checked={mode === m}
                onChange={() => setMode(m)}
                className="h-4 w-4"
              />
              {label}
            </label>
          ))}
          {mode === "partial" && (
            <MoneyInput
              value={partial}
              onChange={setPartial}
              placeholder="반환 금액 (원)"
              aria-label="반환 금액"
              className="ml-6 w-40 rounded-lg border border-slate-300 p-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          )}
        </div>

        <div className="mb-1 text-xs font-medium text-slate-700">처리 방법</div>
        <div className="mb-4 space-y-1.5 text-sm text-slate-700">
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="radio"
              name="keep"
              checked={!숨김}
              onChange={() => set숨김(false)}
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <span>
              해지 상태로 보관
              <br />
              <span className="text-xs text-slate-500">카드가 ‘해지’ 표시로 남아요</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="radio"
              name="keep"
              checked={숨김}
              onChange={() => set숨김(true)}
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <span>
              목록에서 숨기기
              <br />
              <span className="text-xs text-slate-500">
                기록·반환 금액 반영은 유지되고 카드만 숨겨요
              </span>
            </span>
          </label>
        </div>

        {err && <p className="mb-3 text-xs text-red-500">{err}</p>}

        <div className="flex gap-2">
          <AppDialogClose
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            취소
          </AppDialogClose>
          <button
            type="button"
            disabled={pending}
            onClick={submit}
            className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
          >
            {pending ? "처리 중…" : "계약해지"}
          </button>
        </div>
    </AppDialog>
  );
}
