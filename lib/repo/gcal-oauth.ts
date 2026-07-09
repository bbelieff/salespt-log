/**
 * Layer: repo — 구글 캘린더 OAuth2 (ADR-0028). googleapis 격리 규칙 준수(repo 전용).
 *
 * 로그인(NextAuth)과 **분리된** opt-in OAuth: 최소 스코프 2개(calendar.events 쓰기 +
 * calendar.readonly 목록조회)로 per-user refresh token 획득. drive-client(ADR-0015)의
 * 사용자판 — 같은 google.auth.OAuth2 패턴.
 */
import { google } from "googleapis";
import { authConfig } from "@/config";

/** opt-in 동의 스코프 — 전체 calendar 금지, 최소 2개(ADR-0028 §2). */
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

/** 콜백 리디렉션 URI — AUTH_URL 기준(GCP 등록: https://salesptlog.online/api/gcal/callback). */
function redirectUri(): string {
  const base = (process.env.AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/gcal/callback`;
}

function oauthClient() {
  const { googleId, googleSecret } = authConfig();
  return new google.auth.OAuth2(googleId, googleSecret, redirectUri());
}

/** 동의 화면 URL. access_type=offline+prompt=consent 로 **refresh token 확보 보장**.
 *  state=CSRF 서명값(호출부 생성·검증). */
export function buildConsentUrl(state: string): string {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // 매번 refresh_token 재발급(재연결 시에도 확실히 획득)
    scope: SCOPES,
    state,
    include_granted_scopes: true,
  });
}

/** code → refresh token(+access). refresh token 없으면 throw(prompt=consent 로 항상 와야 정상). */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const { tokens } = await oauthClient().getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("[gcal-oauth] refresh_token 미수신 — 재동의 필요(access_type/prompt 확인)");
  }
  return tokens.refresh_token;
}

/** 구글에서 토큰 revoke(연결 해제 시 best-effort). 실패는 무해(무시). */
export async function revokeToken(refreshToken: string): Promise<void> {
  try {
    await oauthClient().revokeToken(refreshToken);
  } catch {
    /* 이미 만료·취소됨 — 무시(레지스트리에서 비우는 것이 정본 해제) */
  }
}

export interface WritableCalendar {
  id: string;
  summary: string; // 표시 이름
  primary: boolean;
}

/** 쓰기 가능 캘린더 목록(드롭다운용) — accessRole owner|writer 만. calendar.readonly 스코프 필요. */
export async function listWritableCalendars(refreshToken: string): Promise<WritableCalendar[]> {
  const auth = oauthClient();
  auth.setCredentials({ refresh_token: refreshToken });
  const cal = google.calendar({ version: "v3", auth });
  const res = await cal.calendarList.list({ minAccessRole: "writer", maxResults: 250 });
  return (res.data.items ?? [])
    .filter((c) => c.id)
    .map((c) => ({ id: c.id!, summary: c.summaryOverride || c.summary || c.id!, primary: !!c.primary }));
}
