/** 오류신고 API — 본문이 상한을 넘으면 다 읽기 전에 413(서버 메모리 보호), 정상 크기는 접수. 합성 데이터. */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth/identity", () => ({ getSessionEmail: vi.fn(async () => "u@example.test") }));
const submit = vi.fn(async () => ({ id: "id-1" }));
vi.mock("@/service/bug-reports", () => ({ submitBugReport: submit, BugReportLimit: class extends Error {} }));

const { POST } = await import("@/app/api/bug-reports/route");
const { BUG_REPORT_BODY_MAX } = await import("@/types/bug-report");

/** content-length 없이 조각으로 보내는 요청(스트림). */
function streamed(bytes: number, chunk = 256_000): Request {
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(ctrl) {
      if (sent >= bytes) return ctrl.close();
      const n = Math.min(chunk, bytes - sent);
      sent += n;
      ctrl.enqueue(new Uint8Array(n).fill(97));
    },
  });
  return new Request("http://x/api/bug-reports", { method: "POST", body, duplex: "half" } as RequestInit);
}

beforeEach(() => submit.mockClear());

describe("POST /api/bug-reports 본문 상한", () => {
  it("content-length 가 상한을 넘으면 읽지 않고 413", async () => {
    const req = new Request("http://x/api/bug-reports", { method: "POST", headers: { "content-length": String(BUG_REPORT_BODY_MAX + 1) }, body: "{}" });
    expect((await POST(req)).status).toBe(413);
    expect(submit).not.toHaveBeenCalled();
  });
  it("길이를 안 밝힌 스트림도 상한을 넘는 순간 413", async () => {
    expect((await POST(streamed(BUG_REPORT_BODY_MAX + 300_000))).status).toBe(413);
    expect(submit).not.toHaveBeenCalled();
  });
  it("정상 크기 신고는 접수(201)하고 본문을 그대로 넘긴다", async () => {
    const payload = { category: "기타", text: "합성", image: "data:image/jpeg;base64," + "A".repeat(2_900_000) };
    const res = await POST(new Request("http://x/api/bug-reports", { method: "POST", body: JSON.stringify(payload) }));
    expect(res.status).toBe(201);
    expect(submit).toHaveBeenCalledWith("u@example.test", payload);
  });
});
