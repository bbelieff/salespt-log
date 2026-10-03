/**
 * Layer: service — DB관리 탭 생성 경로 (add, 4채널).
 *
 * key = autosave draft id. Keyed ⇒ durable scoped idempotency whenever the
 * DB is available (independent of the read/write pilot cohort choice);
 * when the DB is unavailable a provided key is rejected BEFORE any side
 * effect (db_idempotency_unavailable → 503, UI retains the draft) — never
 * an unsafe write with idempotent:false. Keyless callers keep the legacy
 * path (which still skips reserved rows while the DB is available).
 * Import stability: db.ts 가 재수출하므로 기존 `@/service/db`·`@/service`
 * 소비자는 그대로 동작한다.
 */
import { randomUUID } from "node:crypto";
import {
  appendBanner,
  appendLead,
  appendProduction,
  appendPurchase,
} from "@/repo/db";
import { DB_IDEMPOTENCY_UNAVAILABLE } from "@/repo/db/db-append-idempotency";
import { normalizeIdempotencyKey } from "@/repo/db/idempotency-keys";
import { dbEnabled } from "@/repo/db/client";
import {
  assertNoOverlapDirect,
  resolveWriteCtx,
  syncDirectCount,
  syncProduction,
} from "./db";
import type {
  DBBanner,
  DBLead,
  DBProduction,
  DBPurchase,
} from "@/types";

/**
 * Fail closed: a provided key is normalized (malformed ⇒ invalid_request)
 * and requires the DB BEFORE any side effect. Absent key ⇒ null (legacy).
 */
function enforcedKey(key: string | null | undefined): string | null {
  const norm = key ? normalizeIdempotencyKey(key) : null;
  if (norm && !dbEnabled()) throw new Error(DB_IDEMPOTENCY_UNAVAILABLE);
  return norm;
}

// ── 매입DB ────────────────────────────────────────────────────
export async function addPurchase(email: string, p: DBPurchase, key?: string | null) {
  const { sid, salesCtx } = await resolveWriteCtx(email);
  const k = enforcedKey(key);
  const r = k ? await appendPurchase(sid, p, k) : await appendPurchase(sid, p);
  await syncProduction(salesCtx, "매입DB", p.구매일);
  return { row: r.row, idempotent: k !== null, replayed: r.replayed === true };
}

// ── 직접생산 (생산 = 유입, ADR-0024) ──────────────────────────
export async function addProduction(email: string, p: DBProduction, key?: string | null) {
  const { sid, fromDb, syncDb } = await resolveWriteCtx(email);
  const k = enforcedKey(key);
  if (k) {
    // Replay detection (orchestration Phase 1) runs BEFORE the overlap guard,
    // so a lost-ACK retry replays instead of rejecting its own prior row.
    // Pending retries exclude the claimed row from the guard.
    const r = await appendProduction(sid, p, k, {
      checkOverlap: (excludeRow) => assertNoOverlapDirect(sid, p.시작일, p.종료일, excludeRow),
    });
    await syncDirectCount(sid, { row: r.row, 시작일: p.시작일, 종료일: p.종료일 }, fromDb, syncDb);
    return { row: r.row, idempotent: true, replayed: r.replayed === true };
  }
  await assertNoOverlapDirect(sid, p.시작일, p.종료일);
  const r = await appendProduction(sid, p);
  await syncDirectCount(sid, { row: r.row, 시작일: p.시작일, 종료일: p.종료일 }, fromDb, syncDb);
  return { row: r.row, idempotent: false, replayed: false };
}

// ── 현수막 주문 (P:V) ─────────────────────────────────────────
export async function addBanner(email: string, b: DBBanner, key?: string | null) {
  const { sid } = await resolveWriteCtx(email);
  const k = enforcedKey(key);
  // Keyed + DB available adds the reservation + synchronous mirror around
  // the same sheet write (sheet-leg for ALL cohorts, ADR-0025).
  const r = k ? await appendBanner(sid, b, k) : await appendBanner(sid, b);
  return { row: r.row, idempotent: k !== null, replayed: r.replayed === true };
}

// ── 콜·지·기·소 ────────────────────────────────────────────────
export async function addLead(email: string, l: DBLead, key?: string | null) {
  const { sid, salesCtx } = await resolveWriteCtx(email);
  const k = enforcedKey(key);
  // 발굴 안정 id 부여(lead-chain §4-3) — appendLead 가 payload 에 항상 명시(R10: 재사용 행의 옛 id 를 덮음).
  // 클라이언트발 발굴id 는 라우트에서 strip 된다. Keyed ⇒ 발굴id = operation key
  // (retry-stable — a fresh randomUUID per attempt would break the fingerprint).
  const r = k
    ? await appendLead(sid, { ...l, 발굴id: k }, k)
    : await appendLead(sid, { ...l, 발굴id: randomUUID() });
  await syncProduction(salesCtx, "콜·지·기·소", l.접수일);
  return { row: r.row, idempotent: k !== null, replayed: r.replayed === true };
}
