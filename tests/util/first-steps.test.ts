/** 첫걸음 판정·기억 규칙(2026-11-11). 합성 숫자만. */
import { describe, expect, it } from "vitest";
import {
  EMPTY_FIRST_STEPS_MEMORY,
  FIRST_STEPS,
  firstStepDone,
  firstStepProgress,
  firstStepsStorageKey,
  parseFirstStepsMemory,
  shouldOfferTour,
  type FirstStepCounts,
} from "@/util/first-steps";

const zero: FirstStepCounts = { 생산: 0, 비용: 0, 유입: 0, 컨택진행: 0, 미팅예약: 0, 미팅완료: 0, 계약: 0, reviewSeen: false };

describe("firstStepDone", () => {
  it("a brand-new trainee has nothing done and the next step is the first DB purchase", () => {
    const done = firstStepDone(zero);
    expect(Object.values(done).every((v) => !v)).toBe(true);
    expect(firstStepProgress(done)).toMatchObject({ done: 0, total: 7, next: { key: "purchase" } });
  });

  it("judges each step from real records only", () => {
    const done = firstStepDone({ ...zero, 비용: 1_000_000, 유입: 3, 컨택진행: 2, 미팅예약: 1, contractRows: 1, paidRows: 0 });
    expect(done).toMatchObject({ purchase: true, lead: true, contact: true, meeting: true, result: true, payment: false, review: false });
    expect(firstStepProgress(done)).toMatchObject({ done: 5, next: { key: "payment" } });
  });

  it("is finished when every step has a record and the review was seen", () => {
    const done = firstStepDone({ ...zero, 생산: 1, 유입: 1, 컨택진행: 1, 미팅예약: 1, 계약: 1, paidRows: 1, reviewSeen: true });
    expect(firstStepProgress(done)).toMatchObject({ done: 7, next: null });
  });

  it("links every guided step to its screen with ?tour= (review has no tour)", () => {
    expect(FIRST_STEPS.filter((s) => s.tour).map((s) => [s.key, s.href])).toEqual([
      ["purchase", "/db?tour=purchase"],
      ["lead", "/db-sheet?tour=db-add"],
      ["contact", "/contact?tour=contact"],
      ["meeting", "/contact?tour=meeting"],
      ["result", "/schedule?tour=result"],
      ["payment", "/payment?tour=payment"],
    ]);
    expect(FIRST_STEPS.find((s) => s.key === "review")!.tour).toBeUndefined();
  });
});

describe("memory", () => {
  it("keeps one entry per account in this browser", () => {
    expect(firstStepsStorageKey(" Synthetic@Example.invalid ")).toBe("salespt-first-steps:v1:synthetic@example.invalid");
  });

  it("parses only known values and falls back to empty on junk", () => {
    expect(parseFirstStepsMemory('{"hidden":true,"never":["meeting","x"],"finished":["db-add"],"reviewSeen":true}')).toEqual({
      hidden: true,
      never: ["meeting"],
      finished: ["db-add"],
      reviewSeen: true,
    });
    expect(parseFirstStepsMemory("not json")).toEqual(EMPTY_FIRST_STEPS_MEMORY);
    expect(parseFirstStepsMemory(null)).toEqual(EMPTY_FIRST_STEPS_MEMORY);
  });

  it("offers a tour only on the trainee's own screen, before it is done or dismissed", () => {
    const base = { tour: "meeting" as const, memory: EMPTY_FIRST_STEPS_MEMORY, isTraineeSelf: true, alreadyDone: false };
    expect(shouldOfferTour(base)).toBe(true);
    expect(shouldOfferTour({ ...base, isTraineeSelf: false })).toBe(false);
    expect(shouldOfferTour({ ...base, alreadyDone: true })).toBe(false);
    expect(shouldOfferTour({ ...base, memory: { ...EMPTY_FIRST_STEPS_MEMORY, never: ["meeting"] } })).toBe(false);
    expect(shouldOfferTour({ ...base, memory: { ...EMPTY_FIRST_STEPS_MEMORY, finished: ["meeting"] } })).toBe(false);
  });
});
