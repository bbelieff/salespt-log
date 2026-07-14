/**
 * PhoneInput — 연락처 입력(타이핑 중 자동 하이픈). 순수 전화 필드용 단일 부품.
 *
 * 계약:
 *  - 방출 = **하이픈 포함 문자열**(`onChange: (s: string) => void`). 저장도 그대로.
 *    시트 쓰기가 USER_ENTERED 라 **숫자만 문자열은 Sheets 가 숫자로 파싱해 선행 0 을 날린다**
 *    → 하이픈 저장이 오히려 안전(텍스트 유지).
 *  - 표시 정규화(레거시·합본 값)는 `formatPhone` 사용. 이 컴포넌트는 **순수 전화 필드**용이며,
 *    "010-1234-5678(SKT)" 같은 **합본 필드에는 쓰지 않는다**(마스크가 괄호부를 깬다).
 */
"use client";

import { maskPhoneInput } from "@/lib/format/phone";

interface Props {
  /** 저장값(하이픈 포함 문자열). */
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

export default function PhoneInput({
  value,
  onChange,
  placeholder = "010-0000-0000",
  className,
  disabled,
  "aria-label": ariaLabel,
}: Props) {
  return (
    <input
      type="tel"
      inputMode="tel"
      value={maskPhoneInput(value)}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel}
      className={className}
      onChange={(e) => onChange(maskPhoneInput(e.currentTarget.value))}
    />
  );
}
