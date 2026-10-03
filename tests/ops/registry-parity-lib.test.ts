/**
 * BBE-66/63 최우선 지시(2026-08-10) — registry-parity.mjs 순수 로직 검증.
 */
import { describe, expect, it } from "vitest";
import {
  classifyFieldMismatches,
  diffByKey,
  missingInDbAsClassified,
  normalizeCohortType,
  normalizeSortOrder,
} from "../../scripts/ops/registry-parity-lib.mjs";
import { parseRow } from "../../lib/repo/users";

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

  it("같은 자연키에 값이 다른 중복 행이 있으면 마지막 행을 대표로 쓴다(BBE-143 — 김덕호/박준용 실측: " +
    "구 prep 행 + 완료 행 공존, backfill-registry.mjs 는 시트 순서대로 upsert 해 마지막 값이 DB 에 남음)", () => {
    const sheetRows = [
      { email: "a@x.com", name: "A", cohort_label: "8" }, // 구 prep 행(불완전, 시트 앞쪽)
      { email: "a@x.com", name: "A", cohort_label: "A1-1" }, // 완료 행(시트 뒤쪽) — DB 는 이 값으로 수렴
    ];
    const dbRows = [{ email: "a@x.com", name: "A", cohort_label: "A1-1" }];
    const r = diffByKey(sheetRows, dbRows, keyOf, ["cohort_label"]);
    expect(r.fieldMismatches).toHaveLength(0); // 첫 행(prep, "8")을 대표로 썼다면 여기서 오탐 발생
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

describe("diffByKey — normalizers(BBE-143)", () => {
  const keyOf = (r: Record<string, unknown>) => String(r.email);

  it("정규화 후 같은 값이면 fieldMismatches 로 잡지 않는다(예: sort_order '05' vs '5')", () => {
    const sheetRows = [{ email: "a@x.com", sort_order: "05" }];
    const dbRows = [{ email: "a@x.com", sort_order: "5" }];
    const r = diffByKey(sheetRows, dbRows, keyOf, ["sort_order"], { sort_order: normalizeSortOrder });
    expect(r.fieldMismatches).toHaveLength(0);
  });

  it("정규화해도 실제로 다른 값이면 여전히 fieldMismatches 로 잡는다 — 원본(raw) 값 그대로 보고", () => {
    const sheetRows = [{ email: "a@x.com", sort_order: "3" }];
    const dbRows = [{ email: "a@x.com", sort_order: "7" }];
    const r = diffByKey(sheetRows, dbRows, keyOf, ["sort_order"], { sort_order: normalizeSortOrder });
    expect(r.fieldMismatches).toEqual([{ key: "a@x.com", field: "sort_order", sheet: "3", db: "7" }]);
  });

  it("정규화 미지정 필드는 raw 비교 그대로 유지(회귀 방지)", () => {
    const sheetRows = [{ email: "a@x.com", name: "A" }];
    const dbRows = [{ email: "a@x.com", name: "a" }];
    const r = diffByKey(sheetRows, dbRows, keyOf, ["name"]);
    expect(r.fieldMismatches).toHaveLength(1);
  });
});

describe("normalizeSortOrder — lib/repo/users.ts parseRow 와 동일 규칙(BBE-143)", () => {
  // parseRow 는 20칸 행 배열을 받는다. sortOrder 는 M(index 12). 나머지는 zod 기본값으로 채워지도록
  // 최소 유효 행(email 만 유효 형식) 구성 — 다른 필드는 sortOrder 판정에 영향 없음.
  function rowWithSortOrder(raw: string) {
    const r = new Array(20).fill("");
    r[0] = "a@x.com"; // email — zod .email() 통과 필요
    r[12] = raw;
    return r;
  }

  it.each([
    ["", "0"],
    ["0", "0"],
    ["05", "5"],
    ["5", "5"],
    ["-3", "0"],
    ["abc", "0"],
    ["12", "12"],
  ])("raw=%p → normalizeSortOrder=%p, parseRow(sortOrder) 와 일치", (raw, expected) => {
    expect(normalizeSortOrder(raw)).toBe(expected);
    const user = parseRow(rowWithSortOrder(raw));
    expect(user).not.toBeNull();
    expect(String(user!.sortOrder)).toBe(expected);
  });
});

describe("normalizeCohortType — lib/repo/cohorts.ts:106 과 동일 규칙(BBE-143)", () => {
  // cohorts.ts:106 `type: r[3] === "arena" ? "arena" : "cohort"` 를 그대로 미러링.
  // (listCohorts 는 시트/DB I/O 를 요구해 여기서 직접 호출 불가 — 규칙만 값 단위로 대조)
  it.each([
    ["arena", "arena"],
    ["cohort", "cohort"],
    ["", "cohort"],
    ["ARENA", "cohort"], // 대소문자 다르면 코드와 동일하게 "cohort" — 엄격 일치만 arena
  ])("raw=%p → %p", (raw, expected) => {
    expect(normalizeCohortType(raw)).toBe(expected);
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
