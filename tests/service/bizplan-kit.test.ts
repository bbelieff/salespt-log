import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth/identity", () => ({ isAdminEmail: () => false, getEffectiveRole: async () => ({ role: "trainee", status: "active" }) }));
vi.mock("@/repo/users", () => ({ findUserByEmail: async () => null }));
vi.mock("@/repo/bizplan-kit", () => ({ listKitFolder: async () => [], downloadKitFile: async () => new Uint8Array() }));

import { canUseBizplan, pickKit, versionOf } from "@/service/bizplan-kit";

const f = (name: string, modifiedTime = "2026-11-01T00:00:00Z") => ({ id: name, name, mimeType: "", modifiedTime, size: 1 });

describe("bizplan-kit pickKit", () => {
  it("빌더는 v 번호가 가장 큰 md", () => {
    expect(versionOf("빌더_v4.8_2in1.md")).toEqual([4, 8]);
    expect(versionOf("메모.md")).toEqual([]);
    const picked = pickKit([f("빌더_v4.8.md"), f("빌더_v4.10.md"), f("빌더_v4.9.md", "2026-12-01T00:00:00Z"), f("메모.md")]);
    expect(picked.builder?.name).toBe("빌더_v4.10.md");
  });

  it("양식은 이름으로 고르고 임시 파일은 뺀다", () => {
    const picked = pickKit([
      f("~$현장클리닉_양식.docx", "2026-12-01T00:00:00Z"),
      f("현장클리닉_양식.docx"),
      f("팩트파인딩_인터뷰지_양식.docx"),
      f("현장클리닉_새양식.docx", "2026-11-20T00:00:00Z"),
    ]);
    expect(picked.clinic?.name).toBe("현장클리닉_새양식.docx");
    expect(picked.interview?.name).toBe("팩트파인딩_인터뷰지_양식.docx");
    expect(pickKit([]).builder).toBeNull();
  });

  it("등록되지 않은 사람·로그인 안 한 사람은 쓸 수 없다", async () => {
    expect(await canUseBizplan(null)).toBe(false);
    expect(await canUseBizplan("someone@example.com")).toBe(false);
  });
});
