/**
 * PriorContractSection — 이전(아레나 시작 전) 계약업체 등록 + 아레나/이월 매출 2카드.
 * arena-start-revenue-split §A·B(UI). 등록 = POST /api/contract-payment/prior(구분=이월).
 * 매출 분리 = isCarryoverContract(계약일<시작일 OR 깃발) 로 갈라 합산(동적, 하드코딩X).
 * 계약 등록폼은 schedule ContractForm(수임비·계약조건) 재사용 + 계약일·업체명 입력.
 */
"use client";

import { useState } from "react";
import { ContractPayment, isCarryoverContract } from "@/types";
import { useAddPriorContract } from "@/query/contract-payment-hooks";
import ContractForm from "../../schedule/_components/ContractForm";
import { formatMoney } from "@/lib/format/money";

/** 공용 부품 별칭 — 중복 구현 제거(PR-1 lib/format/money 가 단일 원천). */
const fmtMoney = formatMoney;

/** 수임비합 + 수수료(수납액)합 = 매출. */
function revenueOf(cps: ContractPayment[]): number {
  let sum = 0;
  for (const cp of cps) {
    sum +=
      (cp.수임비 || 0) +
      cp.수납1.수납액 +
      cp.수납2.수납액 +
      cp.수납3.수납액;
  }
  return sum;
}

export default function PriorContractSection({
  contracts,
  courseStartISO,
}: {
  contracts: ContractPayment[];
  courseStartISO: string;
}) {
  const add = useAddPriorContract();
  const [step, setStep] = useState<null | "alert" | "form">(null);
  const [계약일, set계약일] = useState("");
  const [업체명, set업체명] = useState("");
  const [warn, setWarn] = useState("");
  const [toast, setToast] = useState("");

  const arena = revenueOf(
    contracts.filter((c) => !isCarryoverContract(c, courseStartISO)),
  );
  const carry = revenueOf(
    contracts.filter((c) => isCarryoverContract(c, courseStartISO)),
  );

  const reset = () => {
    setStep(null);
    set계약일("");
    set업체명("");
    setWarn("");
  };

  const submit = (fee: number, terms: string) => {
    if (!계약일.trim() || !업체명.trim()) {
      setWarn("계약일·업체명을 입력해주세요.");
      return;
    }
    setWarn("");
    const cp = ContractPayment.parse({
      계약일: 계약일.trim(),
      업체명: 업체명.trim(),
      수임비: fee,
      로드맵메모: terms,
    });
    add.mutate(cp, {
      onSuccess: () => {
        reset();
        setToast("이월 계약으로 등록했어요");
        setTimeout(() => setToast(""), 2500);
      },
      onError: (e) => setWarn(e instanceof Error ? e.message : "저장 실패"),
    });
  };

  return (
    <>
      {/* 아레나/이월 매출 2 카드 */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-gray-100 bg-white p-3 text-center shadow-sm">
          <div className="mb-1 text-xs text-gray-500">
            아레나 매출 <span className="text-gray-400">(집계)</span>
          </div>
          <div
            className="text-lg font-bold text-gray-900"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            ₩{fmtMoney(arena)}
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center shadow-sm">
          <div className="mb-1 text-xs text-gray-500">
            이월 매출 <span className="text-gray-400">(비집계)</span>
          </div>
          <div
            className="text-lg font-bold text-gray-500"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            ₩{fmtMoney(carry)}
          </div>
        </div>
      </div>

      {/* 이전 계약업체 등록 버튼 — secondary-strong(블루 톤, +아이콘). 솔리드 블루 주행동보다는 약하게. */}
      <button
        type="button"
        onClick={() => setStep("alert")}
        className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 py-2.5 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100"
      >
        <span className="text-base leading-none">＋</span>
        이전 계약업체 등록
      </button>

      {step && (
        <div
          className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          onClick={reset}
        >
          <div
            className="mt-12 mb-12 w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {step === "alert" ? (
              <>
                <h3 className="mb-2 text-sm font-black text-gray-900">
                  이전 계약업체 등록
                </h3>
                <p className="mb-4 text-sm leading-relaxed text-gray-600">
                  <b>{courseStartISO || "시작일"}</b> 이전 계약은 아레나에 집계되지
                  않아요. 실무·수납 관리용으로만 등록됩니다.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={reset}
                    className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep("form")}
                    className="flex-1 rounded-lg bg-blue-500 py-2.5 text-sm font-bold text-white hover:bg-blue-600"
                  >
                    계속 등록
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="mb-3 text-sm font-black text-gray-900">
                  이전 계약업체 등록{" "}
                  <span className="text-xs font-normal text-gray-400">
                    (이월·비집계)
                  </span>
                </h3>
                <div className="space-y-2.5">
                  <div>
                    <label className="mb-1 block text-xs text-gray-600">
                      계약일 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={계약일}
                      onChange={(e) => set계약일(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-600">
                      업체명 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={업체명}
                      onChange={(e) => set업체명(e.target.value)}
                      placeholder="예: ○○부동산"
                      className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <ContractForm
                    initialFee={0}
                    initialTerms=""
                    onConfirm={submit}
                    pending={add.isPending}
                  />
                  {warn && (
                    <div className="rounded-md bg-red-100 px-2 py-1.5 text-xs font-medium text-red-700">
                      ⚠ {warn}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={reset}
                    className="w-full rounded-lg border border-gray-200 py-2 text-xs font-bold text-gray-500 hover:bg-gray-50"
                  >
                    취소
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-[400] -translate-x-1/2 rounded-xl bg-slate-900/95 px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
