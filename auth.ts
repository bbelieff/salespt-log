/**
 * NextAuth 5 root config — Google provider + 1년 슬라이드 세션.
 *
 * 사용자 결정 (docs/plans/active/login-prototype.md):
 *   - 영구 로그인: maxAge 1년 + updateAge 1일 (sliding window)
 *   - JWT strategy (DB 의존 없음)
 *   - 명시적 로그아웃 액션만 세션 종료
 *
 * OAuth Scope 확장 (2026-05-12):
 *   - `drive` — admin 이 prep row 등록 시 사용자 access_token 으로 그 시트에
 *     Service Account 공유 권한을 자동 추가하기 위해 필요.
 *   - 시트 owner / editor 인 사용자만 해당 호출 성공. 일반 수강생은 read 권한만
 *     필요하지만 동일 scope 유지 (간소화).
 *
 * Token Persistence:
 *   - account.access_token / refresh_token / expires_at 을 jwt 에 저장.
 *   - 만료 시 자동 refresh (refreshGoogleToken).
 *   - session 에 accessToken 노출 → 서버 액션이 사용.
 *
 * 사용:
 *   - app/api/auth/[...nextauth]/route.ts  → handlers export
 *   - 모든 service/api  → import { auth } from "@/auth"
 */
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const ONE_DAY = 60 * 60 * 24;
const ONE_YEAR = ONE_DAY * 365;

/** Google OAuth refresh — access_token 만료 시 호출. */
async function refreshGoogleToken(refreshToken: string): Promise<{
  access_token: string;
  expires_at: number;
} | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AUTH_GOOGLE_ID ?? "",
        client_secret: process.env.AUTH_GOOGLE_SECRET ?? "",
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!data.access_token || !data.expires_in) return null;
    return {
      access_token: data.access_token,
      expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
    };
  } catch (e) {
    console.warn("[auth] refreshGoogleToken 실패:", e instanceof Error ? e.message : e);
    return null;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          // drive scope: prep row 등록 시 SA 자동 공유에 필요.
          // access_type=offline + prompt=consent — refresh_token 발급 보장.
          scope:
            "openid email profile https://www.googleapis.com/auth/drive",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: ONE_YEAR,
    updateAge: ONE_DAY,
  },
  jwt: { maxAge: ONE_YEAR },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    /**
     * JWT 콜백 — email + OAuth token 보존.
     * 만료된 access_token 은 자동 refresh.
     */
    async jwt({ token, user, account }) {
      if (user?.email) token.email = user.email;
      // 첫 로그인 시 token 저장.
      if (account) {
        token.accessToken = account.access_token as string | undefined;
        token.refreshToken = account.refresh_token as string | undefined;
        token.expiresAt = account.expires_at as number | undefined;
      }
      // 만료 1분 전 refresh.
      const exp = token.expiresAt as number | undefined;
      if (exp && Date.now() >= (exp - 60) * 1000 && token.refreshToken) {
        const refreshed = await refreshGoogleToken(token.refreshToken as string);
        if (refreshed) {
          token.accessToken = refreshed.access_token;
          token.expiresAt = refreshed.expires_at;
        }
      }
      return token;
    },
    /**
     * Session 콜백 — 클라이언트가 useSession() 으로 받을 페이로드.
     * accessToken 은 서버 액션에서 auth().then((s) => s?.accessToken) 으로 접근.
     */
    async session({ session, token }) {
      if (token.email) session.user = { ...session.user, email: token.email as string };
      // accessToken 은 서버 전용 (any cast — next-auth 타입 확장 회피).
      (session as unknown as { accessToken?: string }).accessToken =
        token.accessToken as string | undefined;
      return session;
    },
  },
});
