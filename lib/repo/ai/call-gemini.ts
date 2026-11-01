/**
 * Layer: repo — 통화 정리 AI(Gemini) 호출 한 번: 녹음(또는 글자) → 받아쓰기 + 질문별 답(JSON).
 * 키 GEMINI_API_KEY 는 VPS .env 에만 둔다(D1, 유료 등급). 키·통화 내용·응답 본문을 로그나 오류 문구에 넣지 않는다.
 * 무료 등급 키에는 실제 고객 통화를 보내지 않는다. 키가 없으면 「설정 안 됨」으로 멈추고 가짜 답을 만들지 않는다
 * — 가짜는 CALL_AI_FAKE=1 이고 운영이 아닐 때만(로컬 화면 확인용).
 */
import { callPrompt } from "./call-prompt";

export const CALL_AI_MODEL_DEFAULT = "gemini-3.1-flash-lite";
/** 녹음을 요청에 그대로 싣는 상한. base64 로 4/3 배가 되어도 Gemini 요청 한도(20MB) 안 — 0단계 익시오 42kbps 기준 약 45분. */
export const CALL_AUDIO_MAX_BYTES = 14 * 1024 * 1024;
const TIMEOUT_MS = 180_000;

export type CallAiInput =
  | { source: "audio"; audio: Uint8Array; mimeType: string; calledAt: string }
  | { source: "text"; text: string; calledAt: string };

export type CallAiResult = {
  transcript: string;
  /** AI 원답 그대로(질문별 said·evidence). 변환은 lib/service 가 한다. */
  raw: Record<string, unknown>;
  model: string;
  usage: { promptTokens: number; audioTokens: number; outputTokens: number };
};

/** retryable = 잠시 뒤 다시 하면 될 수 있는 오류(429·5xx·시간 초과). 메시지는 사용자에게 보여도 되는 짧은 말. */
export class CallAiError extends Error {
  constructor(message: string, readonly retryable: boolean) { super(message); }
}

type Fetch = typeof fetch;

export async function summarizeCall(input: CallAiInput, f: Fetch = fetch): Promise<CallAiResult> {
  if (process.env.CALL_AI_FAKE === "1" && process.env.NODE_ENV !== "production") return fakeResult(input);
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new CallAiError("AI 정리가 아직 설정되지 않았어요", false);
  if (input.source === "audio" && input.audio.byteLength > CALL_AUDIO_MAX_BYTES) throw new CallAiError("녹음 파일이 너무 커요", false);
  const model = process.env.CALL_AI_MODEL?.trim() || CALL_AI_MODEL_DEFAULT;
  const media = input.source === "audio"
    ? { inline_data: { mime_type: input.mimeType, data: Buffer.from(input.audio).toString("base64") } }
    : { text: `통화 글자:\n${input.text}` };
  let res: Response;
  try {
    res = await f(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: callPrompt(input.source, input.calledAt) }, media] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new CallAiError("AI 연결이 끊겼어요", true);
  }
  if (!res.ok) {
    const retry = res.status === 429 || res.status >= 500;
    throw new CallAiError(retry ? `AI 가 바빠요(${res.status})` : `AI 요청이 거절됐어요(${res.status})`, retry);
  }
  const body = await res.json() as GeminiResponse;
  const text = body.candidates?.[0]?.content?.parts?.map(p => p.text ?? "").join("") ?? "";
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new CallAiError("AI 답을 읽지 못했어요", true); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new CallAiError("AI 답을 읽지 못했어요", true);
  const obj = raw as Record<string, unknown>, u = body.usageMetadata ?? {};
  return {
    transcript: typeof obj.transcript === "string" ? obj.transcript : "",
    raw: obj, model,
    usage: {
      promptTokens: u.promptTokenCount ?? 0,
      audioTokens: (u.promptTokensDetails ?? []).filter(d => d.modality === "AUDIO").reduce((n, d) => n + (d.tokenCount ?? 0), 0),
      outputTokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
    },
  };
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: {
    promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number;
    promptTokensDetails?: { modality?: string; tokenCount?: number }[];
  };
};

/** 로컬 화면 확인용 가짜 답 — 합성 업체, 실제 사람·번호 없음. */
function fakeResult(input: CallAiInput): CallAiResult {
  const transcript = "나: 안녕하세요, 정책자금 상담 드리려고 연락드렸어요.\n상대: 네, 작년 매출은 12억 정도예요.\n나: 다음 주 화요일 두 시에 찾아뵐까요?\n상대: 네, 가게로 오세요.";
  return {
    transcript, model: "fake", usage: { promptTokens: 0, audioTokens: 0, outputTokens: 0 },
    raw: {
      transcript,
      q4_sales: [{ year_said: "작년", year: Number(input.calledAt.slice(0, 4)) - 1, amount_said: "12억", evidence: "상대: 네, 작년 매출은 12억 정도예요." }],
      meeting: { date_said: "다음 주 화요일", time_said: "두 시", place_said: "가게", evidence: "나: 다음 주 화요일 두 시에 찾아뵐까요?" },
      summary: ["작년 매출 12억", "다음 주 화요일 방문 약속"],
      memo: "작년 매출 12억. 다음 주 화요일 두 시 가게 방문.",
    },
  };
}
