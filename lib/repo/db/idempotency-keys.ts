/**
 * Layer: repo/db — creation idempotency shared primitives (Scope E2).
 *
 * Both creation paths (one-off expense entries, DB-tab appends) use the
 * client draft id (uuidv4, minted per deliberate new draft) as the server
 * operation key. Same key + same payload ⇒ replay the first commit.
 * Same key + different payload ⇒ 409 conflict (never silently return the
 * stale original, never overwrite it). Different keys + identical values ⇒
 * independent rows (legit duplicates keep working).
 *
 * Pure helpers only — no pg import, safe for routes/services/clients/tests.
 */
import { createHash } from "node:crypto";

/** Client draft ids are uuids (see newDraftId in db-autosave). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Normalize a caller-supplied idempotency key.
 *  · null/undefined/"" ⇒ null (legacy caller — byte-identical old behavior).
 *  · valid uuid (trimmed, lowercased, max 128 chars) ⇒ the key.
 *  · anything else present ⇒ throws Error("invalid_request") — fail closed,
 *    never silently downgrade a provided key to "no key".
 */
export function normalizeIdempotencyKey(
  raw: unknown,
): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().toLowerCase().slice(0, 128);
  if (!s) return null;
  if (!UUID_RE.test(s)) throw new Error("invalid_request");
  return s;
}

/** Canonical JSON for fingerprinting — sorted keys, stable across retries. */
export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Original-request fingerprint — compared on replay, never the mutable row. */
export function fingerprintRequest(canonical: unknown): string {
  return createHash("sha256").update(canonicalJson(canonical), "utf8").digest("hex");
}
