/**
 * 기수 생성 pending 큐 — 순수 잡 빌더 (R3-5).
 * enqueue 되는 레코드가 정규화(기 strip·type/mode 강제·trim)되는지 박제.
 * SQL·pg 경로는 라이브(재시도 라우트) + 정합 테스트로 검증.
 */
import { describe, it, expect } from "vitest";
import { buildPendingCohortJob } from "@/repo/db/cohort-pending";

describe("buildPendingCohortJob (pending 잡 정규화)", () => {
  it("일반 기수 — '기' strip + trim + 기본값", () => {
    const j = buildPendingCohortJob({
      cohortLabel: "8기",
      cohortType: "cohort",
      name: " 김현민 ",
      mode: "create",
      folderId: "FOLDER",
      templateId: "TMPL",
      sheetTitle: "세일즈PT_ 8기 김현민 수강생 경영일지",
      courseStartISO: "2026-07-10",
    });
    expect(j.cohortLabel).toBe("8"); // 기 정규화
    expect(j.name).toBe("김현민"); // trim
    expect(j.cohortType).toBe("cohort");
    expect(j.mode).toBe("create");
    expect(j.folderId).toBe("FOLDER");
    expect(j.templateId).toBe("TMPL");
    expect(j.sheetTitle).toBe("세일즈PT_ 8기 김현민 수강생 경영일지");
    expect(j.sheetId).toBe(""); // 복제 전이라 빈값
    expect(j.rosterSheetId).toBe("");
    expect(j.courseStartISO).toBe("2026-07-10");
  });

  it("courseStartISO 미제공 → 빈 문자열(역호환)", () => {
    const j = buildPendingCohortJob({
      cohortLabel: "8",
      cohortType: "cohort",
      name: "무날짜",
      mode: "create",
    });
    expect(j.courseStartISO).toBe("");
  });

  it("아레나 — type=arena 보존 + roster", () => {
    const j = buildPendingCohortJob({
      cohortLabel: "A1-1기",
      cohortType: "arena",
      name: "오이슬",
      mode: "create",
      rosterSheetId: "ROSTER",
    });
    expect(j.cohortLabel).toBe("A1-1"); // 뒤 '기'만 strip
    expect(j.cohortType).toBe("arena");
    expect(j.rosterSheetId).toBe("ROSTER");
  });

  it("알 수 없는 type/mode 는 안전 기본값으로 강제", () => {
    const j = buildPendingCohortJob({
      cohortLabel: "9",
      cohortType: "weird",
      name: "테스터",
      mode: "hack",
    });
    expect(j.cohortType).toBe("cohort"); // arena 아니면 cohort
    expect(j.mode).toBe("create"); // link 아니면 create
  });

  it("link 모드 — sheetId 보존", () => {
    const j = buildPendingCohortJob({
      cohortLabel: "8",
      cohortType: "cohort",
      name: "김링크",
      mode: "link",
      sheetId: "EXISTING_SHEET",
    });
    expect(j.mode).toBe("link");
    expect(j.sheetId).toBe("EXISTING_SHEET");
  });
});
