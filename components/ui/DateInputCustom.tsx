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
    if (typeof withPicker.showPicker === "function") {
      withPicker.showPicker();
    } else {
      native.focus();
    }
  };

  return (
    <div
      className="custom-date-wrapper"
      onClick={open}
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
