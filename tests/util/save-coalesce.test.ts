/**
 * BBE-243 — 저장 좌표(coalesce) 유틸 회귀. "연타 20회 유실 0 · 튕김 0" 요건의 핵심 증거.
 */
import { describe, expect, it, vi } from "vitest";
import { createKeyedSaveCoalescer, createSaveCoalescer, saveAllParallel } from "@/util/save-coalesce";

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

describe("createSaveCoalescer", () => {
  it("단일 트리거는 그대로 실행하고 결과를 반환한다", async () => {
    const { trigger } = createSaveCoalescer<number>();
    const result = await trigger(async () => 42);
    expect(result).toBe(42);
  });

  it("★연타 20회 — 진행 중 재트리거는 버려지지 않고 마지막 1개만 이어서 실행된다(유실 0)", async () => {
    const { trigger } = createSaveCoalescer<number>();
    const calls: number[] = [];
    const run = (v: number) => async () => {
      calls.push(v);
      await delay(5);
      return v;
    };

    // 첫 트리거는 즉시 실행 시작(진행 중) — 그 사이 19번 더 "연타"한다.
    const first = trigger(run(0));
    const rest = Array.from({ length: 19 }, (_, i) => trigger(run(i + 1)));
    const results = await Promise.all([first, ...rest]);

    // run 자체는 "첫 실행" + "대기열의 마지막 것" 딱 2번만 불린다 — 19번 전부가 아니라
    // 마지막 값(19)만 반영되면 충분(마지막 입력 보존), 중간값은 재실행할 필요 없음.
    expect(calls).toEqual([0, 19]);
    // 20개 트리거 전부가 정상적으로 resolve 된다 — 예외로 죽는(튕기는) 트리거가 0건.
    expect(results).toHaveLength(20);
    for (const r of results) expect(typeof r === "number" || r === undefined).toBe(true);
  });

  it("진행 중이 아니면 매 트리거가 독립적으로 실행된다(순차 호출)", async () => {
    const { trigger } = createSaveCoalescer<number>();
    const calls: number[] = [];
    for (let i = 0; i < 5; i++) {
      calls.push(await trigger(async () => i));
    }
    expect(calls).toEqual([0, 1, 2, 3, 4]);
  });

  it("isSaving() 은 진행 중에만 true", async () => {
    const { trigger, isSaving } = createSaveCoalescer<void>();
    expect(isSaving()).toBe(false);
    const p = trigger(async () => {
      expect(isSaving()).toBe(true);
      await delay(1);
    });
    await p;
    expect(isSaving()).toBe(false);
  });

  it("run 에서 던진 예외는 trigger 호출자에게 그대로 전파된다(삼키지 않음 — 실패를 숨기지 않는다)", async () => {
    const { trigger } = createSaveCoalescer<void>();
    await expect(trigger(async () => { throw new Error("저장 실패"); })).rejects.toThrow("저장 실패");
  });

  it("첫 트리거가 실패해도 큐에 쌓인 마지막 트리거는 이어서 실행된다", async () => {
    const { trigger } = createSaveCoalescer<number>();
    const calls: number[] = [];
    const failing = trigger(async () => {
      calls.push(-1);
      await delay(5);
      throw new Error("일시 실패");
    });
    const queued = trigger(async () => {
      calls.push(1);
      return 1;
    });
    await expect(failing).rejects.toThrow("일시 실패");
    await expect(queued).resolves.toBe(1);
    expect(calls).toEqual([-1, 1]);
  });
});

describe("saveAllParallel", () => {
  it("독립 항목을 병렬 실행하고 실패 개수만 반환한다(항목별 실패 격리)", async () => {
    const order: string[] = [];
    const fail = vi.fn();
    const n = 10;
    const tasks = Array.from({ length: n }, (_, i) => async () => {
      await delay(i % 2 === 0 ? 5 : 1);
      order.push(`t${i}`);
      if (i === 3) { fail(); throw new Error("일부 실패"); }
    });
    const failed = await saveAllParallel(tasks);
    expect(failed).toBe(1);
    expect(fail).toHaveBeenCalledTimes(1);
    expect(order).toHaveLength(n); // 실패 항목도 "실행은 됐다"(끝까지 격리되어 나머지 진행)
  });

  it("병렬 실행이 순차보다 빠르다 — 동시성 실측(총 대기시간이 항목 수에 비례하지 않는다)", async () => {
    const n = 8;
    const perTaskMs = 20;
    const tasks = Array.from({ length: n }, () => async () => {
      await delay(perTaskMs);
    });
    const start = Date.now();
    await saveAllParallel(tasks);
    const elapsed = Date.now() - start;
    // 순차였다면 n*perTaskMs(160ms) 근처. 병렬이면 perTaskMs(20ms) 근처 — 넉넉한 마진으로 확인.
    expect(elapsed).toBeLessThan(n * perTaskMs * 0.6);
  });

  it("빈 목록은 즉시 0을 반환", async () => {
    expect(await saveAllParallel([])).toBe(0);
  });
});

describe("createKeyedSaveCoalescer (BBE-253)", () => {
  it("같은 키는 좌표(coalesce)된다 — 연타 20회에도 유실 0", async () => {
    const { trigger } = createKeyedSaveCoalescer<string, number>();
    const calls: number[] = [];
    const run = (v: number) => async () => {
      calls.push(v);
      await delay(5);
      return v;
    };
    const first = trigger("studentA", run(0));
    const rest = Array.from({ length: 19 }, (_, i) => trigger("studentA", run(i + 1)));
    const results = await Promise.all([first, ...rest]);
    expect(calls).toEqual([0, 19]); // 즉시 1 + 큐의 마지막 1
    expect(results).toHaveLength(20);
  });

  it("서로 다른 키는 독립적으로 동시에 진행된다(한쪽이 다른 쪽을 막지 않는다)", async () => {
    const { trigger } = createKeyedSaveCoalescer<string, string>();
    const order: string[] = [];
    const start = Date.now();
    const a = trigger("A", async () => {
      await delay(20);
      order.push("A");
      return "A";
    });
    const b = trigger("B", async () => {
      await delay(1);
      order.push("B");
      return "B";
    });
    await Promise.all([a, b]);
    const elapsed = Date.now() - start;
    // A 가 B 를 막았다면 B 도 20ms 이후에나 끝난다 — 독립 진행이면 B 가 먼저 끝난다.
    expect(order[0]).toBe("B");
    expect(elapsed).toBeLessThan(35); // 순차(21ms+)가 아니라 병렬(약 20ms)임을 넉넉한 마진으로 확인
  });

  it("isSaving(key) 은 그 키가 진행 중일 때만 true — 다른 키에는 영향 없음", async () => {
    const { trigger, isSaving } = createKeyedSaveCoalescer<string, void>();
    expect(isSaving("A")).toBe(false);
    const p = trigger("A", async () => {
      expect(isSaving("A")).toBe(true);
      expect(isSaving("B")).toBe(false);
      await delay(1);
    });
    await p;
    expect(isSaving("A")).toBe(false);
  });
});
