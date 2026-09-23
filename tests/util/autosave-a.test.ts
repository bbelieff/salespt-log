/**
 * Scope A autosave core regressions — behavioral (timers + deferred promises),
 * not source-string assertions.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AutosaveQueue } from "@/util/autosave-queue";

type P = { text: string };

function deferred() {
  let resolve!: (v?: unknown) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<unknown>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const TARGET = { kind: "test", id: "a" };

function makeQueue(opts?: {
  delayMs?: number;
  isEmpty?: (p: P) => boolean;
  saveImpl?: (payload: P) => Promise<unknown>;
}) {
  const calls: Array<{ target: Record<string, unknown>; payload: P }> = [];
  const statuses: string[] = [];
  const acks: P[] = [];
  const errors: string[] = [];
  let gate: Array<ReturnType<typeof deferred>> = [];
  const save = vi.fn(async ({ payload }: { payload: P }) => {
    calls.push({ target: { ...TARGET }, payload });
    if (opts?.saveImpl) return opts.saveImpl(payload);
    const d = deferred();
    gate.push(d);
    return d.promise;
  });
  const queue = new AutosaveQueue<P>({
    target: TARGET,
    delayMs: opts?.delayMs ?? 800,
    isEmpty: opts?.isEmpty,
    save,
    onAck: (p) => acks.push(p),
    onStatus: (s) => statuses.push(s),
    onError: (m) => errors.push(m),
  });
  return { queue, calls, statuses, acks, errors, save, gate: () => gate };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
});

describe("autosave queue — silence rules", () => {
  it("sends nothing on construction, sync (hydration/refetch), or untouched defaults", async () => {
    const { queue, save } = makeQueue();
    queue.sync({ text: "server" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
  });

  it("never sends an empty draft", async () => {
    const { queue, save } = makeQueue({ isEmpty: (p) => p.text.trim() === "" });
    queue.edit({ text: "   " });
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
  });

  it("never sends a payload equal to the last ack", async () => {
    const { queue, save, gate } = makeQueue();
    queue.sync({ text: "same" });
    queue.edit({ text: "same" });
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).not.toHaveBeenCalled();
    expect(gate()).toHaveLength(0);
  });
});

describe("autosave queue — debounce + single-flight + latest-wins", () => {
  it("coalesces rapid edits into one request with the latest payload", async () => {
    const { queue, calls, gate } = makeQueue();
    queue.sync({ text: "" });
    queue.edit({ text: "a" });
    await vi.advanceTimersByTimeAsync(300);
    queue.edit({ text: "ab" });
    await vi.advanceTimersByTimeAsync(300);
    queue.edit({ text: "abc" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.payload).toEqual({ text: "abc" });
    gate()[0]!.resolve();
    await vi.advanceTimersByTimeAsync(0);
  });

  it("freezes the target captured at queue creation", async () => {
    const { queue, calls, gate } = makeQueue();
    queue.sync({ text: "" });
    queue.edit({ text: "x" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls[0]!.target).toEqual(TARGET);
    gate()[0]!.resolve();
    await vi.advanceTimersByTimeAsync(0);
  });

  it("preserves edits made mid-flight and sends them after, in order", async () => {
    const { queue, calls, gate } = makeQueue();
    queue.sync({ text: "" });
    queue.edit({ text: "first" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toHaveLength(1);
    queue.edit({ text: "second" }); // arrives while "first" is flying
    gate()[0]!.resolve(); // first ACKs
    await vi.advanceTimersByTimeAsync(100);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.payload).toEqual({ text: "second" });
    gate()[1]!.resolve();
    await vi.advanceTimersByTimeAsync(0);
  });

  it("a stale response never clears newer edits", async () => {
    const saves: Array<{ payload: P; d: ReturnType<typeof deferred> }> = [];
    const queue = new AutosaveQueue<P>({
      target: TARGET,
      delayMs: 800,
      save: async ({ payload }) => {
        const d = deferred();
        saves.push({ payload, d });
        return d.promise;
      },
      onAck: () => {},
    });
    queue.sync({ text: "" });
    queue.edit({ text: "v1" });
    await vi.advanceTimersByTimeAsync(1000);
    queue.edit({ text: "v2" });
    // v1 resolves AFTER v2 was staged — ack must land on v2, never revert to v1.
    saves[0]!.d.resolve();
    await vi.advanceTimersByTimeAsync(100);
    expect(saves).toHaveLength(2);
    expect(saves[1]!.payload).toEqual({ text: "v2" });
    saves[1]!.d.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(queue.hasPending).toBe(false);
    queue.dispose();
  });
});

describe("autosave queue — failure, retry, flush", () => {
  it("keeps the draft on rejection with no automatic retry; manual retry resends", async () => {
    const { queue, calls, gate, errors, statuses } = makeQueue();
    queue.sync({ text: "" });
    queue.edit({ text: "doomed" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toHaveLength(1);
    gate()[0]!.reject(new Error("sheet 429"));
    await vi.advanceTimersByTimeAsync(0);
    expect(errors).toEqual(["sheet 429"]);
    expect(statuses[statuses.length - 1]).toBe("error");
    await vi.advanceTimersByTimeAsync(10000); // no infinite/automatic retry
    expect(calls).toHaveLength(1);
    queue.retry();
    await vi.advanceTimersByTimeAsync(100);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.payload).toEqual({ text: "doomed" }); // draft retained
    gate()[1]!.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(statuses[statuses.length - 1]).toBe("saved");
  });

  it("never reports saved after hydration/refetch alone (no ACK this session)", async () => {
    const { queue, statuses } = makeQueue();
    queue.sync({ text: "server" });
    queue.rebase({ text: "server-v2" });
    await vi.advanceTimersByTimeAsync(2000);
    expect(statuses).not.toContain("saved");
    queue.dispose();
  });

  it("never reports saved before server ACK", async () => {
    const { queue, statuses, gate } = makeQueue();
    queue.sync({ text: "" });
    queue.edit({ text: "unacked" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(statuses).not.toContain("saved");
    gate()[0]!.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(statuses).toContain("saved");
    queue.dispose();
  });

  it("flush awaits in-flight plus the latest pending write (save-and-leave)", async () => {
    const { queue, calls, gate } = makeQueue();
    queue.sync({ text: "" });
    queue.edit({ text: "v1" });
    await vi.advanceTimersByTimeAsync(1000);
    queue.edit({ text: "v2" });
    const done = queue.flush();
    gate()[0]!.resolve();
    await vi.advanceTimersByTimeAsync(0);
    gate()[1]!.resolve();
    await done;
    expect(calls.map((c) => c.payload.text)).toEqual(["v1", "v2"]);
    expect(queue.hasPending).toBe(false);
    queue.dispose();
  });

  it("flush sends debounced-but-unsent edits immediately", async () => {
    const { queue, calls, gate } = makeQueue();
    queue.sync({ text: "" });
    queue.edit({ text: "quick-leave" });
    const done = queue.flush(); // no timer wait
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.payload).toEqual({ text: "quick-leave" });
    gate()[0]!.resolve();
    await done;
    queue.dispose();
  });
});

describe("autosave queue — discardPending, rebase, staged flush", () => {
  it("discardPending cancels the debounce without moving the baseline", async () => {
    const { queue, save } = makeQueue();
    queue.sync({ text: "" });
    queue.edit({ text: "stale" });
    queue.discardPending();
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
    expect(queue.hasPending).toBe(false);
    queue.dispose();
  });

  it("rebase preserves a queued write across a background refresh", async () => {
    const { queue, calls, gate } = makeQueue();
    queue.sync({ text: "" });
    queue.edit({ text: "newer" });
    queue.rebase({ text: "server" });
    expect(queue.hasPending).toBe(true);
    const done = queue.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.payload).toEqual({ text: "newer" });
    gate()[0]!.resolve();
    await done;
    expect(queue.hasPending).toBe(false);
    queue.dispose();
  });

  it("flush sends a staged-only draft (stage without commit)", async () => {
    const { queue, calls, gate } = makeQueue();
    queue.sync({ text: "" });
    queue.stage({ text: "group" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toHaveLength(0); // stage alone schedules nothing
    const done = queue.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.payload).toEqual({ text: "group" });
    gate()[0]!.resolve();
    await done;
    queue.dispose();
  });
});

describe("autosave queue — stage supersedes older debounce (F2/1)", () => {
  it("stage cancels an older debounced edit; flush sends only the latest staged", async () => {
    const { queue, calls, gate, save } = makeQueue();
    queue.sync({ text: "" });
    queue.edit({ text: "v1" });
    queue.stage({ text: "v2" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled(); // no stale intermediate timer write
    const done = queue.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.payload).toEqual({ text: "v2" });
    gate()[0]!.resolve();
    await done;
    expect(queue.hasPending).toBe(false);
    queue.dispose();
  });

  it("active-flight edit then stage then flush awaits the final staged payload", async () => {
    const { queue, calls, gate } = makeQueue();
    queue.sync({ text: "" });
    queue.edit({ text: "v1" });
    await vi.advanceTimersByTimeAsync(1000); // v1 flight starts
    expect(calls).toHaveLength(1);
    expect(calls[0]!.payload).toEqual({ text: "v1" });
    queue.stage({ text: "v2" }); // arrives mid-flight: draft-only, cancels debounce
    const done = queue.flush(); // must await v1 then send v2
    gate()[0]!.resolve(); // v1 ACKs
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.payload).toEqual({ text: "v2" });
    gate()[1]!.resolve();
    await done;
    expect(queue.hasPending).toBe(false);
    queue.dispose();
  });
});

describe("autosave queue — identity switch and dispose", () => {
  it("retarget cancels old-target pending work without saving it", async () => {
    const seen: P[] = [];
    const queue = new AutosaveQueue<P>({
      target: { kind: "week", week: 3 },
      delayMs: 800,
      save: async ({ payload }) => {
        seen.push(payload);
      },
    });
    queue.sync({ text: "" });
    queue.edit({ text: "week-3-edit" });
    queue.retarget({ kind: "week", week: 4 }, { text: "week-4-server" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(seen).toHaveLength(0); // week-3 edit never sent
    // New identity works normally afterwards.
    queue.edit({ text: "week-4-edit" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(seen).toEqual([{ text: "week-4-edit" }]);
    queue.dispose();
  });

  it("ignores a late in-flight response after retarget (no stale clear)", async () => {
    const d = deferred();
    let acked: P[] = [];
    const queue = new AutosaveQueue<P>({
      target: { kind: "week", week: 3 },
      delayMs: 800,
      save: () => d.promise,
      onAck: (p) => acked.push(p),
    });
    queue.sync({ text: "" });
    queue.edit({ text: "old" });
    await vi.advanceTimersByTimeAsync(1000); // flight starts
    queue.edit({ text: "older-staged" });
    queue.retarget({ kind: "week", week: 4 }, { text: "fresh" });
    d.resolve(); // old flight resolves late
    await vi.advanceTimersByTimeAsync(1000);
    expect(acked).toHaveLength(0);
    expect(queue.hasPending).toBe(false);
    queue.dispose();
  });

  it("dispose cancels the timer and ignores late results", async () => {
    const { queue, save, gate, statuses } = makeQueue();
    queue.sync({ text: "" });
    queue.edit({ text: "x" });
    queue.dispose();
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
    expect(gate()).toHaveLength(0);
    expect(statuses).not.toContain("saved");
  });
});

describe("autosave queue — refetch merge (rebase)", () => {
  it("keeps a scheduled edit across a refetch and still sends it", async () => {
    const { queue, calls, gate } = makeQueue();
    queue.sync({ text: "" });
    queue.edit({ text: "unsent" });
    await vi.advanceTimersByTimeAsync(300);
    queue.rebase({ text: "" }); // background refetch, same server state
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.payload).toEqual({ text: "unsent" });
    gate()[0]!.resolve();
    await vi.advanceTimersByTimeAsync(0);
    queue.dispose();
  });

  it("drops a pending edit that now equals the server (made elsewhere)", async () => {
    const { queue, save } = makeQueue();
    queue.sync({ text: "" });
    queue.edit({ text: "same-elsewhere" });
    await vi.advanceTimersByTimeAsync(300);
    queue.rebase({ text: "same-elsewhere" });
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).not.toHaveBeenCalled();
    expect(queue.hasPending).toBe(false);
    queue.dispose();
  });

  it("adopts the new baseline while an errored payload stays retryable", async () => {
    const { queue, calls, gate } = makeQueue();
    queue.sync({ text: "" });
    queue.edit({ text: "v1" });
    await vi.advanceTimersByTimeAsync(1000);
    gate()[0]!.reject(new Error("boom"));
    await vi.advanceTimersByTimeAsync(0);
    queue.rebase({ text: "server-moved" });
    queue.retry();
    await vi.advanceTimersByTimeAsync(100);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.payload).toEqual({ text: "v1" }); // unsent edit preserved
    gate()[1]!.resolve();
    await vi.advanceTimersByTimeAsync(0);
    queue.dispose();
  });
});

describe("autosave queue — identity switch and dispose", () => {
  it("retarget cancels old-target pending work without saving it", async () => {
    const seen: P[] = [];
    const queue = new AutosaveQueue<P>({
      target: { kind: "week", week: 3 },
      delayMs: 800,
      save: async ({ payload }) => {
        seen.push(payload);
      },
    });
    queue.sync({ text: "" });
    queue.edit({ text: "week-3-edit" });
    queue.retarget({ kind: "week", week: 4 }, { text: "week-4-server" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(seen).toHaveLength(0); // week-3 edit never sent
    // New identity works normally afterwards.
    queue.edit({ text: "week-4-edit" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(seen).toEqual([{ text: "week-4-edit" }]);
    queue.dispose();
  });

  it("ignores a late in-flight response after retarget (no stale clear)", async () => {
    const d = deferred();
    let acked: P[] = [];
    const queue = new AutosaveQueue<P>({
      target: { kind: "week", week: 3 },
      delayMs: 800,
      save: () => d.promise,
      onAck: (p) => acked.push(p),
    });
    queue.sync({ text: "" });
    queue.edit({ text: "old" });
    await vi.advanceTimersByTimeAsync(1000); // flight starts
    queue.edit({ text: "older-staged" });
    queue.retarget({ kind: "week", week: 4 }, { text: "fresh" });
    d.resolve(); // old flight resolves late
    await vi.advanceTimersByTimeAsync(1000);
    expect(acked).toHaveLength(0);
    expect(queue.hasPending).toBe(false);
    queue.dispose();
  });

  it("dispose cancels the timer and ignores late results", async () => {
    const { queue, save, gate, statuses } = makeQueue();
    queue.sync({ text: "" });
    queue.edit({ text: "x" });
    queue.dispose();
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
    expect(gate()).toHaveLength(0);
    expect(statuses).not.toContain("saved");
  });
});
