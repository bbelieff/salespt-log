/**
 * BBE-66/63 최우선 지시(2026-08-10) — registry-parity.mjs 순수 로직 검증.
 */
import { describe, expect, it } from "vitest";
import {
  classifyFieldMismatches,
  diffByKey,
  missingInDbAsClassified,
} from "../../scripts/ops/registry-parity-lib.mjs";

describe("diffByKey", () => {
  const keyOf = (r: Record<string, unknown>) => String(r.email);

  it("같은 키·같은 필드값이면 불일치 0건", () => {
    const rows = [{ email: "a@x.com", name: "A" }];
    const r = diffByKey(rows, rows, keyOf, ["name"]);
    expect(r.missingInDb).toHaveLength(0);
    expect(r.missingInSheet).toHaveLength(0);
    expect(r.fieldMismatches).toHaveLength(0);
  });

  it("시트에만 있는 키는 missingInDb 로 잡는다(= 시차 후보)", () => {
    const sheetRows = [{ email: "a@x.com", name: "A" }, { email: "b@x.com", name: "B" }];
    const dbRows = [{ email: "a@x.com", name: "A" }];
    const r = diffByKey(sheetRows, dbRows, keyOf, ["name"]);
    expect(r.missingInDb).toEqual(["b@x.com"]);
  });

  it("DB에만 있는 키는 missingInSheet 로 잡는다(역방향)", () => {
    const sheetRows = [{ email: "a@x.com", name: "A" }];
    const dbRows = [{ email: "a@x.com", name: "A" }, { email: "c@x.com", name: "C" }];
    const r = diffByKey(sheetRows, dbRows, keyOf, ["name"]);
    expect(r.missingInSheet).toEqual(["c@x.com"]);
  });

  it("같은 키인데 필드값이 다르면 fieldMismatches 로 잡는다", () => {
    const sheetRows = [{ email: "a@x.com", name: "A" }];
    const dbRows = [{ email: "a@x.com", name: "다른이름" }];
    const r = diffByKey(sheetRows, dbRows, keyOf, ["name"]);
    expect(r.fieldMismatches).toEqual([{ key: "a@x.com", field: "name", sheet: "A", db: "다른이름" }]);
  });

  it("완전동일 중복 시트 행은 1건으로 축약(BBE-91 실측 패턴)", () => {
    const sheetRows = [{ email: "a@x.com", name: "A" }, { email: "a@x.com", name: "A" }];
    const dbRows = [{ email: "a@x.com", name: "A" }];
    const r = diffByKey(sheetRows, dbRows, keyOf, ["name"]);
    expect(r.uniqueSheetKeys).toBe(1);
  });
});

describe("missingInDbAsClassified", () => {
  it("존재 자체가 없는 키는 항상 '시차' 로 확정 판정된다", () => {
    const r = missingInDbAsClassified(["a@x.com|8|홍길동"], "users");
    expect(r).toHaveLength(1);
    expect(r[0]!.type).toBe("시차");
    expect(r[0]!.user).toBe("users:a@x.com|8|홍길동");
  });
});

describe("classifyFieldMismatches — 렌더옵션(#752) 판정", () => {
  it("한쪽이 raw serial, 다른쪽이 ISO 인데 같은 날짜면 렌더옵션 + 상세에 '같은 날짜' 명시", () => {
    const mismatches = [{ key: "a@x.com", field: "course_start_iso", sheet: "2026-08-07", db: "46241" }];
    const r = classifyFieldMismatches(mismatches, "users");
    expect(r[0]!.type).toBe("렌더옵션");
    expect(r[0]!.detail).toContain("같은 날짜");
  });

  it("한쪽이 raw serial 인데 실제로 다른 날짜를 가리키면 렌더옵션(의심)으로 잡되 불일치임을 명시", () => {
    const mismatches = [{ key: "a@x.com", field: "graduation_iso", sheet: "2026-09-26", db: "46241" }];
    const r = classifyFieldMismatches(mismatches, "users");
    expect(r[0]!.type).toBe("렌더옵션");
    expect(r[0]!.detail).toContain("의심");
  });

  it("날짜류가 아닌 일반 필드 불일치는 '진짜불일치' 로 남는다", () => {
    const mismatches = [{ key: "a@x.com", field: "status", sheet: "active", db: "inactive" }];
    const r = classifyFieldMismatches(mismatches, "users");
    expect(r[0]!.type).toBe("진짜불일치");
  });
});
