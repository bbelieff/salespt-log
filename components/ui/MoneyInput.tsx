/**
 * MoneyInput — 금액 입력(타이핑 중 자동 천단위 콤마). 앱 전체 금액 입력의 단일 부품.
 *
 * 계약(시트 안전의 핵심):
 *  - 화면 표시 = 콤마 문자열, **방출 = number**(`onChange: (n: number) => void`).
 *    타입으로 강제해 콤마 문자열이 repo/시트로 흘러가는 경로를 원천 차단한다
 *    (시트 쓰기는 USER_ENTERED — 콤마 문자열이 닿으면 수식이 깨진다).
 *  - 파싱은 `parseMoney`(숫자 strip 후 Number). **parseInt 금지** — "1,000,000" → 1 로 조용히 절단.
 *
 * 커서 보정: 콤마가 삽입/삭제되며 커서가 끝으로 튀는 문제를 rAF + setSelectionRange 로 보정
 * (기존 ContractForm/PaymentSlotForm 구현에서 승계 — RowForm/LinkedFieldsEditor 는 없던 개선).
 *
 * type="text" + inputMode="numeric" 인 이유: type="number" 는 콤마를 invalid 로 보고 value 를
 * 빈값으로 만들어 **0 이 조용히 저장**된다(db-money-comma 에서 확립된 계약).
 */
"use client";

import { formatMoneyInput, parseMoney } from "@/lib/format/money";

interface Props {
  /** 저장값(number). 0 이면 입력창은 빈칸(placeholder 노출). */
  value: number;
  /** 항상 number 를 방출 — 시트/DB 로 콤마 문자열이 나가지 않는다. */
  onChange: (n: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

export default function MoneyInput({
  value,
  onChange,
  placeholder,
  className,
  disabled,
  "aria-label": ariaLabel,
}: Props) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={formatMoneyInput(value)}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel}
      className={className}
      style={{ fontVariantNumeric: "tabular-nums" }}
      onChange={(e) => {
        const input = e.currentTarget;
        const oldVal = input.value;
        const cursorPos = input.selectionStart ?? 0;
        const num = parseMoney(oldVal);
        const newVal = formatMoneyInput(num);
        // 커서 보정 — 콤마 개수 차이만큼 이동(안 하면 매 입력마다 커서가 끝으로 튄다).
        requestAnimationFrame(() => {
          const oldCommas = (oldVal.slice(0, cursorPos).match(/,/g) ?? []).length;
          const newCommas = (newVal.slice(0, cursorPos).match(/,/g) ?? []).length;
          const newPos = Math.max(
            0,
            Math.min(newVal.length, cursorPos + (newCommas - oldCommas)),
          );
          try {
            input.setSelectionRange(newPos, newPos);
          } catch {
            /* no-op — 일부 브라우저/IME */
          }
        });
        onChange(num);
      }}
    />
  );
}
