/**
 * CompanyInfoFinanceFields — 업체정보 [재무] 금액·비율 칸 (company-finance-won-grid, belie 2026-09-28).
 *
 * - MillionWonInput: 백만원 금액 입력(원 단위 공용 입력 components/ui/MoneyInput 과는 다른 칸 — 값은 글).
 *   숫자만 친 값은 소수 한 자리까지(넘치면 잘라 알림, 칸을 떠나면 알림을 거둔다), 입력하는 동시에
 *   천 단위 쉼표("1,234" — 커서는 useLiveInput 이 보정, belie 2026-09-29), 단위 "백만원" 은 칸 안 오른쪽. 손익 칸만 앞 "-".
 *   칸 아래 "약 2.5억" · "약 3,200만" 읽기 도움말. 옛 자유 글은 그대로 보여 준다(열기만 해선 안 바꿈).
 * - MoneyLegacyNote: 옛 자유 글 안내 — 읽히면 "글로 적힌 값이에요 — 계산에는 X백만원으로 써요"(원 단위로
 *   적은 큰 숫자는 "원 단위로 적은 숫자 같아요 — …") + 「백만원으로 바꾸기」(그 칸만, 화면낭독기엔 어느 칸인지),
 *   못 읽으면 "읽을 수 없어 계산에서 빠져요".
 * - MoneyField: 라벨 + (?) + MillionWonInput("백만원" 단위 표시) + 옛 글 안내 — 영업이익 등.
 * - RatioField: 자동 계산 비율(읽기 전용, 라벨 옆 "(자동)"). 저장된 옛 값이 계산값과 다른 값이면
 *   "이전에 적은 값" 으로 보여 준다("120%" 와 "120.0%" 처럼 모양만 다르면 안 보임). 다음 저장 때
 *   계산값으로 바뀐다 — 계산할 금액이 없으면 옛 값은 그대로 둔다.
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
import { sameRatioText } from "@/service/company-finance";
import type { FieldDef } from "@/components/company-info-defs";
import { FieldLabel, hintIdOf, inputCls, readOnlyCls } from "./CompanyInfoField";
import { groupTyping } from "@/util/live-format";
import { useLiveInput } from "./useLiveInput";

const CUT_MSG = "소수는 한 자리까지만 적어요";
const RATIO_PLACEHOLDER = "금액을 적으면 자동 계산";

interface MillionWonInputProps {
  id: string;
  value: string;
  signed: boolean;
  onChange: (v: string) => void;
  /** @deprecated 단위 "백만원" 은 이제 늘 숫자 뒤(칸 안 오른쪽)에 보인다(belie 2026-09-29). */
  suffix?: boolean;
  describedBy?: string;
  /** 연도별 매출 표처럼 칸이 좁을 때 — 칸 안 단위를 짧고 옅은 "백만" 으로. */
  bare?: boolean;
}

export function MillionWonInput({ id, value, signed, onChange, describedBy, bare = false }: MillionWonInputProps) {
  const [cut, setCut] = useState(false);
  const read = readMoney(value, signed);
  const hint = read.kind === "number" ? moneyHint(read.tenths) : "";
  // 입력하는 동시에 천 단위 쉼표(belie 2026-09-29) — 소수 한 자리 제한(sanitize) 뒤 쉼표, 커서는 친 숫자 뒤.
  const live = useLiveInput((raw, caret, prev) => {
    const r = sanitizeMoneyTyping(raw, signed);
    setCut(r.cut);
    return groupTyping(r.value, caret, prev, signed);
  }, value, onChange);
  const showUnit = read.kind !== "legacy"; // 옛 "3,200만" 처럼 글로 적힌 값엔 단위를 또 붙이지 않는다.
  return (
    <div className="min-w-0">
      <div className="relative">
        <input
          id={id}
          ref={live.ref}
          // 숫자는 오른쪽 정렬(단위 "백만원" 은 칸 안 오른쪽 끝), 옛 자유 글은 앞부분이 보이게 왼쪽.
          className={`${inputCls} min-w-0 tabular-nums ${read.kind === "legacy" ? "" : "text-right"} ${showUnit ? (bare ? "pr-7" : "pr-12") : ""}`}
          inputMode={signed ? "text" : "decimal"}
          aria-describedby={describedBy}
          value={value}
          onChange={live.onChange}
          onBlur={() => {
            // 잘랐다는 알림은 입력 중에만 — 칸을 떠나면 "약 …" 도움말로 돌아간다.
            setCut(false);
            const next = formatMoneyOnBlur(value, signed);
            if (next !== value) onChange(next);
          }}
        />
        {showUnit && (
          <span aria-hidden className={`pointer-events-none absolute inset-y-0 flex items-center text-xs ${bare ? "right-1.5 text-gray-300" : "right-2 text-gray-400"}`}>
            {bare ? "백만" : "백만원"}
          </span>
        )}
      </div>
      {cut ? (
        <p className={`mt-0.5 text-xs text-amber-700 ${bare ? "truncate" : ""}`} role="status">
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
    r.tenths === null
      ? "읽을 수 없어 계산에서 빠져요"
      : r.wonScale
        ? `원 단위로 적은 숫자 같아요 — 계산에는 ${formatTenths(r.tenths)}백만원으로 써요`
        : `글로 적힌 값이에요 — 계산에는 ${formatTenths(r.tenths)}백만원으로 써요`;
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
          // 표 안에선 같은 버튼이 여러 개 — 화면낭독기가 어느 칸을 바꾸는지 알 수 있게.
          aria-label={label ? `${label} 백만원으로 바꾸기` : undefined}
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
      <MillionWonInput
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
  const old = stored.trim();
  const legacy = old !== "" && !sameRatioText(old, computed) ? old : "";
  return (
    <div className={`${className} min-w-0`}>
      <FieldLabel htmlFor={id} label={label} hint={hint} tag="(자동)" />
      <input
        id={id}
        className={`${readOnlyCls} placeholder:text-gray-400`}
        readOnly
        aria-readonly="true"
        aria-describedby={hintIdOf(id, label, hint)}
        placeholder={RATIO_PLACEHOLDER}
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
