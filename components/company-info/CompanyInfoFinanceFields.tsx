/**
 * CompanyInfoFinanceFields — 업체정보 [재무] 금액·비율 칸 (company-finance-won-grid, belie 2026-09-28).
 *
 * - MoneyInput: 백만원 금액 입력. 숫자만 친 값은 소수 한 자리까지(넘치면 잘라 알림), 칸을 떠날 때(blur)
 *   천 단위 쉼표("1,234" — 입력 중에 찍으면 커서가 튄다, 임차 칸과 같은 방식). 손익 칸만 앞 "-".
 *   칸 아래 "약 2.5억" · "약 3,200만" 읽기 도움말. 옛 자유 글은 그대로 보여 준다(열기만 해선 안 바꿈).
 * - MoneyLegacyNote: 옛 자유 글 안내 — 읽히면 "글로 적힌 값이에요 — 계산에는 X백만원으로 써요" +
 *   「백만원으로 바꾸기」(그 칸만), 못 읽으면 "읽을 수 없어 계산에서 빠져요".
 * - MoneyField: 라벨 + (?) + MoneyInput("백만원" 단위 표시) + 옛 글 안내 — 영업이익 등.
 * - RatioField: 자동 계산 비율(읽기 전용). 저장된 옛 값이 계산값과 다르면 "이전에 적은 값" 으로 보여 준다
 *   (다음 저장 때 계산값으로 바뀐다 — 계산할 금액이 없으면 옛 값은 그대로 둔다).
 */
"use client";

import { useState } from "react";
import type { CompanyInfo } from "@/types";
import {
  formatMoneyOnBlur,
  formatTenths,
  moneyHint,
  readMoney,
  sanitizeMoneyTyping,
} from "@/util/company-money";
import type { FieldDef } from "@/components/company-info-defs";
import { FieldLabel, hintIdOf, inputCls, readOnlyCls } from "./CompanyInfoField";

const CUT_MSG = "소수는 한 자리까지만 적어요";

interface MoneyInputProps {
  id: string;
  value: string;
  signed: boolean;
  onChange: (v: string) => void;
  /** 입력칸 옆 "백만원" 표시(연도별 매출 표는 머리글에 단위가 있어 끈다). */
  suffix?: boolean;
  describedBy?: string;
}

export function MoneyInput({ id, value, signed, onChange, suffix = false, describedBy }: MoneyInputProps) {
  const [cut, setCut] = useState(false);
  const read = readMoney(value, signed);
  const hint = read.kind === "number" ? moneyHint(read.tenths) : "";
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1">
        <input
          id={id}
          // 숫자는 오른쪽 정렬, 옛 자유 글은 앞부분이 보이게 왼쪽.
          className={`${inputCls} min-w-0 tabular-nums ${read.kind === "legacy" ? "" : "text-right"}`}
          inputMode={signed ? "text" : "decimal"}
          aria-describedby={describedBy}
          value={value}
          onChange={(e) => {
            const r = sanitizeMoneyTyping(e.target.value, signed);
            setCut(r.cut);
            onChange(r.value);
          }}
          onBlur={() => {
            const next = formatMoneyOnBlur(value, signed);
            if (next !== value) onChange(next);
          }}
        />
        {/* 옛 "3,200만" 처럼 글로 적힌 값엔 단위를 또 붙이지 않는다. */}
        {suffix && read.kind !== "legacy" && <span className="shrink-0 text-xs text-gray-500">백만원</span>}
      </div>
      {cut ? (
        <p className="mt-0.5 text-xs text-amber-700" role="status">
          {CUT_MSG}
        </p>
      ) : (
        hint && <p className="mt-0.5 truncate text-xs text-gray-500">{hint}</p>
      )}
    </div>
  );
}

/** 옛 자유 글 안내 + 「백만원으로 바꾸기」. 숫자·빈칸이면 아무것도 그리지 않는다. */
export function MoneyLegacyNote({
  label,
  value,
  signed,
  onConvert,
}: {
  /** 표 안 칸이면 어느 칸인지("Y(2026) 상반기"). 칸 바로 아래면 생략. */
  label?: string;
  value: string;
  signed: boolean;
  onConvert: () => void;
}) {
  const r = readMoney(value, signed);
  if (r.kind !== "legacy") return null;
  const text =
    r.tenths === null ? "읽을 수 없어 계산에서 빠져요" : `글로 적힌 값이에요 — 계산에는 ${formatTenths(r.tenths)}백만원으로 써요`;
  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-amber-700" role="note">
      <span className="min-w-0 break-words">
        {label ? `${label}: ` : ""}
        {text}
      </span>
      {r.tenths !== null && (
        <button
          type="button"
          onClick={onConvert}
          className="shrink-0 rounded border border-amber-300 px-1.5 text-amber-800 hover:bg-amber-50"
        >
          백만원으로 바꾸기
        </button>
      )}
    </div>
  );
}

export function MoneyField({
  def,
  value,
  signed,
  onChange,
  onConvert,
  id,
  className = "block",
}: {
  def: FieldDef;
  value: string;
  signed: boolean;
  onChange: (k: keyof CompanyInfo, v: string) => void;
  onConvert: () => void;
  id: string;
  className?: string;
}) {
  const [k, label, hint] = def;
  return (
    <div className={`${className} min-w-0`}>
      <FieldLabel htmlFor={id} label={label} hint={hint} />
      <MoneyInput
        id={id}
        value={value}
        signed={signed}
        suffix
        describedBy={hintIdOf(id, label, hint)}
        onChange={(v) => onChange(k, v)}
      />
      <MoneyLegacyNote value={value} signed={signed} onConvert={onConvert} />
    </div>
  );
}

export function RatioField({
  def,
  computed,
  stored,
  id,
  className = "block",
}: {
  def: FieldDef;
  computed: string;
  stored: string;
  id: string;
  className?: string;
}) {
  const [, label, hint] = def;
  const legacy = stored.trim() !== "" && stored.trim() !== computed ? stored.trim() : "";
  return (
    <div className={`${className} min-w-0`}>
      <FieldLabel htmlFor={id} label={label} hint={hint} />
      <input
        id={id}
        className={readOnlyCls}
        readOnly
        aria-readonly="true"
        aria-describedby={hintIdOf(id, label, hint)}
        value={computed}
      />
      {legacy && (
        <p className="mt-0.5 break-words text-xs text-gray-500" role="note">
          이전에 적은 값: {legacy}
        </p>
      )}
    </div>
  );
}
