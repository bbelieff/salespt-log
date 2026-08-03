/**
 * DateInputCustom — 커스텀 박스 + 0×0 native date input + showPicker.
 * 정본: docs/design/components.md §2 Date Input
 *
 * 한국어 UX 요구: "2026-04-25 (목)" 처럼 요일까지 표시.
 * native input은 표시 형식 제어 불가 → 보이는 박스는 우리 컴포넌트, picker만 native.
 */
"use client";

import { useId, useRef } from "react";

const DAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

interface Props {
  value: string; // YYYY-MM-DD
  onChange: (next: string) => void;
  ariaLabel?: string;
  min?: string;
  max?: string;
  placeholder?: string;
}

function formatDisplay(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dayKo = DAY_KO[d.getDay()];
  return `${iso} (${dayKo})`;
}

export default function DateInputCustom({
  value,
  onChange,
  ariaLabel,
  min,
  max,
  placeholder = "날짜 선택",
}: Props) {
  const id = useId();
  const nativeRef = useRef<HTMLInputElement>(null);

  const open = () => {
    const native = nativeRef.current;
    if (!native) return;
    type WithShowPicker = HTMLInputElement & { showPicker?: () => void };
    const withPicker = native as WithShowPicker;
    if (typeof withPicker.showPicker !== "function") {
      native.focus();
      return;
    }
    // showPicker() 는 **user gesture 밖에서 호출되면 NotAllowedError 를 던진다**.
    // 합성 클릭(예: 조상 <label> 이 native input 으로 재전달한 클릭)이 되버블링되면
    // 2차 호출이 발생해 예외로 죽고, 이미 열린 picker 가 닫혀 "날짜 선택 불가" 가 된다
    // (P0-2 실측: label 로 감싼 신규 미팅 슬롯에서만 재현). 호출부 구조와 무관하게
    // 안전하도록 여기서 삼킨다 — 실패해도 focus 로 degrade.
    try {
      withPicker.showPicker();
    } catch {
      native.focus();
    }
  };

  return (
    <div
      className="custom-date-wrapper"
      onClick={(e) => {
        // 조상 <label> 이 native input 으로 재전달한 클릭이 되버블링된 경우(=target 이 그 input)
        // 무시한다. 안 그러면 이미 열린 picker 위에서 showPicker() 가 2차 호출돼 닫힌다(P0-2).
        if (e.target === nativeRef.current) return;
        open();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
    >
      <span className="custom-date-display">
        {value ? formatDisplay(value) : (
          <span className="text-gray-400 font-normal">{placeholder}</span>
        )}
      </span>
      <span className="text-gray-400">📅</span>
      <input
        ref={nativeRef}
        id={id}
        type="date"
        className="hidden-native-date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden
      />
    </div>
  );
}
