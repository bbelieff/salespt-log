/**
 * [대표자] 이메일 저장 경로 (company-info-email-v2, 2026-11-10) — **DB payload 전용, 시트 열 없음**.
 *  ① 스키마 default "" · 옛 payload(키 없음)도 그대로 파싱
 *  ② 04·06 시트 코덱은 이메일을 쓰지 않는다(행 폭 불변 · 값이 어느 셀에도 없음) — 시트 열 0개 추가
 *  ③ DB payload 왕복 — 04 미팅(Meeting 객체 그대로) · 06 업체정보(필드명 평탄화)에 남고,
 *     열문자 backfill·rename 키행(이메일 키 없음)은 "".
 * 합성 데이터만 — 실제 시트·DB 접근 없음.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/repo/sheets-client", () => ({ sheetsClient: () => ({}), ensureGridColumns: vi.fn() }));
vi.mock("@/repo/db/mirror", () => ({ mirrorSheetRow: vi.fn(), mirrorClearRow: vi.fn() }));
vi.mock("@/repo/db/client", () => ({ dbEnabled: () => false }));
vi.mock("@/repo/db/company-archive-sync", () => ({
  persistCompanyArchiveRow: vi.fn(),
  persistCompanyArchiveRename: vi.fn(),
  readCompanyArchiveRowPayload: vi.fn(),
}));
vi.mock("@/repo/db/mirror-pending", () => ({
  markMirrorPending: vi.fn(),
  clearMirrorPending: vi.fn(),
  listMirrorPending: vi.fn(async () => []),
}));
vi.mock("@/lib/analytics/api-timing", () => ({ captureServerEvent: vi.fn() }));

import { CompanyInfo, Meeting } from "@/types";
import { COMPANY_FIELDS_DB_ONLY, MEETING_ROW_WIDTH, meetingToRow, rowToMeeting } from "@/repo/meetings-rows";
import { ARCHIVE_ROW_WIDTH, companyInfoToArchiveRow } from "@/repo/company-info-archive";
import { companyInfoFromDbPayload, meetingFromDbPayload } from "@/repo/db/read-daily";

const EMAIL = "ceo@example.com";
const BASE = Meeting.parse({
  id: "m-email-001",
  예약일: "2026-11-10",
  예약시각: "10:00",
  미팅날짜: "2026-11-11",
  미팅시간: "14:00",
  channel: "매입DB",
  업체명: "예시상사",
  장소: "본사",
  업체정보: { 대표자이름: "홍길동", 연락처통신사: "010-0000-0000(SKT)", 이메일: EMAIL },
});
const hasEmailCell = (row: unknown[]) => row.some((v) => String(v ?? "").includes(EMAIL));

describe("① 스키마", () => {
  it("default '' · DB 전용 목록은 이메일 하나", () => {
    expect(CompanyInfo.parse({}).이메일).toBe("");
    expect(CompanyInfo.parse({ 대표자이름: "옛 기록" }).이메일).toBe("");
    expect([...COMPANY_FIELDS_DB_ONLY]).toEqual(["이메일"]);
  });
  it("모양이 아니어도 막지 않는다(자유 텍스트 — 저장 전체 400 방지)", () => {
    expect(CompanyInfo.safeParse({ 이메일: "ceo.example.com" }).success).toBe(true);
  });
});

describe("② 시트 코덱은 이메일을 모른다 — 새 시트 열 없음", () => {
  it("04 행: 폭 88열(A~CJ) 그대로 · 이메일 값이 어느 셀에도 없음", () => {
    const row = meetingToRow(BASE);
    expect(MEETING_ROW_WIDTH).toBe(88);
    expect(row).toHaveLength(MEETING_ROW_WIDTH);
    expect(hasEmailCell(row)).toBe(false);
    // 시트에서 다시 읽으면 이메일은 ""(시트 미러는 백업일 뿐 — 정본은 DB).
    expect(rowToMeeting(row)!.업체정보!.이메일).toBe("");
  });
  it("06 행: 폭 그대로 · 이메일 값이 어느 셀에도 없음", () => {
    const row = companyInfoToArchiveRow("예시상사", "2026-11-11", BASE.업체정보, "T");
    expect(row).toHaveLength(ARCHIVE_ROW_WIDTH);
    expect(hasEmailCell(row)).toBe(false);
  });
});

describe("③ DB payload 왕복", () => {
  it("04 미팅 — Meeting 객체 payload 그대로 이메일 보존", () => {
    const payload = JSON.parse(JSON.stringify(BASE)) as Record<string, unknown>;
    expect(meetingFromDbPayload(payload)!.업체정보!.이메일).toBe(EMAIL);
  });
  it("06 업체정보 — 필드명 평탄화 payload 에서 복원(trim)", () => {
    const payload = { 업체명: "예시상사", 계약일: "2026-11-11", ...BASE.업체정보, 이메일: `  ${EMAIL} ` };
    expect(companyInfoFromDbPayload(payload)!.이메일).toBe(EMAIL);
  });
  it("열문자 backfill · rename 키행(이메일 키 없음)은 ''", () => {
    expect(companyInfoFromDbPayload({ E: "2020-01-01", Q: "홍길동" })!.이메일).toBe("");
    expect(companyInfoFromDbPayload({ _cleared: false, 업체명: "예시상사", 계약일: "2026-11-11" })!.이메일).toBe("");
  });
});
