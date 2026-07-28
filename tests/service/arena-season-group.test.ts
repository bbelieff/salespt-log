/**
 * 아레나 시즌 그룹핑 회귀 (AR-1).
 * 핵심: ①A2 등장 시 **자동** 시즌2 분리 ②기간은 trainee 데이터 파생(하드코딩 0)
 * ③비아레나 라벨은 orphans 로 보존(유실 금지) ④파서는 cohort-token 재사용 계약.
 */
import { describe, expect, it } from "vitest";
import { groupArenaBySeason } from "../../components/auth/arena-season";
import type { Trainee } from "../../components/auth/AdminUserPickerTypes";

const u = (
  email: string,
  cohort: string,
  start?: string,
  end?: string,
): Trainee => ({
  email,
  cohort,
  name: email.split("@")[0]!,
  spreadsheetId: "",
  role: "trainee",
  courseStartISO: start,
  graduationISO: end,
});

describe("groupArenaBySeason", () => {
  it("A1 기수들을 시즌1 하나로 묶는다", () => {
    const { seasons, orphans } = groupArenaBySeason([
      ["A1-1", [u("a@x.com", "A1-1기"), u("b@x.com", "A1-1기")]],
      ["A1-2", [u("c@x.com", "A1-2기")]],
    ]);
    expect(orphans).toEqual([]);
    expect(seasons).toHaveLength(1);
    expect(seasons[0]!.season).toBe(1);
    expect(seasons[0]!.groups.map(([k]) => k)).toEqual(["A1-1", "A1-2"]);
    expect(seasons[0]!.count).toBe(3);
  });

  it("**A2 등장 → 자동으로 시즌2 그룹 분리**(시즌 번호 asc)", () => {
    const { seasons } = groupArenaBySeason([
      ["A2-1", [u("d@x.com", "A2-1기")]],
      ["A1-1", [u("a@x.com", "A1-1기")]],
      ["A1-2", [u("c@x.com", "A1-2기")]],
    ]);
    expect(seasons.map((s) => s.season)).toEqual([1, 2]);
    expect(seasons[0]!.groups.map(([k]) => k)).toEqual(["A1-1", "A1-2"]);
    expect(seasons[1]!.groups.map(([k]) => k)).toEqual(["A2-1"]);
    expect(seasons[1]!.count).toBe(1);
  });

  it("기간 = 시즌 내 최소 개강 ~ 최대 종강 (데이터 파생, 하드코딩 없음)", () => {
    const { seasons } = groupArenaBySeason([
      ["A1-1", [u("a@x.com", "A1-1기", "2026-06-12", "2026-08-01")]],
      ["A1-2", [u("c@x.com", "A1-2기", "2026-06-20", "2026-08-09")]],
    ]);
    expect(seasons[0]!.startISO).toBe("2026-06-12");
    expect(seasons[0]!.endISO).toBe("2026-08-09");
  });

  it("잘못된/빈 날짜는 기간 계산에서 제외 — undefined 유지", () => {
    const { seasons } = groupArenaBySeason([
      ["A1-1", [u("a@x.com", "A1-1기", "", "not-a-date")]],
    ]);
    expect(seasons[0]!.startISO).toBeUndefined();
    expect(seasons[0]!.endISO).toBeUndefined();
  });

  it("비아레나 라벨(숫자 기수·미분류)은 orphans 로 **보존**(유실 금지)", () => {
    const { seasons, orphans } = groupArenaBySeason([
      ["A1-1", [u("a@x.com", "A1-1기")]],
      ["8", [u("e@x.com", "8기")]],
      ["—", [u("f@x.com", "")]],
    ]);
    expect(seasons).toHaveLength(1);
    expect(orphans.map(([k]) => k)).toEqual(["8", "—"]);
  });

  it("파서 재사용 계약: '기' 접미사 유무 둘 다 같은 시즌으로 인식", () => {
    const { seasons, orphans } = groupArenaBySeason([
      ["A1-1", [u("a@x.com", "A1-1")]],
      ["A1-2기", [u("b@x.com", "A1-2기")]],
    ]);
    expect(orphans).toEqual([]);
    expect(seasons).toHaveLength(1);
    expect(seasons[0]!.count).toBe(2);
  });

  it("빈 입력 → 빈 결과", () => {
    expect(groupArenaBySeason([])).toEqual({ seasons: [], orphans: [] });
  });

  it("테스터(A{n}-0)도 시즌 파싱은 되지만 호출부가 아레나 카테고리만 넘긴다", () => {
    const { seasons } = groupArenaBySeason([["A1-0", [u("t@x.com", "A1-0기")]]]);
    expect(seasons[0]!.season).toBe(1);
  });
});
