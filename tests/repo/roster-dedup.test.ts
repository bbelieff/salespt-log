/**
 * 어드민 로스터 dedup (admin-roster-dup).
 * 1인이 2행(아레나 재참가·시트공유 별칭)으로 보이던 것을 대표 1행으로 접는다.
 * ⚠️ 표시 경로 전용 — 뮤테이션은 raw listAllUsers.
 */
import { describe, it, expect } from "vitest";
import { distinctByPreferred } from "@/repo/user-priority";
import type { User } from "@/types";

function u(p: Partial<User>): User {
  return {
    email: "",
    cohort: "",
    name: "",
    spreadsheetId: "",
    role: "trainee",
    status: "active",
    assignedTrainer: "",
    team: "",
    cohortLabel: "",
    nameLabel: "",
    courseStartISO: "",
    graduationISO: "",
    sortOrder: 0,
    ...p,
  } as User;
}

describe("distinctByPreferred (로스터 표시 dedup)", () => {
  it("아레나 재참가 — 옛 숫자기수행 + A{n}-{m}행(같은 시트) → 대표 1행(아레나)", () => {
    const rows = [
      u({ email: "a@x.com", cohort: "6", spreadsheetId: "SHEET1", status: "active" }),
      u({ email: "a@x.com", cohort: "A1-6", spreadsheetId: "SHEET1", status: "active" }),
    ];
    const out = distinctByPreferred(rows);
    expect(out).toHaveLength(1);
    expect(out[0]!.cohort).toBe("A1-6"); // 아레나 우선
  });

  it("이메일 2개·같은 시트(별칭/직원공유) → 대표 1행", () => {
    const rows = [
      u({ email: "boss@x.com", cohort: "9", spreadsheetId: "SHEET2", name: "박진우(조다영)" }),
      u({ email: "helper@x.com", cohort: "9", spreadsheetId: "SHEET2", name: "박진우(조다영)" }),
    ];
    expect(distinctByPreferred(rows)).toHaveLength(1);
  });

  it("서로 다른 사람(다른 시트) → 그대로 유지", () => {
    const rows = [
      u({ email: "a@x.com", cohort: "7", spreadsheetId: "S_A", name: "함진숙" }),
      u({ email: "b@x.com", cohort: "7", spreadsheetId: "S_B", name: "김철수" }),
    ];
    expect(distinctByPreferred(rows)).toHaveLength(2);
  });

  it("트레이너(시트 없음) — 같은 이메일 2행은 email 로 그룹", () => {
    const rows = [
      u({ email: "t@x.com", cohort: "T", spreadsheetId: "", role: "trainer" }),
      u({ email: "t@x.com", cohort: "A1-3", spreadsheetId: "", role: "trainer" }),
    ];
    expect(distinctByPreferred(rows)).toHaveLength(1);
  });

  it("시트 없는 서로 다른 트레이너(다른 이메일) → 유지", () => {
    const rows = [
      u({ email: "t1@x.com", cohort: "T", spreadsheetId: "", role: "trainer" }),
      u({ email: "t2@x.com", cohort: "T", spreadsheetId: "", role: "trainer" }),
    ];
    expect(distinctByPreferred(rows)).toHaveLength(2);
  });

  it("입력 정렬 보존 — 대표 행의 원래 순서 유지", () => {
    const rows = [
      u({ email: "z@x.com", cohort: "9", spreadsheetId: "SZ", name: "가나다" }),
      u({ email: "a@x.com", cohort: "8", spreadsheetId: "SA", name: "하하하" }),
      u({ email: "a2@x.com", cohort: "8", spreadsheetId: "SA", name: "하하하" }), // SA 중복
    ];
    const out = distinctByPreferred(rows);
    expect(out).toHaveLength(2);
    expect(out.map((x) => x.spreadsheetId)).toEqual(["SZ", "SA"]); // 순서 그대로
  });

  it("빈 배열·단일 → 그대로", () => {
    expect(distinctByPreferred([])).toEqual([]);
    expect(distinctByPreferred([u({ email: "a@x.com", spreadsheetId: "S" })])).toHaveLength(1);
  });
});
