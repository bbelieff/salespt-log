import { describe, expect, it } from "vitest";
import { decideMemberDbAction } from "@/service/cohort-create-db";

describe("decideMemberDbAction", () => {
  it("이름 없으면 fail", () => {
    expect(decideMemberDbAction({ name: "  ", existingUser: false })).toEqual({
      action: "fail", name: "  ", reason: "이름 없음",
    });
  });

  it("이미 DB 에 있으면 skip(멱등)", () => {
    expect(decideMemberDbAction({ name: "홍길동", existingUser: true })).toEqual({
      action: "skip", name: "홍길동",
    });
  });

  it("신규면 create", () => {
    expect(decideMemberDbAction({ name: " 홍길동 ", existingUser: false })).toEqual({
      action: "create", name: "홍길동",
    });
  });
});
