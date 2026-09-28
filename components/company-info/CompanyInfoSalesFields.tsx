/**
 * CompanyInfoSalesFields — 업체정보 [재무] 연도별 매출 표 (company-finance-won-grid, belie 2026-09-28).
 *
 * 1) 「연도별 매출」 한 표: 머리글 "상반기 · 하반기 · 합계"(단위 백만원), 줄 Y · Y-1 · Y-2 · Y-3.
 *    한 줄 = 상반기(매출Y상…) | 하반기(매출Y하…) | 합계(금년도매출·과년도매출·과년도매출Y2·Y3) 세 칸 나란히 —
 *    375px 폰에서도 한 줄(칸 아래 "약 …" 도움말).
 * 2) 합계: 반기 칸에 값이 있으면 반기 합(읽기 전용, 칸 아래 "자동") — 편집기 apply() 가 같은 값을 저장한다
 *    (열기만 해선 안 함). 한쪽만 있으면 그 반기만 더하고 안내, 둘 다 비면 합계는 직접 적는 칸(옛 연도 합계·
 *    재무제표 연 매출). 반기 칸에 읽을 수 없는 글이 있으면 합계를 덮지 않고 알린다. 반기 합과 다른 옛 합계는
 *    "이전 합계 … — 반기 합과 달라 저장할 때 업체 기타메모로 옮겨 둬요".
 * 3) Y 줄 연도 = 매출 기준 연도(네 자리 입력, 설명은 화면낭독기에도). 비었으면 오늘 연도로 보이고, 재무 값이
 *    있는 업체를 처음 고칠 때 저장된다. 바꾸면 칸 이름만 바뀐다. 2000~2100 밖이면 저장하지 않고 Y 줄 바로 아래
 *    안내(칸에 다시 들어가면 거둔다).
 * 4) 매출증가율 3칸(Y-3→Y-2 · Y-2→Y-1 · Y-1→Y): 줄 합계에서 자동 계산(읽기 전용).
 * 옛 한 칸 반기별매출·매출증가율 값은 숨기되, 값이 있으면 읽기 전용 메모로 보여 준다(데이터 보존).
 */
"use client";

import { useState } from "react";
import type { CompanyInfo } from "@/types";
import { baseYearInputError, resolveBaseYear, salesYearTag, salesYearToken } from "@/util/company-sales";
import { formatTenths, moneyHint } from "@/util/company-money";
import {
  computeSalesGrowth,
  legacyMoneyConvertPatch,
  partialYearNote,
  salesRowView,
} from "@/service/company-finance";
import { LEGACY_SALES_NOTES, salesDefs, type FieldDef } from "@/components/company-info-defs";
import HintTooltip from "@/components/ui/HintTooltip";
import { FieldLabel, hintIdOf, readOnlyCls } from "./CompanyInfoField";
import { MillionWonInput, MoneyLegacyNote } from "./CompanyInfoFinanceFields";

type CI = CompanyInfo;

const GRID_HINT =
  "부가세 과세표준증명의 반기 매출을 백만원으로 적어요. 상·하반기를 적으면 합계가 자동으로 더해져요. 반기를 모르면 합계 칸에 한 해 매출을 적어요";
const YEAR_HINT = "기준 연도를 바꾸면 칸 이름만 바뀌어요. 값은 그대로예요.";

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
  onPatch: (p: Partial<CI>) => void;
  idBase: string;
  /** 기준 연도가 비었을 때 쓰는 오늘(테스트 주입용). */
  today: Date;
  className?: string;
}

export default function CompanyInfoSalesFields({ draft, onField, onPatch, idBase, today, className = "" }: Props) {
  const baseYear = resolveBaseYear(draft.매출기준연도, today);
  const defs = salesDefs(baseYear);
  const growth = computeSalesGrowth(draft);
  const note = partialYearNote(draft, baseYear);
  // 기준 연도 칸 — 입력 중 글(null = 입력 중 아님)과 틀린 연도 안내.
  const [yearText, setYearText] = useState<string | null>(null);
  const [yearError, setYearError] = useState("");
  const text = (k: keyof CI) => String(draft[k] ?? "");
  const idOf = (k: keyof CI) => `${idBase}-${String(k)}`;
  const yearId = idOf("매출기준연도");
  const convert = (k: keyof CI, label: string) => {
    const p = legacyMoneyConvertPatch(draft, String(k), label);
    if (p) onPatch(p as Partial<CI>);
  };
  const legacyNote = (key: keyof CI) =>
    LEGACY_SALES_NOTES.filter(([k]) => k === key && text(k).trim() !== "").map(([k, label]) => (
      <LegacyNote key={String(k)} label={label} value={text(k)} />
    ));

  const typeYear = (raw: string) => {
    const v = raw.replace(/\D/g, "").slice(0, 4);
    setYearText(v);
    if (v.length < 4) return setYearError("");
    const err = baseYearInputError(v);
    setYearError(err);
    if (!err && v !== String(baseYear)) onPatch({ 매출기준연도: v });
  };

  const cell = ([k, label]: FieldDef) => (
    <div key={String(k)} className="min-w-0">
      <label htmlFor={idOf(k)} className="sr-only">
        {label}
      </label>
      <MillionWonInput id={idOf(k)} value={text(k)} signed={false} onChange={(v) => onField(k, v)} />
    </div>
  );

  return (
    <div className={`min-w-0 space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <SubHead>연도별 매출</SubHead>
          <HintTooltip label="연도별 매출" text={GRID_HINT} />
        </div>
        <span className="text-xs text-gray-500">단위: 백만원</span>
      </div>
      <div className="space-y-1.5" role="group" aria-label="연도별 매출">
        <div className="flex gap-1 text-xs font-medium text-gray-500" aria-hidden="true">
          <span className="w-12 shrink-0">연도</span>
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-1 text-center">
            <span>상반기</span>
            <span>하반기</span>
            <span>합계</span>
          </div>
        </div>
        {defs.rows.map(([상, 하, 합], i) => {
          const row = salesRowView(draft, i);
          const tag = salesYearTag(i, baseYear);
          const other = row.only === "상반기" ? "하반기" : "상반기";
          return (
            <div key={String(합[0])} className="min-w-0" data-sales-row={i}>
              <div className="flex items-start gap-1">
                <div className="w-12 shrink-0 text-xs">
                  <div className="flex items-center gap-0.5 font-semibold text-gray-800">
                    {salesYearToken(i)}
                    {i === 0 && <HintTooltip label="기준 연도" text={YEAR_HINT} />}
                  </div>
                  {i === 0 ? (
                    <>
                      <label htmlFor={yearId} className="sr-only">
                        매출 기준 연도(Y)
                      </label>
                      <span id={`${yearId}-hint`} className="sr-only">
                        {YEAR_HINT}
                      </span>
                      <input
                        id={yearId}
                        className="w-full rounded border border-gray-300 px-1 py-0.5 text-xs tabular-nums text-gray-900 focus:border-brand-red focus:outline-none"
                        inputMode="numeric"
                        maxLength={4}
                        aria-invalid={yearError ? true : undefined}
                        aria-describedby={yearError ? `${yearId}-hint ${yearId}-err` : `${yearId}-hint`}
                        value={yearText ?? String(baseYear)}
                        onFocus={() => {
                          setYearText(String(baseYear));
                          setYearError("");
                        }}
                        onChange={(e) => typeYear(e.target.value)}
                        onBlur={() => {
                          if (yearText !== null && baseYearInputError(yearText)) setYearError(baseYearInputError(yearText));
                          setYearText(null);
                        }}
                      />
                    </>
                  ) : (
                    <span className="text-gray-500">({baseYear - i})</span>
                  )}
                </div>
                <div className="grid min-w-0 flex-1 grid-cols-3 gap-1">
                  {cell(상)}
                  {cell(하)}
                  {row.auto && row.total !== null ? (
                    <div className="min-w-0">
                      <label htmlFor={idOf(합[0])} className="sr-only">
                        {합[1]}
                      </label>
                      <input
                        id={idOf(합[0])}
                        className={`${readOnlyCls} text-right tabular-nums`}
                        readOnly
                        aria-readonly="true"
                        value={formatTenths(row.total)}
                      />
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {["자동", moneyHint(row.total)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  ) : (
                    cell(합)
                  )}
                </div>
              </div>
              {i === 0 && yearError && (
                <p id={`${yearId}-err`} className="mt-0.5 text-xs text-red-600" role="alert">
                  {yearError} — 이전 연도({baseYear})를 그대로 써요
                </p>
              )}
              {row.only && (
                <p className="mt-0.5 text-xs text-gray-500" role="note">
                  {tag}: {other}가 비어 있어 {row.only}만 더했어요
                </p>
              )}
              {row.blocked && (
                <p className="mt-0.5 text-xs text-amber-700" role="note">
                  {tag}: 반기 칸에 읽을 수 없는 값이 있어 합계를 자동으로 더하지 않아요
                </p>
              )}
              {row.staleTotal && (
                <p className="mt-0.5 break-words text-xs text-gray-500" role="note">
                  {tag}: 이전 합계 {row.staleTotal} — 반기 합과 달라 저장할 때 업체 기타메모로 옮겨 둬요
                </p>
              )}
              {[상, 하, ...(row.auto ? [] : [합])].map(([k, label]) => (
                <MoneyLegacyNote key={String(k)} label={label} value={text(k)} signed={false} onConvert={() => convert(k, label)} />
              ))}
            </div>
          );
        })}
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
