import { describe, expect, it } from "vitest";
import { editableTaskRows, joinAlignedRows, joinTaskRows, pairPriorOutcomes, splitAlignedRows, splitTaskRows } from "@/util/weekly-goal-tasks";

describe("PT과제 row storage", () => {
  it("reads every newline form as one row each and drops blank rows", () => {
    expect(splitTaskRows("first\r\n second \n\nthird\rfourth")).toEqual(["first", "second", "third", "fourth"]);
  });
  it("treats empty stored text as no rows at all", () => {
    expect(splitTaskRows("")).toEqual([]);
    expect(splitTaskRows("\n \n")).toEqual([]);
  });
  it("always hands the editor one row to type into", () => {
    expect(editableTaskRows("")).toEqual([""]);
    expect(editableTaskRows("only")).toEqual(["only"]);
  });
  it("round-trips rows through the stored text column", () => {
    const rows = ["첫 번째 과제", "두 번째 과제"];
    expect(splitTaskRows(joinTaskRows(rows))).toEqual(rows);
  });
  it("never writes a blank row that would shift later rows", () => {
    expect(joinTaskRows(["a", "", "b"])).toBe("a\nb");
  });
});

describe("PT과제 성과 alignment", () => {
  it("keeps an unfilled middle outcome so positions still match the tasks", () => {
    expect(splitAlignedRows(joinAlignedRows(["done", "", "also done"]))).toEqual(["done", "", "also done"]);
  });
  it("drops only trailing blanks", () => {
    expect(joinAlignedRows(["a", "", ""])).toBe("a");
  });
  it("pairs each previous task with its own outcome", () => {
    expect(pairPriorOutcomes("t1\nt2\nt3", "o1\n\no3")).toEqual([
      { task: "t1", outcome: "o1" }, { task: "t2", outcome: "" }, { task: "t3", outcome: "o3" },
    ]);
  });
  it("pads to whichever side has more rows and never returns nothing to render", () => {
    expect(pairPriorOutcomes("t1", "o1\no2")).toEqual([{ task: "t1", outcome: "o1" }, { task: "", outcome: "o2" }]);
    expect(pairPriorOutcomes("", "")).toEqual([{ task: "", outcome: "" }]);
  });
});
