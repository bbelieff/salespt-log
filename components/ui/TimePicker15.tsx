/**
 * TimePicker15 — 시간 입력 (HH + 15분 단위 분 선택).
 *
 * 디자인 (2026-05-19 사용자 요청): 시간필드 늘리고 분은 [00 | 15 | 30 | 45]
 * 4개 segmented 버튼으로 빠른 선택.
 *
 * value/onChange: "HH:MM" 문자열 (zero-padded).
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
        className="w-16 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
      >
        {Array.from({ length: 24 }, (_, i) => pad2(i)).map((hh) => (
          <option key={hh} value={hh}>
            {hh}시
          </option>
        ))}
      </select>
      <div className="flex flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white">
        {MINUTES.map((mm) => {
          const active = mm === mSnap;
          return (
            <button
              key={mm}
              type="button"
              onClick={() => setM(mm)}
              className={`flex-1 px-1 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "bg-blue-500 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
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
