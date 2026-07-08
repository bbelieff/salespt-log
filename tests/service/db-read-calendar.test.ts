/**
 * R2-6 정합 대조 (db-read-calendar): 캘린더 투두 DB 변환이 시트 파서(rowToTodo)와
 * 같은 결과를 내는지 고정. 미팅은 R2-2(db-read-meetings-banners.test)가 이미 커버 —
 * 여기선 신규분(todos payload 이중형태 + showOnCalendar 기본 ON 규칙)에 집중.
 */
import { describe, expect, it } from "vitest";
import { rowToTodo } from "@/repo/todos";
import { todoFromDbPayload } from "@/repo/db/read-daily";

function toSerial(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!) / 86_400_000 + 25569;
}

/** backfill 05 A2:N → rowObj(r) 재현(열문자 A..N, 문자열화, 빈값 skip). */
function backfillPayload(raw: unknown[]): Record<string, unknown> {
  const colName = (i: number) => String.fromCharCode(65 + i); // A..N (i<26)
  const o: Record<string, unknown> = { _backfill: true };
  raw.forEach((v, i) => {
    const s = String(v ?? "").trim();
    if (s !== "") o[colName(i)] = s;
  });
  return o;
}

/** 05 실무투두 원시 행(A..N) — COL: id0 contractRef1 institutionRef2 업체명3 type4 제목5
 *  예정일자6 예정시각7 장소8 상세9 showOnCalendar10 완료여부11 생성시각12 분류13. */
function sheetRow(showCal: unknown): unknown[] {
  const r: unknown[] = new Array(14).fill("");
  r[0] = "todo-001";
  r[3] = "테스트업체";
  r[4] = "전화"; // TodoType enum(기타/미팅/전화/메시지/일반)
  r[5] = "사업계획서 발송";
  r[6] = toSerial("2026-07-15");
  r[7] = 9.5 / 24; // 09:30
  r[8] = "사무실";
  r[9] = "초안 검토";
  r[10] = showCal; // K showOnCalendar
  r[11] = false;   // L 완료여부
  r[13] = "기타";
  return r;
}

describe("R2-6 todos: DB payload ↔ 시트 파서 정합", () => {
  it("dual-write 필드명 payload == 시트 rowToTodo (showOnCalendar=true)", () => {
    const expected = rowToTodo(sheetRow(true))!;
    expect(expected).not.toBeNull();
    const fromDb = todoFromDbPayload({ ...expected } as unknown as Record<string, unknown>);
    expect(fromDb).toEqual(expected);
  });

  it("backfill 열문자 payload(문자열화·직렬날짜) == 시트 rowToTodo", () => {
    const raw = sheetRow(true);
    const expected = rowToTodo(raw)!;
    expect(todoFromDbPayload(backfillPayload(raw))).toEqual(expected);
  });

  it("showOnCalendar 기본 ON — 빈 셀/열문자 미포함이면 true (시트 규칙과 동일)", () => {
    // 빈 셀 = true. backfill 은 빈값 skip → K 키 없음 → coerce(undefined) → 파서가 !false=true.
    const raw = sheetRow(""); // K 빈값
    const expected = rowToTodo(raw)!;
    expect(expected.showOnCalendar).toBe(true);
    expect(todoFromDbPayload(backfillPayload(raw))).toEqual(expected);
  });

  it("showOnCalendar 명시 FALSE 만 false — 캘린더 제외 대상", () => {
    const rawFalse = sheetRow(false);
    expect(rowToTodo(rawFalse)!.showOnCalendar).toBe(false);
    expect(todoFromDbPayload(backfillPayload(rawFalse))!.showOnCalendar).toBe(false);
  });

  it("id 없는 payload 는 null (행 제외)", () => {
    expect(todoFromDbPayload({ _backfill: true })).toBeNull();
  });
});
