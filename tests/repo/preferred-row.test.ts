/**
 * pickPreferredRow — 레지스트리 다행 계정에서 write 행 = read(pickPreferredUser) 행 일치.
 * 회귀: updateDriveLink(write)가 findUserByEmail/loadMe(read)와 같은 행을 골라야
 * Drive 연결이 한 번에 반영(무한루프 fix). fix/registry-write-preferred-row.
 */
import { describe, it, expect } from "vitest";
import { User } from "@/types";
import { pickPreferredRow, pickPreferredUser } from "@/repo/user-priority";

function u(over: Partial<Record<string, unknown>>): User {
  return User.parse({
    email: "tester@x.com",
    cohort: "6기",
    name: "테스터",
    spreadsheetId: "sid",
    role: "trainee",
    status: "active",
    ...over,
  });
}

describe("pickPreferredRow (write 행 = read 행)", () => {
  it("아레나 행 + 숫자 행 → 아레나 행 선택(read 와 동일)", () => {
    const items = [
      { user: u({ cohort: "6기" }), sheetRow: 3 },
      { user: u({ cohort: "A1-6기" }), sheetRow: 7 },
    ];
    const picked = pickPreferredRow(items);
    expect(picked?.sheetRow).toBe(7);
    // read 선택과 동일 user 인지 (write≠read 불일치 방지)
    expect(picked?.user).toBe(pickPreferredUser(items.map((i) => i.user)));
  });

  it("트레이너 행 최우선(아레나보다)", () => {
    const items = [
      { user: u({ cohort: "A1-6기" }), sheetRow: 7 },
      { user: u({ cohort: "T", role: "trainer" }), sheetRow: 9 },
    ];
    expect(pickPreferredRow(items)?.sheetRow).toBe(9);
  });

  it("archived 만 있으면 archived 행", () => {
    const items = [{ user: u({ status: "archived" }), sheetRow: 4 }];
    expect(pickPreferredRow(items)?.sheetRow).toBe(4);
  });

  it("빈 배열 → null", () => {
    expect(pickPreferredRow([])).toBeNull();
  });
});
