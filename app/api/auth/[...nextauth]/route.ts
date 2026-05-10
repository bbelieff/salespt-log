/**
 * NextAuth 5 라우트 핸들러 — auth.ts 에서 만든 handlers unwrap.
 *
 * GET/POST /api/auth/* (callback, signin, signout, csrf, session, ...)
 */
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
