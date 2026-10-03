/**
 * AutosaveQueue — Scope A shared autosave core (pure, no React).
 *
 * Approved semantics implemented here:
 *  - No request on hydration / refetch / untouched defaults / empty draft.
 *  - Target identity frozen at construction; retarget() cancels pending, never saves.
 *  - Single-flight + latest-wins: edits arriving mid-flight are preserved and sent
 *    after the flight; a stale response never clears newer edits.
 *  - Failure keeps the pending payload; only explicit retry()/flush() resends.
 *    No infinite/automatic retry. "Saved" is reported only after server ACK.
 *  - discardPending() cancels queued work without moving the baseline (invalid
 *    input superseding an older debounce, explicit user discard). Use it —
 *    never sync() — for cancellation: sync() adopts a server baseline.
 *  - rebase() adopts a newer server baseline while preserving queued writes
 *    (dirty refetch merge). flush() promotes a staged-only draft so
 *    stage()+flush() without blur still saves.
 */

/**
 * idle — clean, nothing scheduled. pending — debounce/sending latest edits.
 * saved — last payload acked by the server (set ONLY after ACK, never before).
 * error — last attempt rejected; payload retained for manual retry.
 */
export type AutosaveStatus = "idle" | "pending" | "saved" | "error";

/** Frozen routing identity for one queue lifetime (student/week, day/channel, ...). */
export type AutosaveTarget = Record<string, string | number | boolean | null | undefined>;

export interface AutosaveSaveArg<T> {
  /** Target frozen when the payload was enqueued — never a live closure. */
  target: AutosaveTarget;
  payload: T;
}

export interface AutosaveQueueOptions<T> {
  target: AutosaveTarget;
  delayMs?: number;
  /** Empty draft (e.g. no required fields) → never sent. */
  isEmpty?: (payload: T) => boolean;
  /** Equal to last-acked → never sent. Default: JSON deep compare. */
  isEqual?: (a: T, b: T) => boolean;
  save: (arg: AutosaveSaveArg<T>) => Promise<unknown>;
  onAck?: (payload: T) => void;
  onStatus?: (status: AutosaveStatus) => void;
  onError?: (message: string) => void;
}

const defaultEqual = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "저장에 실패했어요.";
}

export class AutosaveQueue<T> {
  private target: AutosaveTarget;
  private readonly delayMs: number;
  private readonly isEmpty: (payload: T) => boolean;
  private readonly isEqual: (a: T, b: T) => boolean;
  private readonly save: (arg: AutosaveSaveArg<T>) => Promise<unknown>;
  private readonly onAck: (payload: T) => void;
  private readonly onStatus: (status: AutosaveStatus) => void;
  private readonly onError: (message: string) => void;

  /** Last payload the caller staged (draft truth for flush/commit). */
  private staged: T | null = null;
  /** Payload scheduled/sent most recently (newest user intent). */
  private pending: T | null = null;
  /** Last server-acked payload. */
  private acked: T | null = null;
  private ackedBySave = false;
  private touched = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flying = false;
  private flightWaiters: Array<() => void> = [];
  private generation = 0;
  private disposed = false;
  private lastError = "";

  constructor(options: AutosaveQueueOptions<T>) {
    this.target = { ...options.target };
    this.delayMs = options.delayMs ?? 800;
    this.isEmpty = options.isEmpty ?? (() => false);
    this.isEqual = options.isEqual ?? defaultEqual;
    this.save = options.save;
    this.onAck = options.onAck ?? (() => {});
    this.onStatus = options.onStatus ?? (() => {});
    this.onError = options.onError ?? (() => {});
  }

  /** Valid user edit — debounce; latest payload wins. Never sends synchronously. */
  edit(payload: T): void {
    if (this.disposed) return;
    this.touched = true;
    this.staged = payload;
    if (this.isEmpty(payload)) {
      this.pending = null;
      this.clearTimer();
      return;
    }
    this.pending = payload;
    this.restartTimer();
  }

  /**
   * Draft-only staging (currency/date group mid-edit) — schedules nothing.
   * Cancels any older debounced pending payload + timer so a group edit in
   * progress supersedes the intermediate keystroke debounce; the staged draft
   * stays as the latest intent for commit()/flush(). While a flight is active
   * the flight itself is untouched — flush() sends the staged draft after it.
   */
  stage(payload: T): void {
    if (this.disposed) return;
    this.touched = true;
    this.staged = payload;
    this.pending = null;
    this.clearTimer();
    if (!this.flying) {
      this.onStatus(this.status);
    }
  }

  /** Whole-group blur — enqueue the staged draft when it is worth sending. */
  commit(): void {
    if (this.disposed || this.staged === null) return;
    this.edit(this.staged);
  }

  /**
   * Explicit cancel of queued work without moving the baseline. Clears the
   * debounce timer, the pending payload, and the staged draft; the last-acked
   * baseline and any recorded save error are untouched. Callers cancelling an
   * older debounce (invalid input) or abandoning local edits (user discard)
   * must use this — never sync(), which adopts a server baseline.
   */
  discardPending(): void {
    if (this.disposed) return;
    this.clearTimer();
    this.pending = null;
    this.staged = null;
    if (!this.flying) {
      this.onStatus(this.status);
    }
  }

  /**
   * Dirty refetch merge — adopt a newer server baseline while preserving any
   * queued user write. Unlike sync(), the debounce timer, pending payload,
   * and staged draft are untouched, so a background refresh never cancels
   * newer edits. A pending payload identical to the new baseline naturally
   * becomes a no-op for flush()/hasPending via the equalsAcked check.
   */
  rebase(server: T): void {
    if (this.disposed) return;
    this.acked = server;
  }

  /** Programmatic hydration/refetch — clean baseline, sends nothing. */
  sync(server: T): void {
    if (this.disposed) return;
    this.clearTimer();
    this.staged = server;
    this.pending = null;
    this.acked = server;
    this.ackedBySave = false;
    this.touched = false;
    this.lastError = "";
  }

  /**
   * Identity changed (other week/day/record) — cancel pending work for the old
   * target without saving it, then adopt the new baseline.
   */
  retarget(target: AutosaveTarget, server: T): void {
    if (this.disposed) return;
    this.generation++; // stale in-flight responses for the old target are ignored
    this.clearTimer();
    this.target = { ...target };
    this.sync(server);
  }

  /** Clear a surfaced error after an explicit user resolution (overwrite/discard). */
  clearError(): void {
    if (this.disposed) return;
    this.lastError = "";
    if (!this.flying && this.timer === null) {
      this.onStatus(this.ackedBySave ? "saved" : "idle");
    }
  }

  /**
   * External ACK for an out-of-band write (conflict overwrite PUT sent
   * directly, NOT through run()). Adopts exactly the frozen acknowledged
   * payload as the new baseline and clears the resolved transport error.
   * Later draft/staged work is preserved: a pending payload equal to the
   * ACK becomes a no-op, a newer one stays queued for an explicit
   * commit/retry (never auto-sent here). "saved" is emitted only when
   * nothing newer remains — never for a refetch. Never use sync()/rebase()
   * as an acknowledgement: both preserve the old error by design.
   */
  acknowledge(payload: T): void {
    if (this.disposed) return;
    this.acked = payload;
    this.ackedBySave = true;
    this.lastError = "";
    if (this.pending !== null && this.isEqual(this.pending, payload)) {
      this.pending = null;
      this.clearTimer();
    }
    this.onAck(payload);
    if (this.flying || this.timer !== null) {
      this.onStatus("pending");
      return;
    }
    const newerPending = this.pending !== null && !this.equalsAcked(this.pending);
    const newerStaged = this.staged !== null && !this.equalsAcked(this.staged);
    this.onStatus(newerPending || newerStaged ? "pending" : "saved");
  }

  /** Manual retry after an error — the only path that resends a failed payload. */
  retry(): void {
    if (this.disposed || this.flying || this.pending === null) return;
    if (this.equalsAcked(this.pending)) return;
    this.lastError = "";
    void this.run(this.pending);
  }

  /**
   * Save-and-leave — cancel the debounce, await any in-flight write, then send
   * the latest payload. The latest staged draft (stage() with no commit, e.g.
   * save-and-leave out of a currency/date group) overwrites any stale pending
   * payload first, so the newest intent is sent instead of a dropped or stale
   * intermediate. Resolves after the newest edits are acked.
   */
  async flush(): Promise<void> {
    if (this.disposed) return;
    this.clearTimer();
    if (
      this.staged !== null &&
      !this.isEmpty(this.staged) &&
      !this.equalsAcked(this.staged)
    ) {
      this.pending = this.staged;
    }
    while (this.flying) {
      await this.settled();
    }
    if (this.pending !== null && !this.equalsAcked(this.pending)) {
      await this.run(this.pending);
    }
    if (this.lastError) throw new Error(this.lastError);
  }

  /** Unmount — cancel the timer; late flight results are ignored. */
  dispose(): void {
    this.disposed = true;
    this.generation++;
    this.clearTimer();
  }

  get hasPending(): boolean {
    return this.pending !== null && !this.equalsAcked(this.pending);
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  get status(): AutosaveStatus {
    if (this.lastError && !this.flying) return "error";
    return this.flying || this.timer !== null ? "pending" : "idle";
  }

  private equalsAcked(payload: T): boolean {
    return this.acked !== null && this.isEqual(this.acked, payload);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private restartTimer(): void {
    this.clearTimer();
    this.onStatus("pending");
    this.timer = setTimeout(() => {
      this.timer = null;
      const next = this.pending;
      if (next === null || this.equalsAcked(next)) {
        if (!this.flying) {
          this.onStatus(this.lastError ? "error" : this.ackedBySave ? "saved" : "idle");
        }
        return;
      }
      void this.run(next);
    }, this.delayMs);
  }

  private settled(): Promise<void> {
    if (!this.flying) return Promise.resolve();
    return new Promise((resolve) => {
      this.flightWaiters.push(resolve);
    });
  }

  private async run(payload: T): Promise<void> {
    if (this.flying) return; // single-flight — the active loop picks up newest itself
    this.flying = true;
    try {
      // Latest-wins loop: edits arriving mid-flight are sent right after, in order.
      let next: T | null = payload;
      while (next !== null) {
        const current = next;
        next = null;
        const generation = this.generation;
        const target = { ...this.target };
        this.onStatus("pending");
        try {
          await this.save({ target, payload: current });
        } catch (e) {
          if (this.disposed || generation !== this.generation) return; // stale: keep newer edits
          this.lastError = errorMessage(e);
          this.onStatus("error");
          this.onError(this.lastError);
          return;
        }
        if (this.disposed || generation !== this.generation) return; // stale: keep newer edits
        this.acked = current;
        this.ackedBySave = true;
        this.lastError = "";
        this.onAck(current);
        const newest = this.pending;
        if (newest !== null && !this.equalsAcked(newest)) next = newest;
        else if (this.staged !== null && !this.equalsAcked(this.staged)) {
          // Newer staged-only draft (stage without commit/flush) stays unsent
          // by design — remain idle, never claim a write is running.
          this.onStatus("idle");
        } else this.onStatus("saved"); // ACKed with nothing newer — only here is "saved" claimed
      }
    } finally {
      this.flying = false;
      const waiters = this.flightWaiters;
      this.flightWaiters = [];
      for (const w of waiters) w();
    }
  }
}
