/**
 * ContractListTable — payment 데스크탑 마스터 경량 선택 테이블.
 *
 * 기존 데스크탑 카드 리스트(ContractRow N개 selectable)를 대체 — 상세 패널의
 * 실제 ContractRow 1개(forceOpen)와 짝을 이룬다. 모바일 아코디언은 그대로.
 * 표시값은 기존 의미 그대로: 수임비=cp.수임비, 수납액=슬롯 수납액 합(페이지
 * billable 집계·ContractRow draft 합과 동일 정의), 진행률=contractProgress.
 * 금액 포맷은 lib/format/money 단일 원천, 날짜·하이라이트는 nameHighlight.
 * 한 행 ~40px(h-10). 페이지는 1024~1399 스택, 1440+ 균등 2열로 배치한다 —
 * 520px 테이블이 1440+ 각 열에 맞고, 좁은 구간은 스택이라 스크롤이 없다
 * (래퍼의 overflow-x-auto는 안전망). 본문 스크롤은 생기지 않는다.
 */
"use client";

import {
  isCarryoverContract,
  isTerminatedContract,
  type ContractPayment,
} from "@/types";
import { formatMoney } from "@/lib/format/money";
import { contractProgress } from "../_lib/payment-progress";
import { fmtDate, renderNameWithHighlight } from "./nameHighlight";

interface Props {
  rows: ContractPayment[];
  selectedRow: number | null;
  onSelect: (row: number | null) => void;
  highlight?: string;
  courseStartISO?: string;
}

/** 계약별 수납액 합 — page totalReceived billable reduce 와 동일 정의. */
function receivedOf(cp: ContractPayment): number {
  return cp.수납1.수납액 + cp.수납2.수납액 + cp.수납3.수납액;
}

export default function ContractListTable({
  rows,
  selectedRow,
  onSelect,
  highlight,
  courseStartISO,
}: Props) {
  return (
    <table
      className="w-full min-w-[520px] border-collapse text-[13px]"
      aria-label="계약 목록"
    >
      <thead>
        <tr className="border-b border-gray-100 text-left text-[11px] font-semibold text-gray-400">
          <th scope="col" className="px-2 py-1.5 font-semibold">
            업체명
          </th>
          <th scope="col" className="whitespace-nowrap px-2 py-1.5 font-semibold">
            계약일
          </th>
          <th
            scope="col"
            className="whitespace-nowrap px-2 py-1.5 text-right font-semibold"
          >
            수임비
          </th>
          <th
            scope="col"
            className="whitespace-nowrap px-2 py-1.5 text-right font-semibold"
          >
            수납액
          </th>
          <th
            scope="col"
            className="whitespace-nowrap px-2 py-1.5 text-right font-semibold"
          >
            진행률
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((cp) => {
          const isSel = selectedRow != null && cp.row === selectedRow;
          const pct = contractProgress(cp);
          const carryover = isCarryoverContract(cp, courseStartISO ?? "");
          const terminated = isTerminatedContract(cp);
          const pick = () => {
            if (!isSel) onSelect(cp.row ?? null);
          };
          return (
            <tr
              key={cp.row}
              data-row={cp.row}
              aria-selected={isSel}
              onClick={pick}
              className={`h-10 cursor-pointer border-b border-gray-50 transition-colors last:border-0 hover:bg-gray-50 ${
                isSel ? "bg-blue-50/60" : ""
              } ${carryover || terminated ? "opacity-60" : ""}`}
            >
              <td className="max-w-[180px] px-2 py-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    pick();
                  }}
                  aria-label={`${cp.업체명 || "업체명 없음"} 선택`}
                  aria-current={isSel ? "true" : undefined}
                  title={cp.업체명 || undefined}
                  className="block w-full truncate text-left text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  {terminated && (
                    <span className="mr-1 rounded bg-red-50 px-1 text-[10px] font-medium text-red-600">
                      해지
                    </span>
                  )}
                  {carryover && (
                    <span className="mr-1 rounded bg-gray-100 px-1 text-[10px] font-medium text-gray-500">
                      이월
                    </span>
                  )}
                  {renderNameWithHighlight(cp.업체명, highlight)}
                </button>
              </td>
              <td
                className="whitespace-nowrap px-2 py-1 text-gray-500"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {fmtDate(cp.계약일)}
              </td>
              <td
                className="whitespace-nowrap px-2 py-1 text-right text-gray-900"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                ₩{formatMoney(cp.수임비)}
              </td>
              <td
                className="whitespace-nowrap px-2 py-1 text-right text-green-700"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                ₩{formatMoney(receivedOf(cp))}
              </td>
              <td
                className="whitespace-nowrap px-2 py-1 text-right text-gray-700"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {pct === 0 ? "—" : `${pct}%`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
