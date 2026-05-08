/**
 * FunnelChart — 6단계 영업퍼널 stacked SVG (사다리꼴 connector 포함).
 *
 * SSOT: docs/design/components.md §9-4
 * 디자인 정본: prototype line 302~430
 *
 * 단계: 생산 → 유입 → 컨택진행 → 미팅예약 → 미팅완료 → 계약
 * 채널 색: 매입DB=#3b82f6 / 직접생산=#16a34a / 현수막=#f59e0b / 콜·지·기·소=#8b5cf6
 *
 * SVG 좌표 (viewBox 0 0 358 260):
 *   라벨 영역: x 0~70 (단계명, 우측정렬 x=68)
 *   막대 영역: x 78~298 (220px), max=360 → 220px 정규화
 *   합계 영역: x 304+
 *   행 높이 22, 사다리꼴 connector 높이 15
 *   계약 행은 폰트 22 강조 (text-blue-700 fw-800)
 */
"use client";

import type { DashboardChannelMatrix } from "@/types";

interface Props {
  matrix: DashboardChannelMatrix[]; // 4 채널
}

const STAGES = ["생산", "유입", "컨택진행", "미팅예약", "미팅완료", "계약"] as const;
type StageKey = (typeof STAGES)[number];

const CH_COLOR: Record<DashboardChannelMatrix["채널"], string> = {
  매입DB: "#3b82f6",
  직접생산: "#16a34a",
  현수막: "#f59e0b",
  "콜·지·기·소": "#8b5cf6",
};
const CH_ORDER: DashboardChannelMatrix["채널"][] = [
  "매입DB",
  "직접생산",
  "현수막",
  "콜·지·기·소",
];

const BAR_X = 78;
const BAR_MAX_W = 220;
const BAR_H = 22;
const TRAP_H = 15;

export default function FunnelChart({ matrix }: Props) {
  // 채널별 lookup (CH_ORDER 순서 보장)
  const ordered: Record<DashboardChannelMatrix["채널"], DashboardChannelMatrix> =
    Object.fromEntries(
      CH_ORDER.map((ch) => [
        ch,
        matrix.find((m) => m.채널 === ch) ?? {
          채널: ch,
          생산: 0,
          유입: 0,
          컨택진행: 0,
          미팅예약: 0,
          미팅완료: 0,
          계약: 0,
        },
      ]),
    ) as Record<DashboardChannelMatrix["채널"], DashboardChannelMatrix>;

  const stageTotal = (s: StageKey) =>
    CH_ORDER.reduce((sum, ch) => sum + (ordered[ch][s] as number), 0);
  const totals = STAGES.map(stageTotal);
  const maxTotal = Math.max(...totals, 1);
  const stageWidth = (s: StageKey) => (stageTotal(s) / maxTotal) * BAR_MAX_W;

  // 행 시작 y: 12, 49, 86, 123, 160, 197 (각 행 = BAR 22 + TRAP 15 = 37)
  const rowY = (i: number) => 12 + i * 37;
  const trapY = (i: number) => rowY(i) + BAR_H;

  const inflow = stageTotal("유입");
  const contract = stageTotal("계약");
  const conversionRate = inflow > 0 ? (contract / inflow) * 100 : 0;

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      {/* 섹션 제목 */}
      <div className="mb-3 flex items-center gap-2">
        <span className="h-5 w-1 rounded-full bg-blue-500" />
        <h2 className="text-base font-extrabold text-gray-900">영업 퍼널</h2>
        <span className="ml-auto text-xs text-gray-400">8주 누적</span>
      </div>

      <svg viewBox="0 0 358 260" className="w-full" aria-label="6단계 영업 퍼널">
        {STAGES.map((stage, i) => {
          const y = rowY(i);
          const totalW = stageWidth(stage);
          const isContract = stage === "계약";
          const labelColor = isContract ? "#1d4ed8" : "#374151";
          const labelWeight = isContract ? 800 : 600;
          const labelFontSize = isContract ? 16 : 14;
          const valueFontSize = isContract ? 22 : 16;
          const valueColor = isContract ? "#1d4ed8" : "#111827";
          const valueWeight = isContract ? 800 : 700;

          // stacked rect 누적
          let cursor = BAR_X;
          const segments = CH_ORDER.map((ch) => {
            const v = ordered[ch][stage] as number;
            const w =
              stageTotal(stage) > 0 ? (v / stageTotal(stage)) * totalW : 0;
            const seg = { ch, x: cursor, w };
            cursor += w;
            return seg;
          });

          // 사다리꼴: 현재 단계 끝 → 다음 단계 시작 (가운데 정렬되도록)
          const nextW = i < STAGES.length - 1 ? stageWidth(STAGES[i + 1]!) : 0;
          const trapTopLeft = BAR_X;
          const trapTopRight = BAR_X + totalW;
          const trapBotLeft = BAR_X + (totalW - nextW) / 2;
          const trapBotRight = trapBotLeft + nextW;

          return (
            <g key={stage}>
              {/* 단계 라벨 */}
              <text
                x={68}
                y={y + (isContract ? 16 : 14)}
                textAnchor="end"
                fontSize={labelFontSize}
                fill={labelColor}
                fontWeight={labelWeight}
              >
                {stage}
              </text>

              {/* stacked 막대 */}
              {segments.map((s, idx) => (
                <rect
                  key={s.ch}
                  x={s.x}
                  y={y}
                  width={s.w}
                  height={BAR_H}
                  fill={CH_COLOR[s.ch]}
                  rx={idx === 0 ? 2 : 0}
                />
              ))}

              {/* 합계 */}
              <text
                x={306}
                y={y + (isContract ? 17 : 16)}
                fontSize={valueFontSize}
                fill={valueColor}
                fontWeight={valueWeight}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {totals[i]}
              </text>

              {/* 사다리꼴 connector (마지막 단계 제외) */}
              {i < STAGES.length - 1 && nextW > 0 && (
                <path
                  d={`M ${trapTopLeft} ${trapY(i)} L ${trapTopRight} ${trapY(i)} L ${trapBotRight} ${trapY(i) + TRAP_H} L ${trapBotLeft} ${trapY(i) + TRAP_H} Z`}
                  fill="#f1f5f9"
                  stroke="#cbd5e1"
                  strokeWidth={0.5}
                />
              )}
            </g>
          );
        })}

        {/* 하단 인사이트 */}
        <line x1="0" y1="240" x2="358" y2="240" stroke="#f1f5f9" strokeWidth={1} />
        <text x="78" y="256" fontSize="12" fill="#64748b">
          <tspan fontWeight={700} fill="#374151">
            전체 전환율:
          </tspan>
          <tspan dx="3">
            유입 {inflow} → 계약 {contract} ={" "}
          </tspan>
          <tspan
            fontWeight={800}
            fill="#1d4ed8"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {conversionRate.toFixed(1)}%
          </tspan>
        </text>
      </svg>

      {/* 채널 범례 */}
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-gray-600">
        {CH_ORDER.map((ch) => (
          <span key={ch} className="flex items-center gap-1">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: CH_COLOR[ch] }}
            />
            {ch}
          </span>
        ))}
      </div>
    </section>
  );
}
