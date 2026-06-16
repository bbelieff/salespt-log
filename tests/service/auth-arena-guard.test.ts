/**
 * 아레나 시트 가드 (arena-numeric-duplicate-claim-guard) — 순수 결정함수.
 * 숫자 기수로 아레나 시트 클레임 시 아레나 행으로 흡수(중복 숫자 행 0).
 */
import { describe, expect, it } from "vitest";
import { resolveArenaSheetClaim } from "@/service/auth";

const arena = { cohort: "A1-3", name: "정유영(조성도)" };

describe("resolveArenaSheetClaim", () => {
  it("숫자 기수로 아레나 시트 클레임 → 아레나 (cohort,name)으로 흡수(redirected)", () => {
    const r = resolveArenaSheetClaim({ cohort: "3", name: "정유영" }, arena);
    expect(r.cohort).toBe("A1-3");
    expect(r.name).toBe("정유영(조성도)");
    expect(r.redirected).toBe(true);
  });

  it('"3기" 처럼 기 붙은 숫자도 아레나로 흡수', () => {
    const r = resolveArenaSheetClaim({ cohort: "5기", name: "김효준" }, {
      cohort: "A1-5",
      name: "김효준",
    });
    expect(r.cohort).toBe("A1-5");
    expect(r.redirected).toBe(true);
  });

  it("아레나 기수로 직접 클레임하면 그대로(흡수 안 함)", () => {
    const r = resolveArenaSheetClaim({ cohort: "A1-3", name: "정유영(조성도)" }, arena);
    expect(r.cohort).toBe("A1-3");
    expect(r.redirected).toBe(false);
  });

  it("아레나 행 없는 일반 숫자 시트는 그대로(정상 수강생 클레임)", () => {
    const r = resolveArenaSheetClaim({ cohort: "8", name: "홍길동" }, null);
    expect(r.cohort).toBe("8");
    expect(r.name).toBe("홍길동");
    expect(r.redirected).toBe(false);
  });
});
