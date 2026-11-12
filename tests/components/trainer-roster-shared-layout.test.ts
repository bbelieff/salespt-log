/**
 * 트레이너 수강생 명단 = 수강생관리(/admin/users)와 같은 배치(2026-11-12, trainer-roster-new-layout).
 *  ① 카테고리 상자(수강생/아레나/테스트) + 접힌 기수 칩(PC 3열) + 아레나 시즌 묶음 + 보관 상자를
 *     관리자 화면과 **같은 컴포넌트**(CohortCategoryBoxes·ArenaSeasonGroups·CohortSection)로 그린다.
 *  ② 관리자 조작(끌어 정렬·팀 변경·담당 변경·등록·승인·유보·일괄 도구)은 하나도 나오지 않는다.
 *  ③ [주간목표]·[웹앱]은 지금처럼 본인 담당(또는 「활성 수강생 조회」 권한) 카드에만.
 * 합성 수강생만(실제 개인정보 없음).
 */
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: (props: React.ComponentProps<"a">) => React.createElement("a", props),
}));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ clear: vi.fn() }),
}));
vi.mock("@/query/me-hook", () => ({ useMe: () => ({ data: undefined }) }));

import TrainerCohortView from "@/components/auth/TrainerCohortView";
import CohortCategoryBoxes from "@/components/auth/CohortCategoryBoxes";
import { COHORT_GRID } from "@/components/auth/AdminUserPickerSections";
import type { Trainee } from "@/components/auth/AdminUserPickerTypes";

vi.stubGlobal("React", React);

const TRAINER = "trainer@example.test";
const OTHER = "other-trainer@example.test";

function t(email: string, cohort: string, name: string, over: Partial<Trainee> = {}): Trainee {
  return { email, cohort, name, spreadsheetId: "", role: "trainee", assignedTrainer: TRAINER, team: "", ...over };
}

const trainees: Trainee[] = [
  t("a@example.test", "98", "가상일", { team: "서울" }),
  t("b@example.test", "99", "가상이"),
  t("c@example.test", "A9-1", "가상삼"),
  t("d@example.test", "A9-0", "가상사"),
  t("e@example.test", "97", "가상오"),
  t("f@example.test", "98", "남의담당", { assignedTrainer: OTHER }),
];

function view(over: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    React.createElement(TrainerCohortView, {
      sessionEmail: TRAINER,
      trainerName: "트레이너",
      trainees,
      activeTrainers: [{ email: TRAINER, name: "트레이너" }, { email: OTHER, name: "다른트레이너" }],
      canBackToAdmin: false,
      archivedCohorts: ["97"],
      ...over,
    }),
  );
}

/** 관리자 전용 조작의 화면 글자·title — 트레이너 화면엔 하나도 없어야 한다. */
const ADMIN_ONLY = [
  "드래그하여", // 끌어 정렬 손잡이
  "팀 변경", "팀 정하기", // 팀 입력
  "담당 트레이너 변경", "누르면 바로 저장", // 담당 변경
  "유보", "복귀", "퇴출", // 유보·삭제
  "승인", "거절", // 가입 승인
  "수강생 관리", "마스터 메뉴", // 관리자 머리글
];

describe("트레이너 명단 — 수강생관리와 같은 배치", () => {
  it("카테고리 상자·3열 기수 칩·아레나 시즌·보관 상자를 그린다", () => {
    const html = view();
    expect(html).toContain("수강생 · 2명"); // 98·99기 (내 담당만)
    expect(html).toContain("아레나 · 1명");
    expect(html).toContain("테스트 · 1명");
    expect(html).toContain("border-blue-200"); // 카테고리 상자(CohortCategoryBoxes)
    expect(html).toContain("시즌9"); // ArenaSeasonGroups
    expect(html).toContain("group/season");
    expect(html.split(COHORT_GRID).length - 1).toBeGreaterThanOrEqual(3); // 수강생·테스트·보관(+시즌 안)
    expect(html).toContain("📦 보관된 기수 (1명)");
    // 예전 배치(기수마다 전폭 상자 + 「아레나 시즌N」 보라 상자)는 사라졌다.
    expect(html).not.toContain("아레나 시즌9");
    expect(html).not.toContain("bg-purple-50 p-3");
  });

  it("관리자와 같은 컴포넌트를 쓴다(따로 만든 사본 없음)", () => {
    const src = readFileSync("components/auth/TrainerCohortView.tsx", "utf8");
    expect(src).toContain('import CohortCategoryBoxes from "./CohortCategoryBoxes"');
    expect(src).toContain("<CohortCategoryBoxes");
    expect(src).toContain("COHORT_GRID");
    const admin = readFileSync("components/auth/AdminUserPicker.tsx", "utf8");
    expect(admin).toContain("<CohortCategoryBoxes");
  });

  it("관리자 전용 조작은 하나도 나오지 않는다(전체 보기·검색 권한이 있어도)", () => {
    for (const html of [view(), view({ openActive: true })]) {
      for (const word of ADMIN_ONLY) expect(html, word).not.toContain(word);
      expect(html).not.toContain("cursor-grab");
      expect(html).not.toContain('aria-expanded'); // 담당 변경 펼침 버튼
      expect(html.match(/<input/g)?.length).toBe(1); // 검색칸 하나뿐(팀 입력칸 없음)
    }
  });

  it("관리자 조작용 핸들러·API 를 화면 코드가 들고 있지 않다", () => {
    const src = readFileSync("components/auth/TrainerCohortView.tsx", "utf8");
    expect(src).not.toMatch(/onReorder=|onAssignTrainers=/); // 넘기지 않으면 끌기·담당 변경이 꺼진다
    const apis = src.match(/\/api\/[a-z-/]+/g) ?? [];
    expect(apis).toEqual(["/api/admin/switch"]); // 웹앱 열기(서버가 담당·권한 재확인) 하나뿐
    expect(src.match(/viewOnly\n/g)?.length).toBe(2); // 활성 상자 + 보관 상자 모두 읽기 전용
    expect(src).not.toMatch(/viewOnly=\{/); // 끌 수 있는 값이 아니라 늘 켜짐
  });

  it("공용 상자는 trainerEmailLc 를 카드까지 전달한다 — 담당 카드에만 주간목표·웹앱", () => {
    const html = renderToStaticMarkup(
      React.createElement(CohortCategoryBoxes, {
        activeGroups: [
          ["98", [trainees[0]!, trainees[5]!]],
          ["A9-1", [trainees[2]!]],
        ],
        busy: null,
        nameByEmail: new Map(),
        onPick: () => {},
        onReserve: () => {},
        onSetTeam: () => {},
        viewOnly: true,
        trainerEmailLc: TRAINER,
      }),
    );
    expect(html).toContain("남의담당");
    expect(html.match(/웹앱 →/g)?.length).toBe(2); // 98기 내 담당 1 + 아레나 내 담당 1
    expect(html.match(/returnTo=%2Ftrainer/g)?.length).toBe(2);
    expect(html).not.toContain("returnTo=%2Fadmin%2Fusers");
    for (const word of ADMIN_ONLY) expect(html, word).not.toContain(word);
  });

  it("trainerEmailLc 없이 읽기 전용(관리부서)이면 예전처럼 버튼이 없다", () => {
    const html = renderToStaticMarkup(
      React.createElement(CohortCategoryBoxes, {
        activeGroups: [["98", [trainees[0]!]], ["A9-1", [trainees[2]!]]],
        busy: null,
        nameByEmail: new Map(),
        onPick: () => {},
        onReserve: () => {},
        onSetTeam: () => {},
        viewOnly: true,
      }),
    );
    expect(html).not.toContain("웹앱");
    expect(html).not.toContain("주간목표");
  });
});
