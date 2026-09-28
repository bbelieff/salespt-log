/**
 * CompanyInfoSalesFields — 업체정보 [재무] 매출 묶음 (company-info-restructure, belie 2026-09-28).
 *
 * 1) 연도별 매출 4칸: "매출 Y(2026)" · "매출 Y-1(2025)" · "매출 Y-2(2024)" · "매출 Y-3(2023)"
 *    — 연도는 오늘(today) 기준. 저장 키는 기존 금년도매출·과년도매출·과년도매출Y2·Y3 그대로.
 * 2) 반기별 매출 8칸: 한 해에 한 줄(상반기 | 하반기) × 4줄. 부가세 과세표준증명 자동입력이 채운다.
 * 3) 매출증가율 3칸(Y-3→Y-2 · Y-2→Y-1 · Y-1→Y): 연도별 매출에서 자동 계산해 보여 주고, 편집기의
 *    저장 경로(apply → withSalesGrowth)가 같은 값을 저장한다. 직접 고칠 수 없다. 올해 매출이 몇 월까지인
 *    값이면 Y-1→Y 설명에 "낮게 보일 수 있어요" 안내를 붙인다.
 * 옛 한 칸 반기별매출·매출증가율 값은 숨기되, 값이 있으면 읽기 전용 메모로 보여 준다(데이터 보존).
 */
"use client";

import type { CompanyInfo } from "@/types";
import { computeSalesGrowth, partialYearNote } from "@/util/company-sales";
import { LEGACY_SALES_NOTES, salesDefs } from "@/components/company-info-defs";
import CompanyInfoField, { FieldLabel, hintIdOf, readOnlyCls } from "./CompanyInfoField";

type CI = CompanyInfo;

function SubHead({ children }: { children: string }) {
  return <p className="pt-0.5 text-xs font-semibold text-gray-600">{children}</p>;
}

function LegacyNote({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-600" role="note" aria-label={label}>
      <span className="font-medium text-gray-700">{label}</span> (읽기 전용)
      <p className="whitespace-pre-line break-words text-gray-800">{value}</p>
    </div>
  );
}

interface Props {
  draft: CI;
  onField: (k: keyof CI, v: string) => void;
  idBase: string;
  /** PC 상세 좁은 단(inline)이면 연도 칸도 1열. */
  inline: boolean;
  /** 연도 라벨 기준일(테스트 주입용). */
  today: Date;
  className?: string;
}

export default function CompanyInfoSalesFields({ draft, onField, idBase, inline, today, className = "" }: Props) {
  const defs = salesDefs(today);
  const growth = computeSalesGrowth(draft);
  const note = partialYearNote(draft.금년도매출);
  const text = (k: keyof CI) => String(draft[k] ?? "");
  const idOf = (k: keyof CI) => `${idBase}-${String(k)}`;
  const legacyNote = (key: keyof CI) =>
    LEGACY_SALES_NOTES.filter(([k]) => k === key && text(k).trim() !== "").map(([k, label]) => (
      <LegacyNote key={String(k)} label={label} value={text(k)} />
    ));
  return (
    <div className={`min-w-0 space-y-1.5 ${className}`}>
      <SubHead>연도별 매출</SubHead>
      <div className={inline ? "grid grid-cols-1 gap-1.5" : "grid grid-cols-1 gap-1.5 sm:grid-cols-2"}>
        {defs.years.map((d) => (
          <CompanyInfoField key={String(d[0])} def={d} value={text(d[0])} onChange={onField} id={idOf(d[0])} className="block min-w-0" />
        ))}
      </div>
      <SubHead>반기별 매출</SubHead>
      {/* 한 해 = 한 줄(상반기 | 하반기). 두 칸은 폰에서도 나란히 — 값이 짧다("1.2억"). */}
      <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="반기별 매출">
        {defs.halves.flat().map((d) => (
          <CompanyInfoField key={String(d[0])} def={d} value={text(d[0])} onChange={onField} id={idOf(d[0])} className="block min-w-0" />
        ))}
      </div>
      {legacyNote("반기별매출")}
      <SubHead>매출증가율 (자동 계산)</SubHead>
      <div className="grid grid-cols-1 gap-1.5 xs:grid-cols-3" role="group" aria-label="매출증가율">
        {defs.growth.map(([k, label, hint]) => {
          const id = idOf(k);
          const tip = k === "매출증가율Y1Y" && note ? `${hint}\n${note}` : hint;
          return (
            <div key={String(k)} className="min-w-0">
              <FieldLabel htmlFor={id} label={label} hint={tip} />
              <input
                id={id}
                className={readOnlyCls}
                readOnly
                aria-readonly="true"
                aria-describedby={hintIdOf(id, label, tip)}
                value={growth[k as keyof typeof growth] ?? ""}
              />
            </div>
          );
        })}
      </div>
      {legacyNote("매출증가율")}
    </div>
  );
}
