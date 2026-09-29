/**
 * font-scale — 글자 크기 단계(순수, import 없음). belie 2026-09-29: "글씨가 조금 더 컸으면" —
 * 브라우저 배율 110% 에서도 화면이 깨지지 않게 **글자만** 키운다(여백·칸 너비는 그대로).
 * 단계 0 = 지금 크기, 1~3 = 10%·20%·30% 더 크게. 박스 요소에 CSS 변수 --font-scale 을 걸면 그 안의
 * 모든 글자 클래스(tailwind.config.ts fontSize · text-px-N · globals.css)가 곱해진다.
 * 적용 범위: 업체정보 컴포넌트(모든 탭 — belie 후속: 실무/수납 상세 박스 버튼은 빼고 업체정보만 남김).
 * 저장 = 이 기기 브라우저(localStorage), 범위별 키.
 */
export const FONT_SCALES = [1, 1.1, 1.2, 1.3] as const;
export const MAX_FONT_STEP = FONT_SCALES.length - 1;
export type FontScope = "company-info";

export function fontStepStorageKey(scope: FontScope): string {
  return `salespt-font-step:${scope}`;
}

/** 저장값(문자열·숫자) → 0~3 단계. 모르는 값은 0. */
export function clampFontStep(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_FONT_STEP, Math.max(0, Math.trunc(n)));
}

export function fontScaleOf(step: number): number {
  return FONT_SCALES[clampFontStep(step)]!;
}
