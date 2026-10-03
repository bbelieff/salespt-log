/**
 * Scope B autosave — DB pure logic regressions.
 *
 * Covers: creation gate (no creation from hydration/defaults/empty/partial),
 * invalid money + incoherent dates never sent, edit gate, operation identity,
 * exact-payload signatures, revision guard, and single-flight coalescing that
 * preserves the latest edit while a save is pending.
 */
import { describe, expect, it, vi } from "vitest";
import {
  createRevisionGuard,
  dbCreateCheck,
  dbEditCheck,
  isTouchedDraft,
  isValidIsoDate,
  newDraftId,
  payloadSignature,
} from "@/app/(app)/db/_lib/db-autosave";
import { createSaveCoalescer } from "@/util/save-coalesce";

const TODAY = new Date().toISOString().slice(0, 10);

const PURCHASE_DEFAULTS = {
  구매일: TODAY,
  업체명: "",
  총액: 0,
  부가세여부: false,
  주문개수: 0,
  기타: "",
};

const PURCHASE_VALID = {
  ...PURCHASE_DEFAULTS,
  업체명: "디비딩프로",
  총액: 11000,
  주문개수: 10,
};

describe("isValidIsoDate", () => {
  it("accepts real calendar days and rejects malformed or impossible dates", () => {
    expect(isValidIsoDate("2026-09-01")).toBe(true);
    expect(isValidIsoDate("")).toBe(false);
    expect(isValidIsoDate("2026-9-1")).toBe(false);
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("not-a-date")).toBe(false);
    expect(isValidIsoDate(undefined)).toBe(false);
  });
});

describe("dbCreateCheck (simple new rows)", () => {
  it("never creates from hydration/default values", () => {
    expect(dbCreateCheck("purchase", { ...PURCHASE_DEFAULTS }).status).toBe("empty");
    expect(dbCreateCheck("direct", { 시작일: TODAY, 종료일: TODAY, 소재: "", 예산입력: 0, 부가세여부: false, 기타: "" }).status).toBe("empty");
    expect(dbCreateCheck("referral", { 구분: "콜드콜", 접수일: TODAY, 대표자명: "", 업체명: "", 소개처: "", 연락처: "", 조건: "" }).status).toBe("empty");
    expect(dbCreateCheck("banner", { 날짜: TODAY, 업체명: "", 도착일: TODAY, 총액: 0, 부가세여부: false, 주문개수: 0, 기타: "" }).status).toBe("empty");
  });

  it("creates only when required text and the money group are complete", () => {
    expect(dbCreateCheck("purchase", { ...PURCHASE_VALID }).status).toBe("valid");
    // name only → partial (money missing)
    expect(dbCreateCheck("purchase", { ...PURCHASE_DEFAULTS, 업체명: "디비딩프로" }).status).toBe("partial");
    // money only → partial (deliberate text missing)
    expect(dbCreateCheck("purchase", { ...PURCHASE_DEFAULTS, 총액: 11000, 주문개수: 10 }).status).toBe("partial");
    // half money group → partial
    expect(dbCreateCheck("purchase", { ...PURCHASE_VALID, 주문개수: 0 }).status).toBe("partial");
    // empty date → partial, never sent
    expect(dbCreateCheck("purchase", { ...PURCHASE_VALID, 구매일: "" }).status).toBe("partial");
  });

  it("referral completes with either name field and no money group", () => {
    const base = { 구분: "콜드콜", 접수일: TODAY, 대표자명: "", 업체명: "", 소개처: "", 연락처: "", 조건: "" };
    expect(dbCreateCheck("referral", { ...base, 대표자명: "김믿음" }).status).toBe("valid");
    expect(dbCreateCheck("referral", { ...base, 업체명: "에이스" }).status).toBe("valid");
    expect(dbCreateCheck("referral", base).status).toBe("empty");
  });

  it("direct requires budget input and a coherent period", () => {
    const base = { 시작일: "2026-09-01", 종료일: "2026-09-10", 소재: "메타", 예산입력: 50000, 부가세여부: false, 기타: "" };
    expect(dbCreateCheck("direct", base).status).toBe("valid");
    expect(dbCreateCheck("direct", { ...base, 예산입력: 0 }).status).toBe("partial");
    const reversed = dbCreateCheck("direct", { ...base, 시작일: "2026-09-10", 종료일: "2026-09-01" });
    expect(reversed.status).toBe("invalid");
    expect(reversed.reasons[0]).toContain("종료일");
  });

  it("blocks invalid money instead of sending it", () => {
    expect(dbCreateCheck("purchase", { ...PURCHASE_VALID, 총액: -100 }).status).toBe("invalid");
    expect(dbCreateCheck("purchase", { ...PURCHASE_VALID, 총액: Number.NaN }).status).toBe("invalid");
    expect(dbCreateCheck("purchase", { ...PURCHASE_VALID, 주문개수: 1.5 }).status).toBe("invalid");
    const badDate = dbCreateCheck("purchase", { ...PURCHASE_VALID, 구매일: "2026-13-40" });
    expect(badDate.status).toBe("invalid");
    expect(badDate.reasons[0]).toContain("구매일");
  });
});

describe("dbEditCheck (existing rows)", () => {
  it("allows any coherent edit and blocks only invalid values", () => {
    expect(dbEditCheck("purchase", { ...PURCHASE_VALID }).status).toBe("valid");
    expect(dbEditCheck("purchase", { ...PURCHASE_DEFAULTS }).status).toBe("valid");
    expect(dbEditCheck("purchase", { ...PURCHASE_VALID, 총액: -1 }).status).toBe("invalid");
    expect(dbEditCheck("banner", { 날짜: TODAY, 업체명: "x", 도착일: "nope", 총액: 1, 주문개수: 1 }).status).toBe("invalid");
  });

  it("blocks clearing a date that the server row has, but not legacy empty dates", () => {
    const cleared = dbEditCheck("purchase", { ...PURCHASE_VALID, 구매일: "" }, PURCHASE_VALID);
    expect(cleared.status).toBe("invalid");
    expect(cleared.reasons[0]).toContain("구매일");
    // legacy row already dateless: editing other fields is still a routine edit.
    expect(dbEditCheck("purchase", { ...PURCHASE_DEFAULTS, 업체명: "x" }, PURCHASE_DEFAULTS).status).toBe("valid");
  });
});

describe("isTouchedDraft", () => {
  it("ignores pristine defaults but notices deliberate changes", () => {
    expect(isTouchedDraft("purchase", { ...PURCHASE_DEFAULTS })).toBe(false);
    expect(isTouchedDraft("purchase", { ...PURCHASE_DEFAULTS, 업체명: "x" })).toBe(true);
    expect(isTouchedDraft("purchase", { ...PURCHASE_DEFAULTS, 주문개수: 3 })).toBe(true);
    expect(isTouchedDraft("purchase", { ...PURCHASE_DEFAULTS, 부가세여부: true })).toBe(true);
    expect(isTouchedDraft("purchase", { ...PURCHASE_DEFAULTS, 구매일: "2026-01-01" })).toBe(true);
  });
});

describe("operation identity and signatures", () => {
  it("issues unique uuid-shaped draft ids", () => {
    const a = newDraftId();
    const b = newDraftId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("signatures ignore key order but distinguish content", () => {
    expect(payloadSignature({ a: 1, b: 2 })).toBe(payloadSignature({ b: 2, a: 1 }));
    expect(payloadSignature({ a: 1 })).not.toBe(payloadSignature({ a: 2 }));
    expect(payloadSignature({})).not.toBe(payloadSignature({ a: "" }));
  });

  it("revision guard lets only the newest revision touch state", () => {
    const guard = createRevisionGuard();
    const first = guard.begin();
    const second = guard.begin();
    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);
  });
});

describe("single-flight coalescing preserves the latest edit", () => {
  it("serializes runs and hands every waiter the latest outcome", async () => {
    const queue = createSaveCoalescer<string>();
    const seen: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = queue.trigger(async () => {
      await gate;
      seen.push("first");
      return "first";
    });
    const second = queue.trigger(async () => {
      seen.push("second");
      return "second";
    });
    const third = queue.trigger(async () => {
      seen.push("third");
      return "third";
    });
    release();
    // intermediate triggers coalesce: only the latest queued run executes.
    await expect(first).resolves.toBe("first");
    await expect(second).resolves.toBe("third");
    await expect(third).resolves.toBe("third");
    expect(seen).toEqual(["first", "third"]);
  });

  it("isolates failures so a queued latest edit still runs", async () => {
    const queue = createSaveCoalescer<void>();
    const onSecond = vi.fn(async () => undefined);
    const failing = queue.trigger(async () => {
      throw new Error("boom");
    });
    const queued = queue.trigger(onSecond);
    await expect(failing).rejects.toThrow("boom");
    await expect(queued).resolves.toBeUndefined();
    expect(onSecond).toHaveBeenCalledOnce();
  });
});
