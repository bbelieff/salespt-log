/**
 * pickActiveArenaRow — 수강생출신 트레이너 "내 아레나 일지" override 의 기반 선택 로직.
 * 회귀: 같은 이메일이 trainer(T, 빈 시트) + arena(A1-x, 본인 시트) 두 행이면,
 * override 는 arena 행 spreadsheetId 를 잡아야 한다(findUserByEmail=트레이너 행이라 못 잡던 버그).
 * fix/trainer-self-arena-override (류서하 ondream0501·최정한 onjung0401).
 */
import { describe, it, expect } from "vitest";
import { User } from "@/types";
import { pickActiveArenaRow } from "@/repo/user-priority";

function u(over: Partial<Record<string, unknown>>): User {
  return User.parse({
    email: "ondream0501@gmail.com",
    cohort: "A1-2기",
    name: "류서하(심나영)",
    spreadsheetId: "1IFu6WoD",
    role: "trainee",
    status: "active",
    ...over,
  });
}

describe("pickActiveArenaRow (내 아레나 일지 override)", () => {
  it("trainer T 행(빈 시트) + arena 행 → arena 행 spreadsheetId 선택", () => {
    const rows = [
      u({ cohort: "T", name: "류서하", role: "trainer", spreadsheetId: "" }),
      u({ cohort: "A1-2기", spreadsheetId: "1IFu6WoD" }),
    ];
    expect(pickActiveArenaRow(rows)?.spreadsheetId).toBe("1IFu6WoD");
  });

  it("아레나 행 없으면 null (이름 매칭 폴백으로 넘어감)", () => {
    const rows = [u({ cohort: "T", role: "trainer", spreadsheetId: "" })];
    expect(pickActiveArenaRow(rows)).toBeNull();
  });

  it("아레나지만 빈 spreadsheetId 면 제외", () => {
    expect(pickActiveArenaRow([u({ spreadsheetId: "" })])).toBeNull();
  });
});
