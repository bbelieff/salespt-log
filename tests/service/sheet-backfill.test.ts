import { describe, expect, it } from "vitest";
import { backfillMissingRows } from "@/service/sheet-backfill";

/**
 * R3 §7-3 L4: append 미러 실패로 DB 에 안 실린 신규행을 시트에서 보충하는 union 헬퍼.
 * loadContractPayments(계약, row+linkedMeetingId) · loadDBOverview(03 4섹션, row) ·
 * loadLeadsForPicker(발굴, row) 세 진입점이 이 헬퍼로 병합한다.
 */
describe("backfillMissingRows", () => {
  it("시트에만 있는 행(=미러 실패 신규)을 보충한다", () => {
    const db = [{ row: 6, v: "a" }, { row: 7, v: "b" }];
    const sheet = [{ row: 6, v: "a" }, { row: 7, v: "b" }, { row: 8, v: "new" }];
    const out = backfillMissingRows(db, sheet, (r) => r.row);
    expect(out.map((r) => r.row)).toEqual([6, 7, 8]);
    expect(out.find((r) => r.row === 8)?.v).toBe("new");
  });

  it("DB 에 있는 행은 DB 값이 정본 — 시트 stale 로 덮지 않는다", () => {
    const db = [{ row: 6, v: "db" }];
    const sheet = [{ row: 6, v: "sheet-stale" }];
    const out = backfillMissingRows(db, sheet, (r) => r.row);
    expect(out).toHaveLength(1);
    expect(out[0]?.v).toBe("db");
  });

  it("보충할 게 없으면 dbRows 원본 참조를 그대로 반환(불필요한 정렬·복사 없음)", () => {
    const db = [{ row: 6 }, { row: 7 }];
    const sheet = [{ row: 6 }, { row: 7 }];
    const out = backfillMissingRows(db, sheet, (r) => r.row);
    expect(out).toBe(db);
  });

  it("병합 결과는 row 오름차순 정렬", () => {
    const db = [{ row: 10 }, { row: 6 }];
    const sheet = [{ row: 8 }];
    const out = backfillMissingRows(db, sheet, (r) => r.row);
    expect(out.map((r) => r.row)).toEqual([6, 8, 10]);
  });

  it("빈 DB(전량 미러 실패) + 시트만 → 전부 보충", () => {
    const db: { row: number }[] = [];
    const sheet = [{ row: 6 }, { row: 7 }];
    const out = backfillMissingRows(db, sheet, (r) => r.row);
    expect(out.map((r) => r.row)).toEqual([6, 7]);
  });

  it("row 가 undefined 인 시트 행은 항상 보충(식별 불가 → 안전 측 보충)", () => {
    const db = [{ row: 6 }];
    const sheet = [{ row: undefined }, { row: 6 }];
    const out = backfillMissingRows(db, sheet, (r) => r.row);
    expect(out).toHaveLength(2);
  });

  // ── 계약 패턴: linkedMeetingId 2차 dedupe (수동 행이동 drift) ──
  it("계약: 2차 키(linkedMeetingId)가 이미 DB 에 있으면 drift 로 row 가 달라도 중복 추가 안 함", () => {
    const db = [{ row: 6, mid: "m1" }];
    // 사용자가 시트에서 행을 삽입 → 같은 계약이 row 7 로 시프트되어 시트에 존재
    const sheet = [{ row: 7, mid: "m1" }];
    const out = backfillMissingRows(db, sheet, (r) => r.row, (r) => r.mid);
    expect(out).toBe(db); // 중복 없음 → 원본 그대로
  });

  it("계약: 2차 키가 서로 다르면(진짜 신규 계약) 보충한다", () => {
    const db = [{ row: 6, mid: "m1" }];
    const sheet = [{ row: 6, mid: "m1" }, { row: 7, mid: "m2" }];
    const out = backfillMissingRows(db, sheet, (r) => r.row, (r) => r.mid);
    expect(out.map((r) => r.row)).toEqual([6, 7]);
  });

  it("계약: 2차 키가 빈 값(prior/legacy, meetingId 없음)이면 row 로만 판정", () => {
    const db = [{ row: 6, mid: "" }];
    const sheet = [{ row: 6, mid: "" }, { row: 8, mid: undefined }];
    const out = backfillMissingRows(
      db,
      sheet,
      (r) => r.row,
      (r) => r.mid || undefined,
    );
    expect(out.map((r) => r.row)).toEqual([6, 8]); // row 8 은 DB 에 없으니 보충
  });

  // ── 03 4섹션 / 발굴 패턴: row 단일 키 ──
  it("03/발굴: 자연키 없이 row 단일 키로 누락 신규행만 보충", () => {
    const db = [{ row: 4, 업체명: "가" }, { row: 5, 업체명: "나" }];
    const sheet = [
      { row: 4, 업체명: "가" },
      { row: 5, 업체명: "나" },
      { row: 6, 업체명: "다-신규" }, // 미러 실패로 DB 누락
    ];
    const out = backfillMissingRows(db, sheet, (r) => r.row);
    expect(out.map((r) => r.row)).toEqual([4, 5, 6]);
    expect(out[2]?.업체명).toBe("다-신규");
  });
});
