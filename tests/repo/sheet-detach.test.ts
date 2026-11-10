/** ADR-0038 5단계 — 시트에서 떼어 낸 기수 판정 규칙. 합성 명단만. */
import { describe, expect, it, vi } from "vitest";

const rows = vi.hoisted(() => ({ value: [] as string[][], reads: 0 }));
vi.mock("@/repo/users-rows", () => ({ cachedRegistryRows: async () => { rows.reads += 1; return rows.value; } }));

import { isSheetDetached } from "@/repo/sheet-detach";

const NINE = new Set(["9"]);
rows.value = [
  ["a@example.test", "9", "합성A", "SHEET_A", "trainee", "active"],
  ["b@example.test", "유보", "합성B", "SHEET_B", "trainee", "active", "", "", "9기"],
  ["c@example.test", "9", "합성C", "SHEET_C", "trainee", "active"],
  ["c@example.test", "A3-9기", "합성C", "SHEET_C", "trainee", "active"],
  ["d@example.test", "8", "합성D", "SHEET_D", "trainee", "active"],
];

describe("isSheetDetached", () => {
  it("목록이 비어 있으면 명단을 읽지도 않고 false(지금 운영)", async () => {
    expect(await isSheetDetached("SHEET_A", new Set())).toBe(false);
    expect(rows.reads).toBe(0);
  });
  it("시트 없는 번호는 항상 true", async () => {
    expect(await isSheetDetached("local:11111111-1111-4111-8111-111111111111", new Set())).toBe(true);
  });
  it("떼어 낸 기수의 시트는 true, 다른 기수는 false", async () => {
    expect(await isSheetDetached("SHEET_A", NINE)).toBe(true);
    expect(await isSheetDetached("SHEET_D", NINE)).toBe(false);
  });
  it("유보 수강생은 원래 기수(I열)로 본다", async () => {
    expect(await isSheetDetached("SHEET_B", NINE)).toBe(true);
  });
  it("한 시트를 아레나 행도 쓰면 떼어 내지 않는다(전광판이 시트를 읽음)", async () => {
    expect(await isSheetDetached("SHEET_C", NINE)).toBe(false);
  });
  it("명단에 없는 시트는 false", async () => {
    expect(await isSheetDetached("SHEET_X", NINE)).toBe(false);
  });
});
