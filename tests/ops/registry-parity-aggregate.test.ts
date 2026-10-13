import { describe, expect, it } from "vitest";
import { registryAggregateReport, registryTargetCounts } from "../../scripts/ops/registry-parity-lib.mjs";

describe("registry audit aggregate-only privacy", () => {
  it("returns counts without source keys or field values", () => {
    const result = registryAggregateReport({ uniqueSheetKeys: 3, dbCount: 2,
      missingInDb: ["sample@example.com|0|가상"], missingInSheet: ["private-id"],
      fieldMismatches: [{ key: "secret-key", field: "name", sheet: "가상값", db: "다른값" }] });
    expect(result).toEqual({ sheetKeys: 3, dbRows: 2, missingInDb: 1, missingInSheet: 1, fieldMismatches: 1 });
    expect(Object.values(result).every((value) => typeof value === "number")).toBe(true);
  });
  it("compares distinct trainee spreadsheet sets, not just equal counts", () => {
    const sheet = [{ role: "trainee", spreadsheet_id: "same" }, { role: "trainee", spreadsheet_id: "sheet-only" },
      { role: "trainee", spreadsheet_id: "same" }, { role: "trainer", spreadsheet_id: "other" }];
    const db = [{ role: "trainee", spreadsheet_id: "same" }, { role: "trainee", spreadsheet_id: "db-only" }];
    expect(registryTargetCounts(sheet, db)).toEqual({ sheetTargets: 2, dbTargets: 2, onlyInSheet: 1, onlyInDb: 1 });
    expect(registryTargetCounts(sheet, sheet)).toEqual({ sheetTargets: 2, dbTargets: 2, onlyInSheet: 0, onlyInDb: 0 });
  });
});
