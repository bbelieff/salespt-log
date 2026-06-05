import { describe, it, expect } from "vitest";
import {
  parseCohortToken,
  buildCohortSheetTitle,
  decideMemberAction,
  type ParsedCohort,
} from "@/service/cohort-token";

describe("parseCohortToken", () => {
  it("일반 기수: 숫자", () => {
    expect(parseCohortToken("8")).toEqual({
      type: "cohort",
      label: "8",
      display: "8기",
      num: "8",
    });
  });

  it("일반 기수: 숫자+기", () => {
    expect(parseCohortToken("8기")).toMatchObject({ type: "cohort", label: "8" });
    expect(parseCohortToken(" 12 기 ")).toMatchObject({ label: "12", display: "12기" });
  });

  it("아레나: a/A + 숫자 (대소문자 무시)", () => {
    expect(parseCohortToken("a1")).toEqual({
      type: "arena",
      label: "A1",
      display: "A1회",
      num: "1",
    });
    expect(parseCohortToken("A1")).toMatchObject({ type: "arena", label: "A1" });
    expect(parseCohortToken("a1회")).toMatchObject({ type: "arena", display: "A1회" });
    expect(parseCohortToken("A 2")).toMatchObject({ type: "arena", label: "A2" });
  });

  it("선행 0 제거", () => {
    expect(parseCohortToken("08")).toMatchObject({ label: "8" });
    expect(parseCohortToken("a01")).toMatchObject({ label: "A1" });
  });

  it("형식 오류 → null", () => {
    expect(parseCohortToken("")).toBeNull();
    expect(parseCohortToken("   ")).toBeNull();
    expect(parseCohortToken("기수")).toBeNull();
    expect(parseCohortToken("b1")).toBeNull();
    expect(parseCohortToken("8a")).toBeNull();
    expect(parseCohortToken("a")).toBeNull();
  });
});

describe("buildCohortSheetTitle", () => {
  const cohort: ParsedCohort = { type: "cohort", label: "8", display: "8기", num: "8" };
  const arena: ParsedCohort = { type: "arena", label: "A1", display: "A1회", num: "1" };

  it("일반: 세일즈PT_ N기 이름 수강생 경영일지", () => {
    expect(buildCohortSheetTitle(cohort, "김믿음")).toBe(
      "세일즈PT_ 8기 김믿음 수강생 경영일지",
    );
  });

  it("아레나: 세일즈PT_ An회 이름 경영일지", () => {
    expect(buildCohortSheetTitle(arena, "김믿음")).toBe(
      "세일즈PT_ A1회 김믿음 경영일지",
    );
  });

  it("이름 공백 trim", () => {
    expect(buildCohortSheetTitle(cohort, "  김믿음  ")).toBe(
      "세일즈PT_ 8기 김믿음 수강생 경영일지",
    );
  });
});

describe("decideMemberAction", () => {
  const parsed: ParsedCohort = {
    type: "cohort",
    label: "8",
    display: "8기",
    num: "8",
  };
  const arena: ParsedCohort = { type: "arena", label: "A1", display: "A1회", num: "1" };

  it("멱등: 이미 시트와 함께 등록됨 → skip", () => {
    const r = decideMemberAction({
      mode: "create",
      parsed,
      name: "김믿음",
      existingSheetId: "1AbcDEFghiJKLmnoPQRstuVWxyz1234567890",
      folderId: "folder123",
    });
    expect(r).toEqual({ action: "skip", name: "김믿음" });
  });

  it("이름 비어있음 → fail", () => {
    const r = decideMemberAction({
      mode: "create",
      parsed,
      name: "   ",
      existingSheetId: null,
    });
    expect(r.action).toBe("fail");
  });

  it("create: 폴더 없음 → fail (이름 폴더 없음)", () => {
    const r = decideMemberAction({
      mode: "create",
      parsed,
      name: "이영업",
      existingSheetId: null,
      folderId: null,
    });
    expect(r).toMatchObject({ action: "fail" });
    if (r.action === "fail") expect(r.reason).toContain("폴더");
  });

  it("create: 폴더 있음 → create (제목 생성)", () => {
    const r = decideMemberAction({
      mode: "create",
      parsed,
      name: "이영업",
      existingSheetId: null,
      folderId: "folderABC",
    });
    expect(r).toEqual({
      action: "create",
      name: "이영업",
      title: "세일즈PT_ 8기 이영업 수강생 경영일지",
      folderId: "folderABC",
    });
  });

  it("create 아레나: 제목 회차 형식", () => {
    const r = decideMemberAction({
      mode: "create",
      parsed: arena,
      name: "박계약",
      existingSheetId: null,
      folderId: "f1",
    });
    if (r.action === "create")
      expect(r.title).toBe("세일즈PT_ A1회 박계약 경영일지");
  });

  it("link: 유효 sheetId → link", () => {
    const r = decideMemberAction({
      mode: "link",
      parsed,
      name: "최고객",
      existingSheetId: null,
      sheetId: "1AbcDEFghiJKLmnoPQRstuVWxyz1234567890",
    });
    expect(r).toEqual({
      action: "link",
      name: "최고객",
      sheetId: "1AbcDEFghiJKLmnoPQRstuVWxyz1234567890",
    });
  });

  it("link: sheetId 형식 불량 → fail", () => {
    const r = decideMemberAction({
      mode: "link",
      parsed,
      name: "최고객",
      existingSheetId: null,
      sheetId: "short",
    });
    expect(r).toMatchObject({ action: "fail" });
  });
});
