/** 보관함 열림표 쿠키 — 30분짜리, 자바스크립트에서 못 읽게(httpOnly). */
import type { NextRequest, NextResponse } from "next/server";
import { VAULT_UNLOCK_MS } from "@/types/company-vault";
import { VaultError } from "@/service/company-vault";

export const VAULT_COOKIE = "salespt_vault";

export function readTicket(req: NextRequest): string | undefined {
  return req.cookies.get(VAULT_COOKIE)?.value;
}

export function writeTicket(res: NextResponse, ticket: string | null): NextResponse {
  if (ticket === null) return res;
  res.cookies.set(VAULT_COOKIE, ticket, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(VAULT_UNLOCK_MS / 1000),
  });
  return res;
}

export function clearTicket(res: NextResponse): NextResponse {
  res.cookies.set(VAULT_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}

/** 서비스 오류는 쉬운 문구 그대로, 그 밖은 일반 문구로. */
export function vaultErrorBody(e: unknown): { status: number; error: string } {
  if (e instanceof VaultError) return { status: e.status, error: e.message };
  console.error("[vault] 처리 실패", e instanceof Error ? e.name : "unknown");
  return { status: 500, error: "보관함을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요." };
}
