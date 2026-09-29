/**
 * FontScaleControl — [ − 가 + ] 글자 크기 버튼(2026-09-29 belie). 지금 크기 기준 세 단계 더 크게.
 * 상태는 부모가 useFontStep 으로 들고, 부모 박스에 --font-scale 을 건다(lib/util/font-scale.ts).
 */
"use client";

import { MAX_FONT_STEP } from "@/util/font-scale";

interface Props {
  step: number;
  onChange: (next: number) => void;
  /** 화면 읽기 프로그램용 대상 이름(예: "업체정보"). */
  label: string;
}

export default function FontScaleControl({ step, onChange, label }: Props) {
  // 버튼 자체는 박스 배율과 무관하게 같은 크기(style 로 고정 — 누르다 버튼이 커져 밀리지 않게).
  const btn =
    "flex h-6 w-6 items-center justify-center rounded-full font-bold leading-none text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div role="group" aria-label={`${label} 글자 크기`} data-font-scale-control style={{ fontSize: 14 }}
      className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-white">
      <button type="button" onClick={() => onChange(step - 1)} disabled={step === 0} aria-label={`${label} 글자 작게`} className={btn}>−</button>
      <span className="select-none px-0.5 font-bold text-slate-700" title={`글자 크기 ${step + 1}/${MAX_FONT_STEP + 1}단계`}>
        가<span className="sr-only"> {step + 1}단계</span>
      </span>
      <button type="button" onClick={() => onChange(step + 1)} disabled={step === MAX_FONT_STEP} aria-label={`${label} 글자 크게`} className={btn}>+</button>
    </div>
  );
}
