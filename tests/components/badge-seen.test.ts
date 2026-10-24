import { describe, expect, it } from "vitest";
import { newBadgeIds } from "@/components/badges/badge-seen";
import type { BadgeState } from "@/lib/analytics/badges";

const s = (id: string, earnedOn: string | null, earned = true): BadgeState => ({ id, earned, earnedOn, progress: null });
const TODAY = "2026-10-24";

describe("newBadgeIds", () => {
  it("first visit on this device: only badges earned in the last 7 days are new", () => {
    expect(newBadgeIds([s("old", "2026-10-01"), s("recent", "2026-10-20"), s("nodate", null), s("locked", null, false)], null, TODAY)).toEqual(["recent"]);
  });
  it("after a visit: anything earned and not yet seen is new, whatever its date", () => {
    expect(newBadgeIds([s("a", "2026-10-01"), s("b", "2026-09-01"), s("c", null)], new Set(["a"]), TODAY)).toEqual(["b", "c"]);
  });
});
