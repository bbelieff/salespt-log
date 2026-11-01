/** 통화 정리 AI 호출 — 실제 네트워크 없이 가짜 fetch 로. 키는 헤더로만 가고, 오류 문구에 키·본문이 실리지 않는다. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CALL_AUDIO_MAX_BYTES, CallAiError, summarizeCall } from "@/repo/ai/call-gemini";
import { callPrompt } from "@/repo/ai/call-prompt";

const KEY = "test-key-not-real";
const env = { ...process.env };
beforeEach(() => { process.env.GEMINI_API_KEY = KEY; delete process.env.CALL_AI_MODEL; delete process.env.CALL_AI_FAKE; });
afterEach(() => { process.env = { ...env }; });

const answer = { transcript: "나: 안녕하세요\n상대: 작년 매출 12억이요", q4_sales: [{ year_said: "작년", year: 2025, amount_said: "12억", evidence: "상대: 작년 매출 12억이요" }] };
const ok = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
const gemini = (text: string) => ({
  candidates: [{ content: { parts: [{ text }] } }],
  usageMetadata: { promptTokenCount: 6258, candidatesTokenCount: 2269, promptTokensDetails: [{ modality: "AUDIO", tokenCount: 4881 }, { modality: "TEXT", tokenCount: 1377 }] },
});
const audioIn = { source: "audio" as const, audio: new Uint8Array([1, 2, 3]), mimeType: "audio/mp4", calledAt: "2026-11-01T05:02:00Z" };

it("녹음을 지시문과 함께 보내고 받아쓰기·원답·토큰을 돌려준다", async () => {
  const f = ok(gemini(JSON.stringify(answer)));
  const r = await summarizeCall(audioIn, f as never);
  const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent");
  expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe(KEY);
  expect(url).not.toContain(KEY);
  const parts = JSON.parse(String(init.body)).contents[0].parts;
  expect(parts[0].text).toContain("입력은 통화 녹음입니다.");
  expect(parts[0].text).toContain("통화 일시: 2026-11-01 14:02 (일요일)");
  expect(parts[1].inline_data).toEqual({ mime_type: "audio/mp4", data: "AQID" });
  expect(r).toEqual({ transcript: answer.transcript, raw: answer, model: "gemini-3.1-flash-lite", usage: { promptTokens: 6258, audioTokens: 4881, outputTokens: 2269 } });
});

it("글자로 받은 통화는 글자로 보낸다, 모델은 바꿀 수 있다", async () => {
  process.env.CALL_AI_MODEL = "gemini-other";
  const f = ok(gemini(JSON.stringify(answer)));
  await summarizeCall({ source: "text", text: "나: 여보세요", calledAt: "2026-11-01T05:02:00Z" }, f as never);
  const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toContain("/models/gemini-other:generateContent");
  const parts = JSON.parse(String(init.body)).contents[0].parts;
  expect(parts[0].text).toContain("입력은 통화 녹음 앱이 만든 통화 글자(받아쓰기)입니다.");
  expect(parts[1]).toEqual({ text: "통화 글자:\n나: 여보세요" });
});

it("키가 없으면 보내지 않고 멈춘다(가짜 답을 만들지 않음)", async () => {
  delete process.env.GEMINI_API_KEY;
  const f = ok({});
  await expect(summarizeCall(audioIn, f as never)).rejects.toMatchObject({ retryable: false, message: "AI 정리가 아직 설정되지 않았어요" });
  expect(f).not.toHaveBeenCalled();
});

it("너무 큰 녹음은 보내지 않는다", async () => {
  const f = ok({});
  await expect(summarizeCall({ ...audioIn, audio: new Uint8Array(CALL_AUDIO_MAX_BYTES + 1) }, f as never)).rejects.toMatchObject({ retryable: false });
  expect(f).not.toHaveBeenCalled();
});

it("429·5xx·연결 끊김은 다시 할 수 있고, 400 은 아니다 — 문구에 키·본문이 없다", async () => {
  for (const [status, retryable] of [[429, true], [503, true], [400, false]] as const) {
    const f = vi.fn(async () => new Response(`{"error":"${KEY} 비밀 본문"}`, { status }));
    const e = await summarizeCall(audioIn, f as never).catch(x => x) as CallAiError;
    expect(e).toBeInstanceOf(CallAiError);
    expect(e.retryable).toBe(retryable);
    expect(e.message).not.toContain(KEY);
    expect(e.message).not.toContain("비밀");
  }
  const down = vi.fn(async () => { throw new TypeError("fetch failed"); });
  await expect(summarizeCall(audioIn, down as never)).rejects.toMatchObject({ retryable: true });
});

it("JSON 이 아닌 답은 다시 해 볼 오류", async () => {
  await expect(summarizeCall(audioIn, ok(gemini("죄송합니다")) as never)).rejects.toMatchObject({ retryable: true });
  await expect(summarizeCall(audioIn, ok(gemini("[1,2]")) as never)).rejects.toMatchObject({ retryable: true });
});

it("가짜 답은 CALL_AI_FAKE=1 이고 운영이 아닐 때만", async () => {
  process.env.CALL_AI_FAKE = "1";
  const f = ok({});
  expect((await summarizeCall(audioIn, f as never)).model).toBe("fake");
  expect(f).not.toHaveBeenCalled();
  vi.stubEnv("NODE_ENV", "production");
  await summarizeCall(audioIn, ok(gemini(JSON.stringify(answer))) as never).then(r => expect(r.model).not.toBe("fake"));
  vi.unstubAllEnvs();
});

it("지시문은 집 주소·주민번호를 적지 말라고 한다", () => {
  expect(callPrompt("audio", "2026-11-01T05:02:00Z")).toContain("집 주소, 주민등록번호, 계좌·비밀번호는 어떤 칸에도 적지 않습니다.");
});
