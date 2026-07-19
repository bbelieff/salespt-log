/**
 * R3-2 meetings 쓰기 정본 + mirror_pending 안전망(§2.2·§7-3) 회귀.
 * meetings 도 todos·sales 와 동일한 per-row 수렴 미러(queueMeetingSheetSync→runSheetSync) —
 * 미러 최종 실패 → 응답 성공 + markMirrorPending(tab=meetings), 성공 → clear, 다음 쓰기가 drain self-heal.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Meeting } from "@/types";

const dbEnabled = vi.fn(() => true);
const writeRowToDb = vi.fn();
const clearRowInDb = vi.fn();
const readMeetingRowStateFromDb = vi.fn();
const readMeetingsFromDb = vi.fn();
const appendMeeting = vi.fn();
const clearMeeting = vi.fn();
const updateMeeting = vi.fn();
const upsertMeetingRowSnapshot = vi.fn();
const findById = vi.fn();
const findByDate = vi.fn();
const findByPreviousMeetingId = vi.fn();
const upsertCarriedRawSnapshot = vi.fn();
const onMeetingCreated = vi.fn();
const reconcileMeetingEvent = vi.fn();
const syncMeetingRemoved = vi.fn();
const markMirrorPending = vi.fn();
const clearMirrorPending = vi.fn();
const listMirrorPending = vi.fn();
const captureServerEvent = vi.fn();
const captureException = vi.fn();

vi.mock("@/repo/db/client", () => ({
  dbEnabled: (...a: unknown[]) => dbEnabled(...(a as [])),
  writeRowToDb: (...a: unknown[]) => writeRowToDb(...(a as [])),
  clearRowInDb: (...a: unknown[]) => clearRowInDb(...(a as [])),
}));
vi.mock("@/repo/db/read-daily", () => ({
  readMeetingRowStateFromDb: (...a: unknown[]) => readMeetingRowStateFromDb(...(a as [])),
  readMeetingsFromDb: (...a: unknown[]) => readMeetingsFromDb(...(a as [])),
}));
vi.mock("@/repo/meetings", () => ({
  appendMeeting: (...a: unknown[]) => appendMeeting(...(a as [])),
  clearMeeting: (...a: unknown[]) => clearMeeting(...(a as [])),
  updateMeeting: (...a: unknown[]) => updateMeeting(...(a as [])),
  upsertMeetingRowSnapshot: (...a: unknown[]) => upsertMeetingRowSnapshot(...(a as [])),
  findById: (...a: unknown[]) => findById(...(a as [])),
  findByDate: (...a: unknown[]) => findByDate(...(a as [])),
  findByPreviousMeetingId: (...a: unknown[]) => findByPreviousMeetingId(...(a as [])),
}));
vi.mock("@/repo/carryover", () => ({
  upsertCarriedRawSnapshot: (...a: unknown[]) => upsertCarriedRawSnapshot(...(a as [])),
}));
vi.mock("@/service/gcal-sync", () => ({
  onMeetingCreated: (...a: unknown[]) => onMeetingCreated(...(a as [])),
  reconcileMeetingEvent: (...a: unknown[]) => reconcileMeetingEvent(...(a as [])),
  syncMeetingRemoved: (...a: unknown[]) => syncMeetingRemoved(...(a as [])),
}));
vi.mock("@/repo/db/mirror-pending", () => ({
  markMirrorPending: (...a: unknown[]) => markMirrorPending(...(a as [])),
  clearMirrorPending: (...a: unknown[]) => clearMirrorPending(...(a as [])),
  listMirrorPending: (...a: unknown[]) => listMirrorPending(...(a as [])),
}));
vi.mock("@/lib/analytics/api-timing", () => ({
  captureServerEvent: (...a: unknown[]) => captureServerEvent(...(a as [])),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: (...a: unknown[]) => captureException(...(a as [])),
}));

import { createMeetingRecord } from "@/service/meetings-write";

const SHEET = "sheet-pilot";
const CTX = { spreadsheetId: SHEET, cohort: "8", email: "u@x.y" };

const mkMeeting = (o: Partial<Meeting> = {}): Meeting =>
  ({
    id: "m1",
    예약일: "2026-07-15",
    예약시각: "10:00",
    미팅날짜: "2026-07-16",
    미팅시간: "10:00",
    channel: "현수막",
    업체명: "가나상사",
    장소: "본사",
    ...o,
  }) as Meeting;

beforeEach(() => {
  for (const m of [
    dbEnabled, writeRowToDb, clearRowInDb, readMeetingRowStateFromDb, readMeetingsFromDb,
    appendMeeting, clearMeeting, updateMeeting, upsertMeetingRowSnapshot, findById, findByDate,
    findByPreviousMeetingId, upsertCarriedRawSnapshot, onMeetingCreated, reconcileMeetingEvent,
    syncMeetingRemoved, markMirrorPending, clearMirrorPending, listMirrorPending,
    captureServerEvent, captureException,
  ]) m.mockReset();
  dbEnabled.mockReturnValue(true);
  writeRowToDb.mockResolvedValue(undefined);
  upsertMeetingRowSnapshot.mockResolvedValue(undefined);
  reconcileMeetingEvent.mockResolvedValue(undefined);
  readMeetingRowStateFromDb.mockResolvedValue(null); // 기본 = 동기화할 정본 없음(조용히 종료)
  markMirrorPending.mockResolvedValue(undefined);
  clearMirrorPending.mockResolvedValue(undefined);
  listMirrorPending.mockResolvedValue([]);
});

afterEach(async () => {
  await new Promise((r) => setTimeout(r, 10));
});

describe("mirror_pending 안전망 (§7-3) — meetings", () => {
  it("시트 미러 최종 실패 → 응답 성공 + markMirrorPending(tab=meetings)", async () => {
    // 정본 저장 성공. 미러가 최신 DB 상태 read 에서 계속 실패 → exhaust → mark.
    readMeetingRowStateFromDb.mockRejectedValue(new Error("mirror read down"));
    await expect(createMeetingRecord(CTX, mkMeeting({ id: "m1" }))).resolves.toBeUndefined();
    await vi.waitFor(
      () => expect(markMirrorPending).toHaveBeenCalledWith({
        spreadsheetId: SHEET,
        tab: "meetings",
        rowKey: "m1",
      }),
      { timeout: 3000 },
    );
    expect(captureServerEvent).toHaveBeenCalledWith("sheet_mirror_error", { tab: "meetings" });
    expect(clearMirrorPending).not.toHaveBeenCalled();
  });

  it("시트 미러 성공 → clearMirrorPending(tab=meetings)", async () => {
    readMeetingRowStateFromDb.mockResolvedValue({ cleared: false, meeting: mkMeeting({ id: "m1" }) });
    await createMeetingRecord(CTX, mkMeeting({ id: "m1" }));
    await vi.waitFor(() => expect(clearMirrorPending).toHaveBeenCalled());
    expect(clearMirrorPending).toHaveBeenCalledWith({
      spreadsheetId: SHEET,
      tab: "meetings",
      rowKey: "m1",
    });
    expect(markMirrorPending).not.toHaveBeenCalled();
  });

  it("다음 쓰기의 queue 가 밀린 pending 미팅 행을 재드라이브(self-heal)", async () => {
    listMirrorPending.mockResolvedValueOnce(["m-old"]);
    readMeetingRowStateFromDb.mockResolvedValue({ cleared: false, meeting: mkMeeting({ id: "m-old" }) });
    await createMeetingRecord(CTX, mkMeeting({ id: "m1" }));
    await vi.waitFor(() =>
      expect(clearMirrorPending).toHaveBeenCalledWith({
        spreadsheetId: SHEET,
        tab: "meetings",
        rowKey: "m-old",
      }),
    );
  });

  it("비파일럿 = R2 시트(appendMeeting), DB·표식 미개입", async () => {
    await createMeetingRecord({ ...CTX, cohort: "7" }, mkMeeting({ id: "m1" }));
    expect(appendMeeting).toHaveBeenCalled();
    expect(writeRowToDb).not.toHaveBeenCalled();
    expect(markMirrorPending).not.toHaveBeenCalled();
    expect(clearMirrorPending).not.toHaveBeenCalled();
  });
});
