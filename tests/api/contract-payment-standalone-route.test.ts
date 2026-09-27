/**
 * POST /api/contract-payment/standalone — 「영업기록 없이 업체추가」 라우트 계약(서비스 목).
 * 인증 401 · 입력검증 400 · 성공 200{row} · 서비스 실패 500.
 * 403 경로는 없다 — prior 라우트와 같은 권한(getWritableUserEmail, 임퍼스네이션 대상에 쓰기)을 쓴다.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  session: vi.fn(),
  writable: vi.fn(),
  add: vi.fn(),
}));
vi.mock("@/auth/identity", () => ({ getSessionEmail: api.session, getWritableUserEmail: api.writable }));
vi.mock("@/service", () => ({ addStandaloneContract: api.add }));
vi.mock("@/lib/analytics/api-timing", () => ({
  withApiTiming: (_label: string, handler: unknown) => handler,
}));

import { POST } from "@/app/api/contract-payment/standalone/route";

const KEY = "11111111-1111-4111-8111-111111111111";
const OK = { 계약일: "2026-09-10", 업체명: "예시상사", 수임비: 3_000_000, requestKey: KEY };

function req(body: unknown) {
  return new NextRequest("http://localhost/api/contract-payment/standalone", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
async function out(r: Response) {
  return { status: r.status, body: await r.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.session.mockResolvedValue("hong@example.com");
  api.writable.mockResolvedValue("hong@example.com");
  api.add.mockResolvedValue({ row: 12 });
});

describe("POST /api/contract-payment/standalone", () => {
  it("로그인 안 됨 → 401, 서비스 호출 없음", async () => {
    api.session.mockResolvedValue(null);
    const r = await out(await POST(req(OK)));
    expect(r.status).toBe(401);
    expect(r.body.error).toBe("unauthenticated");
    expect(api.add).not.toHaveBeenCalled();
  });

  it.each([
    ["업체명 공백", { ...OK, 업체명: "   " }],
    ["업체명 100자 초과", { ...OK, 업체명: "가".repeat(101) }],
    ["계약일 형식", { ...OK, 계약일: "2026/09/10" }],
    ["수임비 음수", { ...OK, 수임비: -1 }],
    ["수임비 소수", { ...OK, 수임비: 1.5 }],
    ["수임비 문자열", { ...OK, 수임비: "1000" }],
    ["requestKey 누락", { ...OK, requestKey: undefined }],
    ["requestKey uuid 아님", { ...OK, requestKey: "abc" }],
  ])("%s → 400", async (_n, body) => {
    const r = await out(await POST(req(body)));
    expect(r.status).toBe(400);
    expect(typeof r.body.error).toBe("string");
    expect(api.add).not.toHaveBeenCalled();
  });

  it("JSON 아님 → 400", async () => {
    const r = await out(await POST(req("{not json")));
    expect(r.status).toBe(400);
  });

  it("성공 → 200 {ok,row}, 업체명은 trim 해서 서비스로", async () => {
    const r = await out(await POST(req({ ...OK, 업체명: "  예시상사  " })));
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, row: 12 });
    expect(api.add).toHaveBeenCalledWith("hong@example.com", { ...OK, 업체명: "예시상사" });
  });

  it("수임비 0 허용", async () => {
    const r = await out(await POST(req({ ...OK, 수임비: 0 })));
    expect(r.status).toBe(200);
  });

  it("서비스 실패 → 500 {error}", async () => {
    api.add.mockRejectedValue(new Error("시트 오류"));
    const r = await out(await POST(req(OK)));
    expect(r.status).toBe(500);
    expect(r.body.error).toBe("시트 오류");
  });
});
