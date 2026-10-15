/**
 * 화석 B2 (2026-10-15) — DB 정본 기수에서 "없음"은 정상 결과다. 그날 미팅 0건·자식 미팅 없음 때 시트를
 * 다시 훑지 않는다. 단건 id 조회의 시트 보충(이월 raw·레거시 공백 대비)은 남긴다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const sheet = {
  findByDate: vi.fn(async () => [{ id: "sheet-only" }]),
  findByPreviousMeetingId: vi.fn(async () => ({ id: "sheet-child" })),
  findById: vi.fn(async () => ({ id: "sheet-row" })),
};
const db = { readMeetingsFromDb: vi.fn(), readMeetingRowStateFromDb: vi.fn() };

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/repo/meetings", () => ({
  appendMeeting: vi.fn(), clearMeeting: vi.fn(), readAllMeetings: vi.fn(), updateMeeting: vi.fn(), upsertMeetingRowSnapshot: vi.fn(),
  findByDate: (...a: unknown[]) => sheet.findByDate(...(a as [])),
  findByPreviousMeetingId: (...a: unknown[]) => sheet.findByPreviousMeetingId(...(a as [])),
  findById: (...a: unknown[]) => sheet.findById(...(a as [])),
}));
vi.mock("@/repo/carryover", () => ({ upsertCarriedRawSnapshot: vi.fn() }));
vi.mock("@/repo/db/client", () => ({ clearRowInDb: vi.fn(), dbEnabled: () => true, writeRowToDb: vi.fn() }));
vi.mock("@/repo/db/mirror-pending", () => ({ clearMirrorPending: vi.fn(), listMirrorPending: vi.fn(async () => []), markMirrorPending: vi.fn() }));
vi.mock("@/repo/db/read-daily", () => ({
  readMeetingsFromDb: (...a: unknown[]) => db.readMeetingsFromDb(...(a as [])),
  readMeetingRowStateFromDb: (...a: unknown[]) => db.readMeetingRowStateFromDb(...(a as [])),
}));
vi.mock("@/lib/analytics/api-timing", () => ({ captureServerEvent: vi.fn() }));
vi.mock("@/service/gcal-sync", () => ({ onMeetingCreated: vi.fn(), reconcileMeetingEvent: vi.fn(), syncMeetingRemoved: vi.fn() }));

const { findMeetingsByDateRecord, findChildMeetingRecord, getMeetingRecord } = await import("@/service/meetings-write");
const PILOT = { spreadsheetId: "s", cohort: "8", email: "trainee@example.com" };

beforeEach(() => {
  vi.clearAllMocks();
  db.readMeetingsFromDb.mockResolvedValue([{ id: "m1", 미팅날짜: "2026-10-01", 예약일: "2026-09-30", previousMeetingId: "" }]);
});

describe("DB 정본 기수 — 없음은 없음", () => {
  it("그날 미팅 0건이면 시트를 훑지 않고 빈 목록", async () => {
    expect(await findMeetingsByDateRecord(PILOT, "2026-10-02")).toEqual([]);
    expect(sheet.findByDate).not.toHaveBeenCalled();
  });
  it("그날 미팅이 있으면 DB 결과", async () => {
    expect((await findMeetingsByDateRecord(PILOT, "2026-10-01")).map((m) => m.id)).toEqual(["m1"]);
  });
  it("자식 미팅이 없으면 시트를 훑지 않고 null", async () => {
    expect(await findChildMeetingRecord(PILOT, "m1")).toBeNull();
    expect(sheet.findByPreviousMeetingId).not.toHaveBeenCalled();
  });
  it("단건 id 조회는 DB 공백일 때 시트 보충을 유지(이월 raw·레거시)", async () => {
    db.readMeetingRowStateFromDb.mockResolvedValue(null);
    expect((await getMeetingRecord(PILOT, "x"))?.id).toBe("sheet-row");
  });
});

describe("비파일럿 기수 — 예전처럼 시트", () => {
  it("날짜 조회는 시트", async () => {
    await findMeetingsByDateRecord({ ...PILOT, cohort: "3" }, "2026-10-02");
    expect(sheet.findByDate).toHaveBeenCalled();
  });
});
