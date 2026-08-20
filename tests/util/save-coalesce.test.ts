/**
 * BBE-243 — 저장 좌표(coalesce) 유틸 회귀. "연타 20회 유실 0 · 튕김 0" 요건의 핵심 증거.
 */
import { describe, expect, it, vi } from "vitest";
import { createSaveCoalescer, saveAllParallel } from "@/util/save-coalesce";

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
