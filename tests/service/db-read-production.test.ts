/**
 * R2-5 정합 대조 (db-read-production): 03 DB관리 4섹션의 DB 파서 재사용이
 * 시트 파서(parseXRow)와 같은 결과를 내는지 고정. 특히:
 *  • 직접생산 "생산중"(종료일 빈) 행 — sheet/backfill 배열도 신규 I:O로 보존하는지
 *  • 파생값(주문금액=개당단가×주문개수, 개당단가=예산/생산개수) 양 경로 동일
 *  • 합계행 skip 기준
 */
import { describe, expect, it } from "vitest";
import { DBProduction } from "@/types";
import {
  isProductionMeaningful,
  parseBannerRow,
  parseProductionRow,
  parsePurchaseRow,
} from "@/repo/db";

/** backfill 절대 열문자 payload 재현(섹션 시작 인덱스부터). */
function colPayload(absStart: number, cells: unknown[]): Record<string, unknown> {
  const colName = (i: number) =>
    i < 26 ? String.fromCharCode(65 + i) : "A" + String.fromCharCode(65 + i - 26);
  const o: Record<string, unknown> = { _backfill: true };
  cells.forEach((v, i) => {
    const s = String(v ?? "").trim();
    if (s !== "") o[colName(absStart + i)] = s;
  });
  return o;
}

// coerce/relRow 재현 — read-db-tab 내부와 동일 규칙(테스트가 그 경로를 대리 검증).
function coerce(v: unknown): unknown {
  if (typeof v !== "string") return v;
  if (v === "true" || v === "TRUE") return true;
  if (v === "false" || v === "FALSE") return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}
function relRow(payload: Record<string, unknown>, absStart: number): unknown[] {
  const colName = (i: number) =>
    i < 26 ? String.fromCharCode(65 + i) : "A" + String.fromCharCode(65 + i - 26);
  const r: unknown[] = [];
  for (let i = 0; i < 8; i++) r.push(coerce(payload[colName(absStart + i)]));
  return r;
}

describe("R2-5 매입DB: backfill 열문자 == 시트 파서, 주문금액 파생 일치", () => {
  // 시트 B~H raw: 구매일/업체명/개당단가/주문개수/부가세(F,bool)/기타/(H)
  const sheetRow = ["2026-06-10", "매입업체", 5000, 3, true, "메모", ""];
  it("열문자 payload → parsePurchaseRow == 시트 직접 파싱", () => {
    const fromSheet = parsePurchaseRow(sheetRow);
    const fromDb = parsePurchaseRow(relRow(colPayload(1, sheetRow), 1)); // 매입DB absStart=1(B)
    expect(fromDb).toEqual(fromSheet);
    expect(fromDb.주문금액).toBe(5000 * 3); // 파생 재계산
    expect(fromDb.부가세여부).toBe(true);
  });
});

describe("R2-5 직접생산: 신규 I:O 생산중·비정상 날짜 보존", () => {
  // 신규 레이아웃 I~O: 시작/종료/소재/예산/생산개수/부가세/기타
  it("종료일 있는 완료 행: 열문자 파서 == 시트 파서 (neo=true)", () => {
    const raw = ["2026-06-01", "2026-06-05", "강남", 300000, 10, true, "메모"];
    const fromSheet = parseProductionRow(raw);
    const fromDb = parseProductionRow(relRow(colPayload(8, raw), 8)); // 직접생산 absStart=8(I)
    expect(fromDb).toEqual(fromSheet);
    expect(fromDb.개당단가).toBe(Math.round(300000 / 10));
  });

  it("생산중(종료일 빈) sheet/backfill 행도 신규 열 배치로 예산을 보존한다", () => {
    const raw = ["2026-06-01", "", "강남", 300000, 0, true, "생산중"];
    const fromSheet = parseProductionRow(raw);
    const fromDbBackfill = parseProductionRow(relRow(colPayload(8, raw), 8));
    expect(fromSheet).toMatchObject({
      시작일: "2026-06-01", 종료일: "", 소재: "강남", 기간예산: 300000,
      생산개수: 0, 부가세여부: true, 기타: "생산중",
    });
    expect(fromDbBackfill).toEqual(fromSheet);
    expect(isProductionMeaningful(fromSheet)).toBe(true);
  });

  it("종료일이 비정상이어도 신규 checkbox/메모 위치로 판별하고 시작일 인식을 허용한다", () => {
    const parsed = parseProductionRow(["2026-06-01", "미정", "강남", 300000, 0, false, "종료일 확인 필요"]);
    expect(parsed).toMatchObject({ 종료일: "미정", 소재: "강남", 기간예산: 300000, 부가세여부: false });
    expect(isProductionMeaningful(parsed)).toBe(true);
  });

  it("시작일이 누락/비정상이어도 양수 예산 행을 미배분 원장용으로 보존한다", () => {
    const missing = parseProductionRow(["", "", "강남", 300000, 0, false, "시작일 누락"]);
    const invalid = parseProductionRow(["날짜확인", "", "강북", 200000, 0, true, "시작일 오류"]);
    expect(missing).toMatchObject({ 시작일: "", 기간예산: 300000 });
    expect(invalid).toMatchObject({ 시작일: "날짜확인", 기간예산: 200000 });
    expect(isProductionMeaningful(missing)).toBe(true);
    expect(isProductionMeaningful(invalid)).toBe(true);
    expect(isProductionMeaningful(parseProductionRow(["", "", "", 0, 0, false, ""]))).toBe(false);
  });

  it("기존 단일 날짜 legacy 배치는 그대로 해석한다", () => {
    const parsed = parseProductionRow(["2026-05-01", "강남", 120000, 4, 30000, "legacy note", ""]);
    expect(parsed).toMatchObject({
      시작일: "2026-05-01", 종료일: "2026-05-01", 소재: "강남",
      기간예산: 120000, 생산개수: 4, 부가세여부: false, 기타: "legacy note",
    });
  });

  it("✅ dual-write 필드명 payload(생산중) → Zod 복원은 소재 보존 (read-db-tab safe 경로)", () => {
    // read-db-tab 의 safe(DBProduction, payload) 가 하는 일 = 파서 재실행 없이 Zod parse.
    const payload = {
      시작일: "2026-06-01", 종료일: "", 소재: "강남",
      기간예산: 300000, 생산개수: 0, 부가세여부: true, 기타: "생산중", 개당단가: 0,
    };
    const parsed = DBProduction.safeParse(payload);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.소재).toBe("강남"); // 배열 파서와 달리 밀림 없음
  });
});

describe("R2-5 현수막: 신규 U(r5,bool) 우선 — backfill 이 W(r7) 없어도 무영향", () => {
  it("P~V 7열(구 W 없음) 열문자 == 시트 파서", () => {
    // 날짜/업체/도착일/개당단가/주문개수/부가세(U,bool)/기타 — r[7]=W 없음
    const raw = ["2026-06-12", "현수막업체", "2026-06-15", 2000, 5, true, "메모"];
    const fromSheet = parseBannerRow(raw);
    const fromDb = parseBannerRow(relRow(colPayload(15, raw), 15)); // 현수막 absStart=15(P)
    expect(fromDb).toEqual(fromSheet);
    expect(fromDb.부가세여부).toBe(true); // r[5] 우선(구 W r[7] fallback 불필요)
    expect(fromDb.주문금액).toBe(2000 * 5);
  });
});
