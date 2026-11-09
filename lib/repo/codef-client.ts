/**
 * Layer: repo. CODEF(헥토데이터) API 호출 격리 — 토큰 발급·요청 인코딩·비밀번호 RSA 암호화.
 *
 * - 키는 VPS .env 에만: CODEF_CLIENT_ID · CODEF_CLIENT_SECRET · CODEF_PUBLIC_KEY(키 관리 화면의 publicKey).
 *   CODEF_HOST 기본 = 데모 서버(https://development.codef.io). 정식 키로 바꾸면 https://api.codef.io.
 * - 요청 본문은 JSON 을 URL 인코딩해 보내고, 응답도 URL 인코딩돼 온다(CODEF 규격, 2026-11-08 실측).
 * - 키·요청 본문·응답 원문은 로그에 남기지 않는다.
 */
import { constants, publicEncrypt } from "node:crypto";

export class CodefNotConfigured extends Error {
  constructor() { super("간편인증 서류 조회가 아직 설정되지 않았어요."); }
}
export class CodefNetworkError extends Error {}

export type CodefResult = { code: string; message: string; extraMessage: string; data: unknown; extra?: unknown };

export function codefConfigured(): boolean {
  return !!(process.env.CODEF_CLIENT_ID?.trim() && process.env.CODEF_CLIENT_SECRET?.trim() && process.env.CODEF_PUBLIC_KEY?.trim());
}
const host = () => (process.env.CODEF_HOST?.trim() || "https://development.codef.io").replace(/\/$/, "");

let token: { value: string; until: number } | null = null;

async function getToken(f: typeof fetch): Promise<string> {
  if (token && token.until > Date.now() + 60_000) return token.value;
  const id = process.env.CODEF_CLIENT_ID?.trim(), secret = process.env.CODEF_CLIENT_SECRET?.trim();
  if (!id || !secret) throw new CodefNotConfigured();
  let res: Response;
  try {
    res = await f("https://oauth.codef.io/oauth/token", {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials&scope=read",
      signal: AbortSignal.timeout(15_000),
    });
  } catch { throw new CodefNetworkError("CODEF 연결이 끊겼어요."); }
  if (!res.ok) throw new CodefNetworkError(`CODEF 인증에 실패했어요(${res.status}).`);
  const j = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) throw new CodefNetworkError("CODEF 인증 응답이 비어 있어요.");
  token = { value: j.access_token, until: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return token.value;
}

/** 테스트 전용 — 캐시한 토큰을 비운다. */
export function resetCodefToken() { token = null; }

/**
 * 상품 하나 호출. 간편인증 대기 중인 요청은 고객 승인까지 응답이 오지 않을 수 있어(같은 id 묶음) 제한시간을 길게 둔다.
 * 반환은 CODEF result 코드 그대로 — CF-00000 성공, CF-03002 추가인증(간편인증 승인 대기) 등은 서비스가 해석한다.
 */
export async function codefCall(path: string, params: Record<string, unknown>, opts: { timeoutMs?: number; f?: typeof fetch } = {}): Promise<CodefResult> {
  const f = opts.f ?? fetch;
  const t = await getToken(f);
  let res: Response;
  try {
    res = await f(host() + path, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: encodeURIComponent(JSON.stringify(params)),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 330_000),
    });
  } catch { throw new CodefNetworkError("CODEF 응답이 오지 않았어요."); }
  if (res.status === 401) { token = null; throw new CodefNetworkError("CODEF 인증이 만료됐어요. 다시 보내 주세요."); }
  if (!res.ok) throw new CodefNetworkError(`CODEF 오류(${res.status})`);
  const text = await res.text();
  let j: { result?: { code?: string; message?: string; extraMessage?: string }; data?: unknown; extraInfo?: unknown };
  try { j = JSON.parse(decodeURIComponent(text.replace(/\+/g, " "))); } catch { throw new CodefNetworkError("CODEF 응답을 읽지 못했어요."); }
  return { code: j.result?.code ?? "", message: j.result?.message ?? "", extraMessage: j.result?.extraMessage ?? "", data: j.data, extra: j.extraInfo };
}

/** 인증서 비밀번호·주민번호를 CODEF publicKey 로 RSA(PKCS#1 v1.5) 암호화한 base64. */
export function codefEncrypt(plain: string): string {
  const raw = process.env.CODEF_PUBLIC_KEY?.trim();
  if (!raw) throw new CodefNotConfigured();
  const pem = raw.includes("BEGIN") ? raw : `-----BEGIN PUBLIC KEY-----\n${raw.match(/.{1,64}/g)!.join("\n")}\n-----END PUBLIC KEY-----`;
  return publicEncrypt({ key: pem, padding: constants.RSA_PKCS1_PADDING }, Buffer.from(plain, "utf8")).toString("base64");
}
