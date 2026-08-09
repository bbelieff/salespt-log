/**
 * BBE-59 Phase 2 — scripts/ops/backfill-db-row-numbers.mjs 순수 함수 단위 테스트.
 * DB 연결 없이 판정 로직(레거시 키 파싱·스킵 조건)만 검증 — db-migrate.mjs 의 computePending 과
 * 같은 패턴(순수 함수는 import 시 부작용 없음, main() 은 isMainModule 가드로 격리).
 */
import { describe, expect, it } from "vitest";
import { hasRowNumber, legacyRowNumber, pendingRowNumber } from "../../scripts/ops/backfill-db-row-numbers.mjs";

describe("legacyRowNumber", () => {
  it("레거시 4섹션 키에서 행번호를 뽑는다", () => {
    expect(legacyRowNumber("매입DB:r9")).toBe(9);
    expect(legacyRowNumber("직접생산:r123")).toBe(123);
    expect(legacyRowNumber("현수막:r4")).toBe(4);
    expect(legacyRowNumber("콜지기소:r7")).toBe(7);
  });

  it("신규 UUID 키는 null(행번호를 키에서 못 뽑음 — 매치 대상 아님)", () => {
    expect(legacyRowNumber("매입DB:3fa85f64-5717-4562-b3fc-2c963f66afa6")).toBeNull();
  });

  it("알 수 없는 섹션/형식은 null", () => {
    expect(legacyRowNumber("모르는섹션:r9")).toBeNull();
    expect(legacyRowNumber("매입DB:9")).toBeNull(); // r 접두어 없음
  });
});

describe("hasRowNumber", () => {
  it("유효한 양수 _row 가 있으면 true", () => {
    expect(hasRowNumber({ _row: 9 })).toBe(true);
    expect(hasRowNumber({ _row: "9" })).toBe(true); // DB 왕복 후 문자열일 수 있음
  });
  it("없거나 0/음수/비정상이면 false", () => {
    expect(hasRowNumber({})).toBe(false);
    expect(hasRowNumber({ _row: 0 })).toBe(false);
    expect(hasRowNumber({ _row: -1 })).toBe(false);
    expect(hasRowNumber({ _row: "abc" })).toBe(false);
    expect(hasRowNumber(null)).toBe(false);
  });
});

describe("pendingRowNumber — 대상 판정(멱등의 핵심)", () => {
  it("레거시 키 + _row 없음 → 채울 행번호 반환", () => {
    expect(pendingRowNumber("매입DB:r9", {})).toBe(9);
  });
  it("레거시 키인데 이미 _row 있음 → null(이미 처리됨, 재실행 시 스킵)", () => {
    expect(pendingRowNumber("매입DB:r9", { _row: 9 })).toBeNull();
  });
  it("신규 UUID 키 → null(대상 아님, 애초에 _row 를 append 가 이미 채움)", () => {
    expect(pendingRowNumber("매입DB:abc-uuid", {})).toBeNull();
  });
});
