/**
 * ChannelPerformance — 채널별 성과 (좌: 비용 도넛 / 우: DB유입 도넛, 좌우 대칭).
 *
 * SSOT: docs/design/components.md §9-7
 *
 * 좌: 채널별 비용 (3채널: 매입DB/직접생산/현수막, 콜·지·기·소 제외)
 *     - 가운데: 총비용 (만원)
 *     - 도넛 밑: 채널별 비용 + % 라벨
 * 우: 채널별 DB유입 (4채널 — 콜·지·기·소 포함)
 *     - 가운데: 총유입 건수
 *     - 도넛 밑: 채널별 유입 + % 라벨
 *
 * 채널 색: 매입DB=#3b82f6 / 직접생산=#16a34a / 현수막=#f59e0b / 콜·지·기·소=#8b5cf6
 */
"use client";

import type {
  DashboardChannelMatrix,
  DashboardCostBreakdown,
} from "@/types";

interface Props {
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
  const cx = 85;
  const cy = 80;
  const r = 48;
  const stroke = 20;
  const C = 2 * Math.PI * r; // ≈ 301.6

  let offset = 0;
  return (
    <svg viewBox="0 0 170 160" className="w-full" aria-hidden>
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
        fontSize="18"
        fontWeight={800}
        fill={centerValueColor}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {centerValue}
      </text>
    </svg>
  );
}

export default function ChannelPerformance({ costBreakdown, matrix }: Props) {
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

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      {/* 섹션 제목 */}
      <div className="mb-3 flex items-center gap-2">
        <span className="h-5 w-1 rounded-full bg-red-500" />
        <h2 className="text-base font-extrabold text-gray-900">채널별 성과</h2>
        <span className="ml-auto text-xs text-gray-400">8주 누적</span>
      </div>

      {/* 좌우 대칭 도넛 2개 */}
      <div className="grid grid-cols-2 gap-3">
        {/* === 좌: 채널별 비용 === */}
        <div>
          <div className="mb-1 text-center text-xs font-semibold text-gray-700">
            채널별 비용
          </div>
          <DonutSvg
            slices={costSlices}
            centerLabel="총비용"
            centerValue={`−${fmtMan(costTotal)}`}
            centerValueColor="#dc2626"
          />
          <ul
            className="mt-2 space-y-1 text-xs"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {costSlices.map((s) => {
              const pct = costTotal > 0 ? (s.value / costTotal) * 100 : 0;
              return (
                <li key={s.label} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="font-semibold text-gray-700">{s.label}</span>
                  <span className="ml-auto font-bold text-gray-900">
                    {fmtMan(s.value)}
                  </span>
                  <span className="w-10 text-right text-gray-500">
                    {pct.toFixed(1)}%
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* === 우: 채널별 DB유입 === */}
        <div>
          <div className="mb-1 text-center text-xs font-semibold text-gray-700">
            채널별 DB유입
          </div>
          <DonutSvg
            slices={inflowSlices}
            centerLabel="총유입"
            centerValue={fmtCount(inflowTotal)}
            centerValueColor="#1d4ed8"
          />
          <ul
            className="mt-2 space-y-1 text-xs"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {inflowSlices.map((s) => {
              const pct = inflowTotal > 0 ? (s.value / inflowTotal) * 100 : 0;
              return (
                <li key={s.label} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="font-semibold text-gray-700">{s.label}</span>
                  <span className="ml-auto font-bold text-gray-900">
                    {fmtCount(s.value)}
                  </span>
                  <span className="w-10 text-right text-gray-500">
                    {pct.toFixed(1)}%
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* === 채널별 계약단가 (1계약당 비용) — 좌우 도넛 아래 full-width === */}
      <div className="mt-4 rounded-lg bg-slate-50 p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <span className="text-xs">💼</span>
          <span className="text-xs font-semibold text-gray-700">
            채널별 계약단가
          </span>
          <span className="ml-1 text-[10px] text-gray-400">
            1계약당 들어간 비용 (낮을수록 효율적)
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {cpcRows.map((r) => (
            <div
              key={r.채널}
              className="rounded-md border border-gray-200 bg-white px-2 py-1.5"
            >
              <div className="flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ backgroundColor: r.color }}
                />
                <span className="truncate text-[10px] font-semibold text-gray-700">
                  {r.채널}
                </span>
              </div>
              <div
                className="mt-0.5 text-sm font-extrabold text-gray-900"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {!r.hasCost ? (
                  <span className="text-gray-400">—</span>
                ) : r.contracts === 0 ? (
                  <span className="text-gray-400">—</span>
                ) : (
                  fmtMan(r.cpc)
                )}
              </div>
              <div className="text-[9px] text-gray-400">
                {r.hasCost
                  ? `${fmtMan(r.cost)} ÷ ${r.contracts}건`
                  : "비용 없음"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
