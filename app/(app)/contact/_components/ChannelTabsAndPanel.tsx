/**
 * 채널 탭 (4개) + 채널별 4지표 입력 패널 (6:4 그리드).
 * 정본: docs/design/prototypes/contact-daily-input.html (v7) §2-2, §2-3
 *
 * - 탭에 합계 배지 (그 채널의 4지표 합)
 * - 활성 탭 밑줄 (채널 색)
 * - 6:4 좌우 그리드: 입력 | "오늘 채널 합계" 강조
 */
"use client";

import { CHANNEL_ORDER, type Channel } from "@/types";
import type { ChannelDailyRowMetrics } from "@/service";

const CHANNEL_META: Record<
  Channel,
  {
    desc: string;
    helps: { production: string; inflow: string; contactProgress: string; contactSuccess: string };
    color: "blue" | "green" | "amber" | "purple";
    badgeClass: string;
  }
> = {
  매입DB: {
    desc: "DB생산업체로부터 구매",
    helps: {
      production: "구매한 DB 수",
      inflow: "오늘 전달받은 DB 수",
      contactProgress: "부재 제외, 실제 통화 수",
      contactSuccess: "미팅 예약 확정된 수",
    },
    color: "blue",
    badgeClass: "badge badge-purchase",
  },
  직접생산: {
    desc: "메타·구글·당근 등",
    helps: {
      production: "오늘 생산된 DB 수",
      inflow: "오늘 유입된 DB 수 (보통=생산)",
      contactProgress: "부재 제외, 실제 통화 수",
      contactSuccess: "미팅 예약 확정된 수",
    },
    color: "green",
    badgeClass: "badge badge-direct",
  },
  현수막: {
    desc: "오프라인 현수막 광고",
    helps: {
      production: "오늘 부착·노출된 현수막 수",
      inflow: "오늘 유입된 문의 수",
      contactProgress: "부재 제외, 실제 통화 수",
      contactSuccess: "미팅 예약 확정된 수",
    },
    color: "amber",
    badgeClass: "badge badge-banner",
  },
  "콜·지·기·소": {
    desc: "콜드콜·지인·기존고객·소개",
    helps: {
      production: "발굴한 컨택대상 수 (=유입)",
      inflow: "컨택대상 수 (생산과 동일)",
      contactProgress: "부재 제외, 실제 통화 수",
      contactSuccess: "미팅 예약 확정된 수",
    },
    color: "purple",
    badgeClass: "badge badge-referral",
  },
};

const COLOR_CLASS: Record<
  "blue" | "green" | "amber" | "purple",
  { bg50: string; bg100: string; bg500: string; text700: string; under: string; hover: string; border: string }
> = {
  blue: {
    bg50: "bg-blue-50",
    bg100: "bg-blue-100",
    bg500: "bg-blue-500",
    text700: "text-blue-700",
    under: "bg-blue-500",
    hover: "hover:bg-blue-600",
    border: "border-blue-200",
  },
  green: {
    bg50: "bg-green-50",
    bg100: "bg-green-100",
    bg500: "bg-green-500",
    text700: "text-green-700",
    under: "bg-green-500",
    hover: "hover:bg-green-600",
    border: "border-green-200",
  },
  amber: {
    bg50: "bg-amber-50",
    bg100: "bg-amber-100",
    bg500: "bg-amber-500",
    text700: "text-amber-700",
    under: "bg-amber-500",
    hover: "hover:bg-amber-600",
    border: "border-amber-200",
  },
  purple: {
    bg50: "bg-purple-50",
    bg100: "bg-purple-100",
    bg500: "bg-purple-500",
    text700: "text-purple-700",
    under: "bg-purple-500",
    hover: "hover:bg-purple-600",
    border: "border-purple-200",
  },
};

const METRICS: Array<{
  key: keyof ChannelDailyRowMetrics;
  label: string;
  upstream?: keyof ChannelDailyRowMetrics;
}> = [
  { key: "production", label: "생산" },
  { key: "inflow", label: "유입" },
  { key: "contactProgress", label: "컨택진행" },
  { key: "contactSuccess", label: "컨택성공", upstream: "contactProgress" },
];

interface Props {
  active: Channel;
  draft: Record<Channel, ChannelDailyRowMetrics>;
  onSelectChannel: (ch: Channel) => void;
  onStep: (key: keyof ChannelDailyRowMetrics, delta: number) => void;
  onSetVal: (key: keyof ChannelDailyRowMetrics, value: number) => void;
}

function totalOf(m: ChannelDailyRowMetrics): number {
  return m.production + m.inflow + m.contactProgress + m.contactSuccess;
}

export default function ChannelTabsAndPanel({
  active,
  draft,
  onSelectChannel,
  onStep,
  onSetVal,
}: Props) {
  const ch = CHANNEL_META[active];
  const cls = COLOR_CLASS[ch.color];
  const cell = draft[active];

  const channelSum = (key: keyof ChannelDailyRowMetrics): number =>
    CHANNEL_ORDER.reduce((acc, c) => acc + draft[c][key], 0);

  return (
    <div className="mb-3 overflow-hidden rounded-2xl bg-white shadow-sm">
      {/* 채널 탭 */}
      <div className="flex border-b border-gray-100">
        {CHANNEL_ORDER.map((c) => {
          const meta = CHANNEL_META[c];
          const colorCls = COLOR_CLASS[meta.color];
          const isActive = c === active;
          const total = totalOf(draft[c]);
          return (
            <button
              key={c}
              type="button"
              onClick={() => onSelectChannel(c)}
              className={`relative flex-1 px-1 py-2.5 transition-all ${
                isActive ? colorCls.bg50 : "bg-white hover:bg-gray-50"
              }`}
              aria-pressed={isActive}
            >
              <div className="flex flex-col items-center gap-1">
                <span
                  className={`text-xs font-bold ${
                    isActive ? colorCls.text700 : "text-gray-500"
                  }`}
                >
                  {c}
                </span>
                {total > 0 ? (
                  <span
                    className={`rounded-full px-1.5 py-px text-[10px] font-semibold leading-none ${
                      isActive ? `${colorCls.bg100} ${colorCls.text700}` : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {total}
                  </span>
                ) : (
                  <span className="text-[10px] leading-none text-gray-300">·</span>
                )}
              </div>
              {isActive && (
                <span
                  className={`absolute bottom-[-1px] left-[12%] right-[12%] h-[3px] rounded-t-sm ${colorCls.under}`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 채널 헤더 (배지 + 설명) */}
      <div className={`flex items-center gap-2 border-b ${cls.border} ${cls.bg50} px-3 py-2`}>
        <span className={ch.badgeClass}>{active}</span>
        <span className="truncate text-xs text-gray-500">{ch.desc}</span>
      </div>

      {/* 입력/합계 헤더 */}
      <div className="flex items-stretch border-b border-gray-100 bg-gray-50">
        <div className="w-3/5 px-3 py-1.5 text-xs font-semibold text-gray-500">채널 입력</div>
        <div className="w-2/5 border-l-2 bg-indigo-100 px-2 py-1.5 text-center text-xs font-bold text-indigo-700">
          ⭐ 오늘 채널 합계
        </div>
      </div>

      {/* 4지표 행 */}
      {METRICS.map((m, mi) => {
        const total = channelSum(m.key);
        const upstreamVal = m.upstream ? cell[m.upstream] : Infinity;
        const atLimit = m.upstream && cell[m.key] >= upstreamVal;
        const plusClass = atLimit
          ? "bg-gray-200 text-gray-400 cursor-not-allowed"
          : `${cls.bg500} text-white ${cls.hover}`;
        const help = ch.helps[m.key as keyof typeof ch.helps];
        return (
          <div
            key={m.key}
            className={`flex items-stretch ${mi < METRICS.length - 1 ? "border-b border-gray-50" : ""}`}
          >
            <div className="flex w-3/5 min-w-0 items-center justify-between px-3 py-3">
              <div className="min-w-0 pr-1">
                <div className="text-sm font-medium text-gray-800">{m.label}</div>
                <div className="truncate text-xs text-gray-400">{help}</div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className="stepper-btn bg-gray-100 text-gray-600 hover:bg-gray-200"
                  onClick={() => onStep(m.key, -1)}
                  aria-label={`${m.label} 감소`}
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className="stepper-val"
                  value={cell[m.key]}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isNaN(n)) onSetVal(m.key, Math.max(0, n));
                  }}
                  aria-label={`${m.label} 수치`}
                />
                <button
                  type="button"
                  className={`stepper-btn ${plusClass}`}
                  onClick={() => onStep(m.key, 1)}
                  aria-disabled={atLimit ? true : undefined}
                  aria-label={`${m.label} 증가`}
                >
                  ＋
                </button>
              </div>
            </div>
            <div className="flex w-2/5 flex-col items-center justify-center border-l-2 bg-indigo-50 py-3 text-center">
              <div
                className={`text-3xl font-extrabold leading-none ${
                  total > 0 ? "text-indigo-700" : "text-gray-300"
                }`}
              >
                {total}
              </div>
              <div
                className={`mt-1 text-xs font-semibold ${
                  total > 0 ? "text-indigo-600" : "text-gray-400"
                }`}
              >
                {m.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
