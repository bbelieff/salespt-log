/**
 * MetricStepper — 숫자 +/- 입력.
 * 정본: docs/design/components.md §2 Number Input (Stepper)
 *
 * 원칙:
 *   - 커스텀 +/- 버튼만 사용
 *   - 네이티브 스피너(상하 화살표)는 CSS로 숨김
 *   - inputmode=numeric (모바일 숫자 키패드)
 */
"use client";

import { useId } from "react";

interface Props {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  ariaLabel?: string;
  /** 미팅예약 같은 cap이 걸린 경우 + 버튼 비활성. */
  capped?: boolean;
  cappedHint?: string;
  /** 큰 step 버튼 추가 (생산 +10/-10 같은 빠른 가산, 2026-05-17 [C-1]). */
  bigStep?: number;
}

export default function MetricStepper({
  value,
  onChange,
  min = 0,
  max,
  ariaLabel,
  capped = false,
  cappedHint,
  bigStep,
}: Props) {
  const id = useId();
  const canDec = value > min;
  const canInc = !capped && (max === undefined || value < max);
  const canBigDec = value > min;
  const canBigInc = !capped && (max === undefined || value < max);

  const handle = (delta: number) => {
    let next = value + delta;
    if (next < min) next = min;
    if (max !== undefined && next > max) next = max;
    onChange(next);
  };

  return (
    <div className="flex items-center gap-1.5">
      {bigStep && (
        <button
          type="button"
          onClick={() => handle(-bigStep)}
          disabled={!canBigDec}
          className="rounded-full bg-gray-200 px-2 py-1 text-[11px] font-bold text-gray-800 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={ariaLabel ? `${ariaLabel} ${bigStep} 감소` : `${bigStep} 감소`}
          title={`${bigStep}개 한꺼번에 감소`}
        >
          −{bigStep}
        </button>
      )}
      <button
        type="button"
        onClick={() => handle(-1)}
        disabled={!canDec}
        className="stepper-btn bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={ariaLabel ? `${ariaLabel} 감소` : "감소"}
      >
        −
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        className="stepper-val"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isNaN(v)) return;
          let next = v;
          if (next < min) next = min;
          if (max !== undefined && next > max) next = max;
          onChange(next);
        }}
        aria-label={ariaLabel}
      />
      <button
        type="button"
        onClick={() => handle(1)}
        disabled={!canInc}
        title={capped ? cappedHint : undefined}
        className="stepper-btn bg-blue-500 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={ariaLabel ? `${ariaLabel} 증가` : "증가"}
      >
        +
      </button>
      {bigStep && (
        <button
          type="button"
          onClick={() => handle(bigStep)}
          disabled={!canBigInc}
          title={capped ? cappedHint : `${bigStep}개 한꺼번에 증가`}
          className="rounded-full bg-blue-100 px-2 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-200 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={ariaLabel ? `${ariaLabel} ${bigStep} 증가` : `${bigStep} 증가`}
        >
          +{bigStep}
        </button>
      )}
    </div>
  );
}
