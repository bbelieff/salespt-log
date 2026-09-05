/**
 * PriorContractRegister — 「이전 계약업체 등록」 흐름(버튼 + 2단계 모달).
 *
 * ## 지금은 화면에 안 붙어 있다 (2026-09-05 belie 요청)
 * 실무·수납 탭의 이 자리는 **업무매뉴얼(노션) 버튼**이 차지했다. 기능을 **지우지 않고**
 * 통째로 이 파일에 옮겨 두었다 — 언제든 되살릴 수 있다.
 *
 * ## 되살리는 법 (두 줄)
 *   1) `PriorContractSection.tsx` 에  `import PriorContractRegister from "./PriorContractRegister";`
 *   2) 매출 2카드 아래에  `<PriorContractRegister courseStartISO={courseStartISO} />`
 * 서버(API·서비스·시트 쓰기)는 **손대지 않았다** — `POST /api/contract-payment/prior` 와
 * `lib/service/contract-payment-add.ts` 가 그대로 있으니 붙이는 즉시 동작한다.
 *
 * ## 이미 등록된 이전 계약은 그대로 보인다
 * 버튼이 사라졌다고 데이터가 사라지지 않는다. 02 계약수납관리에 남아 있고, 실무·수납
 * 목록과 「이월 매출」 카드에 계속 집계된다(`isCarryoverContract`).
 */
"use client";

import { useState } from "react";
import { ContractPayment } from "@/types";
import { useAddPriorContract } from "@/query/contract-payment-hooks";
import ContractForm from "../../schedule/_components/ContractForm";

export default function PriorContractRegister({
  courseStartISO,
}: {
  courseStartISO: string;
}) {
  const add = useAddPriorContract();
  const [step, setStep] = useState<null | "alert" | "form">(null);
  const [계약일, set계약일] = useState("");
  const [업체명, set업체명] = useState("");
  const [warn, setWarn] = useState("");
  const [toast, setToast] = useState("");

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
