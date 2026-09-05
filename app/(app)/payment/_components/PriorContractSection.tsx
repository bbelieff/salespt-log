/**
 * PriorContractSection — 아레나/이월 매출 2카드 + 업무매뉴얼(노션) 바로가기.
 * arena-start-revenue-split §A·B(UI). 매출 분리 = isCarryoverContract(계약일<시작일 OR 깃발)
 * 로 갈라 합산(동적, 하드코딩X).
 *
 * 2026-09-05 belie: 여기 있던 「이전 계약업체 등록」 버튼을 **업무매뉴얼 버튼으로 교체**했다.
 * 등록 흐름은 지우지 않고 `PriorContractRegister.tsx` 로 통째로 옮겨 뒀다 — 되살리는 법은
 * 그 파일 머리말 두 줄. 서버(API·서비스)는 그대로라 붙이는 즉시 동작한다.
 * **이미 등록된 이전 계약은 그대로 보인다** — 목록과 「이월 매출」 카드에 계속 집계된다.
 */
"use client";

import { ContractPayment, isCarryoverContract } from "@/types";
import { formatMoney } from "@/lib/format/money";
import { WORK_MANUAL_URL } from "@/config/links";

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

  const arena = revenueOf(
    contracts.filter((c) => !isCarryoverContract(c, courseStartISO)),
  );
  const carry = revenueOf(
    contracts.filter((c) => isCarryoverContract(c, courseStartISO)),
  );

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

      {/* 업무매뉴얼(노션) — 2026-09-05 belie. 이 자리에 있던 「이전 계약업체 등록」은
          지우지 않고 `PriorContractRegister.tsx` 로 옮겨 뒀다(되살리는 법은 그 파일 머리말). */}
      <a
        href={WORK_MANUAL_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 py-2.5 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100"
      >
        <span className="text-base leading-none">📘</span>
        업무매뉴얼 보기
      </a>

    </>
  );
}
