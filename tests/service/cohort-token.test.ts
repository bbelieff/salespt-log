import { describe, it, expect } from "vitest";
import {
  parseCohortToken,
  buildCohortSheetTitle,
  decideMemberAction,
  arenaSeasonLabel,
  arenaCohortLabel,
  arenaCohortLabelParts,
  isClaimableCohort,
  buildArenaSheetTitle,
  buildArenaCompanyFolderName,
  decideArenaAction,
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

  it("create: 폴더 모호(2개+) → fail (folderError 주입)", () => {
    const r = decideMemberAction({
      mode: "create",
      parsed,
      name: "김승",
      existingSheetId: null,
      folderId: null,
      folderError: "이름 폴더 여러 개 — 명확화 필요: [서울 8기] 김승 / [부산 8기] 김승엽",
    });
    expect(r).toMatchObject({ action: "fail" });
    if (r.action === "fail") expect(r.reason).toContain("명확화");
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

describe("arena 빌더 (시즌 A{n} + 자기기수 {m}기 + 이름)", () => {
  it("arenaSeasonLabel: 시즌 레벨 config 키 → A{n}", () => {
    expect(arenaSeasonLabel(1)).toBe("A1");
    expect(arenaSeasonLabel(12)).toBe("A12");
  });

  it("arenaCohortLabel: 참가자별 매칭 키 → A{시즌}-{기수}기", () => {
    expect(arenaCohortLabel(1, 1)).toBe("A1-1기");
    expect(arenaCohortLabel(2, 8)).toBe("A2-8기");
  });

  it("buildArenaSheetTitle: 세일즈PT_A{시즌}_{기수}기 {이름}_대표님 경영일지", () => {
    expect(buildArenaSheetTitle(1, 1, "김믿음")).toBe(
      "세일즈PT_A1_1기 김믿음_대표님 경영일지",
    );
    expect(buildArenaSheetTitle(2, 3, "  이영업 ")).toBe(
      "세일즈PT_A2_3기 이영업_대표님 경영일지",
    );
  });

  it("buildArenaCompanyFolderName: …_대표님 업체관리", () => {
    expect(buildArenaCompanyFolderName(1, 1, "김믿음")).toBe(
      "세일즈PT_A1_1기 김믿음_대표님 업체관리",
    );
  });
});

// 레지스트리 prep(addTraineePrepRow)·claim(findExistingSheetIdByCohortName) 양측이
// 공유하는 cohort 정규화. 두 곳 모두 String(c).replace(/기\s*$/,"").trim() 동일.
// claim 폼이 항상 대문자 "A" 로 조합하므로 case-fold 불필요.
const normCohort = (c: string) => c.replace(/기\s*$/, "").trim();

describe("arena cohort 라벨 정규화 일치 (prep ↔ claim)", () => {
  it("create-arena 저장 라벨과 claim 조합 라벨이 동일 정규화", () => {
    const prepLabel = arenaCohortLabel(1, 1); // create-arena-members 가 저장
    const claimLabel = "A1-1기"; // claim 폼이 `A${season}-${gisu}기` 로 조합
    expect(prepLabel).toBe(claimLabel);
    expect(normCohort(prepLabel)).toBe("A1-1");
    expect(normCohort(claimLabel)).toBe(normCohort(prepLabel));
  });

  it('"기" 유무·공백 변형 흡수 ("A1-1기" / "A1-1" / "A1-1기 ")', () => {
    expect(normCohort("A1-1기")).toBe("A1-1");
    expect(normCohort("A1-1")).toBe("A1-1");
    expect(normCohort("A1-1기 ")).toBe("A1-1");
  });

  it("트레이너 오인 방지: 아레나 라벨은 'T' 가 아님", () => {
    expect(arenaCohortLabel(1, 1).toUpperCase()).not.toBe("T");
  });
});

describe("arenaCohortLabelParts", () => {
  it("아레나 라벨 파싱 (기 유무 무관)", () => {
    expect(arenaCohortLabelParts("A1-0기")).toEqual({ season: 1, gisu: 0 });
    expect(arenaCohortLabelParts("A1-9기")).toEqual({ season: 1, gisu: 9 });
    expect(arenaCohortLabelParts("A12-3")).toEqual({ season: 12, gisu: 3 });
    expect(arenaCohortLabelParts(" A1-1기 ")).toEqual({ season: 1, gisu: 1 });
  });
  it("비아레나 → null", () => {
    expect(arenaCohortLabelParts("8기")).toBeNull();
    expect(arenaCohortLabelParts("8")).toBeNull();
    expect(arenaCohortLabelParts("T")).toBeNull();
    expect(arenaCohortLabelParts("A1")).toBeNull();
    expect(arenaCohortLabelParts("")).toBeNull();
  });
});

describe("isClaimableCohort (claim 검증 게이트)", () => {
  it("숫자 수강생·트레이너 허용 (회귀 없음)", () => {
    expect(isClaimableCohort("8")).toBe(true);
    expect(isClaimableCohort("8기")).toBe(true);
    expect(isClaimableCohort("T")).toBe(true);
    expect(isClaimableCohort("t")).toBe(true);
  });
  it("아레나 A{n}-{m}기 허용", () => {
    expect(isClaimableCohort("A1-0기")).toBe(true);
    expect(isClaimableCohort("A1-9기")).toBe(true);
    expect(isClaimableCohort("A2-3기")).toBe(true);
  });
  it("연습(온보딩) 기수 허용 — '연습'·'연습기' 정규화", () => {
    expect(isClaimableCohort("연습")).toBe(true);
    expect(isClaimableCohort("연습기")).toBe(true);
    expect(isClaimableCohort(" 연습 ")).toBe(true); // 공백 흡수
  });
  it("형식 오류 거부 (연습 유사 오타 포함)", () => {
    expect(isClaimableCohort("")).toBe(false);
    expect(isClaimableCohort("A1")).toBe(false);
    expect(isClaimableCohort("abc")).toBe(false);
    expect(isClaimableCohort("A-1기")).toBe(false);
    expect(isClaimableCohort("연습용2")).toBe(false); // 이름이지 기수 아님
    expect(isClaimableCohort("연")).toBe(false);
  });
});

describe("decideArenaAction", () => {
  it("멱등: 이미 등록된 시트 있으면 skip", () => {
    const r = decideArenaAction({
      season: 1,
      gisu: 1,
      name: "김믿음",
      existingSheetId: "1AbcDEFghiJKLmnoPQRstuVWxyz1234567890",
    });
    expect(r).toEqual({ action: "skip", name: "김믿음" });
  });

  it("이름 비면 fail", () => {
    const r = decideArenaAction({
      season: 1,
      gisu: 1,
      name: "  ",
      existingSheetId: null,
    });
    expect(r.action).toBe("fail");
  });

  it("기수 비정상이면 fail", () => {
    const r = decideArenaAction({
      season: 1,
      gisu: Number.NaN,
      name: "김믿음",
      existingSheetId: null,
    });
    expect(r.action).toBe("fail");
  });

  it("신규 → create (라벨·시트제목·폴더명 생성)", () => {
    const r = decideArenaAction({
      season: 1,
      gisu: 1,
      name: "김믿음",
      existingSheetId: null,
    });
    expect(r).toEqual({
      action: "create",
      name: "김믿음",
      cohortLabel: "A1-1기",
      sheetTitle: "세일즈PT_A1_1기 김믿음_대표님 경영일지",
      folderName: "세일즈PT_A1_1기 김믿음_대표님 업체관리",
    });
  });
});
