/**
 * Scope B autosave — expense ledger pure logic regressions.
 *
 * Covers: one-off creation gate (no creation from hydration/defaults/empty),
 * invalid vs partial vs valid, and rename autosave conditions.
 */
import { describe, expect, it } from "vitest";
import {
  oneTimeExpenseCheck,
  shouldAutosaveRename,
} from "@/components/dashboard/expense-ledger/expense-autosave";

const BASE = {
  categoryId: "category-marketing",
  itemName: "사무실 임차료",
  amountWon: 100000,
  start: "2026-09-01",
  end: "2026-09-01",
  range: false,
};

describe("oneTimeExpenseCheck", () => {
  it("never creates from hydration/default values", () => {
    expect(
      oneTimeExpenseCheck({ categoryId: "", itemName: "", amountWon: 0, start: "2026-09-23", end: "2026-09-23", range: false }).status,
    ).toBe("empty");
  });

  it("creates only when category, item, amount, and dates are complete", () => {
    expect(oneTimeExpenseCheck(BASE).status).toBe("valid");
    expect(oneTimeExpenseCheck({ ...BASE, categoryId: "" }).status).toBe("partial");
    expect(oneTimeExpenseCheck({ ...BASE, itemName: "   " }).status).toBe("partial");
    expect(oneTimeExpenseCheck({ ...BASE, amountWon: 0 }).status).toBe("partial");
    expect(oneTimeExpenseCheck({ ...BASE, amountWon: -50 }).status).toBe("partial");
  });

  it("blocks malformed or incoherent dates without sending", () => {
    expect(oneTimeExpenseCheck({ ...BASE, start: "" }).status).toBe("invalid");
    expect(oneTimeExpenseCheck({ ...BASE, start: "2026-02-30" }).status).toBe("invalid");
    expect(
      oneTimeExpenseCheck({ ...BASE, range: true, start: "2026-09-05", end: "2026-09-01" }),
    ).toMatchObject({ status: "invalid" });
    expect(
      oneTimeExpenseCheck({ ...BASE, range: true, start: "2026-09-01", end: "2026-09-03" }).status,
    ).toBe("valid");
  });
});

describe("shouldAutosaveRename", () => {
  it("autosaves only real, usable name changes", () => {
    expect(shouldAutosaveRename("마케팅", "퍼포먼스 마케팅")).toBe(true);
    expect(shouldAutosaveRename("마케팅", "마케팅")).toBe(false);
    expect(shouldAutosaveRename("마케팅", "   ")).toBe(false);
    expect(shouldAutosaveRename("마케팅", "x".repeat(41))).toBe(false);
  });
});
