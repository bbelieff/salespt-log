/**
 * trainer-weekly-entry + admin-weekly-entry 회귀 — 주간목표 진입 + 기본 내 담당 필터.
 *
 * - TrainerCohortView 기본값은 내 담당만(showOnlyMine=true), 토글 라벨은
 *   "전체 수강생 보기"(mine) / "내 수강생만 보기"(all).
 * - 담당 카드(트레이너 뷰)는 녹색 시트 대신 중립 [주간목표] 링크
 *   (/weekly-goals?student=<encoded>&returnTo=%2Ftrainer, spreadsheetId 무관,
 *   impersonation 미사용). 미배정은 액션 없음.
 * - admin(!viewOnly)도 녹색 시트 대신 compact [주간목표]
 *   (/weekly-goals?student=<encoded>&returnTo=%2Fadmin%2Fusers, spreadsheetId·배정 무관)
 *   + [웹앱 →] 유지. 유보 섹션도 동일.
 * - read-only(viewOnly·trainerEmail 없음)는 액션 없음.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: (props: React.ComponentProps<"a">) =>
    React.createElement("a", props),
}));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ clear: vi.fn() }),
}));
vi.mock("@/query/me-hook", () => ({ useMe: () => ({ data: undefined }) }));

import TraineeCard from "@/components/auth/TraineeCard";
import { ReservedSection } from "@/components/auth/AdminUserPickerSections";
import TrainerCohortView from "@/components/auth/TrainerCohortView";
import type { Trainee } from "@/components/auth/AdminUserPickerTypes";

vi.stubGlobal("React", React);

const TRAINER = "trainer@test.com";

function trainee(over: Partial<Trainee> = {}): Trainee {
  return {
    email: "student@test.com",
    cohort: "8",
    name: "수강생",
    spreadsheetId: "sheet-1",
    role: "trainee",
    assignedTrainer: "",
    team: "",
    ...over,
  };
}

const noop = () => {};
const names = new Map<string, string>([[TRAINER, "트레이너"]]);

function cardHtml(u: Trainee, extra: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    React.createElement(TraineeCard, {
      u,
      archived: false,
      viewOnly: true,
      busy: null,
      nameByEmail: names,
      onPick: noop,
      onReserve: noop,
      onSetTeam: noop,
      trainerEmailLc: TRAINER,
      ...extra,
    }),
  );
}

describe("trainer weekly entry", () => {
  it("담당 카드에 인코딩된 주간목표 링크를 주고 시트는 내주지 않는다", () => {
    const html = cardHtml(
      trainee({
        email: "Test+Alias@Example.com",
        assignedTrainer: TRAINER,
      }),
    );
    expect(html).toContain("주간목표");
    expect(html).toContain("student=Test%2BAlias%40Example.com");
    expect(html).toContain("returnTo=%2Ftrainer");
    expect(html).not.toContain("📊 시트");
    expect(html).toContain("웹앱");
  });

  it("담당 카드는 spreadsheetId 없이도 주간목표를 준다", () => {
    const html = cardHtml(
      trainee({ assignedTrainer: TRAINER, spreadsheetId: "" }),
    );
    expect(html).toContain("주간목표");
    expect(html).toContain("/weekly-goals?student=");
  });

  it("미배정 카드는 아무 액션도 주지 않는다", () => {
    const html = cardHtml(trainee({ assignedTrainer: "other@test.com" }));
    expect(html).not.toContain("주간목표");
    expect(html).not.toContain("📊 시트");
    expect(html).not.toContain("웹앱");
  });

  it("admin은 시트 대신 주간목표를 주고 웹앱은 유지한다", () => {
    const html = renderToStaticMarkup(
      React.createElement(TraineeCard, {
        u: trainee({ assignedTrainer: "" }),
        archived: false,
        viewOnly: false,
        busy: null,
        nameByEmail: names,
        onPick: noop,
        onReserve: noop,
        onSetTeam: noop,
      }),
    );
    expect(html).toContain("주간목표");
    expect(html).toContain("student=student%40test.com");
    expect(html).toContain("returnTo=%2Fadmin%2Fusers");
    expect(html).not.toContain("📊 시트");
    expect(html).not.toContain("docs.google.com");
    expect(html).toContain("웹앱");
  });

  it("admin은 시트·배정 없이도 주간목표를 준다", () => {
    const html = renderToStaticMarkup(
      React.createElement(TraineeCard, {
        u: trainee({ assignedTrainer: "", spreadsheetId: "" }),
        archived: false,
        viewOnly: false,
        busy: null,
        nameByEmail: names,
        onPick: noop,
        onReserve: noop,
        onSetTeam: noop,
      }),
    );
    expect(html).toContain("주간목표");
    expect(html).toContain("/weekly-goals?student=");
    expect(html).toContain("returnTo=%2Fadmin%2Fusers");
    expect(html).not.toContain("📊 시트");
    expect(html).toContain("웹앱");
  });

  it("유보 섹션은 시트 대신 admin 주간목표를 주고 복귀·퇴출을 유지한다", () => {
    const html = renderToStaticMarkup(
      React.createElement(ReservedSection, {
        list: [trainee({})],
        busy: null,
        nameByEmail: names,
        onRestore: noop,
        onPurge: noop,
        viewOnly: false,
      }),
    );
    expect(html).toContain("주간목표");
    expect(html).toContain("student=student%40test.com");
    expect(html).toContain("returnTo=%2Fadmin%2Fusers");
    expect(html).not.toContain("📊 시트");
    expect(html).not.toContain("docs.google.com");
    expect(html).toContain(">복귀<");
    expect(html).toContain(">퇴출<");
  });

  it("유보 섹션 read-only는 액션을 숨긴다", () => {
    const html = renderToStaticMarkup(
      React.createElement(ReservedSection, {
        list: [trainee({})],
        busy: null,
        nameByEmail: names,
        onRestore: noop,
        onPurge: noop,
        viewOnly: true,
      }),
    );
    expect(html).not.toContain("주간목표");
    expect(html).not.toContain(">복귀<");
    expect(html).not.toContain(">퇴출<");
  });

  it("read-only(trainerEmail 없음)는 아무 액션도 주지 않는다", () => {
    const html = renderToStaticMarkup(
      React.createElement(TraineeCard, {
        u: trainee({ assignedTrainer: TRAINER }),
        archived: false,
        viewOnly: true,
        busy: null,
        nameByEmail: names,
        onPick: noop,
        onReserve: noop,
        onSetTeam: noop,
      }),
    );
    expect(html).not.toContain("주간목표");
    expect(html).not.toContain("📊 시트");
    expect(html).not.toContain("웹앱");
  });

  it("기본은 내 담당만 보이고 토글은 전체 보기를 제안한다", () => {
    const html = renderToStaticMarkup(
      React.createElement(TrainerCohortView, {
        sessionEmail: TRAINER,
        trainerName: "트레이너",
        trainees: [
          trainee({ email: "mine@test.com", name: "내담당", assignedTrainer: TRAINER }),
          trainee({ email: "other@test.com", name: "남의담당", assignedTrainer: "other@test.com" }),
        ],
        activeTrainers: [{ email: TRAINER, name: "트레이너" }],
        canBackToAdmin: true,
        archivedCohorts: [],
      }),
    );
    expect(html).toContain("내담당");
    expect(html).not.toContain("남의담당");
    expect(html).toContain("전체 수강생 보기");
    expect(html).toContain("내 담당 1명");
    expect(html).toContain("주간목표");
    expect(html).not.toContain("📊 시트");
  });

  it("담당이 없으면 전체로 멋대로 바꾸지 않고 알린다", () => {
    const html = renderToStaticMarkup(
      React.createElement(TrainerCohortView, {
        sessionEmail: TRAINER,
        trainerName: "트레이너",
        trainees: [
          trainee({ email: "other@test.com", name: "남의담당", assignedTrainer: "other@test.com" }),
        ],
        activeTrainers: [{ email: TRAINER, name: "트레이너" }],
        canBackToAdmin: true,
        archivedCohorts: [],
      }),
    );
    expect(html).toContain("담당 수강생이 없습니다");
    expect(html).not.toContain("남의담당");
    expect(html).toContain("전체 수강생 보기");
  });
});

