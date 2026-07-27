/**
 * R2-5 정합 대조 (db-read-production): 03 DB관리 4섹션의 DB 파서 재사용이
 * 시트 파서(parseXRow)와 같은 결과를 내는지 고정. 특히:
 *  • 직접생산 "생산중"(종료일 빈) 행 — 필드명 Zod 경로가 배열-neo 밀림을 피하는지
 *  • 파생값(주문금액=개당단가×주문개수, 개당단가=예산/생산개수) 양 경로 동일
 *  • 합계행 skip 기준
 */
import { describe, expect, it } from "vitest";
import { DBProduction } from "@/types";
import {
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

describe("R2-5 직접생산: 생산중(종료일 빈) 행 — 배열 vs 필드명 경로", () => {
  // 신규 레이아웃 I~O: 시작/종료/소재/예산/생산개수/부가세/기타
  it("종료일 있는 완료 행: 열문자 파서 == 시트 파서 (neo=true)", () => {
    const raw = ["2026-06-01", "2026-06-05", "강남", 300000, 10, true, "메모"];
    const fromSheet = parseProductionRow(raw);
    const fromDb = parseProductionRow(relRow(colPayload(8, raw), 8)); // 직접생산 absStart=8(I)
    expect(fromDb).toEqual(fromSheet);
    expect(fromDb.개당단가).toBe(Math.round(300000 / 10));
  });

  it("⚠️ 생산중(종료일 빈) 행: 배열 파서는 neo=false 로 밀림 → 필드명 Zod 경로가 정답", () => {
    // 종료일(J) 빈 → parseProductionRow 는 neo=false → 소재를 예산으로 오독(시트 파서 한계).
    // dual-write payload(이미 파싱된 타입)는 Zod 로 그대로 복원해야 정확 — read-db-tab 이
    // 필드명이면 파서 재실행 안 하고 Zod. 여기선 그 위험을 문서화(파서 직접 호출 시 밀림 확인).
    const raw = ["2026-06-01", "", "강남", 300000, 0, true, "생산중"];
    const parsed = parseProductionRow(raw);
    // neo=false 경로 — 종료일=시작일, 소재=r[1]="" (밀림 실증)
    expect(parsed.종료일).toBe(parsed.시작일);
    expect(parsed.소재).toBe(""); // 강남이 아니라 빈값 — 배열 파서로는 부정확
    // → read-db-tab 은 이 케이스에 Zod 경로를 쓰므로 실제 서비스는 정확(아래 통합 확인).
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
