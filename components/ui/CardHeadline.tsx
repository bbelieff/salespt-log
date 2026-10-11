/**
 * CardHeadline — 카드 맨 위 쉬운 말 한 줄(belie 2026-10-12 #8, Pluuug식 헤드라인).
 * 표시 전용이다. 문구·색은 부르는 쪽 순수 함수(components/dashboard/finance-headline.ts,
 * components/weekly-goals/goal-headline.ts)가 정한다. 말줄임·잘림 없이 어절 단위로만 줄을 바꾼다.
 * SSOT: docs/design/components.md §10-1 · §9 「대시보드 한 줄 문장」, 색 = docs/design/tokens.md.
 */
export type HeadlineTone = "profit" | "loss" | "done" | "neutral";

export interface Headline {
  text: string;
  /** 꾸밈 이모지 — 화면낭독기에서 읽지 않는다(aria-hidden). */
  emoji?: string;
  tone: HeadlineTone;
}

// profit = 영업이익 칸 파랑(PROFIT_OK #1d4ed8), loss = 음수 영업이익 보라(PROFIT_NEG #7c3aed — 비용 빨강과 구분),
// done = 링 달성 초록 계열(흰 바탕 AA 대비), neutral = 본문 진한 회색.
const TONE: Record<HeadlineTone, string> = {
  profit: "text-blue-700",
  loss: "text-violet-600",
  done: "text-green-700",
  neutral: "text-slate-800",
};

interface Props {
  headline: Headline | null;
  /** 숫자를 불러오는 중 — 문장 자리에 반짝이는 회색 줄을 두어 자리를 지킨다(덜컹임 방지). */
  loading?: boolean;
  className?: string;
  /** 기간 칩처럼 사용자가 바꾸는 문장만 polite 로 알린다. 항상 붙어 있는 자리여야 바뀐 글자만 읽힌다. */
  "aria-live"?: "polite" | "off";
}

export default function CardHeadline({ headline, loading = false, className = "", "aria-live": live }: Props) {
  return (
    <p
      data-card-headline=""
      aria-live={live}
      aria-busy={loading || undefined}
      className={`break-keep text-sm font-bold leading-snug ${TONE[headline?.tone ?? "neutral"]} ${className}`}
    >
      {loading ? (
        <span aria-hidden="true" className="fx-skeleton block h-5 w-2/3 rounded-md" />
      ) : (
        headline && (
          <>
            {headline.text}
            {headline.emoji && <span aria-hidden="true"> {headline.emoji}</span>}
          </>
        )
      )}
    </p>
  );
}
