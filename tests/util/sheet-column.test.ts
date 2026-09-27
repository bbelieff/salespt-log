import { describe, expect, it } from "vitest";
import { colName } from "@/util/sheet-column";

describe("colName (0-based → 열문자)", () => {
  it.each([
    [0, "A"], [25, "Z"], [26, "AA"], [28, "AC"], [45, "AT"], [46, "AU"],
    [47, "AV"], [51, "AZ"], [52, "BA"], [65, "BN"], [701, "ZZ"], [702, "AAA"],
  ])("%i → %s", (i, out) => {
    expect(colName(i)).toBe(out);
  });
});
