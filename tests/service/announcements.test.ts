/**
 * 새소식 노출 필터 (announcement-popup §3) — 순수 함수 단위 테스트.
 * audience(all/arena/regular)·기간(start~end)·active·pinned 정렬 + visible 최신 6.
 */
import { describe, expect, it } from "vitest";
import {
  filterNoticesFor,
  isArenaAudienceCohort,
  pickVisibleUpdates,
} from "@/service/announcements";
import { Notice, UpdateItem } from "@/types";

const notice = (over: Partial<Notice>): Notice =>
  Notice.parse({ id: "n1", ...over });

describe("isArenaAudienceCohort", () => {
  it("A 접두 cohort 만 arena", () => {
    expect(isArenaAudienceCohort("A1-6")).toBe(true);
    expect(isArenaAudienceCohort("A1-6기")).toBe(true);
    expect(isArenaAudienceCohort("6")).toBe(false);
    expect(isArenaAudienceCohort("")).toBe(false);
    expect(isArenaAudienceCohort(null)).toBe(false);
  });
});

describe("filterNoticesFor", () => {
  const today = "2026-06-11";

  it("active=false 제외, 기간(빈값=무제한) 필터", () => {
    const list = [
      notice({ id: "off", active: false }),
      notice({ id: "future", start: "2026-07-01" }),
      notice({ id: "past", end: "2026-06-10" }),
      notice({ id: "open" }), // start/end 빈값 = 무제한
      notice({ id: "in", start: "2026-06-01", end: "2026-06-30" }),
    ];
    const got = filterNoticesFor(list, { isArena: false, today }).map((n) => n.id);
    expect(got.sort()).toEqual(["in", "open"]);
  });

  it("audience — arena 사용자: regular 공지 제외 / 일반 사용자: arena 공지 제외", () => {
    const list = [
      notice({ id: "all", audience: "all" }),
      notice({ id: "arena", audience: "arena" }),
      notice({ id: "regular", audience: "regular" }),
    ];
    expect(filterNoticesFor(list, { isArena: true, today }).map((n) => n.id).sort())
      .toEqual(["all", "arena"]);
    expect(filterNoticesFor(list, { isArena: false, today }).map((n) => n.id).sort())
      .toEqual(["all", "regular"]);
  });

  it("pinned 우선 정렬", () => {
    const list = [
      notice({ id: "b" }),
      notice({ id: "a", pinned: true }),
    ];
    expect(filterNoticesFor(list, { isArena: false, today })[0]!.id).toBe("a");
  });
});

describe("pickVisibleUpdates", () => {
  const upd = (pr: number, visible: boolean): UpdateItem =>
    UpdateItem.parse({ pr, visible });

  it("visible=TRUE 만, pr desc, 최대 6개", () => {
    const list = [
      ...Array.from({ length: 12 }, (_, i) => upd(i + 1, true)),
      upd(99, false),
    ];
    const got = pickVisibleUpdates(list);
    expect(got).toHaveLength(6);
    expect(got[0]!.pr).toBe(12); // 99 는 invisible — 제외
    expect(got[5]!.pr).toBe(7); // 12,11,10,9,8,7
  });
});
