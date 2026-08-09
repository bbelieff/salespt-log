/**
 * BBE-65 — migrateArenaCarryover 의 이전 기수 미팅 소스 읽기가
 * listCarrySourceMeetings(시트 전용)만 쓰면, 방금 DB 정본으로 저장돼 아직 비동기 시트
 * 미러(queueMeetingSheetSync)가 안 따라잡은 예약 미팅을 놓친다(read-your-writes 위반).
 * 이전 기수가 DB 읽기 파일럿이면 readMeetingsFromDb 를 union 해 그 gap 을 메우는지 회귀 고정.
 * daily-source(chooseDailySource/chooseWriteSource)는 순수함수라 실제 구현을 그대로 쓴다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Meeting } from "@/types";
import { Meeting as MeetingSchema } from "@/types";

const findActiveArenaRowByEmail = vi.fn();
const findPriorCohortRow = vi.fn();
const markPriorRowArchived = vi.fn();
const appendCarriedMeeting = vi.fn();
const listCarriedMeetingKeys = vi.fn();
const listCarrySourceMeetings = vi.fn();
const dbEnabled = vi.fn(() => true);
const writeRowToDb = vi.fn();
const listCarriedMeetingKeysFromDb = vi.fn();
const readMeetingsFromDb = vi.fn();
const queueMeetingSheetSync = vi.fn();
const appendFromContract = vi.fn();
const readAllContracts = vi.fn();
const updateUserFields = vi.fn();

vi.mock("@/repo/users-arena", () => ({
  findActiveArenaRowByEmail: (...a: unknown[]) => findActiveArenaRowByEmail(...(a as [])),
  findPriorCohortRow: (...a: unknown[]) => findPriorCohortRow(...(a as [])),
  markPriorRowArchived: (...a: unknown[]) => markPriorRowArchived(...(a as [])),
}));
vi.mock("@/repo/carryover", () => ({
  appendCarriedMeeting: (...a: unknown[]) => appendCarriedMeeting(...(a as [])),
  carriedMeetingPayload: (src: { 원본id: string }, newId: string) => ({
    A: newId,
    AO: "이월",
    AP: src.원본id,
  }),
  listCarriedMeetingKeys: (...a: unknown[]) => listCarriedMeetingKeys(...(a as [])),
  listCarrySourceMeetings: (...a: unknown[]) => listCarrySourceMeetings(...(a as [])),
}));
vi.mock("@/repo/db/client", () => ({
  dbEnabled: (...a: unknown[]) => dbEnabled(...(a as [])),
  writeRowToDb: (...a: unknown[]) => writeRowToDb(...(a as [])),
}));
vi.mock("@/repo/db/read-daily", () => ({
  listCarriedMeetingKeysFromDb: (...a: unknown[]) => listCarriedMeetingKeysFromDb(...(a as [])),
  readMeetingsFromDb: (...a: unknown[]) => readMeetingsFromDb(...(a as [])),
}));
vi.mock("@/repo/meetings-rows", () => ({
  meetingToRow: (m: Meeting) => ["ROW_FOR", m.id],
  stripUserEnteredEscapes: (row: unknown[]) => row, // BBE-65(2차) — 이 테스트는 apostrophe 무관, 통과만
}));
vi.mock("@/service/meetings-write", () => ({
  queueMeetingSheetSync: (...a: unknown[]) => queueMeetingSheetSync(...(a as [])),
}));
vi.mock("@/repo/contract-payment", () => ({
  appendFromContract: (...a: unknown[]) => appendFromContract(...(a as [])),
  readAll: (...a: unknown[]) => readAllContracts(...(a as [])),
  updateUserFields: (...a: unknown[]) => updateUserFields(...(a as [])),
}));

import { migrateArenaCarryover } from "@/service/arena-carryover";

const EMAIL = "trainee@example.com";
const ARENA_SHEET = "arena-sheet-id";
const PRIOR_SHEET = "prior-sheet-id";

function meeting(id: string): Meeting {
  return MeetingSchema.parse({
    id,
    예약일: "2026-08-01",
    예약시각: "09:00",
    미팅날짜: "2026-08-05",
    미팅시간: "10:00",
    channel: "매입DB",
    업체명: "테스트업체",
    장소: "서울",
    상태: "예약",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  dbEnabled.mockReturnValue(true);
  findActiveArenaRowByEmail.mockResolvedValue({
    email: EMAIL,
    cohort: "A1-4",
    spreadsheetId: ARENA_SHEET,
  });
  listCarriedMeetingKeys.mockResolvedValue(new Set());
  listCarriedMeetingKeysFromDb.mockResolvedValue(new Set());
  readAllContracts.mockResolvedValue([]);
  markPriorRowArchived.mockResolvedValue(undefined);
});

describe("migrateArenaCarryover — 이전 기수 예약 미팅 읽기 (BBE-65)", () => {
  it("이전 기수가 DB 읽기 파일럿이면, 시트에 없고 DB 에만 있는 예약 미팅도 DB 정본 경로로 이월된다", async () => {
    findPriorCohortRow.mockResolvedValue({
      cohort: "8", // DB_READ_COHORTS 소속 — chooseDailySource 실구현이 "db" 판정
      spreadsheetId: PRIOR_SHEET,
      status: "active",
    });
    listCarrySourceMeetings.mockResolvedValue([]); // 시트는 아직 못 따라잡음(비동기 미러 지연)
    readMeetingsFromDb.mockResolvedValue([meeting("m-db-only")]); // DB 에는 이미 있음

    const report = await migrateArenaCarryover(EMAIL);

    expect(readMeetingsFromDb).toHaveBeenCalledWith(PRIOR_SHEET);
    expect(report.meetings.copied).toBe(1);
    expect(report.meetings.failed).toEqual([]);
    // 아레나(A1-4)도 파일럿 → dbPrimary 경로로 실제 DB 이월 write 발생.
    expect(writeRowToDb).toHaveBeenCalledTimes(1);
    const call = writeRowToDb.mock.calls[0]![0] as { tab: string; payload: { AP: string } };
    expect(call.tab).toBe("meetings");
    expect(call.payload.AP).toBe("m-db-only");
  });

  it("DB 와 시트 양쪽에 같은 미팅이 있으면 중복 이월하지 않는다(원본id dedupe)", async () => {
    findPriorCohortRow.mockResolvedValue({
      cohort: "8",
      spreadsheetId: PRIOR_SHEET,
      status: "active",
    });
    listCarrySourceMeetings.mockResolvedValue([{ 원본id: "m-both", raw: ["from-sheet"] }]);
    readMeetingsFromDb.mockResolvedValue([meeting("m-both")]); // 이미 시트에도 있는 것과 동일 id

    const report = await migrateArenaCarryover(EMAIL);

    expect(report.meetings.copied).toBe(1); // 1건만(중복 아님)
    expect(writeRowToDb).toHaveBeenCalledTimes(1);
  });

  it("이전 기수가 DB 읽기 파일럿이 아니면 readMeetingsFromDb 를 호출하지 않는다(비파일럿은 시트가 유일한 정본)", async () => {
    findPriorCohortRow.mockResolvedValue({
      cohort: "3", // DB_READ_COHORTS 밖 — chooseDailySource 실구현이 "sheet" 판정
      spreadsheetId: PRIOR_SHEET,
      status: "active",
    });
    listCarrySourceMeetings.mockResolvedValue([]);

    const report = await migrateArenaCarryover(EMAIL);

    expect(readMeetingsFromDb).not.toHaveBeenCalled();
    expect(report.meetings.copied).toBe(0);
  });
});
