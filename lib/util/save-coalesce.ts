/**
 * 저장 액션 재진입 가드 + 좌표(coalesce) — BBE-243("연타·빠른 다중 입력 시 튕김/입력 무시").
 *
 * 문제: 화면마다 `savingRef.current` 애드혹 가드를 반복 구현했는데(app/(app)/contact/page.tsx
 * 등), 이 패턴은 저장 중 들어온 재클릭을 **그냥 버린다** — 재클릭 시점에 이미 최신 입력이
 * 반영된 draft 가 있어도 그 저장 시도 자체가 무시된다("입력 무시"의 한 경로).
 *
 * 해법: 저장 중 재트리거가 들어오면 버리지 않고 **가장 마지막 트리거 1개만** 큐에 남긴다.
 * 진행 중이던 저장이 끝나면 그 마지막 트리거로 한 번 더 실행 — 중간에 쌓인 트리거들은
 * 중복 실행하지 않고 스킵(마지막 입력만 반영하면 충분, "마지막 입력 보존" 요건과 일치).
 *
 * `run` 은 trigger() 호출마다 새로 넘긴다(팩토리 아님) — 호출 시점의 최신 draft/state 를
 * 클로저로 그대로 캡처하게 해서 stale closure 위험을 없앤다.
 */
interface Waiter<T> {
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
}

export function createSaveCoalescer<T = void>() {
  let saving = false; // 동기 플래그 — 아래 IIFE 대입 타이밍에 기대면 첫 await 전까지 false로
  // 보였다(적대검증 발견). isSaving() 이 run() 진입 직후부터 true 를 보장해야 호출부가
  // "저장 중…" 표시를 정확히 켤 수 있다.
  let pendingRun: (() => Promise<T>) | null = null;
  let pendingWaiters: Waiter<T>[] = [];

  async function runLoop(first: () => Promise<T>, firstWaiter: Waiter<T>) {
    let current = first;
    let waiters = [firstWaiter];
    for (;;) {
      try {
        const result = await current();
        for (const w of waiters) w.resolve(result);
      } catch (e) {
        // 이번 배치(waiters)만 이 실패를 본다 — 그 이후 큐에 쌓인 트리거는 별개로 이어서
        // 실행된다(첫 시도가 실패해도 그 사이 쌓인 마지막 입력은 버려지지 않는다).
        for (const w of waiters) w.reject(e);
      }
      if (!pendingRun) break;
      current = pendingRun;
      waiters = pendingWaiters;
      pendingRun = null;
      pendingWaiters = [];
    }
    saving = false;
  }

  function trigger(run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (saving) {
        pendingRun = run; // 실행은 마지막에 덮어쓴 것 1개만(중간값 재실행 불필요)
        pendingWaiters.push({ resolve, reject }); // 대기자는 전부 모아 배치 결과를 같이 통지
        return;
      }
      saving = true; // run() 진입 전에 동기적으로 세팅 — isSaving() 이 즉시 true 를 본다
      void runLoop(run, { resolve, reject });
    });
  }

  /** 현재 저장이 진행 중인지(디스플레이용 — "저장 중…" 같은 로딩 표시). */
  function isSaving(): boolean {
    return saving;
  }

  return { trigger, isSaving };
}

/**
 * 항목(키)별로 독립된 좌표(coalesce) 큐를 관리 — BBE-253("담당 트레이너 토글 연타 시
 * 롤백"). 화면에 동시에 여러 "행"(수강생 등)이 있고 각 행이 독립적으로 연타될 수 있을 때,
 * 행마다 별도의 `createSaveCoalescer` 를 두면 ①같은 행에 대한 재트리거는 좌표(마지막
 * 입력만 반영) ②다른 행끼리는 서로 막지 않고 병렬 진행 — 두 성질을 한 번에 얻는다.
 */
export function createKeyedSaveCoalescer<K, T = void>() {
  const coalescers = new Map<K, ReturnType<typeof createSaveCoalescer<T>>>();

  function trigger(key: K, run: () => Promise<T>): Promise<T> {
    let c = coalescers.get(key);
    if (!c) {
      c = createSaveCoalescer<T>();
      coalescers.set(key, c);
    }
    return c.trigger(run);
  }

  function isSaving(key: K): boolean {
    return coalescers.get(key)?.isSaving() ?? false;
  }

  return { trigger, isSaving };
}

/**
 * 여러 개의 독립 저장 작업을 **병렬**로 실행 — 항목별 실패 격리(실패 개수 반환).
 * 순차 `for...await` 대신 쓰면: ①총 대기시간이 항목 수에 비례해 늘어나지 않고 ②재시도
 * 백오프가 항목마다 누적(1번 항목 재시도 대기 중 2번은 시작도 못 함)되지 않는다 — 다건
 * 저장(다중 미팅슬롯·다중 dirty 카드)에서 "튕김"(긴 정지)으로 느껴지는 주된 경로였다.
 * 항목은 서로 독립적이어야 한다(순서 의존 로직에는 쓰지 말 것).
 */
export async function saveAllParallel(
  tasks: Iterable<() => Promise<void>>,
): Promise<number> {
  const results = await Promise.allSettled([...tasks].map((run) => run()));
  return results.filter((r) => r.status === "rejected").length;
}
