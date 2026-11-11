/**
 * Layer: repo(db). 간편인증 서류 조회 저장소 — simple_auth_requests(요청·사업자별 결과) + simple_auth_originals(원문 PDF 봉인).
 * 마이그레이션 0018_simple_auth.sql. 모든 조회는 spreadsheet_id(수강생 개인 시트 = 테넌트)로 제한한다.
 */
import { dbEnabled, getDbPool } from "./client";
import { openVault, sealVault } from "../vault-crypto";
import { SimpleAuthBusiness, type SimpleAuthRequest, type SimpleAuthStatus } from "@/types/simple-auth";
import { z } from "zod";

function pool() { if (!dbEnabled()) throw new Error("simple_auth_unavailable"); return getDbPool(); }

type Raw = {
  id: string; owner_name: string; phone: string; method: string; docs: string[]; status: string;
  sent_at: Date; deadline: Date; resends: number; progress: number; error: string | null; businesses: unknown;
};
const COLUMNS = "id, owner_name, phone, method, docs, status, sent_at, deadline, resends, progress, error, businesses";

function toRequest(r: Raw): SimpleAuthRequest {
  return {
    id: r.id, owner: r.owner_name, phone: r.phone, method: r.method as SimpleAuthRequest["method"],
    docs: r.docs as SimpleAuthRequest["docs"], status: r.status as SimpleAuthStatus,
    sentAt: r.sent_at.toISOString(), deadline: r.deadline.getTime(), resends: r.resends, progress: r.progress,
    ...(r.error ? { error: r.error } : {}),
    businesses: z.array(SimpleAuthBusiness).catch([]).parse(r.businesses),
  };
}

export type SimpleAuthOwner = { email: string; spreadsheetId: string };

export async function insertSimpleAuthRequest(o: SimpleAuthOwner, r: SimpleAuthRequest): Promise<void> {
  await pool().query(
    `insert into public.simple_auth_requests (id, email, spreadsheet_id, owner_name, phone, method, docs, status, sent_at, deadline, resends, progress, businesses)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`,
    [r.id, o.email, o.spreadsheetId, r.owner, r.phone, r.method, r.docs, r.status, new Date(r.sentAt), new Date(r.deadline), r.resends, r.progress, JSON.stringify(r.businesses)],
  );
}

/** 요청 한 건의 바뀐 칸만 저장. 테넌트가 다르면 아무것도 안 바뀐다. */
export async function updateSimpleAuthRequest(spreadsheetId: string, id: string, patch: Partial<Pick<SimpleAuthRequest, "status" | "deadline" | "resends" | "progress" | "error" | "businesses">>): Promise<SimpleAuthRequest | null> {
  const sets: string[] = [], vals: unknown[] = [spreadsheetId, id];
  const add = (col: string, v: unknown, cast = "") => { vals.push(v); sets.push(`${col}=$${vals.length}${cast}`); };
  if (patch.status !== undefined) add("status", patch.status);
  if (patch.deadline !== undefined) add("deadline", new Date(patch.deadline));
  if (patch.resends !== undefined) add("resends", patch.resends);
  if (patch.progress !== undefined) add("progress", patch.progress);
  if ("error" in patch) add("error", patch.error ?? null);
  if (patch.businesses !== undefined) add("businesses", JSON.stringify(patch.businesses), "::jsonb");
  sets.push("updated_at=now()");
  const r = await pool().query<Raw>(`update public.simple_auth_requests set ${sets.join(", ")} where spreadsheet_id=$1 and id=$2 returning ${COLUMNS}`, vals);
  return r.rows[0] ? toRequest(r.rows[0]) : null;
}

export async function listSimpleAuthRequests(spreadsheetId: string, keepDays: number): Promise<SimpleAuthRequest[]> {
  const r = await pool().query<Raw>(
    `select ${COLUMNS} from public.simple_auth_requests where spreadsheet_id=$1 and sent_at > now() - ($2::int * interval '1 day') order by sent_at desc limit 300`,
    [spreadsheetId, keepDays],
  );
  return r.rows.map(toRequest);
}

export async function getSimpleAuthRequest(spreadsheetId: string, id: string): Promise<SimpleAuthRequest | null> {
  const r = await pool().query<Raw>(`select ${COLUMNS} from public.simple_auth_requests where spreadsheet_id=$1 and id=$2`, [spreadsheetId, id]);
  return r.rows[0] ? toRequest(r.rows[0]) : null;
}

export async function deleteSimpleAuthRequest(spreadsheetId: string, id: string): Promise<boolean> {
  const r = await pool().query(`delete from public.simple_auth_requests where spreadsheet_id=$1 and id=$2`, [spreadsheetId, id]);
  return (r.rowCount ?? 0) > 0;
}

/** 오늘(since 이후) 이 수강생이 보낸 요청 수 — 하루 한도. */
export async function countSimpleAuthSince(email: string, since: Date): Promise<number> {
  const r = await pool().query<{ n: string }>(`select count(*)::text as n from public.simple_auth_requests where lower(email)=lower($1) and sent_at >= $2`, [email, since]);
  return Number(r.rows[0]?.n ?? 0);
}

/** 보관 기간이 지난 요청(원문 포함, cascade)을 지운다. */
export async function purgeSimpleAuthOlderThan(days: number): Promise<number> {
  const r = await pool().query(`delete from public.simple_auth_requests where sent_at < now() - ($1::int * interval '1 day')`, [days]);
  return r.rowCount ?? 0;
}

/** 원문 PDF(base64) 봉인 저장. 같은 서류를 다시 받으면 덮어쓴다. */
export async function saveSimpleAuthOriginal(requestId: string, bizNo: string, docKey: string, pdfBase64: string): Promise<void> {
  await pool().query(
    `insert into public.simple_auth_originals (request_id, biz_no, doc_key, sealed) values ($1,$2,$3,$4)
     on conflict (request_id, biz_no, doc_key) do update set sealed=excluded.sealed, created_at=now()`,
    [requestId, bizNo, docKey, sealVault(pdfBase64)],
  );
}

/** 원문 PDF(base64). 테넌트가 다르거나 없으면 null. */
export async function readSimpleAuthOriginal(spreadsheetId: string, requestId: string, bizNo: string, docKey: string): Promise<string | null> {
  const r = await pool().query<{ sealed: string }>(
    `select o.sealed from public.simple_auth_originals o join public.simple_auth_requests q on q.id=o.request_id
     where q.spreadsheet_id=$1 and o.request_id=$2 and o.biz_no=$3 and o.doc_key=$4`,
    [spreadsheetId, requestId, bizNo, docKey],
  );
  return r.rows[0] ? openVault(r.rows[0].sealed) : null;
}

/** 요청들에 저장된 원문 목록(사업자번호·서류 키만, 내용 없음) — 끊긴 요청도 받은 원문은 보여 주기 위해. */
export async function listSimpleAuthOriginalKeys(spreadsheetId: string, requestIds: string[]): Promise<{ requestId: string; bizNo: string; docKey: string }[]> {
  if (!requestIds.length) return [];
  const r = await pool().query<{ request_id: string; biz_no: string; doc_key: string }>(
    `select o.request_id, o.biz_no, o.doc_key from public.simple_auth_originals o join public.simple_auth_requests q on q.id=o.request_id
     where q.spreadsheet_id=$1 and o.request_id = any($2::uuid[])`,
    [spreadsheetId, requestIds],
  );
  return r.rows.map((x) => ({ requestId: x.request_id, bizNo: x.biz_no, docKey: x.doc_key }));
}
