/**
 * TimeSelectPair — 시(09~22) + 분(00·15·30·45) 분리 select.
 * 정본: docs/design/components.md §2 Time Input
 *
 * iOS Safari가 <input type="time" step="900">의 step을 무시하므로
 * 15분 단위 강제를 위해 select 2개로 분리.
 */
"use client";

interface Props {
  value: string; // "HH:MM" 또는 ""
  onChange: (next: string) => void;
  /** 영업시간 시작 (기본 09) */
  hourMin?: number;
  /** 영업시간 끝 (기본 22, 포함) */
  hourMax?: number;
  ariaLabel?: string;
}

const MINUTES = ["00", "15", "30", "45"] as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function splitHHMM(v: string): [string, string] {
  if (!v || !/^\d{2}:\d{2}$/.test(v)) return ["", ""];
  const [h, m] = v.split(":");
  return [h ?? "", m ?? ""];
}

export default function TimeSelectPair({
  value,
  onChange,
  hourMin = 9,
  hourMax = 22,
  ariaLabel,
}: Props) {
  const [hh, mm] = splitHHMM(value);

  const updateHour = (h: string) => {
    const m = mm || "00"; // 분이 없으면 기본 00
    if (h && m) onChange(`${h}:${m}`);
    else onChange("");
  };
  const updateMinute = (m: string) => {
    if (hh && m) onChange(`${hh}:${m}`);
    else onChange("");
  };

  const hours: string[] = [];
  for (let h = hourMin; h <= hourMax; h++) hours.push(pad2(h));

  return (
    <div className="time-select-wrapper" aria-label={ariaLabel}>
      <select
        className="time-hour"
        value={hh}
        onChange={(e) => updateHour(e.target.value)}
        aria-label={ariaLabel ? `${ariaLabel} 시` : "시"}
      >
        <option value="">--</option>
        {hours.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="time-separator">:</span>
      <select
        className="time-minute"
        value={mm}
        onChange={(e) => updateMinute(e.target.value)}
        aria-label={ariaLabel ? `${ariaLabel} 분` : "분"}
      >
        <option value="">--</option>
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
