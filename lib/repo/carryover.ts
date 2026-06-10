/**
 * Layer: repo — 아레나 재참가 이월 I/O (arena-carryover §2, 읽기=이전 기수 시트 / 쓰기=아레나).
 *
 * 04: 이전 시트의 상태=예약 미팅 raw(A~AN)를 아레나 04에 복사 — 새 id 발급,
 *     AO="이월"/AP=원본 미팅 id. N/O/Q/S(수식)·기존 행 비접촉(split write).
 * 02: service 가 기존 contract-payment repo(appendFromContract+updateUserFields) 재사용.
 * 멱등: 아레나 04 AP / 02 AJ 컬럼의 원본키 집합으로 중복 삽입 방지.
 * 이전 기수 시트는 읽기 전용 — 이 파일은 old 시트에 어떤 쓰기도 하지 않는다.
 */
import { sheetsClient } from "./sheets-client";
import { SHEET_RANGES } from "@/config";

const TAB = SHEET_RANGES.meetings.tab;
const ref = `'${TAB}'`;

export interface CarrySourceMeeting {
  원본id: string;
  raw: unknown[]; // A~AN (0..39)
}

/** 이전 시트 04 에서 상태=예약 행 raw 추출 (J=9 가 "예약"). */
export async function listCarrySourceMeetings(
  oldSheetId: string,
): Promise<CarrySourceMeeting[]> {
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId: oldSheetId,
    range: `${ref}!A2:AN`,
  });
  const out: CarrySourceMeeting[] = [];
  for (const r of res.data.values ?? []) {
    const id = String(r[0] ?? "").trim();
    const 상태 = String(r[9] ?? "").trim();
    if (id && 상태 === "예약") out.push({ 원본id: id, raw: r });
  }
  return out;
}

/** 아레나 시트에 이미 이월된 원본키 집합 — 04 AP 컬럼. */
export async function listCarriedMeetingKeys(
  arenaSheetId: string,
): Promise<Set<string>> {
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId: arenaSheetId,
    range: `${ref}!AP2:AP`,
  });
  return new Set(
    (res.data.values ?? []).map((r) => String(r[0] ?? "").trim()).filter(Boolean),
  );
}

/** A열 기준 첫 빈 행 (meetings.ts findFirstEmptyRow 동일 패턴). */
async function firstEmptyRow(spreadsheetId: string): Promise<number> {
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: `${ref}!A2:A`,
  });
  const ids = (res.data.values ?? []).map((r) => String(r[0] ?? "").trim());
  for (let i = 0; i < ids.length; i++) if (!ids[i]) return i + 2;
  return ids.length + 2;
}

/**
 * 이월 미팅 1행 append — split write(A:M / P / R빈값 / T~AN / AO:AP).
 * N/O/Q/S 수식 비접촉. R(previousMeetingId)은 옛 시트 내부 참조라 비움.
 */
export async function appendCarriedMeeting(
  arenaSheetId: string,
  src: CarrySourceMeeting,
  newId: string,
): Promise<void> {
  const row = await firstEmptyRow(arenaSheetId);
  const a2m = src.raw.slice(0, 13).map((v) => v ?? "");
  a2m[0] = newId; // 새 id (옛/새 시트 id 혼동 방지 — 원본은 AP 에)
  const t2an = Array.from({ length: 21 }, (_, i) => src.raw[19 + i] ?? "");
  await sheetsClient().spreadsheets.values.batchUpdate({
    spreadsheetId: arenaSheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        { range: `${ref}!A${row}:M${row}`, values: [a2m as (string | number | boolean)[]] },
        { range: `${ref}!P${row}`, values: [[src.raw[15] ?? ""] as (string | number | boolean)[]] },
        { range: `${ref}!T${row}:AN${row}`, values: [t2an as (string | number | boolean)[]] },
        { range: `${ref}!AO${row}:AP${row}`, values: [["이월", src.원본id]] },
      ],
    },
  });
}
