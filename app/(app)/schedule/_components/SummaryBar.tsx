/**
 * SummaryBar — 주간 요약 (5칸 카운터 + 주간 매출 합계).
 *
 * v4:
 *  - sticky 제거 (부모 schedule/page.tsx에서 WeekHeader와 함께 묶어 sticky 처리)
 *  - 5칸 의미 그룹 구분선:
 *      [미팅총건] | [미팅예정] ‖ [미팅완료] | [미팅취소] | [계약 강조]
 *      ‖ = 결과 그룹과의 두꺼운 구분선
 *  - "변경" 상태 미팅도 미팅예정에 포함 (재예약된 미팅도 진행 예정)
 *  - 수임비/수수료 분리 표시
 *
 * SSOT: docs/domains/sheet-structure.md §4 v2 (수수료 = Q+W+AC = 슬롯별 수납액)
 */
"use client";

import { useMemo } from "react";
import type { Meeting } from "@/types";
import { useContractPayments } from "@/query/contract-payment-hooks";

interface Props {
  meetings: Meeting[];
}

function fmtMoney(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default function SummaryBar({ meetings }: Props) {
  const total = meetings.length;
  // 미팅예정 — "예약" + "변경" 모두 포함 (변경된 미팅도 다음 일정 예정 상태)
  const reserved = meetings.filter(
    (m) => m.상태 === "예약" || m.상태 === "변경",
  ).length;
  const contract = meetings.filter((m) => m.상태 === "계약").length;
  const done = meetings.filter((m) => m.상태 === "완료").length;
  const canceled = meetings.filter((m) => m.상태 === "취소").length;

  // 수임비 합 — 이번 주 계약 확정된 미팅
  const feeSum = meetings
    .filter((m) => m.계약여부)
    .reduce((s, m) => s + (m.수임비 || 0), 0);

  // 수수료 합 — 02 계약수납관리의 슬롯별 수납액(Q+W+AC) 합.
  const cpQuery = useContractPayments();
  const commissionSum = useMemo(() => {
    const rows = cpQuery.data?.rows ?? [];
    const weekContractKeys = new Set(
      meetings
        .filter((m) => m.계약여부)
        .map((m) => `${m.미팅날짜}|${m.업체명.trim()}`),
    );
    return rows
      .filter((cp) =>
        weekContractKeys.has(`${cp.계약일}|${cp.업체명.trim()}`),
      )
      .reduce(
        (s, cp) => s + cp.수납1.수납액 + cp.수납2.수납액 + cp.수납3.수납액,
        0,
      );
  }, [cpQuery.data, meetings]);

  const revenueSum = feeSum + commissionSum;

  return (
    <div className="border-y border-gray-200 bg-white shadow-sm">
      {/* 5칸 카운터 — 의미상 두 덩어리:
          ① 미팅총건 | ② 미팅예정    ‖    ③ 미팅완료 | ④ 미팅취소 | ⑤ 계약(강조)
                                    ↑ 결과 그룹 구분선 (border-l-2)
          ① ② 사이는 얇은 보더, ③④⑤ 사이도 얇은 보더, ② ↔ ③ 사이는 두꺼운 보더 */}
      <div className="flex items-stretch px-2 pb-2 pt-2.5">
        <CellWrap>
          <Cell label="미팅총건" value={total} cls="text-gray-900" />
        </CellWrap>
        <CellWrap thinDivider>
          <Cell label="미팅예정" value={reserved} cls="text-amber-600" />
        </CellWrap>
        {/* 두꺼운 구분선 (결과 그룹 시작) */}
        <CellWrap thickDivider>
          <Cell label="미팅완료" value={done} cls="text-orange-600" />
        </CellWrap>
        <CellWrap thinDivider>
          <Cell label="미팅취소" value={canceled} cls="text-red-500" />
        </CellWrap>
        <CellWrap thinDivider>
          <Cell
            label="계약"
            value={contract}
            cls="text-green-700"
            highlight
          />
        </CellWrap>
      </div>

      {/* 주간 매출 — 수임비/수수료 분리 + 합계 */}
      <div className="border-t border-gray-100 px-4 py-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-gray-700">💰 주간 매출 합계</span>
          <span
            className="text-base font-extrabold text-green-700"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            ₩{fmtMoney(revenueSum)}
          </span>
        </div>
        <div
          className="mt-1 flex justify-end gap-3 text-[11px] text-gray-500"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          <span>
            수임비{" "}
            <b className="font-semibold text-gray-700">₩{fmtMoney(feeSum)}</b>
          </span>
          <span className="text-gray-300">+</span>
          <span>
            수수료{" "}
            <b className="font-semibold text-gray-700">
              ₩{fmtMoney(commissionSum)}
            </b>
          </span>
        </div>
      </div>
    </div>
  );
}

function CellWrap({
  children,
  thinDivider,
  thickDivider,
}: {
  children: React.ReactNode;
  thinDivider?: boolean;
  thickDivider?: boolean;
}) {
  const border = thickDivider
    ? "border-l-2 border-gray-300"
    : thinDivider
      ? "border-l border-gray-100"
      : "";
  return <div className={`flex flex-1 px-1 ${border}`}>{children}</div>;
}

function Cell({
  label,
  value,
  cls,
  highlight,
}: {
  label: string;
  value: number;
  cls: string;
  highlight?: boolean;
}) {
  if (highlight) {
    // 계약 강조 — 녹색 박스 + 굵은 폰트
    return (
      <div className="flex-1 rounded-lg bg-green-100 py-0.5 text-center ring-1 ring-green-300">
        <div className={`text-xl font-extrabold leading-tight ${cls}`}>
          {value}
        </div>
        <div className="text-[11px] font-bold text-green-700">{label}</div>
      </div>
    );
  }
  return (
    <div className="flex-1 text-center">
      <div className={`text-lg font-bold leading-tight ${cls}`}>{value}</div>
      <div className="text-[11px] text-gray-500">{label}</div>
    </div>
  );
}
