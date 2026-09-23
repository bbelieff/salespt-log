/**
 * Scope C autosave regressions — schedule/payment/calendar routine edits.
 *
 * Shared queue core is Scope A (`@/util/autosave-queue`, covered by
 * tests/util/autosave-a.test.ts). These tests pin Scope C wiring semantics:
 * no requests on mount/hydration/refetch, debounced + group-blur writes,
 * frozen target identity, single-flight with newer-typing preserved, failure
 * keeps draft with manual retry only, and C-owned pure helpers
 * (validContractDraft, linkedNext).
 */
import { describe, expect, it, vi } from "vitest";
import { AutosaveQueue } from "@/util/autosave-queue";
import {
  linkedNext,
  validContractDraft,
} from "@/app/(app)/payment/_lib/payment-progress";
import type { ContractPayment } from "@/types";

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

interface Basic {
  미팅날짜: string;
  미팅시간: string;
  업체명: string;
  장소: string;
  예약비고: string;
}
const BASIC: Basic = {
  미팅날짜: "2026-09-24",
  미팅시간: "10:00",
  업체명: "가나상사",
  장소: "잠실",
  예약비고: "",
};

function basicQueue(save: (payload: Basic) => Promise<unknown>) {
  const calls: Array<{ target: Record<string, unknown>; payload: Basic }> = [];
  const queue = new AutosaveQueue<Basic>({
    target: { kind: "schedule-basic", id: "m1" },
    delayMs: 10,
    save: async ({ target, payload }) => {
      calls.push({ target: { ...target }, payload: { ...payload } });
      await save(payload);
    },
  });
  queue.sync({ ...BASIC });
  return { queue, calls };
}

describe("no requests on mount / hydration / refetch / untouched", () => {
  it("sync + refetch without edits sends nothing", async () => {
    const save = vi.fn(async (_payload: unknown) => {});
    const { queue } = basicQueue(save);
    await tick(60);
    queue.sync({ ...BASIC, 장소: "강남" }); // background refetch
    await tick(60);
    expect(save).not.toHaveBeenCalled();
  });

  it("editing back to the acked value sends nothing", async () => {
    const save = vi.fn(async (_payload: unknown) => {});
    const { queue } = basicQueue(save);
    queue.edit({ ...BASIC, 장소: "강남" });
    queue.edit({ ...BASIC }); // revert before debounce fires
    await tick(60);
    expect(save).not.toHaveBeenCalled();
  });
});

describe("debounced text writes coalesce to the latest", () => {
  it("rapid typing produces one save with the newest draft", async () => {
    const save = vi.fn(async (_payload: unknown) => {});
    const { queue, calls } = basicQueue(save);
    queue.edit({ ...BASIC, 업체명: "가" });
    queue.edit({ ...BASIC, 업체명: "가나" });
    queue.edit({ ...BASIC, 업체명: "가나상" });
    await tick(60);
    expect(save).toHaveBeenCalledTimes(1);
    expect(calls[0]!.payload.업체명).toBe("가나상");
  });
});

describe("currency/date group: stage then blur-commit", () => {
  it("staged group edits send nothing until commit", async () => {
    const save = vi.fn(async (_payload: unknown) => {});
    const { queue, calls } = basicQueue(save);
    queue.stage({ ...BASIC, 미팅날짜: "2026-09-25" });
    queue.stage({ ...BASIC, 미팅날짜: "2026-09-25", 미팅시간: "11:00" });
    await tick(60);
    expect(save).not.toHaveBeenCalled();
    queue.commit();
    await tick(60);
    expect(save).toHaveBeenCalledTimes(1);
    expect(calls[0]!.payload).toEqual({
      ...BASIC,
      미팅날짜: "2026-09-25",
      미팅시간: "11:00",
    });
  });
});

describe("frozen identity + single-flight + newer typing preserved", () => {
  it("slow flight keeps newer edits; stale response never clears them", async () => {
    const gate = deferred<void>();
    const seen: Basic[] = [];
    const { queue } = basicQueue(async (p) => {
      seen.push({ ...p });
      await gate.promise;
    });
    queue.edit({ ...BASIC, 장소: "A" });
    await tick(40); // flight starts with A
    queue.edit({ ...BASIC, 장소: "AB" }); // newer typing mid-flight
    gate.resolve();
    await tick(60);
    expect(seen.map((s) => s.장소)).toEqual(["A", "AB"]);
  });

  it("retarget cancels old pending without saving it", async () => {
    const save = vi.fn(async (_payload: unknown) => {});
    const calls: Array<{ target: unknown; payload: Basic }> = [];
    const queue = new AutosaveQueue<Basic>({
      target: { kind: "schedule-basic", id: "m1" },
      delayMs: 10,
      save: async ({ target, payload }) => {
        calls.push({ target, payload });
        await save(payload);
      },
    });
    queue.sync({ ...BASIC });
    queue.edit({ ...BASIC, 장소: "구값" });
    queue.retarget({ kind: "schedule-basic", id: "m2" }, { ...BASIC });
    await tick(60);
    expect(save).not.toHaveBeenCalled();
    queue.edit({ ...BASIC, 장소: "신값" });
    await tick(60);
    expect(save).toHaveBeenCalledTimes(1);
    expect(calls[0]!.target).toEqual({ kind: "schedule-basic", id: "m2" });
    expect((calls[0]!.payload as Basic).장소).toBe("신값");
  });
});

describe("failure keeps draft; manual retry only", () => {
  it("rejects once, never auto-retries, retry resends latest", async () => {
    let Fail = true;
    const errors: string[] = [];
    const acked: Basic[] = [];
    const queue = new AutosaveQueue<Basic>({
      target: { kind: "contract-linked", row: 9 },
      delayMs: 10,
      save: async ({ payload }) => {
        if (Fail) throw new Error("시트 429");
        acked.push({ ...payload });
      },
      onError: (m) => errors.push(m),
    });
    queue.sync({ ...BASIC });
    queue.edit({ ...BASIC, 업체명: "다라상사" });
    await tick(60);
    expect(errors).toEqual(["시트 429"]);
    await tick(60);
    expect(acked).toEqual([]); // no infinite retry
    expect(queue.status).toBe("error");
    Fail = false;
    queue.retry();
    await tick(60);
    expect(acked).toEqual([{ ...BASIC, 업체명: "다라상사" }]);
  });
});

const cp = (o: Partial<ContractPayment> = {}): ContractPayment =>
  ({
    row: 9,
    계약일: "2026-07-10",
    업체명: "가나상사",
    수임비: 1_000_000,
    수납1: { 진행기관: "", 진행률: "", 현황: "", 승인금액: 0, 수납액: 0, 수납일: "", 메모: "" },
    수납2: { 진행기관: "", 진행률: "", 현황: "", 승인금액: 0, 수납액: 0, 수납일: "", 메모: "" },
    수납3: { 진행기관: "", 진행률: "", 현황: "", 승인금액: 0, 수납액: 0, 수납일: "", 메모: "" },
    ...o,
  }) as ContractPayment;

describe("validContractDraft", () => {
  it("accepts ordinary recordkeeping edits", () => {
    expect(
      validContractDraft(cp({ 수임비: 0, 수납1: { 진행기관: "미소", 진행률: "20%", 현황: "진행", 승인금액: 3_000_000, 수납액: 1_000_000, 수납일: "2026-08-01", 메모: "" } })),
    ).toBe(true);
  });

  it("rejects negative amounts and malformed dates", () => {
    expect(validContractDraft(cp({ 수임비: -1 }))).toBe(false);
    expect(
      validContractDraft(cp({ 수납1: { 진행기관: "", 진행률: "", 현황: "", 승인금액: 0, 수납액: -5, 수납일: "", 메모: "" } })),
    ).toBe(false);
    expect(
      validContractDraft(cp({ 수납2: { 진행기관: "", 진행률: "", 현황: "", 승인금액: 0, 수납액: 0, 수납일: "26.8.1", 메모: "" } })),
    ).toBe(false);
  });
});

describe("linkedNext — changed keys only, no duplicate linked saves", () => {
  const base = { 계약일: "2026-07-10", 업체명: "가나상사", 수임비: 1_000_000 };

  it("returns {} for identical values", () => {
    expect(linkedNext(base, { ...base })).toEqual({});
  });

  it("sends only the changed coherent group", () => {
    expect(linkedNext(base, { ...base, 수임비: 2_000_000 })).toEqual({
      수임비: 2_000_000,
    });
    expect(linkedNext(base, { ...base, 업체명: "  가나상사  " })).toEqual({});
    expect(linkedNext(base, { ...base, 업체명: "다라상사 " })).toEqual({
      업체명: "다라상사",
    });
  });
});
