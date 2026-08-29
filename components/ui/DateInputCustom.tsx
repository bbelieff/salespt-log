/**
 * DateInputCustom — 커스텀 박스 + 0×0 native date input + showPicker.
 * 정본: docs/design/components.md §2 Date Input
 *
 * 한국어 UX 요구: "2026-04-25 (목)" 처럼 요일까지 표시.
 * native input은 표시 형식 제어 불가 → 보이는 박스는 우리 컴포넌트, picker만 native.
 */
"use client";

import { useId, useRef, useState } from "react";

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
  // showPicker() 가 (미지원/예외로) 실패했을 때만 native input 을 pointer-events:auto 로
  // 되살려 브라우저 기본 클릭-오픈에 기대는 최후 폴백(BBE-81, 2026-08-07). 평소엔
  // globals.css 의 pointer-events:none 이 클릭을 전부 wrapper(JS)로만 보낸다.
  //
  // ⚠️ 이 폴백은 **예외가 났을 때만** 켜진다 — 그래서 "조용한 실패"는 못 잡는다.
  // 실제로 2026-08-29 에 크롬이 `opacity:0` 인 date input 의 showPicker() 를 예외 없이
  // 무시하기 시작해 4번째 재발이 났다(호출은 ok, 달력만 안 뜸 → 폴백도 안 켜짐 → 완전 무반응).
  // 그 방어선은 JS 가 아니라 **CSS 계약**이다 — globals.css 의 `.hidden-native-date` 는
  // opacity 를 0 으로 두지 않는다(내용만 투명화). tests/components/date-input-picker.test.ts
  // 의 「가시성 계약」 describe 가 이를 기계 검증한다. 되돌리지 말 것.
  const [fallback, setFallback] = useState(false);

  const open = () => {
    const native = nativeRef.current;
    if (!native) return;
    type WithShowPicker = HTMLInputElement & { showPicker?: () => void };
    const withPicker = native as WithShowPicker;
    if (typeof withPicker.showPicker !== "function") {
      setFallback(true);
      native.focus();
      return;
    }
    // showPicker() 는 **user gesture 밖에서 호출되면 NotAllowedError 를 던진다**.
    // 합성 클릭(예: 조상 <label> 이 native input 으로 재전달한 클릭)이 되버블링되면
    // 2차 호출이 발생해 예외로 죽고, 이미 열린 picker 가 닫혀 "날짜 선택 불가" 가 된다
    // (P0-2 실측: label 로 감싼 신규 미팅 슬롯에서만 재현). 호출부 구조와 무관하게
    // 안전하도록 여기서 삼킨다 — 실패해도 focus 로 degrade하고, 눈에 보이는 폴백으로
    // 전환한다(BBE-81 — 예전엔 여기서 조용히 아무 일도 안 일어나 "무반응"으로 보였다).
    try {
      withPicker.showPicker();
    } catch (err) {
      console.warn("DateInputCustom: showPicker() 실패 — 직접 클릭 폴백으로 전환", err);
      setFallback(true);
      native.focus();
    }
  };

  return (
    <div
      className="custom-date-wrapper"
      onClick={(e) => {
        // native input 이 박스 전체를 투명하게 덮고 있다 — 평소엔 pointer-events:none 이라
        // 이 분기가 사실상 안 탄다(클릭이 항상 span/wrapper 로 옴). fallback 모드에서만
        // native 가 직접 클릭을 받아 브라우저 기본 동작으로 열리므로, 그 클릭까지
        // showPicker() 로 다시 열면 이미 열린 picker 가 닫힌다 — 방어로 남겨둔다.
        if (e.target === nativeRef.current) return;
        open();
      }}
    >
      <span className="custom-date-display">
        {value ? formatDisplay(value) : (
          <span className="text-gray-400 font-normal">{placeholder}</span>
        )}
      </span>
      <span className="text-gray-400">📅</span>
      {fallback && (
        <span className="shrink-0 text-xs text-amber-600" role="status">
          다시 눌러주세요
        </span>
      )}
      <input
        ref={nativeRef}
        id={id}
        type="date"
        className={
          fallback ? "hidden-native-date hidden-native-date--fallback" : "hidden-native-date"
        }
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
      />
    </div>
  );
}
