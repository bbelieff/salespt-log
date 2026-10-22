/**
 * web-push-notifications §5·§8 T5~T8 — 시범 대상만, 한 번만, 0건이면 안 보냄, 만료 기기 정리.
 * 저장소·발송·재료 로더는 모의. 합성 이메일·업체.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PUSH_PREFERENCES } from "@/types/push";

const store = {
  listCandidates: vi.fn(), claimDelivery: vi.fn(), finishDelivery: vi.fn(async () => {}), recentMessageIds: vi.fn(async () => []),
  listActiveSubscriptions: vi.fn(), recordSendResult: vi.fn(async () => {}), countDeliveries: vi.fn(async () => 0),
  getPreferences: vi.fn(async () => DEFAULT_PUSH_PREFERENCES), upsertSubscription: vi.fn(), getPreferencesOr: vi.fn(),
};
const sendPush = vi.fn();
vi.mock("@/repo/db/push", () => store);
vi.mock("@/repo/push-sender", () => ({ sendPush: (...a: unknown[]) => sendPush(...a), pushConfigured: () => true, vapidPublicKey: () => "pub" }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

const todo = { id: "t1", 업체명: "가나상사", 제목: "서류 보완 요청", 예정일자: "2026-10-20", 예정시각: "", 완료여부: false, type: "실무", 기록종류: "todo", contractRef: "2026-10-01|가나상사", institutionRef: "" };
const contract = { row: 3, 계약일: "2026-10-01", 업체명: "가나상사", 수납1: { 진행기관: "", 진행상품: "" }, 수납2: {}, 수납3: {} };
let todos: unknown[] = [];
let contracts: unknown[] = [];
vi.mock("@/service/contract-payment", () => ({ loadContractPayments: async () => contracts }));
vi.mock("@/service/todos", () => ({ listAllTodos: async () => todos }));
vi.mock("@/service/meeting-follow-ups", () => ({ loadFollowUpMeetings: async () => [] }));
vi.mock("@/service/db-sheet", () => ({ resolveDbSheetContext: async () => { throw new Error("no db sheet"); }, loadDbSheet: async () => [] }));
// The real rule decides which todos count; keep the classification simple for the fixture.
vi.mock("@/lib/analytics/payment-work-status", () => ({ activeWorkContracts: (cs: unknown[]) => cs, classifyWorkStatus: () => "working", slotHasData: () => false }));

const { dispatchDuePush, sendTestPush } = await import("@/service/push");
const AT_0845 = new Date("2026-10-22T23:45:00Z"); // Fri 08:45 KST

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PUSH_PILOT_EMAILS = "pilot@example.com";
  delete process.env.PUSH_ENABLED;
  todos = [todo];
  contracts = [contract];
  store.listCandidates.mockResolvedValue([{ email: "pilot@example.com", prefs: DEFAULT_PUSH_PREFERENCES }]);
  store.claimDelivery.mockResolvedValue("11111111-1111-1111-1111-111111111111");
  store.listActiveSubscriptions.mockResolvedValue([{ id: "s1", endpoint: "https://push.example/a", p256dh: "k", auth: "a" }, { id: "s2", endpoint: "https://push.example/b", p256dh: "k", auth: "a" }]);
  sendPush.mockResolvedValue({ ok: true });
});

describe("dispatchDuePush", () => {
  it("asks only for allow-listed pilot users and sends the morning message to every device", async () => {
    const stats = await dispatchDuePush(AT_0845);
    expect(store.listCandidates).toHaveBeenCalledWith(["pilot@example.com"]);
    expect(store.claimDelivery).toHaveBeenCalledWith("pilot@example.com:2026-10-23:morning", "pilot@example.com", "morning", "2026-10-23");
    expect(sendPush).toHaveBeenCalledTimes(2);
    const payload = sendPush.mock.calls[0]![1] as { body: string; url: string };
    expect(payload.body).toContain("가나상사");
    expect(payload.url).toContain("from=push&d=11111111-1111-1111-1111-111111111111");
    expect(sendPush.mock.calls[0]![2]).toEqual({ ttlSeconds: 14400, topic: "morning" });
    expect(stats).toMatchObject({ sent: 1, candidates: 1 });
  });
  it("sends nothing at all on a zero day (no silent push)", async () => {
    todos = [];
    contracts = [];
    const stats = await dispatchDuePush(AT_0845);
    expect(sendPush).not.toHaveBeenCalled();
    expect(store.finishDelivery).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ status: "skipped_zero" }));
    expect(stats.skippedZero).toBe(1);
  });
  it("a second run in the same slot finds the claim taken and sends nothing", async () => {
    store.claimDelivery.mockResolvedValue(null);
    const stats = await dispatchDuePush(AT_0845);
    expect(sendPush).not.toHaveBeenCalled();
    expect(stats.duplicate).toBe(1);
  });
  it("records a gone endpoint so the device is disabled", async () => {
    sendPush.mockResolvedValueOnce({ ok: false, gone: true, status: 410, fatal: false });
    await dispatchDuePush(AT_0845);
    expect(store.recordSendResult).toHaveBeenCalledWith("s1", false, true);
    expect(store.recordSendResult).toHaveBeenCalledWith("s2", true, false);
  });
  it("does nothing outside the person's time or with the kill switch", async () => {
    await dispatchDuePush(new Date("2026-10-23T00:00:00Z")); // 09:00 KST
    expect(store.claimDelivery).not.toHaveBeenCalled();
    store.listCandidates.mockClear();
    process.env.PUSH_ENABLED = "0";
    await dispatchDuePush(AT_0845);
    expect(store.listCandidates).not.toHaveBeenCalled();
  });
});

describe("sendTestPush", () => {
  it("refuses non-pilot users and caps at 3 per day", async () => {
    await expect(sendTestPush("someone@example.com", AT_0845)).rejects.toThrow("push_not_available");
    store.countDeliveries.mockResolvedValueOnce(3);
    expect(await sendTestPush("pilot@example.com", AT_0845)).toEqual({ ok: false, reason: "limit" });
  });
  it("tells the person when the next notification comes", async () => {
    expect(await sendTestPush("pilot@example.com", AT_0845)).toEqual({ ok: true, devices: 2 });
    expect((sendPush.mock.calls[0]![1] as { body: string }).body).toBe("알림이 잘 와요. 다음 알림은 오늘 18:00에 보내 드릴게요.");
  });
});
