/**
 * ChannelTabs — 4-segment 토글.
 * 정본: db-management.html v11 `.ch-tab`
 *
 * 비활성: 채널 라이트 배경 + 채널 진한 글자
 * 활성: 채널 진한 배경 + 흰 글자 + 채널색 그림자
 */
"use client";

import { CHANNELS, CHANNEL_KEYS, type ChannelKey } from "../_lib/channels";

interface Props {
  activeCh: ChannelKey;
  onSwitch: (k: ChannelKey) => void;
}

const INACTIVE_CLS: Record<ChannelKey, string> = {
  purchase: "bg-blue-50 text-blue-700",
  direct: "bg-green-50 text-green-700",
  banner: "bg-amber-50 text-amber-700",
  referral: "bg-purple-50 text-purple-700",
};

export default function ChannelTabs({ activeCh, onSwitch }: Props) {
  return (
    <div className="mb-3 flex gap-1.5">
      {CHANNEL_KEYS.map((k) => {
        const meta = CHANNELS[k];
        const active = k === activeCh;
        const fontCls =
          k === "referral" ? "text-[11px] tracking-tight" : "text-[13px]";
        const cls = active ? "text-white shadow-lg" : INACTIVE_CLS[k];
        return (
          <button
            key={k}
            type="button"
            onClick={() => onSwitch(k)}
            className={`flex min-h-11 flex-1 items-center justify-center rounded-[10px] px-1 py-2.5 font-semibold transition-all active:scale-95 ${fontCls} ${cls}`}
            style={
              active
                ? {
                    background: meta.color,
                    boxShadow: `0 4px 10px ${meta.color}4D`,
                  }
                : undefined
            }
          >
            {meta.name}
          </button>
        );
      })}
    </div>
  );
}
