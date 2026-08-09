/**
 * BBE-58(R7 Phase 1 #9) — gcal 토큰·설정 DB 정본 전환 회귀.
 *
 * 세 불변식을 고정한다(gcal-token.ts 헤더 참조):
 *  ① 행 존재 = 정본 — DB 행이 있으면 시트를 보지 않는다. **특히 token_enc="" (해제됨)일 때
 *     시트로 폴백하면 연결 해제가 되살아난다**(이 PR 최대 위험, 전용 케이스로 박제).
 *  ② lazy backfill — 시트 폴백이 값을 찾으면 DB 로 1회 이전(on conflict do nothing).
 *  ③ DB 정본 + 시트 미러 — 시트 쓰기 실패는 저장 실패가 아니다(DB 성공 시). 단 DB 미설정
 *     환경에서는 시트가 정본이므로 실패를 삼키면 안 된다.
 *
 * 토큰 값 자체는 암호문 왕복만 확인 — 평문을 단정문에 노출하지 않는다(ADR-0028 §3 정신).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbEnabled = vi.fn(() => true);
const readGcalTokenRow = vi.fn();
const upsertGcalToken = vi.fn();
const upsertGcalSettings = vi.fn();
const backfillGcalRowIfAbsent = vi.fn();
const findUserByEmail = vi.fn();
const updateUserCell = vi.fn();

vi.mock("@/repo/db/client", () => ({ dbEnabled: () => dbEnabled() }));
vi.mock("@/repo/db/gcal-tokens", () => ({
  readGcalTokenRow: (...a: unknown[]) => readGcalTokenRow(...(a as [])),
  upsertGcalToken: (...a: unknown[]) => upsertGcalToken(...(a as [])),
  upsertGcalSettings: (...a: unknown[]) => upsertGcalSettings(...(a as [])),
  backfillGcalRowIfAbsent: (...a: unknown[]) => backfillGcalRowIfAbsent(...(a as [])),
}));
vi.mock("@/repo/users", () => ({
  findUserByEmail: (...a: unknown[]) => findUserByEmail(...(a as [])),
  updateUserCell: (...a: unknown[]) => updateUserCell(...(a as [])),
}));

import { encryptToken } from "@/repo/gcal-crypto";
import {
  clearGcalToken,
  getGcalConnection,
  saveGcalSettings,
  saveGcalToken,
} from "@/repo/gcal-token";

const EMAIL = "u@x.y";
const ENC = encryptToken("refresh-token-fixture"); // 암호문 — 평문은 단정문에 쓰지 않는다

beforeEach(() => {
  dbEnabled.mockReset().mockReturnValue(true);
  readGcalTokenRow.mockReset().mockResolvedValue(null);
  upsertGcalToken.mockReset().mockResolvedValue(undefined);
  upsertGcalSettings.mockReset().mockResolvedValue(undefined);
  backfillGcalRowIfAbsent.mockReset().mockResolvedValue(undefined);
  findUserByEmail.mockReset().mockResolvedValue(null);
  updateUserCell.mockReset().mockResolvedValue(undefined);
});

describe("① 행 존재 = 정본", () => {
  it("DB 행이 있으면 시트를 아예 읽지 않는다", async () => {
    readGcalTokenRow.mockResolvedValue({ tokenEnc: ENC, settings: '{"calendarId":"c1"}' });
    const conn = await getGcalConnection(EMAIL);
    expect(conn.connected).toBe(true);
    expect(conn.settings.calendarId).toBe("c1");
    expect(findUserByEmail).not.toHaveBeenCalled();
  });

  it("🔒 해제됨(token_enc='')인 DB 행은 시트로 폴백하지 않는다 — 해제 되살아남 방지", async () => {
    readGcalTokenRow.mockResolvedValue({ tokenEnc: "", settings: "" });
    // 시트에는 아직 옛 토큰이 남아 있는 상황(미러 실패·revert 잔재)
    findUserByEmail.mockResolvedValue({ gcalToken: ENC, gcalSettings: "" });
    const conn = await getGcalConnection(EMAIL);
    expect(conn.connected).toBe(false); // 시트 값이 되살아나면 안 된다
    expect(conn.refreshToken).toBeNull();
    expect(findUserByEmail).not.toHaveBeenCalled();
  });

  it("DB 행이 없으면 시트로 폴백한다", async () => {
    readGcalTokenRow.mockResolvedValue(null);
    findUserByEmail.mockResolvedValue({ gcalToken: ENC, gcalSettings: '{"calendarId":"sheet-cal"}' });
    const conn = await getGcalConnection(EMAIL);
    expect(conn.connected).toBe(true);
    expect(conn.settings.calendarId).toBe("sheet-cal");
  });

  it("DB 조회가 throw 하면(순단) 시트로 강등 — 캘린더가 DB 장애로 끊기지 않는다", async () => {
    readGcalTokenRow.mockRejectedValue(new Error("connection reset"));
    findUserByEmail.mockResolvedValue({ gcalToken: ENC, gcalSettings: "" });
    const conn = await getGcalConnection(EMAIL);
    expect(conn.connected).toBe(true);
  });
});

describe("② lazy backfill", () => {
  it("시트 폴백이 값을 찾으면 DB 로 1회 이전한다", async () => {
    readGcalTokenRow.mockResolvedValue(null);
    findUserByEmail.mockResolvedValue({ gcalToken: ENC, gcalSettings: '{"calendarId":"c9"}' });
    await getGcalConnection(EMAIL);
    await new Promise((r) => setImmediate(r)); // fire-and-forget 소진
    expect(backfillGcalRowIfAbsent).toHaveBeenCalledWith(EMAIL, ENC, '{"calendarId":"c9"}');
  });

  it("시트도 비어 있으면 backfill 하지 않는다(빈 행 양산 금지)", async () => {
    readGcalTokenRow.mockResolvedValue(null);
    findUserByEmail.mockResolvedValue({ gcalToken: "", gcalSettings: "" });
    await getGcalConnection(EMAIL);
    await new Promise((r) => setImmediate(r));
    expect(backfillGcalRowIfAbsent).not.toHaveBeenCalled();
  });

  it("backfill 실패는 읽기를 깨뜨리지 않는다", async () => {
    readGcalTokenRow.mockResolvedValue(null);
    backfillGcalRowIfAbsent.mockRejectedValue(new Error("db down"));
    findUserByEmail.mockResolvedValue({ gcalToken: ENC, gcalSettings: "" });
    const conn = await getGcalConnection(EMAIL);
    await new Promise((r) => setImmediate(r));
    expect(conn.connected).toBe(true);
  });
});

describe("③ DB 정본 + 시트 미러", () => {
  it("saveGcalToken — DB upsert(정본) + 시트 S 미러", async () => {
    await saveGcalToken(EMAIL, "new-token");
    expect(upsertGcalToken).toHaveBeenCalledTimes(1);
    expect(upsertGcalToken.mock.calls[0]![0]).toBe(EMAIL);
    expect(updateUserCell).toHaveBeenCalledWith(EMAIL, "S", expect.any(String));
  });

  it("🔒 재연결 시 시트에만 있던 캘린더 선택이 기본값으로 초기화되지 않는다(전환기 회귀)", async () => {
    // DB 미이전 사용자: DB 행 없음 + 시트에 업무용 캘린더 선택이 남아 있는 상태에서 재연결.
    readGcalTokenRow.mockResolvedValue(null);
    findUserByEmail.mockResolvedValue({ gcalToken: "", gcalSettings: '{"calendarId":"work@x.y"}' });
    await saveGcalToken(EMAIL, "new-token");
    expect(upsertGcalSettings).toHaveBeenCalledWith(EMAIL, '{"calendarId":"work@x.y"}');
    expect(updateUserCell).toHaveBeenCalledWith(EMAIL, "T", '{"calendarId":"work@x.y"}');
  });

  it("최초 연결(설정 없음) — 기본 설정이 저장된다", async () => {
    readGcalTokenRow.mockResolvedValue(null);
    findUserByEmail.mockResolvedValue(null);
    await saveGcalToken(EMAIL, "new-token");
    expect(upsertGcalSettings).toHaveBeenCalledWith(EMAIL, '{"calendarId":"primary"}');
  });

  it("시트 미러가 실패해도 저장은 성공(DB 정본) — throw 하지 않는다", async () => {
    updateUserCell.mockRejectedValue(new Error("sheets 429"));
    await expect(saveGcalToken(EMAIL, "new-token")).resolves.toBeUndefined();
    expect(upsertGcalToken).toHaveBeenCalledTimes(1);
  });

  it("DB 미설정 환경에서는 시트가 정본 — 시트 실패를 삼키지 않는다", async () => {
    dbEnabled.mockReturnValue(false);
    updateUserCell.mockRejectedValue(new Error("sheets 429"));
    await expect(saveGcalToken(EMAIL, "new-token")).rejects.toThrow();
    expect(upsertGcalToken).not.toHaveBeenCalled();
  });

  it("clearGcalToken — 행을 지우지 않고 token_enc='' 로 upsert(해제 되살아남 방지)", async () => {
    await clearGcalToken(EMAIL);
    expect(upsertGcalToken).toHaveBeenCalledWith(EMAIL, "");
    expect(updateUserCell).toHaveBeenCalledWith(EMAIL, "S", "");
  });

  it("saveGcalSettings — 기존 설정과 병합해 DB·시트 양쪽 기록", async () => {
    readGcalTokenRow.mockResolvedValue({ tokenEnc: ENC, settings: '{"calendarId":"old"}' });
    const next = await saveGcalSettings(EMAIL, { calendarId: "new" });
    expect(next.calendarId).toBe("new");
    expect(upsertGcalSettings).toHaveBeenCalledWith(EMAIL, '{"calendarId":"new"}');
    expect(updateUserCell).toHaveBeenCalledWith(EMAIL, "T", '{"calendarId":"new"}');
  });
});

describe("DB 미설정(로컬·CI) — 기존 시트 동작 완전 보존", () => {
  it("읽기는 시트만 본다(DB 호출 0)", async () => {
    dbEnabled.mockReturnValue(false);
    findUserByEmail.mockResolvedValue({ gcalToken: ENC, gcalSettings: "" });
    const conn = await getGcalConnection(EMAIL);
    expect(conn.connected).toBe(true);
    expect(readGcalTokenRow).not.toHaveBeenCalled();
    expect(backfillGcalRowIfAbsent).not.toHaveBeenCalled();
  });
});
