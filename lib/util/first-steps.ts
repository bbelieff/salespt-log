/**
 * 첫걸음(새 수강생 온보딩) — 순수 규칙(2026-11-11 belie 「추천대로 1차 진행」, plan first-steps-spotlight).
 * 일곱 가지 첫 동작과 「끝났는지」 판정. 판정은 이미 있는 기록으로만 한다(연습용 데이터 없음) —
 * 그래서 폰에서 하고 PC 로 와도 다시 뜨지 않는다. 브라우저 저장값(숨김·다시 보지 않기)은 화면 쪽이 읽는다.
 */

export type FirstStepKey = "purchase" | "lead" | "contact" | "meeting" | "result" | "payment" | "review";
/** 화면에서 스포트라이트로 따라 하는 안내(1차 DB 넣기·미팅 예약, 2차 구매·컨택·결과·수납). */
export type FirstStepTour = "purchase" | "db-add" | "contact" | "meeting" | "result" | "payment";

export interface FirstStep {
  key: FirstStepKey;
  label: string;
  /** 「해 보기」가 가는 곳. 안내가 있으면 `?tour=` 를 붙여 그 화면에서 바로 켠다. */
  href: string;
  tour?: FirstStepTour;
}

export const FIRST_STEPS: readonly FirstStep[] = [
  { key: "purchase", label: "첫 DB 구매 기록", href: "/db?tour=purchase", tour: "purchase" },
  { key: "lead", label: "첫 DB 넣기", href: "/db-sheet?tour=db-add", tour: "db-add" },
  { key: "contact", label: "첫 컨택 기록", href: "/contact?tour=contact", tour: "contact" },
  { key: "meeting", label: "첫 미팅 예약", href: "/contact?tour=meeting", tour: "meeting" },
  { key: "result", label: "첫 미팅 결과·계약", href: "/schedule?tour=result", tour: "result" },
  { key: "payment", label: "첫 수납 기록", href: "/payment?tour=payment", tour: "payment" },
  { key: "review", label: "첫 주 돌아보기", href: "/dashboard" },
] as const;

/** 대시보드가 이미 받아 둔 숫자(채널 합계)·계약 행. */
export interface FirstStepCounts {
  생산: number;
  비용: number;
  유입: number;
  컨택진행: number;
  미팅예약: number;
  미팅완료: number;
  계약: number;
  /** 실무/수납 계약 행 수 · 수납액이 있는 행 수. 아직 못 불러왔으면 undefined. */
  contractRows?: number;
  paidRows?: number;
  /** 「첫 주 돌아보기」를 눌러 본 적이 있는지(브라우저 기억). */
  reviewSeen: boolean;
}

export function firstStepDone(c: FirstStepCounts): Record<FirstStepKey, boolean> {
  return {
    purchase: c.생산 > 0 || c.비용 > 0,
    lead: c.유입 > 0,
    contact: c.컨택진행 > 0,
    meeting: c.미팅예약 > 0,
    result: c.미팅완료 > 0 || c.계약 > 0 || (c.contractRows ?? 0) > 0,
    payment: (c.paidRows ?? 0) > 0,
    review: c.reviewSeen,
  };
}

export function firstStepProgress(done: Record<FirstStepKey, boolean>): { done: number; total: number; next: FirstStep | null } {
  const next = FIRST_STEPS.find((s) => !done[s.key]) ?? null;
  return { done: FIRST_STEPS.filter((s) => done[s.key]).length, total: FIRST_STEPS.length, next };
}

/** 브라우저 기억 — 계정마다 따로(같은 PC 를 여러 사람이 써도 섞이지 않게). */
export interface FirstStepsMemory {
  /** 대시보드 카드를 숨겼는지. */
  hidden: boolean;
  /** 「다시 보지 않기」를 누른 안내. */
  never: FirstStepTour[];
  /** 안내를 끝까지 따라 했거나 그 기록이 생긴 것. 제안 줄을 다시 띄우지 않는다. */
  finished: FirstStepTour[];
  reviewSeen: boolean;
}

export const EMPTY_FIRST_STEPS_MEMORY: FirstStepsMemory = { hidden: false, never: [], finished: [], reviewSeen: false };

export function firstStepsStorageKey(email: string): string {
  return `salespt-first-steps:v1:${email.trim().toLowerCase()}`;
}

export const FIRST_STEP_TOURS: readonly FirstStepTour[] = ["purchase", "db-add", "contact", "meeting", "result", "payment"];
const tourList = (v: unknown): FirstStepTour[] =>
  Array.isArray(v) ? FIRST_STEP_TOURS.filter((t) => v.includes(t)) : [];

/** 저장값 → 기억. 모르는 모양이면 빈 기억. */
export function parseFirstStepsMemory(raw: string | null | undefined): FirstStepsMemory {
  if (!raw) return EMPTY_FIRST_STEPS_MEMORY;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (!v || typeof v !== "object") return EMPTY_FIRST_STEPS_MEMORY;
    return { hidden: v.hidden === true, never: tourList(v.never), finished: tourList(v.finished), reviewSeen: v.reviewSeen === true };
  } catch {
    return EMPTY_FIRST_STEPS_MEMORY;
  }
}

/** 제안 줄을 띄울지 — 수강생 본인 화면에서, 아직 안 했고, 그만 보기·끝낸 적이 없을 때만. */
export function shouldOfferTour(opts: {
  tour: FirstStepTour;
  memory: FirstStepsMemory;
  isTraineeSelf: boolean;
  alreadyDone: boolean;
}): boolean {
  if (!opts.isTraineeSelf || opts.alreadyDone) return false;
  return !opts.memory.never.includes(opts.tour) && !opts.memory.finished.includes(opts.tour);
}
