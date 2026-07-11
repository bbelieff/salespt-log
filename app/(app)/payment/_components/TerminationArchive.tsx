/**
 * 해지 보관함 (contract-termination 스펙 — components.md 등재).
 * 숨김(soft delete) 해지 계약을 접힌 아코디언에서 열람 — 읽기전용.
 * 반환액은 매출에서 이미 차감 반영 중(수임비+수납−반환액) — 여기선 열람만.
 */
"use client";

import { useState } from "react";
import type { ContractPayment } from "@/types";
import { fmtMoney } from "./nameHighlight";

interface Props {
  /** 숨김 처리된 해지 계약만 (page 가 필터해서 전달). */
  contracts: ContractPayment[];
}

export default function TerminationArchive({ contracts }: Props) {
  const [open, setOpen] = useState(false);
  if (contracts.length === 0) return null;
  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between p-3 text-left text-sm text-gray-600 hover:bg-gray-50"
        aria-expanded={open}
      >
        <span className="font-medium">
          🗂 해지 보관함{" "}
          <span className="text-red-500">{contracts.length}건</span>
        </span>
        <span className="text-xs text-gray-400">{open ? "접기 ▲" : "펼치기 ▼"}</span>
      </button>
      {open && (
        <ul className="divide-y divide-gray-100 border-t border-gray-100">
          {contracts.map((cp) => (
            <li key={cp.row} className="px-3 py-2 text-xs text-gray-600">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium text-gray-800">
                  {cp.업체명 || "(업체명 없음)"}
                </span>
                <span
                  className="shrink-0 text-gray-400"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  해지 {cp.해지일 || "—"}
                </span>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <span className="truncate text-gray-500">
                  {cp.해지사유 || "(사유 없음)"}
                </span>
                {cp.반환액 > 0 && (
                  <span
                    className="shrink-0 text-red-500"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    반환 ₩{fmtMoney(cp.반환액)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
