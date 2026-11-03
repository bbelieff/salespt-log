/** 통화 정리 흐름 — 저장소·AI 는 가짜. 스위치·하루 상한·파일 검사, 작업자의 성공·재시도·실패와 녹음 지우기. */
import { beforeEach, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  createCall: vi.fn(), queueCall: vi.fn(), claimNextCall: vi.fn(), finishCall: vi.fn(), failCall: vi.fn(), retryCall: vi.fn(),
  getCall: vi.fn(), listCallsForLead: vi.fn(), staleCallAudio: vi.fn(), clearCallAudio: vi.fn(), countCallUploadsSince: vi.fn(), discardCall: vi.fn(),
}));
const audio = vi.hoisted(() => ({ saveCallAudio: vi.fn(), readCallAudio: vi.fn(), removeCallAudio: vi.fn(), removeOldCallAudio: vi.fn() }));
const ai = vi.hoisted(() => ({ summarizeCall: vi.fn() }));
vi.mock("@/repo/db/call-records", () => ({ ...db, CallLeadMissing: class extends Error {} }));
vi.mock("@/repo/call-audio", async (orig) => ({ ...(await orig<typeof import("@/repo/call-audio")>()), ...audio }));
vi.mock("@/repo/ai/call-gemini", async (orig) => ({ ...(await orig<typeof import("@/repo/ai/call-gemini")>()), ...ai }));

import { CallAiError } from "@/repo/ai/call-gemini";
import { discardCall, processNextCall, startCall, uploadCall } from "@/service/call-summary";

const who = { email: "Caller@Example.test", spreadsheetId: "sheet-synthetic" };
const ID = "00000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CALL_SUMMARY_EMAILS", "caller@example.test");
  vi.stubEnv("CALL_DAILY_LIMIT", "");
  db.countCallUploadsSince.mockResolvedValue(0);
  db.queueCall.mockResolvedValue(true);
  audio.saveCallAudio.mockResolvedValue("/tmp/x.m4a");
});

it("스위치 밖이면 없는 기능(404), 안이면 📞 기록", async () => {
  vi.stubEnv("CALL_SUMMARY_EMAILS", "");
  await expect(startCall(who, ID)).rejects.toMatchObject({ status: 404 });
  vi.stubEnv("CALL_SUMMARY_EMAILS", "caller@example.test");
  db.createCall.mockResolvedValue("new-id");
  expect(await startCall(who, ID)).toBe("new-id");
  expect(db.createCall).toHaveBeenCalledWith(expect.objectContaining({ leadId: ID, email: who.email, spreadsheetId: who.spreadsheetId }));
});

it("녹음: 확장자·크기·빈 파일·하루 상한을 막고, 맞으면 임시 파일로 두고 대기열에", async () => {
  await expect(uploadCall(who, ID, { kind: "audio", name: "a.amr", bytes: new Uint8Array(3) })).rejects.toMatchObject({ status: 400 });
  await expect(uploadCall(who, ID, { kind: "audio", name: "a.m4a", bytes: new Uint8Array(14 * 1024 * 1024 + 1) })).rejects.toMatchObject({ status: 413 });
  await expect(uploadCall(who, ID, { kind: "audio", name: "a.m4a", bytes: new Uint8Array(0) })).rejects.toMatchObject({ status: 400 });
  expect(audio.saveCallAudio).not.toHaveBeenCalled();
  await uploadCall(who, ID, { kind: "audio", name: "통화 010-0000-0000.M4A", bytes: new Uint8Array(3) });
  expect(audio.saveCallAudio).toHaveBeenCalledWith(expect.any(Uint8Array), "m4a");
  expect(db.queueCall).toHaveBeenCalledWith(who.email, ID, { source: "audio", audioPath: "/tmp/x.m4a", transcript: "" });
  db.countCallUploadsSince.mockResolvedValue(30);
  await expect(uploadCall(who, ID, { kind: "text", text: "나: 여보세요" })).rejects.toMatchObject({ status: 429 });
});

it("이미 올린 통화면 409 이고 방금 쓴 파일을 지운다", async () => {
  db.queueCall.mockResolvedValue(false);
  await expect(uploadCall(who, ID, { kind: "audio", name: "a.mp3", bytes: new Uint8Array(3) })).rejects.toMatchObject({ status: 409 });
  expect(audio.removeCallAudio).toHaveBeenCalledWith("/tmp/x.m4a");
});

it("글자: 비었거나 너무 길면 막고, 맞으면 녹음 없이 대기열에", async () => {
  await expect(uploadCall(who, ID, { kind: "text", text: "  " })).rejects.toMatchObject({ status: 400 });
  await expect(uploadCall(who, ID, { kind: "text", text: "가".repeat(60_001) })).rejects.toMatchObject({ status: 413 });
  await uploadCall(who, ID, { kind: "text", text: " 나: 여보세요 " });
  expect(db.queueCall).toHaveBeenCalledWith(who.email, ID, { source: "text", audioPath: null, transcript: "나: 여보세요" });
});

const claimed = { id: ID, source: "audio", audioPath: "/tmp/x.m4a", transcript: "", calledAt: "2026-11-03T01:00:00Z" };
const answer = { transcript: "나: 네", raw: { q11_credit: { said: "820점", evidence: "상대: 820점" }, memo: "m" }, model: "m", usage: {} };

it("작업자: 녹음 → AI → 변환 → review, 녹음 파일을 지운다", async () => {
  db.claimNextCall.mockResolvedValue(claimed);
  audio.readCallAudio.mockResolvedValue({ audio: new Uint8Array(3), mimeType: "audio/m4a" });
  ai.summarizeCall.mockResolvedValue(answer);
  db.finishCall.mockResolvedValue({ ok: true, audioPath: "/tmp/x.m4a" });
  expect(await processNextCall()).toBe(true);
  expect(ai.summarizeCall).toHaveBeenCalledWith(expect.objectContaining({ source: "audio", mimeType: "audio/m4a", calledAt: claimed.calledAt }));
  const out = db.finishCall.mock.calls[0]![1];
  expect(out).toMatchObject({ transcript: "나: 네", raw: answer.raw });
  expect(out.extraction.company).toEqual({ 신용점수: "820" });
  expect(audio.removeCallAudio).toHaveBeenCalledWith("/tmp/x.m4a");
});

it("작업자: 잠깐의 오류는 다시 대기(파일 유지), 횟수를 다 쓰면 파일을 지운다", async () => {
  db.claimNextCall.mockResolvedValue(claimed);
  audio.readCallAudio.mockResolvedValue({ audio: new Uint8Array(3), mimeType: "audio/m4a" });
  ai.summarizeCall.mockRejectedValue(new CallAiError("AI 가 바빠요(429)", true));
  db.retryCall.mockResolvedValueOnce("queued").mockResolvedValueOnce("failed");
  await processNextCall();
  expect(audio.removeCallAudio).not.toHaveBeenCalled();
  await processNextCall();
  expect(audio.removeCallAudio).toHaveBeenCalledWith("/tmp/x.m4a");
});

it("작업자: 다시 해도 안 되는 오류·녹음 없음은 failed, 사유는 짧은 말만", async () => {
  db.claimNextCall.mockResolvedValue(claimed);
  audio.readCallAudio.mockRejectedValue(new Error("ENOENT /tmp/x.m4a 비밀"));
  db.failCall.mockResolvedValue({ ok: true, audioPath: "/tmp/x.m4a" });
  await processNextCall();
  expect(db.failCall).toHaveBeenCalledWith(ID, "정리하지 못했어요");
  expect(audio.removeCallAudio).toHaveBeenCalledWith("/tmp/x.m4a");
  db.claimNextCall.mockResolvedValue(null);
  expect(await processNextCall()).toBe(false);
});

it("글자로 받은 통화는 글자를 보내고, 닫기는 남은 녹음을 지운다", async () => {
  db.claimNextCall.mockResolvedValue({ ...claimed, source: "text", audioPath: null, transcript: "나: 여보세요" });
  ai.summarizeCall.mockResolvedValue({ ...answer, transcript: "" });
  db.finishCall.mockResolvedValue({ ok: true, audioPath: null });
  await processNextCall();
  expect(ai.summarizeCall).toHaveBeenCalledWith({ source: "text", text: "나: 여보세요", calledAt: claimed.calledAt });
  expect(db.finishCall.mock.calls[0]![1].transcript).toBe("나: 여보세요");
  db.discardCall.mockResolvedValue({ ok: true, audioPath: "/tmp/y.m4a" });
  await discardCall(who.email, ID);
  expect(audio.removeCallAudio).toHaveBeenLastCalledWith("/tmp/y.m4a");
  db.discardCall.mockResolvedValue({ ok: false, audioPath: null });
  await expect(discardCall(who.email, ID)).rejects.toMatchObject({ status: 409 });
});
