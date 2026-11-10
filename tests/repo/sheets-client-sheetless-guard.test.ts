/** ADR-0038 — 시트 없는 수강생 번호는 구글 시트 API 에 절대 도달하지 않는다(네트워크 0). */
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ n: 0 }));
vi.mock("@/config", () => ({ serviceAccount: () => ({ client_email: "sa@example.test", private_key: "synthetic" }) }));
vi.mock("googleapis", () => {
  const fn = async () => { calls.n += 1; return { data: { values: [["ok"]] } }; };
  const values = { get: fn, batchGet: fn, update: fn, batchUpdate: fn, append: fn, clear: fn, batchClear: fn };
  return {
    google: {
      auth: { JWT: class {} },
      sheets: () => ({ spreadsheets: { values, get: fn, batchUpdate: fn } }),
    },
  };
});

import { readRange, sheetsClient, SheetlessTenantError } from "@/repo/sheets-client";

describe("sheets-client sheetless guard", () => {
  beforeEach(() => { calls.n = 0; });

  it("local: 번호면 읽기·쓰기 모두 호출 전에 막는다", async () => {
    const id = "local:0f8fad5b-d9cb-469f-a165-70867728950e";
    await expect(readRange(id, "A1:B2")).rejects.toBeInstanceOf(SheetlessTenantError);
    const s = sheetsClient();
    await expect(s.spreadsheets.values.batchUpdate({ spreadsheetId: id } as never)).rejects.toThrow("[no-sheet]");
    await expect(s.spreadsheets.values.append({ spreadsheetId: id } as never)).rejects.toThrow("[no-sheet]");
    await expect(s.spreadsheets.batchUpdate({ spreadsheetId: id } as never)).rejects.toThrow("[no-sheet]");
    expect(calls.n).toBe(0);
  });

  it("기존 시트 번호는 지금과 똑같이 통과한다", async () => {
    const rows = await readRange("1SyntheticSheetIdForTestOnly_abcdefghijklmn", "A1:B2");
    expect(rows).toEqual([["ok"]]);
    expect(calls.n).toBe(1);
  });
});
