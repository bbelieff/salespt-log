import { describe, expect, it } from "vitest";
import {
  hasRealSheet,
  isSheetlessTenantKey,
  isUsableTenantKey,
  newSheetlessTenantKey,
} from "@/util/tenant-key";

const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const SHEET = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcd"; // 합성 시트 ID 모양

describe("tenant-key (ADR-0038)", () => {
  it("새 번호는 local:<uuid> 이고 시트 ID 문자집합과 겹치지 않는다", () => {
    const key = newSheetlessTenantKey(UUID.toUpperCase());
    expect(key).toBe(`local:${UUID}`);
    expect(/^[A-Za-z0-9_-]+$/.test(key)).toBe(false);
    expect(isSheetlessTenantKey(key)).toBe(true);
    expect(hasRealSheet(key)).toBe(false);
    expect(isUsableTenantKey(key)).toBe(true);
  });

  it("uuid 가 아니면 만들지 않는다 — 빈 값·짧은 값으로 번호가 겹치는 사고 방지", () => {
    expect(() => newSheetlessTenantKey("")).toThrow();
    expect(() => newSheetlessTenantKey("abc")).toThrow();
  });

  it("기존 시트 ID 는 그대로 시트가 있는 번호다", () => {
    expect(hasRealSheet(SHEET)).toBe(true);
    expect(isSheetlessTenantKey(SHEET)).toBe(false);
    expect(isUsableTenantKey(SHEET)).toBe(true);
  });

  it("빈 값은 시트도 아니고 기록을 나누는 키도 아니다", () => {
    for (const v of ["", "  ", null, undefined]) {
      expect(hasRealSheet(v)).toBe(false);
      expect(isUsableTenantKey(v)).toBe(false);
      expect(isSheetlessTenantKey(v)).toBe(false);
    }
  });
});
