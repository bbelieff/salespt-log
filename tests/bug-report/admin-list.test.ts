/**
 * 오류 신고함(admin-phase1, 2026-11-16) — 읽기 전용.
 *  ① 볼 수 있는 사람: 마스터 + 관리부서. 그 밖은 service 가 거절하고 DB 를 읽지 않는다.
 *  ② 최신순 20건씩, 쪽 번호는 범위 안으로. 캡처는 목록에 싣지 않고 한 장씩만.
 *  ③ 화면: 시각·보낸 사람·보던 화면·내용·상태·캡처 링크. 쓰기 버튼 없음.
 *  ④ repo 읽기는 표를 만들지 않는다(표가 없으면 빈 결과).
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal("React", React);

const m = vi.hoisted(() => ({
  db: true,
  query: vi.fn(),
  trainer: vi.fn(),
  session: vi.fn(),
}));
vi.mock("@/repo/db/client", () => ({ dbEnabled: () => m.db, getDbPool: () => ({ query: m.query }) }));
vi.mock("@/repo/users", () => ({ findTrainerByEmail: m.trainer }));
vi.mock("@/config", () => ({ adminEmails: () => ["master@example.test"] }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));
vi.mock("@/auth/identity", () => ({
  getSessionEmail: m.session,
  canViewAdminPages: async (e: string) => e === "master@example.test" || e === "staff@example.test",
}));

const { listBugReportsForAdmin, getBugReportImageForAdmin, countNewBugReportsForTodo, BugReportForbidden, BUG_REPORT_PAGE_SIZE } =
  await import("@/service/bug-reports-admin");
const { default: ReportsPage } = await import("@/app/admin/reports/page");

const ID = "3f2c1a54-8a0e-4c7a-9b56-0c1d2e3f4a5b";
const IMG = "data:image/jpeg;base64,AAAA";
const row = (over: Record<string, unknown> = {}) => ({
  id: ID, created_at: new Date("2026-11-15T03:04:00Z"), email: "s@example.test", name: "가상수강생", cohort: "11",
  category: "저장이 안 돼요", body: "눌러도 반응이 없어요", has_image: true, status: "new",
  context: { path: "/payment?tab=1", title: "실무/수납", errors: ["TypeError: x"] },
  ...over,
});
/** SQL 종류별로 답하는 가짜 DB. */
function db(opts: { total?: number; rows?: unknown[]; image?: string | null; fresh?: number } = {}) {
  m.query.mockImplementation(async (sql: string) => {
    if (/select image from/.test(sql)) return { rows: opts.image == null ? [] : [{ image: opts.image }] };
    if (/status='new'/.test(sql)) return { rows: [{ n: String(opts.fresh ?? 0) }] };
    if (/count\(\*\)/.test(sql)) return { rows: [{ n: String(opts.total ?? 0) }] };
    return { rows: opts.rows ?? [] };
  });
}
const sqls = () => m.query.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  vi.clearAllMocks();
  m.db = true;
  m.trainer.mockResolvedValue(null);
  db();
});

describe("볼 수 있는 사람", () => {
  it("마스터", async () => {
    db({ total: 1, rows: [row()] });
    const r = await listBugReportsForAdmin("Master@Example.test");
    expect(r.rows).toHaveLength(1);
    expect(m.trainer).not.toHaveBeenCalled();
  });
  it("관리부서(활성 트레이너 행 · 부서 관리)", async () => {
    m.trainer.mockResolvedValue({ role: "trainer", status: "active", cohort: " 관리 " });
    await expect(listBugReportsForAdmin("staff@example.test")).resolves.toMatchObject({ enabled: true });
  });
  it.each([
    ["일반 트레이너", { role: "trainer", status: "active", cohort: "T" }],
    ["승인 대기 관리부서", { role: "trainer", status: "pending", cohort: "관리" }],
    ["수강생", null],
  ])("%s → 거절, DB 를 읽지 않는다", async (_name, trainer) => {
    m.trainer.mockResolvedValue(trainer);
    await expect(listBugReportsForAdmin("x@example.test")).rejects.toBeInstanceOf(BugReportForbidden);
    await expect(getBugReportImageForAdmin("x@example.test", ID)).rejects.toBeInstanceOf(BugReportForbidden);
    expect(m.query).not.toHaveBeenCalled();
  });
  it("이메일이 없으면 거절", async () => {
    await expect(listBugReportsForAdmin(null)).rejects.toBeInstanceOf(BugReportForbidden);
    await expect(listBugReportsForAdmin("  ")).rejects.toBeInstanceOf(BugReportForbidden);
  });
});

describe("목록", () => {
  it("최신순 · 20건씩 · 캡처 본문은 싣지 않는다", async () => {
    db({ total: 45, rows: [row()] });
    const r = await listBugReportsForAdmin("master@example.test", 2);
    expect(r).toMatchObject({ enabled: true, total: 45, page: 2, pageCount: 3 });
    expect(r.rows[0]).toEqual({
      id: ID, createdAt: "2026-11-15T03:04:00.000Z", email: "s@example.test", name: "가상수강생", cohort: "11",
      category: "저장이 안 돼요", body: "눌러도 반응이 없어요", hasImage: true, status: "new",
      pageTitle: "실무/수납", pagePath: "/payment?tab=1", errors: ["TypeError: x"],
    });
    const list = m.query.mock.calls.find((c) => /order by created_at desc/.test(String(c[0])))!;
    expect(list[1]).toEqual([BUG_REPORT_PAGE_SIZE, BUG_REPORT_PAGE_SIZE]);
    expect(String(list[0])).not.toMatch(/select[^;]*\bimage\b(?! <> '')/);
  });
  it("쪽 번호는 범위 안으로", async () => {
    db({ total: 45 });
    expect((await listBugReportsForAdmin("master@example.test", 99)).page).toBe(3);
    expect((await listBugReportsForAdmin("master@example.test", -4)).page).toBe(1);
    expect((await listBugReportsForAdmin("master@example.test", Number.NaN)).page).toBe(1);
  });
  it("맥락이 깨져 있어도 목록은 나온다", async () => {
    db({ total: 1, rows: [row({ context: "엉뚱한 값" }), row({ context: null, has_image: false })] });
    const r = await listBugReportsForAdmin("master@example.test");
    expect(r.rows.map((x) => [x.pageTitle, x.pagePath, x.errors, x.hasImage])).toEqual([["", "", [], true], ["", "", [], false]]);
  });
  it("읽기만 한다 — 표를 만들거나 고치는 SQL 이 없다", async () => {
    db({ total: 1, rows: [row()], image: IMG, fresh: 2 });
    await listBugReportsForAdmin("master@example.test");
    await getBugReportImageForAdmin("master@example.test", ID);
    await countNewBugReportsForTodo();
    expect(sqls().length).toBeGreaterThan(0);
    for (const sql of sqls()) expect(sql).not.toMatch(/\b(create|insert|update|delete|alter|drop)\b/i);
  });
  it("표가 아직 없으면(42P01) 빈 결과 — 다른 오류는 그대로", async () => {
    m.query.mockRejectedValue(Object.assign(new Error("relation does not exist"), { code: "42P01" }));
    await expect(listBugReportsForAdmin("master@example.test")).resolves.toMatchObject({ rows: [], total: 0, page: 1 });
    await expect(countNewBugReportsForTodo()).resolves.toBe(0);
    await expect(getBugReportImageForAdmin("master@example.test", ID)).resolves.toBeNull();
    m.query.mockRejectedValue(new Error("connection refused"));
    await expect(listBugReportsForAdmin("master@example.test")).rejects.toThrow("connection refused");
  });
  it("DB 가 꺼져 있으면 빈 목록(읽지 않음)", async () => {
    m.db = false;
    await expect(listBugReportsForAdmin("master@example.test")).resolves.toMatchObject({ enabled: false, rows: [] });
    await expect(countNewBugReportsForTodo()).resolves.toBe(0);
    expect(m.query).not.toHaveBeenCalled();
  });
});

describe("캡처 한 장", () => {
  it("형식이 맞는 그림만 돌려준다", async () => {
    db({ image: IMG });
    await expect(getBugReportImageForAdmin("master@example.test", ID)).resolves.toBe(IMG);
    db({ image: "javascript:alert(1)" });
    await expect(getBugReportImageForAdmin("master@example.test", ID)).resolves.toBeNull();
    db({ image: "" });
    await expect(getBugReportImageForAdmin("master@example.test", ID)).resolves.toBeNull();
  });
  it("id 가 uuid 가 아니면 DB 를 읽지 않는다", async () => {
    await expect(getBugReportImageForAdmin("master@example.test", "1; drop table")).resolves.toBeNull();
    expect(m.query).not.toHaveBeenCalled();
  });
});

describe("새 신고 수", () => {
  it("최근 7일 · status=new", async () => {
    db({ fresh: 3 });
    await expect(countNewBugReportsForTodo()).resolves.toBe(3);
    expect(m.query.mock.calls[0]?.[1]).toEqual([7]);
  });
});

describe("화면 /admin/reports", () => {
  const html = async (sp: Record<string, string> = {}) => renderToStaticMarkup(await ReportsPage({ searchParams: Promise.resolve(sp) }));

  it("관리부서도 본다 — 시각·보낸 사람·화면·내용·상태·캡처 링크", async () => {
    m.session.mockResolvedValue("staff@example.test");
    m.trainer.mockResolvedValue({ role: "trainer", status: "active", cohort: "관리" });
    db({ total: 21, rows: [row()] });
    const out = await html();
    expect(out).toContain("오류 신고함");
    expect(out).toContain("모두 21건");
    expect(out).toContain('dateTime="2026-11-15T03:04:00.000Z"');
    expect(out).toContain("11. 15. 12:04"); // 한국 시각
    expect(out).toContain("11기 가상수강생");
    expect(out).toContain("s@example.test");
    expect(out).toContain("실무/수납 · /payment?tab=1");
    expect(out).toContain("눌러도 반응이 없어요");
    expect(out).toContain("새 신고");
    expect(out).toContain(`href="/admin/reports?page=1&amp;open=${ID}"`);
    expect(out).toContain('href="/admin/reports?page=2"');
    // 읽기 전용 — 누를 수 있는 것은 링크뿐이고 캡처 본문은 목록에 없다.
    expect(out).not.toMatch(/<button|<form|<input/);
    expect(out).not.toContain("data:image");
  });
  it("「캡처 보기」를 누른 한 건만 그림을 읽는다", async () => {
    m.session.mockResolvedValue("master@example.test");
    db({ total: 1, rows: [row()], image: IMG });
    expect(await html({ open: ID })).toContain(`src="${IMG}"`);
    // 목록에 없는 id 는 읽지 않는다.
    m.query.mockClear();
    expect(await html({ open: "3f2c1a54-8a0e-4c7a-9b56-000000000000" })).not.toContain("data:image");
    expect(sqls().some((s) => /select image from/.test(s))).toBe(false);
  });
  it("신고가 없으면 빈 안내", async () => {
    m.session.mockResolvedValue("master@example.test");
    expect(await html()).toContain("들어온 신고가 없어요.");
  });
  it("수강생·로그인 안 함 → / 로, DB 를 읽지 않는다", async () => {
    for (const who of ["student@example.test", null]) {
      m.session.mockResolvedValue(who);
      await expect(ReportsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/");
    }
    expect(m.query).not.toHaveBeenCalled();
  });
});
