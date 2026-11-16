/**
 * 관리자 구역 권한 가드(admin-phase1, 2026-11-16).
 *  ① 레이아웃이 먼저 막는다 — 마스터·관리부서가 아니면 "/" (새 화면이 가드를 빠뜨려도 열리지 않게).
 *  ② 화면별 가드는 그대로 — 마스터 전용(설정·DB 대조·알림)은 관리부서도 못 연다.
 *  ③ 조회 화면(전광판·공유왕·오류 신고함)은 마스터·관리부서 둘 다.
 *  ④ /admin/me(route handler)는 레이아웃을 타지 않는다 — 예전 동작 그대로.
 */
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal("React", React);

const m = vi.hoisted(() => ({
  session: vi.fn(),
  setImpersonation: vi.fn(),
  pending: vi.fn(),
  listReports: vi.fn(),
  reportImage: vi.fn(),
  EMAIL: {
    master: "master@example.test",
    management: "staff@example.test",
    trainee: "student@example.test",
    anon: null,
  } as Record<"master" | "management" | "trainee" | "anon", string | null>,
  // 화면 조각은 이 시험의 대상이 아니다.
  stub: () => ({ default: () => null }),
}));
type Role = keyof typeof m.EMAIL;
const { EMAIL } = m;

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));
vi.mock("@/auth/identity", () => ({
  getSessionEmail: m.session,
  isAdminEmail: (e: string | null) => e === m.EMAIL.master,
  canViewAdminPages: async (e: string | null) => e === m.EMAIL.master || e === m.EMAIL.management,
  setImpersonation: m.setImpersonation,
}));
vi.mock("@/auth/revalidate-admin", () => ({ revalidateAdminPages: vi.fn() }));
vi.mock("@/config", () => ({ appBaseUrl: () => "https://app.example.test" }));
vi.mock("@/service", () => ({
  getAdminPendingCounts: m.pending,
  getDbPilotStatus: vi.fn(async () => ({ enabled: false, ok: false, latencyMs: null, rows: null, mirrorPending: null, error: null })),
  listAnnouncementsAdmin: vi.fn(async () => ({ notices: [], updates: [] })),
}));
vi.mock("@/service/db-parity", () => ({ getDbParity: vi.fn(async () => ({ enabled: false, users: 0, rows: [] })) }));
vi.mock("@/service/scoreboard", () => ({
  loadScoreboardBundle: vi.fn(async () => ({ byCohort: [] })),
  listShareScoreTargets: vi.fn(async () => []),
}));
vi.mock("@/service/bug-reports-admin", () => ({
  listBugReportsForAdmin: m.listReports,
  getBugReportImageForAdmin: m.reportImage,
}));
vi.mock("@/components/PullToRefresh", m.stub);
vi.mock("@/components/auth/AdminSideNav", m.stub);
vi.mock("@/components/auth/CollapsibleSection", m.stub);
vi.mock("@/components/auth/MigrateCacheButton", m.stub);
vi.mock("@/components/auth/SystemStatusStrip", m.stub);
vi.mock("@/components/auth/ScoreboardRefreshButton", m.stub);
vi.mock("@/components/scoreboard/ScoreboardView", m.stub);
vi.mock("@/app/admin/arena/share-scores/_components/ShareScoresManager", m.stub);
vi.mock("@/app/admin/popup/_components/NoticeManager", m.stub);
vi.mock("@/app/admin/popup/_components/UpdatesManager", m.stub);

import AdminLayout from "@/app/admin/layout";
import SettingsPage from "@/app/admin/settings/page";
import DbParityPage from "@/app/admin/db-parity/page";
import PopupPage from "@/app/admin/popup/page";
import ScoreboardPage from "@/app/admin/arena/scoreboard/page";
import ShareScoresPage from "@/app/admin/arena/share-scores/page";
import ReportsPage from "@/app/admin/reports/page";
import { GET as adminMe } from "@/app/admin/me/route";

const as = (role: Role) => m.session.mockResolvedValue(EMAIL[role]);
const opens = (p: Promise<unknown>) => expect(p).resolves.toBeTruthy();
const bounces = (p: Promise<unknown>) => expect(p).rejects.toThrow("redirect:/");

beforeEach(() => {
  vi.clearAllMocks();
  m.pending.mockResolvedValue({ trainees: 0, trainers: 0 });
  m.listReports.mockResolvedValue({ enabled: true, rows: [], total: 0, page: 1, pageCount: 1 });
  m.reportImage.mockResolvedValue(null);
});

describe("레이아웃 가드", () => {
  it.each(["master", "management"] as const)("%s → 연다", async (role) => {
    as(role);
    await opens(AdminLayout({ children: null }));
    expect(m.pending).toHaveBeenCalledOnce();
  });
  it.each(["trainee", "anon"] as const)("%s → / 로 보내고 아무것도 읽지 않는다", async (role) => {
    as(role);
    await bounces(AdminLayout({ children: null }));
    expect(m.pending).not.toHaveBeenCalled();
  });
});

describe("마스터 전용 화면은 그대로 마스터만", () => {
  const pages = {
    "/admin/settings": () => SettingsPage(),
    "/admin/db-parity": () => DbParityPage({ searchParams: Promise.resolve({}) }),
    "/admin/popup": () => PopupPage(),
  };
  for (const [name, open] of Object.entries(pages)) {
    it(`${name}`, async () => {
      as("master");
      await opens(open());
      for (const role of ["management", "trainee", "anon"] as const) {
        as(role);
        await bounces(open());
      }
    });
  }
});

describe("조회 화면은 마스터·관리부서", () => {
  const pages = {
    "/admin/arena/scoreboard": () => ScoreboardPage(),
    "/admin/arena/share-scores": () => ShareScoresPage(),
    "/admin/reports": () => ReportsPage({ searchParams: Promise.resolve({}) }),
  };
  for (const [name, open] of Object.entries(pages)) {
    it(`${name}`, async () => {
      for (const role of ["master", "management"] as const) {
        as(role);
        await opens(open());
      }
      for (const role of ["trainee", "anon"] as const) {
        as(role);
        await bounces(open());
      }
    });
  }
  it("오류 신고함은 막힌 계정에게 목록을 읽지 않는다", async () => {
    as("trainee");
    await bounces(ReportsPage({ searchParams: Promise.resolve({ open: "x" }) }));
    expect(m.listReports).not.toHaveBeenCalled();
    expect(m.reportImage).not.toHaveBeenCalled();
  });
});

describe("/admin/me — 레이아웃 밖(route handler), 예전 동작 그대로", () => {
  const where = async () => new URL((await adminMe()).headers.get("location")!).pathname;
  it("마스터 → 대리 보기를 끄고 /dashboard", async () => {
    as("master");
    expect(await where()).toBe("/dashboard");
    expect(m.setImpersonation).toHaveBeenCalledWith(null);
  });
  it("관리부서·수강생 → /dashboard (대리 보기는 건드리지 않음)", async () => {
    for (const role of ["management", "trainee"] as const) {
      as(role);
      expect(await where()).toBe("/dashboard");
    }
    expect(m.setImpersonation).not.toHaveBeenCalled();
  });
  it("로그인 안 함 → /", async () => {
    as("anon");
    expect(await where()).toBe("/");
  });
});
