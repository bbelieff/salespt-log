/**
 * setSeasonStart — 시즌 개강일(cohorts J) 쓰기 회귀 (AR-2b).
 *
 * 박제하는 계약:
 *  ① **시즌 행이 없을 때도 `type="arena"` 로 만든다** — 개막 차단 결함 방지.
 *     기본값 "cohort" 로 append 되면 `resolveCurrentSeason` 의 type 게이트가 그 행을
 *     건너뛰어 **개강일을 입력해도 시즌이 전환되지 않는다**(4R 자체검증에서 발견).
 *  ② 기존 행이 있으면 D~J 를 갱신하고 **다른 설정(템플릿·폴더 ID)을 보존**한다.
 *  ③ 형식 검증: YYYY-MM-DD 또는 "" (미정 복귀) 만 허용.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const appended: unknown[][] = [];
const updated: { range: string; values: unknown[][] }[] = [];
let existingRows: string[][] = [];

vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: () => {},
}));

vi.mock("@/config", () => ({
  registry: () => ({ spreadsheetId: "REG", tab: "users" }),
  cohortsTab: () => "cohorts",
}));

vi.mock("@/repo/sheets-client", () => ({
  readRange: async () => existingRows,
  appendRows: async (_id: string, _range: string, rows: unknown[][]) => {
    appended.push(...rows);
  },
  sheetsClient: () => ({
    spreadsheets: {
      values: {
        update: async (req: { range: string; requestBody: { values: unknown[][] } }) => {
          updated.push({ range: req.range, values: req.requestBody.values });
        },
      },
    },
  }),
}));

const { setSeasonStart } = await import("@/repo/cohorts");

beforeEach(() => {
  appended.length = 0;
  updated.length = 0;
  existingRows = [];
});

describe("setSeasonStart", () => {
  it("**시즌 행이 없으면 type=arena 로 append** (개막 차단 결함 방지)", async () => {
    existingRows = []; // A2 행 없음
    await setSeasonStart("A2", "2026-08-07");

    expect(appended).toHaveLength(1);
    const row = appended[0]!;
    expect(row[0]).toBe("A2"); // A label
    expect(row[1]).toBe("active"); // B status
    expect(row[3]).toBe("arena"); // D type — "cohort" 면 시즌 판정에서 skip 됨
    expect(row[9]).toBe("2026-08-07"); // J seasonStartISO
  });

  it("기존 시즌 행이 있으면 D~J 갱신 + 다른 설정 보존", async () => {
    // A2 행이 이미 있고 템플릿·폴더가 설정된 상태.
    existingRows = [
      ["A1", "active", "", "arena", "TMPL1", "ROOT1", "ROSTER1", "SHEETS1", "COMP1", "2026-06-12"],
      ["A2", "active", "", "arena", "TMPL2", "ROOT2", "ROSTER2", "SHEETS2", "COMP2", ""],
    ];
    await setSeasonStart("A2", "2026-08-07");

    expect(appended).toHaveLength(0); // append 아님 — 기존 행 갱신
    expect(updated).toHaveLength(1);
    expect(updated[0]!.range).toBe("cohorts!D3:J3"); // A2 는 시트 3행
    const vals = updated[0]!.values[0]!;
    expect(vals[0]).toBe("arena"); // type 보존
    expect(vals[1]).toBe("TMPL2"); // 템플릿 보존
    expect(vals[5]).toBe("COMP2"); // 업체폴더 보존
    expect(vals[6]).toBe("2026-08-07"); // J 갱신
  });

  it('빈 문자열 = 미정 복귀 (전광판이 시즌 번호를 감춤 → 데이터는 유지)', async () => {
    existingRows = [["A2", "active", "", "arena", "", "", "", "", "", "2026-08-07"]];
    await setSeasonStart("A2", "");
    expect(updated[0]!.values[0]![6]).toBe("");
  });

  it("YYYY-MM-DD 아니면 throw — 시트에 쓰지 않는다", async () => {
    await expect(setSeasonStart("A2", "8/7")).rejects.toThrow();
    await expect(setSeasonStart("A2", "2026-8-7")).rejects.toThrow();
    expect(appended).toHaveLength(0);
    expect(updated).toHaveLength(0);
  });
});
