/**
 * Layer: repo — 통화 정리 기록 call_records (migration 0014, plan docs/plans/active/call-summary.md).
 * 상태 = 대기열: queued 를 `for update skip locked` 로 하나씩 가져가 pm2 재시작·작업자 여러 개에도 한 번만 처리한다.
 * 녹음 원본은 글자로 바꾼 뒤 바로 지운다(D3) — 경로를 비우는 함수가 옛 경로를 돌려주면 부르는 쪽이 파일을 지운다.
 */
import { randomUUID } from "node:crypto";
import { dbEnabled, getDbPool } from "./client";
import { CallExtraction, type CallRecord, type CallSource, type CallStatus } from "@/types/call";

function pool() {
  if (!dbEnabled()) throw new Error("call_db_unavailable");
  return getDbPool();
}
const key = (email: string) => email.trim().toLowerCase();

/** processing 이 이보다 오래 멈춰 있으면 작업자가 죽은 것으로 보고 다시 가져간다. */
export const CALL_STALE_MINUTES = 10;
/** 이만큼 가져가고도 끝나지 않으면 failed. */
export const CALL_MAX_ATTEMPTS = 3;

export type CallUpload = { source: CallSource; audioPath: string | null; transcript: string };

type Row = {
  id: string; spreadsheet_id: string; lead_id: string; email: string; status: CallStatus; source: CallSource | null;
  called_at: Date; audio_seconds: number | null; transcript: string; extraction: unknown; error: string; attempts: number;
  created_at: Date; confirmed_at: Date | null; audio_path: string | null;
};
const COLS = `id::text, spreadsheet_id, lead_id::text, email, status, source, called_at, audio_seconds, transcript, extraction,
  error, attempts, created_at, confirmed_at, audio_path`;
const toRecord = (r: Row): CallRecord => ({
  id: r.id, spreadsheetId: r.spreadsheet_id, leadId: r.lead_id, email: r.email, status: r.status, source: r.source,
  calledAt: r.called_at.toISOString(), audioSeconds: r.audio_seconds, transcript: r.transcript,
  extraction: r.extraction == null ? null : CallExtraction.parse(r.extraction), error: r.error, attempts: r.attempts,
  createdAt: r.created_at.toISOString(), confirmedAt: r.confirmed_at?.toISOString() ?? null,
});

/** 이 업체가 이 DB관리시트에 없으면(휴지통 비움 등) 통화를 만들 수 없다. */
export class CallLeadMissing extends Error { constructor() { super("call_lead_missing"); } }

/** 📞 를 누르면 upload 없이(dialed), 📞 없이 DB정보에서 바로 올리면 upload 와 함께(queued) 만든다. */
export async function createCall(input: {
  spreadsheetId: string; leadId: string; email: string; calledAt: string; upload?: CallUpload;
}): Promise<string> {
  const id = randomUUID(), u = input.upload;
  await pool().query(
    `insert into public.call_records (id, spreadsheet_id, lead_id, email, status, called_at, source, audio_path, transcript)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, input.spreadsheetId, input.leadId, key(input.email), u ? "queued" : "dialed", input.calledAt,
      u?.source ?? null, u?.audioPath ?? null, u?.transcript ?? ""])
    .catch((e: { code?: string }) => { throw e.code === "23503" ? new CallLeadMissing() : e; });
  return id;
}

/** dialed(또는 실패해서 다시 올리는) 통화에 녹음·글자를 붙여 대기열에 넣는다. 본인 통화가 아니거나 상태가 맞지 않으면 false. */
export async function queueCall(email: string, id: string, u: CallUpload): Promise<boolean> {
  const r = await pool().query(
    `update public.call_records set status='queued', source=$3, audio_path=$4, transcript=$5, error='', attempts=0,
       started_at=null, updated_at=now()
     where id=$1 and email=$2 and status in ('dialed','failed')`,
    [id, key(email), u.source, u.audioPath, u.transcript]);
  return (r.rowCount ?? 0) > 0;
}

export type ClaimedCall = CallRecord & { audioPath: string | null };

/** 다음 처리할 통화 하나를 processing 으로 바꿔 가져간다. 없으면 null. 멈춘 processing 은 다시 가져가거나 횟수를 넘으면 failed. */
export async function claimNextCall(): Promise<ClaimedCall | null> {
  const db = pool();
  await db.query(
    `update public.call_records set status='failed', error='정리가 끝나지 않았어요', audio_path=null, updated_at=now()
     where status='processing' and started_at < now() - make_interval(mins => $1) and attempts >= $2`,
    [CALL_STALE_MINUTES, CALL_MAX_ATTEMPTS]);
  const r = await db.query<Row>(
    `update public.call_records c set status='processing', started_at=now(), attempts=c.attempts+1, updated_at=now()
     where c.id = (
       select id from public.call_records
       where status='queued' or (status='processing' and started_at < now() - make_interval(mins => $1) and attempts < $2)
       order by created_at for update skip locked limit 1)
     returning ${COLS}`,
    [CALL_STALE_MINUTES, CALL_MAX_ATTEMPTS]);
  const row = r.rows[0];
  return row ? { ...toRecord(row), audioPath: row.audio_path } : null;
}

/** processing 이었던 통화만 바꾼다. 비운 녹음 경로(옛 값)를 돌려준다 — 부르는 쪽이 그 파일을 지운다. */
async function settle(id: string, set: string, params: unknown[]): Promise<{ ok: boolean; audioPath: string | null }> {
  const r = await pool().query<{ old: string | null }>(
    `update public.call_records c set ${set}, audio_path=null, updated_at=now()
     from (select id, audio_path as old from public.call_records where id=$1 and status='processing' for update) o
     where c.id=o.id returning o.old`,
    [id, ...params]);
  return r.rows[0] ? { ok: true, audioPath: r.rows[0].old } : { ok: false, audioPath: null };
}

/** 정리 끝 → review(확인 대기). raw 는 AI 원답(나중에 변환 규칙을 고쳐 다시 돌릴 때 씀). */
export function finishCall(id: string, out: { transcript: string; raw: unknown; extraction: CallExtraction; audioSeconds: number | null }) {
  return settle(id, `status='review', transcript=$2, raw=$3, extraction=$4, audio_seconds=$5, error=''`,
    [out.transcript, JSON.stringify(out.raw), JSON.stringify(CallExtraction.parse(out.extraction)), out.audioSeconds]);
}

/** 다시 해도 안 되는 실패 → failed. 사용자에게 보여 줄 짧은 사유만 남긴다(통화 내용·키 금지). */
export function failCall(id: string, reason: string) {
  return settle(id, `status='failed', error=$2`, [reason.slice(0, 200)]);
}

/** 잠깐의 오류(429·5xx) → 녹음을 둔 채 queued 로 돌려 다음에 다시. 횟수를 다 쓰면 failed. */
export async function retryCall(id: string, reason: string): Promise<CallStatus | null> {
  const r = await pool().query<{ status: CallStatus }>(
    `update public.call_records set status = case when attempts >= $3 then 'failed' else 'queued' end, error=$2,
       audio_path = case when attempts >= $3 then null else audio_path end, started_at=null, updated_at=now()
     where id=$1 and status='processing' returning status`,
    [id, reason.slice(0, 200), CALL_MAX_ATTEMPTS]);
  return r.rows[0]?.status ?? null;
}

export async function getCall(email: string, id: string): Promise<CallRecord | null> {
  const r = await pool().query<Row>(`select ${COLS} from public.call_records where id=$1 and email=$2`, [id, key(email)]);
  return r.rows[0] ? toRecord(r.rows[0]) : null;
}

/** 한 업체의 통화, 최근 것부터. */
export async function listCallsForLead(spreadsheetId: string, leadId: string, limit = 20): Promise<CallRecord[]> {
  const r = await pool().query<Row>(
    `select ${COLS} from public.call_records where spreadsheet_id=$1 and lead_id=$2 order by created_at desc limit $3`,
    [spreadsheetId, leadId, limit]);
  return r.rows.map(toRecord);
}

/** 녹음 원본이 남은 채 오래된 통화(처리 중 제외) — 정리 작업이 파일을 지우고 clearCallAudio 로 경로를 비운다. */
export async function staleCallAudio(olderThanHours: number): Promise<{ id: string; audioPath: string }[]> {
  const r = await pool().query<{ id: string; audio_path: string }>(
    `select id::text, audio_path from public.call_records
     where audio_path is not null and status <> 'processing' and updated_at < now() - make_interval(hours => $1)`,
    [olderThanHours]);
  return r.rows.map(x => ({ id: x.id, audioPath: x.audio_path }));
}

export async function clearCallAudio(id: string): Promise<void> {
  await pool().query(`update public.call_records set audio_path=null, updated_at=now() where id=$1 and status <> 'processing'`, [id]);
}

/** 이 사람이 since 이후 올린 통화 수(녹음·글자) — 하루 상한. */
export async function countCallUploadsSince(email: string, since: Date): Promise<number> {
  const r = await pool().query<{ n: number }>(
    `select count(*)::int as n from public.call_records where email=$1 and source is not null and updated_at >= $2`,
    [key(email), since.toISOString()]);
  return r.rows[0]?.n ?? 0;
}

/** 저장하지 않고 닫기 → discarded. 처리 중·확정된 통화는 못 닫는다. 비운 녹음 경로(옛 값)를 돌려준다. */
export async function discardCall(email: string, id: string): Promise<{ ok: boolean; audioPath: string | null }> {
  const r = await pool().query<{ old: string | null }>(
    `update public.call_records c set status='discarded', audio_path=null, updated_at=now()
     from (select id, audio_path as old from public.call_records
           where id=$1 and email=$2 and status in ('dialed','queued','review','failed') for update) o
     where c.id=o.id returning o.old`,
    [id, key(email)]);
  return r.rows[0] ? { ok: true, audioPath: r.rows[0].old } : { ok: false, audioPath: null };
}
