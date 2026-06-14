/**
 * AwardPodium — 전광판 캡쳐 탭 지표별 시상대 (arena-scoreboard-v2).
 *
 * 1·2·3등 큰 카드(이름 공개·큰 숫자, 1등 중앙·강조) + 4~6등 리스트.
 * 색만 지표별로 바꿔 재사용. 표준 Tailwind 스케일만 사용(arbitrary value 없음).
 */
import type { RankingEntry } from "@/types";

export type PodiumColor = "blue" | "purple" | "teal" | "amber" | "rose";

const C: Record<
  PodiumColor,
  { grad: string; soft: string; text: string; ring: string; bar: string }
> = {
  blue: {
    grad: "from-blue-400 to-blue-600",
    soft: "bg-blue-50",
    text: "text-blue-700",
    ring: "ring-blue-300",
    bar: "bg-blue-500",
  },
  purple: {
    grad: "from-purple-400 to-purple-600",
    soft: "bg-purple-50",
    text: "text-purple-700",
    ring: "ring-purple-300",
    bar: "bg-purple-500",
  },
  teal: {
    grad: "from-teal-400 to-teal-600",
    soft: "bg-teal-50",
    text: "text-teal-700",
    ring: "ring-teal-300",
    bar: "bg-teal-500",
  },
  amber: {
    grad: "from-amber-400 to-amber-600",
    soft: "bg-amber-50",
    text: "text-amber-700",
    ring: "ring-amber-300",
    bar: "bg-amber-500",
  },
  rose: {
    grad: "from-rose-400 to-rose-600",
    soft: "bg-rose-50",
    text: "text-rose-700",
    ring: "ring-rose-300",
    bar: "bg-rose-500",
  },
};

const MEDAL = ["🥇", "🥈", "🥉"];

function fmt(v: number): string {
  return Math.round(v).toLocaleString("ko-KR");
}

function PodiumCard({
  entry,
  unit,
  color,
  height,
  top,
}: {
  entry: RankingEntry;
  unit: string;
  color: PodiumColor;
  height: string;
  top: boolean;
}) {
  const c = C[color];
  return (
    <div className="flex flex-1 flex-col items-center justify-end">
      <span className="mb-1 text-2xl">{MEDAL[entry.rank - 1] ?? ""}</span>
      <div
        className={`flex w-full flex-col items-center justify-center rounded-t-xl bg-gradient-to-b ${c.grad} px-1 ${height} ${
          top ? "shadow-lg" : ""
        }`}
      >
        <span className="px-1 text-center text-base font-black leading-tight text-white">
          {entry.name}
        </span>
        <span className="text-[11px] font-bold text-white/80">
          {entry.cohort}기
        </span>
        <span className="mt-1 text-xl font-black tabular-nums text-white">
          {fmt(entry.value)}
        </span>
        <span className="text-[11px] font-bold text-white/80">{unit}</span>
      </div>
    </div>
  );
}

export default function AwardPodium({
  metric,
  unit,
  color,
  entries,
}: {
  metric: string;
  unit: string;
  color: PodiumColor;
  entries: RankingEntry[];
}) {
  const c = C[color];
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3, 6);
  // 시상대 배치: 2등 | 1등 | 3등
  const first = top3.find((e) => e.rank === 1);
  const second = top3.find((e) => e.rank === 2);
  const third = top3.find((e) => e.rank === 3);

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-8 text-center text-sm text-gray-400">
        {metric}왕 집계할 데이터가 없어요.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        {second ? (
          <PodiumCard
            entry={second}
            unit={unit}
            color={color}
            height="h-28"
            top={false}
          />
        ) : (
          <div className="flex-1" />
        )}
        {first && (
          <PodiumCard
            entry={first}
            unit={unit}
            color={color}
            height="h-36"
            top
          />
        )}
        {third ? (
          <PodiumCard
            entry={third}
            unit={unit}
            color={color}
            height="h-24"
            top={false}
          />
        ) : (
          <div className="flex-1" />
        )}
      </div>

      {rest.length > 0 && (
        <ul className={`overflow-hidden rounded-xl ${c.soft}`}>
          {rest.map((e) => (
            <li
              key={`${e.name}-${e.rank}`}
              className="flex items-center gap-3 border-b border-white/60 px-4 py-2 last:border-0"
            >
              <span className={`w-6 text-sm font-black ${c.text}`}>
                {e.rank}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-900">
                {e.name}
                <span className="ml-1 text-[11px] font-bold text-gray-400">
                  {e.cohort}기
                </span>
              </span>
              <span className="text-sm font-black tabular-nums text-gray-800">
                {fmt(e.value)}
                <span className="ml-0.5 text-[11px] font-bold text-gray-400">
                  {unit}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
