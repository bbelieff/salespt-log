/**
 * 단위 테스트 — `lib/service/me.ts`의 D-day 계산 정합성.
 *
 * SSOT: ADR-0005 (주차 카운팅 컨벤션).
 *   7기+ 현행 모델: graduationISO = courseStartISO(O1) + 50d (종강총회일 = 수료일).
 *   (6기 이하 legacy 는 O1+57 이지만 그 시트들은 O2 직접값이 진실이라 fixture
 *    검증 대상 아님 — 이 테스트는 7기+ 모델만 검증.)
 *
 * 7기 검증 fixture: O1 = 2026-05-15(금) → graduationISO = 2026-07-04(토)
 */
import { describe, expect, it } from "vitest";
import {
  GRADUATION_OFFSET_DAYS,
  computeGraduationISO,
  enrichUsersWithDates,
} from "@/service/me";

describe("GRADUATION_OFFSET_DAYS", () => {
  it("종강총회 offset = 50일 (7기+ 현행 모델, ADR-0005)", () => {
    expect(GRADUATION_OFFSET_DAYS).toBe(50);
  });
});

describe("computeGraduationISO — 7기 모델 (O1+50)", () => {
  it("O1=2026-05-15(금) → graduation=2026-07-04(토)", () => {
    expect(computeGraduationISO("2026-05-15")).toBe("2026-07-04");
  });

  it("월말 경계: 4/30 → 6/19 (5월 31d + 6월 19d = 50)", () => {
    expect(computeGraduationISO("2026-04-30")).toBe("2026-06-19");
  });

  it("연말 경계: 12/31 → 다음해 2/19 (1월 31d + 2월 19d = 50)", () => {
    expect(computeGraduationISO("2026-12-31")).toBe("2027-02-19");
  });

  it("윤년(2028) 2/29 → 4/19 (3월 31d + 4월 19d = 50)", () => {
    expect(computeGraduationISO("2028-02-29")).toBe("2028-04-19");
  });
});

describe("enrichUsersWithDates — 아레나 cohort 보호 (arena-cohort-display)", () => {
  it("cohort=A1-4, 시트캐시 cohortLabel=4 여도 A1-4 유지(아레나=레지스트리 SSOT)", async () => {
    const [r] = await enrichUsersWithDates([
      {
        cohort: "A1-4",
        name: "고경희",
        spreadsheetId: "sheet-x",
        cohortLabel: "4", // 시트 B3 스테일 옛 기수
        nameLabel: "고경희",
        courseStartISO: "2026-06-12",
        graduationISO: "2026-08-01",
      },
    ]);
    expect(r!.cohort).toBe("A1-4");
  });
  it("일반 숫자 cohort 는 기존대로 cohortLabel 표시", async () => {
    const [r] = await enrichUsersWithDates([
      {
        cohort: "8",
        name: "김현민",
        spreadsheetId: "sheet-y",
        cohortLabel: "8기",
        nameLabel: "김현민",
        courseStartISO: "2026-06-12",
        graduationISO: "2026-08-01",
      },
    ]);
    expect(r!.cohort).toBe("8기");
  });

  it("아레나 부부명 보호 — cohort=A1-3·시트 B3=3·C3=정유영 → A1-3·정유영(조성도) 유지", async () => {
    const [r] = await enrichUsersWithDates([
      {
        cohort: "A1-3",
        name: "정유영(조성도)", // 레지스트리 SSOT (부부 괄호명)
        spreadsheetId: "sheet-z",
        cohortLabel: "3", // 시트 B3 옛 기수
        nameLabel: "정유영", // 시트 C3 단일명 (동반자 잘림)
        courseStartISO: "2026-06-12",
        graduationISO: "2026-08-01",
      },
    ]);
    expect(r!.cohort).toBe("A1-3");
    expect(r!.name).toBe("정유영(조성도)");
  });

  it("일반 기수 이름은 기존대로 시트값(nameLabel)으로 덮임", async () => {
    const [r] = await enrichUsersWithDates([
      {
        cohort: "7",
        name: "홍길동", // 레지스트리(괄호 없음·비아레나)
        spreadsheetId: "sheet-w",
        cohortLabel: "7기",
        nameLabel: "홍길동수정", // 시트 C3 = 표시 정본
        courseStartISO: "2026-06-12",
        graduationISO: "2026-08-01",
      },
    ]);
    expect(r!.cohort).toBe("7기");
    expect(r!.name).toBe("홍길동수정");
  });
});
