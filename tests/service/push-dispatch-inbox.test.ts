/**
 * 비서 사서함 (web-push-notifications §16) — the morning push opens the saved summary, and people without
 * a device (or with notifications off) still get one. 저장소·발송·재료 로더는 모의. 합성 이메일·업체.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PUSH_PREFERENCES } from "@/types/push";

const store = {
  listCandidates: vi.fn(), claimDelivery: vi.fn(), finishDelivery: vi.fn(async () => {}), recentMessageIds: vi.fn(async () => []),
  listActiveSubscriptions: vi.fn(), recordSendResult: vi.fn(async () => {}), countDeliveries: vi.fn(async () => 0),
  getPreferences: vi.fn(async () => DEFAULT_PUSH_PREFERENCES), upsertSubscription: vi.fn(), getPreferencesOr: vi.fn(),
  listPreferences: vi.fn(async () => new Map()),
};
const inbox = {
  saveReport: vi.fn(async () => "22222222-2222-2222-2222-222222222222"), findReport: vi.fn(async () => null),
  reportsMadeOn: vi.fn(async () => new Set<string>()), deleteReportsBefore: vi.fn(async () => 0),
};
vi.mock("@/repo/db/push-inbox", () => inbox);
const sendPush = vi.fn();
vi.mock("@/repo/db/push", () => store);
vi.mock("@/repo/push-sender", () => ({ sendPush: (...a: unknown[]) => sendPush(...a), pushConfigured: () => true, vapidPublicKey: () => "pub" }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
const findUserByEmail = vi.fn();
const listAllUsers = vi.fn(async () => [] as unknown[]);
vi.mock("@/repo/users", () => ({ findUserByEmail: (...a: unknown[]) => findUserByEmail(...a), listAllUsers: () => listAllUsers() }));

const todo = { id: "t1", 업체명: "가나상사", 제목: "서류 보완 요청", 예정일자: "2026-10-20", 예정시각: "", 완료여부: false, type: "실무", 기록종류: "todo", contractRef: "2026-10-01|가나상사", institutionRef: "" };
const contract = { row: 3, 계약일: "2026-10-01", 업체명: "가나상사", 수납1: { 진행기관: "", 진행상품: "" }, 수납2: {}, 수납3: {} };
let todos: unknown[] = [];
let contracts: unknown[] = [];
vi.mock("@/service/contract-payment", () => ({ loadContractPayments: async () => contracts }));
vi.mock("@/service/todos", () => ({ listAllTodos: async () => todos }));
let meetings: unknown[] = [];
vi.mock("@/service/meeting-follow-ups", () => ({ loadFollowUpMeetings: async () => meetings }));
let leads: unknown[] | null = null;
vi.mock("@/service/db-sheet", () => ({ resolveDbSheetContext: async () => { if (!leads) throw new Error("no db sheet"); return {}; }, loadDbSheet: async () => leads }));
// The real rule decides which todos count; keep the classification simple for the fixture.
vi.mock("@/lib/analytics/payment-work-status", () => ({ activeWorkContracts: (cs: unknown[]) => cs, classifyWorkStatus: () => "working", isSlotClosed: () => false, slotHasData: () => false }));

const { dispatchDuePush } = await import("@/service/push");
const AT_0845 = new Date("2026-10-22T23:45:00Z"); // Fri 08:45 KST
const trainee = (email: string, status = "active") => ({ email, role: "trainee", status });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PUSH_PILOT_EMAILS = "pilot@example.com";
  delete process.env.PUSH_ENABLED;
  delete process.env.PUSH_AUDIENCE;
  todos = [todo];
  contracts = [contract];
  meetings = [];
  leads = null;
  store.listCandidates.mockResolvedValue([{ email: "pilot@example.com", prefs: DEFAULT_PUSH_PREFERENCES }]);
  store.claimDelivery.mockResolvedValue("11111111-1111-1111-1111-111111111111");
  store.listActiveSubscriptions.mockResolvedValue([{ id: "s1", endpoint: "https://push.example/a", p256dh: "k", auth: "a" }]);
  sendPush.mockResolvedValue({ ok: true });
});

describe("비서 사서함 in the dispatch tick", () => {
  it("saves the morning summary and the push opens it", async () => {
    await dispatchDuePush(AT_0845);
    const saved = inbox.saveReport.mock.calls[0] as unknown as [string, { slot: string; headline: string }, number];
    expect(saved[0]).toBe("pilot@example.com");
    expect(saved[1].slot).toBe("morning");
    const payload = sendPush.mock.calls[0]![1] as { title: string; body: string; url: string };
    expect(payload.title).toBe("비서의 아침 요약이 도착했어요");
    expect(payload.body).toBe(saved[1].headline.split(". ")[1]);
    expect(payload.url).toMatch(/^\/inbox\/22222222-2222-2222-2222-222222222222\?/);
  });
  it("falls back to the old message when the summary cannot be saved", async () => {
    inbox.saveReport.mockRejectedValueOnce(new Error("db down"));
    await dispatchDuePush(AT_0845);
    const payload = sendPush.mock.calls[0]![1] as { title: string; body: string };
    expect(payload.title).toBe("경영일지");
    expect(payload.body).toContain("가나상사");
  });
  it("makes summaries for trainees without a device or with notifications off, skipping pending and done ones", async () => {
    process.env.PUSH_AUDIENCE = "all";
    listAllUsers.mockResolvedValue([trainee("pilot@example.com"), trainee("off@example.com"), trainee("new@example.com", "pending"), { email: "t@example.com", role: "trainer", status: "active" }]);
    inbox.reportsMadeOn.mockResolvedValue(new Set(["pilot@example.com:morning"]));
    store.listPreferences.mockResolvedValue(new Map([["off@example.com", { ...DEFAULT_PUSH_PREFERENCES, enabled: false }]]));
    const stats = await dispatchDuePush(AT_0845);
    const people = inbox.saveReport.mock.calls.map(c => (c as unknown as [string])[0]);
    expect(people).toEqual(["pilot@example.com", "off@example.com"]); // the push run, then the inbox-only run
    expect(stats).toMatchObject({ reports: 1, reportsFailed: 0, reportsLeft: 0 });
    expect(inbox.deleteReportsBefore).toHaveBeenCalledWith("2026-07-25");
  });
});
