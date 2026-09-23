/**
 * Scope B autosave core — DB production rows (existing edits + simple new rows).
 *
 * Pure logic (no React): draft completeness/validity checks, stable operation
 * identity, exact-payload signatures, and a revision guard so a stale response
 * never clears newer changes. React components in `_components` consume these
 * through a single-flight queue (`createSaveCoalescer` in `@/util/save-coalesce`).
 *
 * Contract:
 * - Existing-row edits save when dirty AND not invalid (server accepts empty
 *   strings/zeros, so any coherent edit is a routine edit). Undo restores the
 *   previously ACKed payload.
 * - New-row creation fires ONLY on "valid": deliberate required text filled +
 *   complete money group + well-formed coherent dates. Defaults/hydration
 *   (prefilled today, zeros, first select option) never create.
 * - Servers here are append-only with no idempotency key (no schema migration
 *   in this scope). Bounded client safety: stable draftId per draft, single
 *   flight, exact-signature dedup, manual retry only (no auto retry).
 */
import type { ChannelKey } from "./channels";

export type DbDraftStatus = "empty" | "partial" | "invalid" | "valid";

export interface DbDraftCheck {
  status: DbDraftStatus;
  reasons: string[];
}

/** Deliberate text fields per channel — at least one must be non-blank. */
const REQUIRED_TEXT: Record<ChannelKey, string[]> = {
  purchase: ["업체명"],
  banner: ["업체명"],
  direct: ["소재"],
  referral: ["대표자명", "업체명"],
};

const SELECT_DEFAULTS: Record<string, string> = {
  구분: "콜드콜",
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Well-formed AND a real calendar day (rejects 2026-02-30 etc.). */
export function isValidIsoDate(value: unknown): boolean {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m! - 1 &&
    dt.getUTCDate() === d!
  );
}

function textOf(draft: Record<string, unknown>, key: string): string {
  return String(draft[key] ?? "").trim();
}

function moneyOf(draft: Record<string, unknown>, key: string): number {
  const raw = draft[key];
  if (raw === "" || raw === undefined || raw === null) return 0;
  return Number(raw);
}

/** Money fields must be finite and non-negative; count fields integral. */
function moneyProblems(
  draft: Record<string, unknown>,
  keys: string[],
  intKeys: string[],
): string[] {
  const out: string[] = [];
  for (const key of keys) {
    const n = moneyOf(draft, key);
    if (!Number.isFinite(n)) {
      out.push(`${key} 금액을 숫자로 입력해 주세요.`);
    } else if (n < 0) {
      out.push(`${key} 금액은 0 이상이어야 해요.`);
    } else if (intKeys.includes(key) && !Number.isInteger(n)) {
      out.push(`${key} 개수는 정수로 입력해 주세요.`);
    }
  }
  return out;
}

function dateProblems(
  draft: Record<string, unknown>,
  keys: string[],
  /** Cleared dates (baseline had a value, draft is empty) are invalid: never wipe by accident. */
  clearedIsInvalid?: (key: string) => boolean,
): string[] {
  const out: string[] = [];
  for (const key of keys) {
    const v = textOf(draft, key);
    if (v === "") {
      if (clearedIsInvalid?.(key)) out.push(`${key} 날짜를 입력해 주세요.`);
      continue;
    }
    if (!isValidIsoDate(v)) {
      out.push(`${key} 날짜를 올바르게 입력해 주세요.`);
    }
  }
  return out;
}

function channelMoneyKeys(channel: ChannelKey): {
  keys: string[];
  intKeys: string[];
} {
  switch (channel) {
    case "purchase":
    case "banner":
      return { keys: ["총액", "주문개수", "개당단가"], intKeys: ["주문개수"] };
    case "direct":
      return { keys: ["예산입력", "기간예산"], intKeys: [] };
    case "referral":
      return { keys: [], intKeys: [] };
  }
}

function channelDateKeys(channel: ChannelKey): string[] {
  switch (channel) {
    case "purchase":
      return ["구매일"];
    case "banner":
      return ["날짜", "도착일"];
    case "direct":
      return ["시작일", "종료일"];
    case "referral":
      return ["접수일"];
  }
}

/** Money group complete = deliberate paid amounts (VAT-exclusive math needs inputs). */
function moneyComplete(channel: ChannelKey, draft: Record<string, unknown>): boolean {
  switch (channel) {
    case "purchase":
    case "banner":
      return moneyOf(draft, "총액") > 0 && moneyOf(draft, "주문개수") > 0;
    case "direct":
      return moneyOf(draft, "예산입력") > 0;
    case "referral":
      return true;
  }
}

function hasDeliberateText(channel: ChannelKey, draft: Record<string, unknown>): boolean {
  return REQUIRED_TEXT[channel].some((k) => textOf(draft, k) !== "");
}

/** Anything beyond pristine defaults (prefilled today / 0 / "" / first option). */
export function isTouchedDraft(
  channel: ChannelKey,
  draft: Record<string, unknown>,
): boolean {
  if (hasDeliberateText(channel, draft)) return true;
  const { keys } = channelMoneyKeys(channel);
  if (keys.some((k) => moneyOf(draft, k) !== 0)) return true;
  for (const [key, value] of Object.entries(draft)) {
    if (channelDateKeys(channel).includes(key)) continue;
    if (typeof value === "string" && value !== "" && value !== (SELECT_DEFAULTS[key] ?? "")) {
      if (!REQUIRED_TEXT[channel].includes(key)) return true;
    }
    if (typeof value === "boolean" && value) return true;
  }
  const today = new Date().toISOString().slice(0, 10);
  if (channelDateKeys(channel).some((k) => textOf(draft, k) !== "" && textOf(draft, k) !== today)) {
    return true;
  }
  return false;
}

function coherenceProblems(
  channel: ChannelKey,
  draft: Record<string, unknown>,
): string[] {
  const out: string[] = [];
  if (channel === "direct") {
    const s = textOf(draft, "시작일");
    const e = textOf(draft, "종료일");
    if (isValidIsoDate(s) && isValidIsoDate(e) && e < s) {
      out.push("생산 종료일은 시작일보다 빠를 수 없어요.");
    }
  }
  return out;
}

function invalidReasons(
  channel: ChannelKey,
  draft: Record<string, unknown>,
  baseline?: Record<string, unknown> | null,
): string[] {
  const { keys, intKeys } = channelMoneyKeys(channel);
  return [
    ...moneyProblems(draft, keys, intKeys),
    ...dateProblems(
      draft,
      channelDateKeys(channel),
      baseline
        ? (key) => textOf(baseline, key) !== ""
        : undefined,
    ),
    ...coherenceProblems(channel, draft),
  ];
}

/**
 * Creation gate for SIMPLE new rows: valid only when the user deliberately
 * completed required fields (name + money group + present well-formed dates).
 * Untouched defaults / hydration / empty drafts never create.
 */
export function dbCreateCheck(
  channel: ChannelKey,
  draft: Record<string, unknown>,
): DbDraftCheck {
  const invalid = invalidReasons(channel, draft, null);
  if (invalid.length > 0) return { status: "invalid", reasons: invalid };
  if (!isTouchedDraft(channel, draft)) return { status: "empty", reasons: [] };
  const missing: string[] = [];
  if (!hasDeliberateText(channel, draft)) {
    missing.push(`${REQUIRED_TEXT[channel].join("·")} 중 하나를 입력해 주세요.`);
  }
  if (!moneyComplete(channel, draft)) {
    missing.push("금액·개수를 모두 입력해 주세요.");
  }
  const emptyDate = channelDateKeys(channel).find((k) => textOf(draft, k) === "");
  if (emptyDate) missing.push(`${emptyDate} 날짜를 입력해 주세요.`);
  if (missing.length > 0) return { status: "partial", reasons: missing };
  return { status: "valid", reasons: [] };
}

/**
 * Edit gate for EXISTING rows: any dirty draft saves unless it carries an
 * invalid value (malformed date/amount, incoherent period). Partial input is
 * preserved locally, never wiped, never sent.
 */
export function dbEditCheck(
  channel: ChannelKey,
  draft: Record<string, unknown>,
  baseline?: Record<string, unknown> | null,
): DbDraftCheck {
  const invalid = invalidReasons(channel, draft, baseline);
  if (invalid.length > 0) return { status: "invalid", reasons: invalid };
  return { status: "valid", reasons: [] };
}

/** Stable operation identity — one per opened draft, reused across retries. */
export function newDraftId(): string {
  const c = globalThis.crypto as
    | { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => void }
    | undefined;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  c?.getRandomValues?.(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((v) => v.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Exact-payload signature — repeated blur/Enter with identical bytes saves once. */
export function payloadSignature(payload: Record<string, unknown>): string {
  const keys = Object.keys(payload).sort();
  return JSON.stringify(keys.map((k) => [k, payload[k] ?? null]));
}

/**
 * Revision guard — capture `begin()` at queue creation (identity + payload
 * frozen then); after ACK/NAK only the newest revision may touch state, so a
 * stale response never clears newer changes or hides a newer error.
 */
export function createRevisionGuard() {
  let latest = 0;
  return {
    begin(): number {
      latest += 1;
      return latest;
    },
    isCurrent(seq: number): boolean {
      return seq === latest;
    },
  };
}
