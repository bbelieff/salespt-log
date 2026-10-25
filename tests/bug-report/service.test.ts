/** 오류신고 접수 — 입력 검사 · 하루 상한 · 저장 내용 · 관리자 알림(실패해도 접수). */
import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn(async () => "id-1");
const count = vi.fn(async () => 0);
const send = vi.fn(async (..._args: unknown[]) => ({ ok: true }));
vi.mock("@/repo/db/bug-reports", () => ({ insertBugReport: insert, countRecentBugReports: count }));
vi.mock("@/repo/users", () => ({ findUserByEmail: vi.fn(async () => ({ name: "가상", cohort: "11" })) }));
vi.mock("@/repo/db/push", () => ({ listActiveSubscriptions: vi.fn(async () => [{ id: "s1", endpoint: "e", p256dh: "p", auth: "a" }]), recordSendResult: vi.fn(async () => undefined) }));
vi.mock("@/repo/push-sender", () => ({ pushConfigured: () => true, sendPush: send }));
vi.mock("@/config", () => ({ adminEmails: () => ["admin@example.test"] }));

const { submitBugReport, BugReportLimit, BUG_REPORT_DAILY_LIMIT } = await import("@/service/bug-reports");
const { BugReportInput } = await import("@/types/bug-report");

beforeEach(() => { insert.mockClear(); count.mockReset(); count.mockResolvedValue(0); send.mockClear(); });

describe("BugReportInput", () => {
  it("문제 종류가 없거나 목록 밖이면 거절", () => {
    expect(BugReportInput.safeParse({}).success).toBe(false);
    expect(BugReportInput.safeParse({ category: "아무거나" }).success).toBe(false);
  });
  it("그림은 data URL(JPEG/PNG)만, 빈 값은 허용", () => {
    expect(BugReportInput.safeParse({ category: "기타", image: "https://x/y.png" }).success).toBe(false);
    expect(BugReportInput.safeParse({ category: "기타", image: "data:image/jpeg;base64,AAAA" }).success).toBe(true);
    expect(BugReportInput.parse({ category: "기타" }).image).toBe("");
  });
});

describe("submitBugReport", () => {
  it("이름·기수와 함께 저장하고 관리자에게 알린다", async () => {
    await expect(submitBugReport("u@example.test", { category: "저장이 안 돼요", text: "  안 돼요 ", context: { path: "/payment", title: "실무/수납" } })).resolves.toEqual({ id: "id-1" });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ email: "u@example.test", name: "가상", cohort: "11", category: "저장이 안 돼요", body: "안 돼요" }));
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send.mock.calls[0]?.[1]).toMatchObject({ title: "🐞 오류신고 · 11기 가상 · 저장이 안 돼요", body: "화면: 실무/수납" });
  });
  it("하루 상한을 넘으면 저장하지 않는다", async () => {
    count.mockResolvedValue(BUG_REPORT_DAILY_LIMIT);
    await expect(submitBugReport("u@example.test", { category: "기타" })).rejects.toBeInstanceOf(BugReportLimit);
    expect(insert).not.toHaveBeenCalled();
  });
  it("알림이 실패해도 접수는 성공한다", async () => {
    send.mockRejectedValueOnce(new Error("push down"));
    await expect(submitBugReport("u@example.test", { category: "기타" })).resolves.toEqual({ id: "id-1" });
  });
});
