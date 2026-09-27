/**
 * ChannelPerformance — 채널별 성과 (좌: 비용 도넛 / 우: DB유입 도넛, 좌우 대칭).
 *
 * SSOT: docs/design/components.md §9-7
 *
 * 좌: 채널별 비용 도넛 (3채널: 매입DB/직접생산/현수막, 콜·지·기·소 제외) — 가운데 총비용(만원)
 * 우: 채널별 DB유입 도넛 (4채널 — 콜·지·기·소 포함) — 가운데 총유입 건수
 * 도넛 제목은 도넛 왼쪽. 도넛 아래 채널 표 1개 = 비용(%) · DB유입(%) · 계약단가(비용÷계약).
 *
 * 채널 색: 매입DB=#3b82f6 / 직접생산=#16a34a / 현수막=#f59e0b / 콜·지·기·소=#8b5cf6
 */
"use client";
import { STATS_WEEKS } from "@/config/cohort-dates";

import type {
  DashboardChannelMatrix,
  DashboardCostBreakdown,
} from "@/types";

interface Props {
  weeks?: number;
  costBreakdown: DashboardCostBreakdown[]; // 3 (매입DB/직접생산/현수막)
  matrix: DashboardChannelMatrix[]; // 4 채널 (유입 추출)
}

const CH_COLOR: Record<string, string> = {
  매입DB: "#3b82f6",
  직접생산: "#16a34a",
  현수막: "#f59e0b",
  "콜·지·기·소": "#8b5cf6",
};

function fmtMan(원: number): string {
  return `${Math.round(원 / 10_000).toLocaleString("ko-KR")}만`;
}
function fmtCount(n: number): string {
  return n.toLocaleString("ko-KR");
}

interface Slice {
  label: string;
  value: number;
  color: string;
}

function DonutSvg({
  slices,
  centerLabel,
  centerValue,
  centerValueColor,
}: {
  slices: Slice[];
  centerLabel: string;
  centerValue: string;
  centerValueColor: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  // 여백 없는 정사각 viewBox(외곽 반지름 58 = r 48 + stroke/2) — 카드 높이를 줄이려고
  // 좌우 여백을 없앴다(2026-09-28). 표시 크기는 svg 클래스가 정한다 — 360px 폰에서
  // 옆 제목이 글자 단위로 쪼개지지 않게 402px 미만은 96px, 그 이상은 112px.
  const cx = 58;
  const cy = 58;
  const r = 48;
  const stroke = 20;
  const C = 2 * Math.PI * r; // ≈ 301.6
  // 가운데 구멍 지름은 76(= 2 × (r − stroke/2)) — 「−1,376만」처럼 긴 값이 고리에 닿지 않게 글자를 줄인다.
  const valueFontSize = centerValue.length >= 7 ? 13 : centerValue.length >= 6 ? 15 : 18;

  let offset = 0;
  return (
    <svg viewBox="0 0 116 116" preserveAspectRatio="xMidYMid meet" className="channel-donut-svg h-24 w-24 shrink-0 md:h-28 md:w-28" aria-hidden>
      {/* 값이 0이어도 도넛 자리가 보이게 옅은 바탕 고리 */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {slices.map((s) => {
          const portion = total > 0 ? s.value / total : 0;
          const dash = portion * C;
          const el = (
            <circle
              key={s.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${C}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return el;
        })}
      </g>
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        fontSize="11"
        fill="#94a3b8"
      >
        {centerLabel}
      </text>
      <text
        x={cx}
        y={cy + 16}
        textAnchor="middle"
        fontSize={valueFontSize}
        fontWeight={800}
        fill={centerValueColor}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {centerValue}
      </text>
    </svg>
  );
}

export default function ChannelPerformance({ costBreakdown, matrix, weeks = STATS_WEEKS }: Props) {
  // 좌: 비용 (3채널)
  const costSlices: Slice[] = costBreakdown.map((b) => ({
    label: b.채널,
    value: b.비용,
    color: CH_COLOR[b.채널] ?? "#94a3b8",
  }));
  const costTotal = costSlices.reduce((s, x) => s + x.value, 0);

  // 우: DB유입 (4채널)
  const inflowSlices: Slice[] = matrix.map((m) => ({
    label: m.채널,
    value: m.유입,
    color: CH_COLOR[m.채널] ?? "#94a3b8",
  }));
  const inflowTotal = inflowSlices.reduce((s, x) => s + x.value, 0);

  // 채널별 계약단가 = 채널 비용 ÷ 채널 계약건수 (= 1계약 따는 데 든 비용)
  // 콜·지·기·소는 비용 0 (도넛 좌측에 없음) — 별도 처리
  const costByChannel = new Map<string, number>();
  costBreakdown.forEach((b) => costByChannel.set(b.채널, b.비용));
  const cpcRows = matrix.map((m) => {
    const cost = costByChannel.get(m.채널) ?? 0;
    const cpc = m.계약 > 0 ? cost / m.계약 : 0;
    return {
      채널: m.채널,
      color: CH_COLOR[m.채널] ?? "#94a3b8",
      contracts: m.계약,
      cost,
      cpc,
      hasCost: cost > 0,
    };
  });

  const pct = (v: number, total: number) => (total > 0 ? `${((v / total) * 100).toFixed(0)}%` : "0%");

  // 높이 압축(2026-09-28 belie): 도넛 제목은 도넛 왼쪽에 붙이고, 도넛별 범례 2개 +
  // 계약단가 카드 4개를 채널 1행짜리 표 하나로 합쳤다(채널 색이 같아 범례가 중복이었다).
  return (
    <section className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      {/* 섹션 제목 */}
      <div className="mb-2 flex items-center gap-2">
        <span className="h-5 w-1 rounded-full bg-red-500" />
        <h2 className="text-base font-extrabold text-gray-900">채널별 성과</h2>
        <span className="ml-auto text-xs text-gray-400">{weeks}주 누적</span>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-2">
        {/* 도넛 2개 — 제목은 도넛 바로 왼쪽 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center justify-center gap-1.5">
            <span className="shrink-0 break-keep text-right text-xs font-semibold leading-tight text-gray-700">채널별<br />비용</span>
            <DonutSvg
              slices={costSlices}
              centerLabel="총비용"
              centerValue={`−${fmtMan(costTotal)}`}
              centerValueColor="#dc2626"
            />
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <span className="shrink-0 break-keep text-right text-xs font-semibold leading-tight text-gray-700">채널별<br />DB유입</span>
            <DonutSvg
              slices={inflowSlices}
              centerLabel="총유입"
              centerValue={fmtCount(inflowTotal)}
              centerValueColor="#1d4ed8"
            />
          </div>
        </div>

        {/* 채널 표 — 비용 · DB유입 · 계약단가(1계약당 비용) */}
        <table className="w-full whitespace-nowrap text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr className="text-gray-400">
              <th className="pb-0.5 text-left font-medium">채널</th>
              <th className="pb-0.5 text-right font-medium">비용</th>
              <th className="pb-0.5 text-right font-medium">DB유입</th>
              <th className="pb-0.5 text-right font-medium" title="1계약당 들어간 비용 = 채널 비용 ÷ 계약건수 (낮을수록 효율적)">
                계약단가
              </th>
            </tr>
          </thead>
          <tbody>
            {cpcRows.map((r) => {
              const inflow = inflowSlices.find((x) => x.label === r.채널)?.value ?? 0;
              return (
                <tr key={r.채널} className="border-t border-slate-100">
                  <td className="py-0.5">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: r.color }} />
                      <span className="truncate font-semibold text-gray-700">{r.채널}</span>
                    </span>
                  </td>
                  <td className="py-0.5 text-right">
                    {r.hasCost ? (
                      <>
                        <span className="font-bold text-gray-900">{fmtMan(r.cost)}</span>
                        <span className="ml-1 text-gray-400">{pct(r.cost, costTotal)}</span>
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-0.5 text-right">
                    <span className="font-bold text-gray-900">{fmtCount(inflow)}</span>
                    <span className="ml-1 text-gray-400">{pct(inflow, inflowTotal)}</span>
                  </td>
                  <td
                    className="py-0.5 text-right font-bold text-gray-900"
                    title={r.hasCost ? `${fmtMan(r.cost)} ÷ ${r.contracts}건` : "비용 없음"}
                  >
                    {!r.hasCost || r.contracts === 0 ? <span className="font-normal text-gray-400">—</span> : fmtMan(r.cpc)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
