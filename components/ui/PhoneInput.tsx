/**
 * PhoneInput — 연락처 입력(타이핑 중 자동 하이픈). 순수 전화 필드용 단일 부품.
 *
 * 계약:
 *  - 방출 = **하이픈 포함 문자열**(`onChange: (s: string) => void`). 저장도 그대로.
 *    시트 쓰기가 USER_ENTERED 라 **숫자만 문자열은 Sheets 가 숫자로 파싱해 선행 0 을 날린다**
 *    → 하이픈 저장이 오히려 안전(텍스트 유지).
 *  - 마스크는 **비파괴**(maskPhoneInput): **선행 전화 런만** 포맷하고 뒤 텍스트는 보존한다.
 *    연락처 칸엔 메모·2번째 번호·통신사가 함께 적혀 있을 수 있어("010-1234-5678 (김대표)"),
 *    숫자만 남기고 자르면 **시트 원문이 영구 삭제**된다. 선행 0 소실 레거시도 복원한다.
 *  - 커서 보정(rAF + setSelectionRange) — 하이픈 증감으로 캐럿이 끝으로 튀는 것 방지.
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
      onChange={(e) => {
        const input = e.currentTarget;
        const oldVal = input.value;
        const cursorPos = input.selectionStart ?? 0;
        const newVal = maskPhoneInput(oldVal);
        // 커서 보정 — 하이픈 삽입/삭제 개수 차이만큼 이동(안 하면 중간 수정 시 캐럿이 끝으로 튄다).
        requestAnimationFrame(() => {
          const oldSeps = (oldVal.slice(0, cursorPos).match(/-/g) ?? []).length;
          const newSeps = (newVal.slice(0, cursorPos).match(/-/g) ?? []).length;
          const newPos = Math.max(
            0,
            Math.min(newVal.length, cursorPos + (newSeps - oldSeps)),
          );
          try {
            input.setSelectionRange(newPos, newPos);
          } catch {
            /* no-op — 일부 브라우저/IME */
          }
        });
        onChange(newVal);
      }}
    />
  );
}
