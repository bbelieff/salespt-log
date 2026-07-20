/**
 * DB생산 폼 dirty 판정 회귀 (2026-07-20 유실 사고 수리).
 * 핵심: **자동(formula) 필드만 변할 때는 dirty 아님**(거짓양성 0) — 수식/자동값이 mount 정착·
 * refetch 로 흔들려도 이탈 가드가 뜨지 않아야 한다. 사용자 입력 필드가 바뀔 때만 dirty.
 */
import { describe, expect, it } from "vitest";
import { CHANNELS } from "../../app/(app)/db/_lib/channels";
import { rowFormDirty } from "../../app/(app)/db/_lib/dirty";

const purchase = CHANNELS.purchase.fields;
const direct = CHANNELS.direct.fields;

const base = {
  구매일: "2026-07-01", 업체명: "가나상사", 총액: 110000, 부가세여부: true,
  주문개수: 10, 개당단가: 10000, 주문금액: 100000, 기타: "",
};

describe("rowFormDirty — 자동 필드 제외 dirty 판정", () => {
  it("동일 → dirty 아님", () => {
    expect(rowFormDirty(purchase, base, { ...base })).toBe(false);
  });

  it("**거짓 dirty 0**: 자동(formula) 필드만 달라도 dirty 아님 (개당단가·주문금액 mount 정착)", () => {
    const settled = { ...base, 개당단가: 9999, 주문금액: 99990 }; // 수식 재계산으로 흔들린 값
    expect(rowFormDirty(purchase, base, settled)).toBe(false);
  });

  it("사용자 입력 필드(업체명) 변경 → dirty", () => {
    expect(rowFormDirty(purchase, base, { ...base, 업체명: "다라상사" })).toBe(true);
  });

  it("주문개수(입력) 변경 → dirty", () => {
    expect(rowFormDirty(purchase, base, { ...base, 주문개수: 12 })).toBe(true);
  });

  it("총액(입력 도우미, formOnly) 변경 → dirty (formula 아님)", () => {
    expect(rowFormDirty(purchase, base, { ...base, 총액: 220000 })).toBe(true);
  });

  it("부가세여부 토글 변경 → dirty", () => {
    expect(rowFormDirty(purchase, base, { ...base, 부가세여부: false })).toBe(true);
  });

  it("타입 정규화: number 10 vs string '10' 은 동일 취급(거짓 dirty 방지)", () => {
    expect(rowFormDirty(purchase, base, { ...base, 주문개수: "10" as never })).toBe(false);
  });

  it("null/undefined/빈문자 정규화 동일 취급", () => {
    expect(rowFormDirty(purchase, { ...base, 기타: undefined }, { ...base, 기타: "" })).toBe(false);
  });

  it("직접생산: 자동 개당단가/기간예산만 흔들려도 dirty 아님", () => {
    const d = { 시작일: "2026-07-01", 종료일: "2026-07-05", 소재: "메타", 예산입력: 100, 부가세여부: false, 기간예산: 100, 개당단가: 50, 기타: "" };
    expect(rowFormDirty(direct, d, { ...d, 개당단가: 999, 기간예산: 12345 })).toBe(false);
    expect(rowFormDirty(direct, d, { ...d, 소재: "구글" })).toBe(true);
  });
});
