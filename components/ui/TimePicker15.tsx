/**
 * TimePicker15 — 시간 입력 (HH + 15분 단위 분 선택).
 *
 * 디자인 (2026-05-19 사용자 요청): 시간필드 늘리고 분은 [00 | 15 | 30 | 45]
 * 4개 segmented 버튼으로 빠른 선택.
 *
 * value/onChange: "HH:MM" 문자열 (zero-padded).
 * 시 범위 = 08~21시(컨택 TimeSelectPair 와 통일, belie 2026-11-10). 범위 밖 기존 값은 그대로 보인다.
 */
"use client";

type Props = {
  value: string;
  onChange: (next: string) => void;
};

const MINUTES = ["00", "15", "30", "45"] as const;

function parse(v: string): { h: string; m: string } {
  const [h, m] = (v || "10:00").split(":");
  return { h: h ?? "10", m: m ?? "00" };
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

const HOUR_MIN = 8, HOUR_MAX = 21;
/** 08~21시 + 범위 밖 현재 값(있으면). */
export function hourOptions(current: string): string[] {
  const hours = Array.from({ length: HOUR_MAX - HOUR_MIN + 1 }, (_, i) => pad2(HOUR_MIN + i));
  if (current && !hours.includes(current)) hours.push(current);
  return hours.sort();
}

export default function TimePicker15({ value, onChange }: Props) {
  const { h, m } = parse(value);
  const mSnap = MINUTES.includes(m as (typeof MINUTES)[number])
    ? m
    : "00";

  const setH = (next: string) => onChange(`${next}:${mSnap}`);
  const setM = (next: string) => onChange(`${h}:${next}`);

  return (
    <div className="flex items-stretch gap-1.5">
      <select
        aria-label="시"
        value={h}
        onChange={(e) => setH(e.target.value)}
        className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
      >
        {hourOptions(h).map((hh) => (
          <option key={hh} value={hh}>
            {hh}시
          </option>
        ))}
      </select>
      <div className="flex flex-1 rounded-lg border border-slate-200 bg-white">
        {MINUTES.map((mm) => {
          const active = mm === mSnap;
          return (
            <button
              key={mm}
              type="button"
              onClick={() => setM(mm)}
              className={`hit-44-y flex-1 px-1 py-1.5 text-xs font-semibold transition-colors first:rounded-l-md last:rounded-r-md ${
                active
                  ? "bg-blue-700 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              :{mm}
            </button>
          );
        })}
      </div>
    </div>
  );
}
