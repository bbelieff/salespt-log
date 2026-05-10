/**
 * NextAuth 5 root config — Google provider + 1년 슬라이드 세션.
 *
 * 사용자 결정 (docs/plans/active/login-prototype.md):
 *   - 영구 로그인: maxAge 1년 + updateAge 1일 (sliding window)
 *   - JWT strategy (DB 의존 없음)
 *   - 명시적 로그아웃 액션만 세션 종료
 *
 * 사용:
 *   - app/api/auth/[...nextauth]/route.ts  → handlers export
 *   - 모든 service/api  → import { auth } from "@/auth"
 */
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const ONE_DAY = 60 * 60 * 24;
const ONE_YEAR = ONE_DAY * 365;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // 동의 화면 매번 생략 (이미 승인된 사용자)
      authorization: { params: { prompt: "select_account" } },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: ONE_YEAR,    // 1년 — 사실상 영구 (매일 1회 방문 시 슬라이드 갱신)
    updateAge: ONE_DAY,
  },
  jwt: { maxAge: ONE_YEAR },
  pages: {
    signIn: "/login",   // 인트로 페이지 (로그인 화면 = login.html 프로토타입 → React)
  },
  callbacks: {
    /**
     * JWT 콜백 — 세션 토큰에 email 보존 (id_token decode 비용 제거).
     */
    async jwt({ token, user }) {
      if (user?.email) token.email = user.email;
      return token;
    },
    /**
     * Session 콜백 — 클라이언트가 useSession() 으로 받을 페이로드.
     */
    async session({ session, token }) {
      if (token.email) session.user = { ...session.user, email: token.email as string };
      return session;
    },
  },
});
