/**
 * Layer: service — 통화 정리 흐름(plan docs/plans/active/call-summary.md PR-4).
 * 📞 기록(dialed) → 녹음·글자 올리기(queued) → 처리 작업자(processing → review·failed) → 상태 조회 · 닫기(discarded).
 * 확정 저장(DB정보·미팅)은 PR-4b. 기능 스위치 CALL_SUMMARY_EMAILS 에 없는 사람에게는 없는 기능처럼 군다.
 * 로그에는 통화 id·오류 종류만 남긴다(통화 내용·전화번호·키 금지).
 */
import { CALL_PAST_DAYS, callSummaryEmails, isCallSummaryUser } from "@/config";
import type { CallRecord } from "@/types/call";
import { CALL_AUDIO_MAX_BYTES, CallAiError, summarizeCall } from "@/repo/ai/call-gemini";
import { CALL_AUDIO_TYPES, readCallAudio, removeCallAudio, removeOldCallAudio, saveCallAudio } from "@/repo/call-audio";
import * as calls from "@/repo/db/call-records";
import { mapCallExtraction } from "./call-extract-map";

export { CallLeadMissing } from "@/repo/db/call-records";
export { CALL_AUDIO_MAX_BYTES } from "@/repo/ai/call-gemini";
export const CALL_TEXT_MAX_CHARS = 60_000;

/** 화면에 그대로 보여 줘도 되는 짧은 사유와 HTTP 상태. */
export class CallSummaryError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 | 413 | 429) { super(message); }
}

type Who = { email: string; spreadsheetId: string };

function gate(email: string) {
  if (!isCallSummaryUser(email)) throw new CallSummaryError("없는 기능이에요", 404);
}

/** 하루(한국 날짜) 올릴 수 있는 통화 수. */
export const callDailyLimit = () => Number(process.env.CALL_DAILY_LIMIT) || 30;

function kstMidnight(now = new Date()): Date {
  const k = new Date(now.getTime() + 9 * 3_600_000);
  return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()) - 9 * 3_600_000);
}

/**
 * 📞 버튼 — 업체·시각만 남긴다. calledAt 은 📞 없이 건 통화를 올릴 때 녹음한 시각(지난 CALL_PAST_DAYS 일 안, 미래 금지).
 * 「다음 주 화요일」을 날짜로 바꾸는 기준이라 실제 통화 시각이어야 한다.
 */
export async function startCall(who: Who, leadId: string, calledAt?: string): Promise<string> {
  gate(who.email);
  const now = Date.now(), at = calledAt ? Date.parse(calledAt) : now;
  if (!Number.isFinite(at) || at > now + 5 * 60_000 || at < now - CALL_PAST_DAYS * 86_400_000) {
    throw new CallSummaryError("통화 시각을 확인해 주세요", 400);
  }
  return calls.createCall({ email: who.email, spreadsheetId: who.spreadsheetId, leadId, calledAt: new Date(at).toISOString() });
}

/** 이 시트에서 내 진행 중 통화 — 화면이 기능 켜짐(200/404)과 상태 칩을 한 번에 안다. */
export async function listActiveCalls(who: Who): Promise<CallRecord[]> {
  gate(who.email);
  return calls.listActiveCalls(who.spreadsheetId, who.email);
}

export type CallUploadInput = { kind: "audio"; name: string; bytes: Uint8Array } | { kind: "text"; text: string };

/** 녹음 파일 또는 통화 앱이 만든 글자를 붙여 대기열에 넣는다. */
export async function uploadCall(who: Who, id: string, input: CallUploadInput): Promise<void> {
  gate(who.email);
  if (await calls.countCallUploadsSince(who.email, kstMidnight()) >= callDailyLimit()) {
    throw new CallSummaryError("오늘 올릴 수 있는 통화 수를 다 썼어요", 429);
  }
  let upload: calls.CallUpload;
  if (input.kind === "text") {
    const text = input.text.trim();
    if (!text) throw new CallSummaryError("통화 글자가 비어 있어요", 400);
    if (text.length > CALL_TEXT_MAX_CHARS) throw new CallSummaryError("통화 내용이 너무 길어요", 413);
    upload = { source: "text", audioPath: null, transcript: text };
  } else {
    const ext = input.name.toLowerCase().split(".").pop() ?? "";
    if (!CALL_AUDIO_TYPES[ext]) throw new CallSummaryError("m4a·mp3·wav·aac·ogg·flac 녹음만 올릴 수 있어요", 400);
    if (input.bytes.byteLength > CALL_AUDIO_MAX_BYTES) throw new CallSummaryError("녹음 파일이 14MB 보다 커요", 413);
    if (input.bytes.byteLength === 0) throw new CallSummaryError("녹음 파일이 비어 있어요", 400);
    upload = { source: "audio", audioPath: await saveCallAudio(input.bytes, ext), transcript: "" };
  }
  if (!(await calls.queueCall(who.email, id, upload))) {
    await removeCallAudio(upload.audioPath);
    throw new CallSummaryError("이미 올렸거나 없는 통화예요", 409);
  }
}

/** 통화 하나 — AI 원답(raw)·녹음 경로는 내보내지 않는다(CallRecord 에 없음). */
export async function getCallStatus(email: string, id: string): Promise<CallRecord> {
  gate(email);
  const call = await calls.getCall(email, id);
  if (!call) throw new CallSummaryError("없는 통화예요", 404);
  return call;
}

export async function listLeadCalls(who: Who, leadId: string): Promise<CallRecord[]> {
  gate(who.email);
  return (await calls.listCallsForLead(who.spreadsheetId, leadId)).filter(c => c.email === who.email.trim().toLowerCase());
}

/** 저장하지 않고 닫기. 남은 녹음도 지운다. */
export async function discardCall(email: string, id: string): Promise<void> {
  gate(email);
  const r = await calls.discardCall(email, id);
  if (!r.ok) throw new CallSummaryError("닫을 수 없는 통화예요", 409);
  await removeCallAudio(r.audioPath);
}

/** 대기열에서 하나 꺼내 정리한다. 꺼낸 게 있으면 true. */
export async function processNextCall(): Promise<boolean> {
  const call = await calls.claimNextCall();
  if (!call) return false;
  try {
    const ai = call.source === "audio"
      ? await summarizeCall({ source: "audio", calledAt: call.calledAt, ...(await readCallAudio(call.audioPath ?? "")) })
      : await summarizeCall({ source: "text", text: call.transcript, calledAt: call.calledAt });
    const done = await calls.finishCall(call.id, {
      transcript: ai.transcript || call.transcript, raw: ai.raw, extraction: mapCallExtraction(ai.raw, call.calledAt), audioSeconds: null,
    });
    await removeCallAudio(done.audioPath);
  } catch (e) {
    const reason = e instanceof CallAiError ? e.message : "정리하지 못했어요";
    console.warn(`[call-summary] ${call.id} ${e instanceof CallAiError ? (e.retryable ? "retry" : "fail") : "error"}: ${reason}`);
    if (e instanceof CallAiError && e.retryable) {
      if ((await calls.retryCall(call.id, reason)) === "failed") await removeCallAudio(call.audioPath);
    } else {
      await removeCallAudio((await calls.failCall(call.id, reason)).audioPath);
    }
  }
  return true;
}

/** 하루 넘게 남은 녹음 원본(닫지 않고 둔 통화, 멈춘 채 실패 처리된 통화의 파일 등)을 지운다. */
export async function sweepCallAudio(): Promise<void> {
  for (const s of await calls.staleCallAudio(24)) {
    await removeCallAudio(s.audioPath);
    await calls.clearCallAudio(s.id);
  }
  await removeOldCallAudio(24);
}

const TICK_MS = 5_000;
const SWEEP_MS = 60 * 60_000;
let started = false;

/** instrumentation 에서 한 번 부른다. 스위치에 아무도 없으면 돌지 않는다(재기동 시 다시 판단). */
export function startCallWorkerLoop(): void {
  if (started || callSummaryEmails().length === 0) return;
  started = true;
  let busy = false, lastSweep = 0;
  setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      while (await processNextCall()) { /* 대기열을 비울 때까지 */ }
      if (Date.now() - lastSweep > SWEEP_MS) { lastSweep = Date.now(); await sweepCallAudio(); }
    } catch (e) {
      console.warn(`[call-summary] worker: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      busy = false;
    }
  }, TICK_MS).unref();
}
