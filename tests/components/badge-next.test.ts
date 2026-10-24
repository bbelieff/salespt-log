import { describe, expect, it } from "vitest";
import { badgeRows, chipModel, pickNext } from "@/components/badges/badge-next";
import type { BadgeState } from "@/lib/analytics/badges";

const got = (id: string, on = "2026-10-01"): BadgeState => ({ id, earned: true, earnedOn: on, progress: null });
const prog = (id: string, cur: number, max: number, unit = "일"): BadgeState => ({ id, earned: false, earnedOn: null, progress: { cur, max, unit } });

describe("pickNext", () => {
  it("chooses the badge with the smallest remaining share and never a secret one", () => {
    const next = pickNext(badgeRows([prog("days-30", 23, 30), prog("contracts-5", 1, 5, "건"), prog("days-100", 23, 100)]));
    expect(next?.def.id).toBe("days-30");
  });
  it("without any bar falls back to the first ready badge that has an action", () => {
    expect(pickNext(badgeRows([]))?.def.id).toBe("first-activity");
  });
});

describe("chipModel", () => {
  it("normal: count + days left to the next badge, bar = that badge's progress", () => {
    const m = chipModel([got("first-activity"), prog("days-3", 2, 3)], []);
    expect(m).toMatchObject({ kind: "next", got: 1, total: 31, text: "다음 물주기 3일까지 1일", img: "droplet", pct: 67 });
  });
  it("a new, unseen badge wins over the next badge", () => {
    const m = chipModel([got("first-contract"), prog("days-3", 2, 3)], ["first-contract"]);
    expect(m).toMatchObject({ kind: "new", text: "새 배지 「첫 계약」 ✨", img: "money_bag" });
  });
  it("several new badges: the most recently earned one is named", () => {
    const m = chipModel([got("first-activity", "2026-10-01"), got("first-contract", "2026-10-24")], ["first-activity", "first-contract"]);
    expect(m.text).toBe("새 배지 「첫 계약」 ✨");
  });
  it("nothing yet: one first action", () => {
    expect(chipModel([], [])).toMatchObject({ kind: "first", got: 0, text: "첫 배지: 오늘 연락 1건 기록", pct: 0 });
  });
  it("only secret or not-ready badges left → done message", () => {
    const ready = badgeRows([]).filter(r => r.def.ready && r.def.group !== "secret").map(r => got(r.def.id));
    expect(chipModel(ready, [])).toMatchObject({ kind: "done", img: "trophy" });
  });
});
