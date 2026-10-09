/**
 * CompanyInfoSalesTotals — 업체정보 기본보기의 「연매출」 한 줄(belie 2026-10-09).
 *
 * 올해(Y) · Y-1 · Y-2 · Y-3 의 연매출(합계)만 한 줄에, 확장보기 표의 연매출 줄과 같은 옅은 파랑 띠.
 * 상·하반기는 확장보기에서만 고친다. 반기 칸에 값이 있으면 합계는 자동 계산값이라 읽기 전용으로 보인다
 * (확장보기 CompanyInfoSalesFields 와 같은 salesRowView 기준). 기준 연도는 확장보기에서 바꾼다.
 */
"use client";

import type { CompanyInfo } from "@/types";
import { resolveBaseYear, salesYearToken } from "@/util/company-sales";
import { formatTenths } from "@/util/company-money";
import { salesRowView } from "@/service/company-finance";
import { salesDefs } from "@/components/company-info-defs";
import { readOnlyCls } from "./CompanyInfoField";
import { MillionWonInput } from "./CompanyInfoFinanceFields";

type CI = CompanyInfo;

interface Props {
  draft: CI;
  onField: (k: keyof CI, v: string) => void;
  idBase: string;
  today: Date;
  className?: string;
}

export default function CompanyInfoSalesTotals({ draft, onField, idBase, today, className = "" }: Props) {
  const baseYear = resolveBaseYear(draft.매출기준연도, today);
  const rows = salesDefs(baseYear).rows;
  return (
    <div className={`min-w-0 ${className}`} role="group" aria-label="연매출">
      <p className="mb-0.5 text-xs font-semibold text-gray-600">
        연매출 <span className="font-normal text-gray-400">(백만원 · 상·하반기는 확장보기)</span>
      </p>
      <div className="grid grid-cols-2 gap-1 rounded-md bg-blue-50 p-1 xs:grid-cols-4" data-sales-totals>
        {rows.map(([, , 합], i) => {
          const [k, label] = 합;
          const id = `${idBase}-basic-${String(k)}`;
          const row = salesRowView(draft, i);
          return (
            <div key={String(k)} className="min-w-0">
              <label htmlFor={id} className="block text-xs font-semibold text-blue-900">
                {i === 0 ? "올해" : salesYearToken(i)} <span className="font-normal tabular-nums">{baseYear - i}</span>
                <span className="sr-only"> {label}</span>
              </label>
              {row.auto && row.total !== null ? (
                <input id={id} className={`${readOnlyCls} text-right font-semibold tabular-nums`} readOnly aria-readonly="true" value={formatTenths(row.total)} />
              ) : (
                <MillionWonInput id={id} value={String(draft[k] ?? "")} signed={false} bare onChange={(v) => onField(k, v)} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
