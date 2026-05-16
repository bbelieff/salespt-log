/**
 * WeekFunnelBar — 컨택탭 헤더 아래 금주 채널 funnel 합계 표시 (2026-05-16).
 *
 * 표시: 생산 · 유입 · 컨택진행 · 미팅예약 — 4채널 합산, 그 주 전체 합.
 * SSOT: 시트 01 영업관리!E~H 의 28 데이터 row (7일 × 4채널) 합산 (readWeekFunnel).
 *
 * 일정·계약 탭의 SummaryBar 와 동일한 visual pattern — 4 단위 균등 분할 + 큰 숫자.
 */
"use client";

interface Props {
  weekFunnel: {
    생산: number;
    유입: number;
    컨택진행: number;
    미팅예약: number;
  };
}

export default function WeekFunnelBar({ weekFunnel }: Props) {
  return (
    <div className="grid grid-cols-4 gap-1 border-t border-gray-100 bg-white px-2 py-2">
      <Metric label="생산" value={weekFunnel.생산} tone="text-gray-800" />
      <Metric label="유입" value={weekFunnel.유입} tone="text-amber-700" />
      <Metric
        label="컨택진행"
        value={weekFunnel.컨택진행}
        tone="text-indigo-700"
      />
      <Metric
        label="미팅예약"
        value={weekFunnel.미팅예약}
        tone="text-green-700"
      />
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg py-1.5">
      <span className={`text-base font-bold leading-none ${tone}`}>{value}</span>
      <span className="mt-0.5 text-[10px] font-medium text-gray-500">
        {label}
      </span>
    </div>
  );
}
