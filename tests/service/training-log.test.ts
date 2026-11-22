/**
 * 트레이닝일지 — 수강생은 자기 일지만(belie 2026-10-30). 노션·레지스트리는 가짜, 이름·내용은 모두 가상.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toLogBlock, toText } from "@/service/training-log-blocks";

const users: Record<string, { email: string; role: string; cohort: string; name: string }> = {
  "a@example.com": { email: "a@example.com", role: "trainee", cohort: "11", name: "가상일" },
  "b@example.com": { email: "b@example.com", role: "trainee", cohort: "11", name: "가상이" },
  "c@example.com": { email: "c@example.com", role: "trainee", cohort: "12", name: "가상일" },
  "t@example.com": { email: "t@example.com", role: "trainer", cohort: "T", name: "가상트" },
};
const DB11 = "11111111-1111-1111-1111-111111111111";
const DB12 = "22222222-2222-2222-2222-222222222222";
const OTHER = "33333333-3333-3333-3333-333333333333";
const page = (id: string, db: string, owner: string, title: string) => ({
  id, object: "page", parent: { database_id: db }, created_time: "2026-10-01T00:00:00Z",
  properties: { 상태: { type: "select", select: { name: owner } }, 제목: { type: "title", title: [{ plain_text: title }] } },
});
const PAGES = [
  page("aaaaaaaa-0000-0000-0000-000000000001", DB11, "가상일", "가상일 대표님 1주차 트레이닝 일지"),
  page("aaaaaaaa-0000-0000-0000-000000000002", DB11, "가상일", "가상일 대표님 2주차 트레이닝 일지"),
  page("bbbbbbbb-0000-0000-0000-000000000001", DB11, "가상이", "가상이 대표님 1주차 트레이닝 일지"),
  page("cccccccc-0000-0000-0000-000000000001", DB12, "가상일", "가상일 대표님 1주차 트레이닝 일지"),
  page("dddddddd-0000-0000-0000-000000000001", OTHER, "가상일", "가상일 회의 메모"),
];
const notion = {
  configured: true,
  searchDatabases: vi.fn(async (q: string) => [
    { id: DB11, title: [{ plain_text: "[서울11기] 트레이닝 일지" }] },
    { id: DB12, title: [{ plain_text: "[부산12기] 트레이닝 일지" }] },
    { id: OTHER, title: [{ plain_text: "11기 회의록" }] },
  ].filter(() => q.includes("기]"))),
  queryDatabase: vi.fn(async (db: string) => PAGES.filter((p) => p.parent.database_id === db)),
  getPage: vi.fn(async (id: string) => { const p = PAGES.find((x) => x.id === id); if (!p) throw new Error("notion 404"); return p; }),
  listBlockChildren: vi.fn(async () => [
    { id: "b1", type: "heading_2", has_children: false, heading_2: { rich_text: [{ plain_text: "트레이너 피드백", annotations: { bold: true } }] } },
    { id: "b2", type: "bulleted_list_item", has_children: false, bulleted_list_item: { rich_text: [{ plain_text: "가상 피드백", annotations: { color: "yellow_background" } }] } },
    { id: "b3", type: "child_database", has_children: false, child_database: { title: "숨김" } },
  ]),
};

vi.mock("@/repo/notion-client", () => ({
  notionConfigured: () => notion.configured,
  searchDatabases: (q: string) => notion.searchDatabases(q),
  queryDatabase: (id: string) => notion.queryDatabase(id),
  getPage: (id: string) => notion.getPage(id),
  listBlockChildren: () => notion.listBlockChildren(),
}));
vi.mock("@/repo/users", () => ({ findUserByEmail: async (email: string) => users[email] ?? null }));

async function load() {
  vi.resetModules();
  return import("@/service/training-log");
}

beforeEach(() => { notion.configured = true; });

describe("training log — own entries only", () => {
  it("lists only my pages in my cohort database, newest week first", async () => {
    const { listMyTrainingLogs } = await load();
    const a = await listMyTrainingLogs("a@example.com");
    expect(a.status).toBe("ok");
    expect(a.items.map((i) => [i.id, i.week])).toEqual([
      ["aaaaaaaa-0000-0000-0000-000000000002", 2],
      ["aaaaaaaa-0000-0000-0000-000000000001", 1],
    ]);
    // 같은 이름이라도 다른 기수 DB(12기)와 일지 DB 가 아닌 표는 섞이지 않는다.
    const c = await listMyTrainingLogs("c@example.com");
    expect(c.items.map((i) => i.id)).toEqual(["cccccccc-0000-0000-0000-000000000001"]);
  });

  it("refuses someone else's page, another cohort's page and a non-log page", async () => {
    const { getMyTrainingLog } = await load();
    expect(await getMyTrainingLog("a@example.com", "bbbbbbbb-0000-0000-0000-000000000001")).toBeNull();
    expect(await getMyTrainingLog("a@example.com", "cccccccc-0000-0000-0000-000000000001")).toBeNull();
    expect(await getMyTrainingLog("a@example.com", "dddddddd-0000-0000-0000-000000000001")).toBeNull();
    expect(await getMyTrainingLog("a@example.com", "../etc")).toBeNull();
    const mine = await getMyTrainingLog("a@example.com", "aaaaaaaa-0000-0000-0000-000000000001");
    expect(mine?.blocks).toEqual([
      { type: "h2", text: [{ text: "트레이너 피드백", bold: true }] },
      { type: "ul", text: [{ text: "가상 피드백", bg: "yellow" }] },
    ]);
  });

  it("says why the list is empty: no token, or not a trainee", async () => {
    const { listMyTrainingLogs } = await load();
    expect((await listMyTrainingLogs("t@example.com")).status).toBe("no_cohort");
    notion.configured = false;
    expect((await listMyTrainingLogs("a@example.com")).status).toBe("not_configured");
  });
});

describe("training log — blocks are not silently dropped", () => {
  const rt = (t: string) => ({ rich_text: [{ plain_text: t }] });
  it("heading_4 (노션 제목 4단계) shows as a small heading, and as a toggle when it folds its children", () => {
    expect(toLogBlock({ type: "heading_4", has_children: false, heading_4: rt("가상 소제목") })).toEqual({ type: "h4", text: [{ text: "가상 소제목" }] });
    expect(toLogBlock({ type: "heading_4", has_children: true, heading_4: { ...rt("가상 6단계"), is_toggleable: true } })).toEqual({ type: "toggle", text: [{ text: "가상 6단계" }], level: 4 });
  });
  it("an unknown block keeps its text and its children; an empty unknown leaf is skipped", () => {
    expect(toLogBlock({ type: "future_block", has_children: true, future_block: rt("가상") })).toEqual({ type: "p", text: [{ text: "가상" }] });
    expect(toLogBlock({ type: "future_block", has_children: true, future_block: {} })).toEqual({ type: "p", text: [] });
    expect(toLogBlock({ type: "child_page", has_children: true, child_page: { title: "가상 하위 메모" } })).toEqual({ type: "p", text: [{ text: "가상 하위 메모", bold: true }] });
    expect(toLogBlock({ type: "table_of_contents", has_children: false, table_of_contents: {} })).toBeNull();
    expect(toLogBlock({ type: "child_database", has_children: false, child_database: { title: "숨김" } })).toBeNull();
  });
});

describe("training log — 노션 시각 효과를 그대로 옮긴다", () => {
  const rich = (plain_text: string, annotations = {}, extra = {}) => ({ plain_text, annotations, ...extra });
  it("글자색·배경색 9종을 구분하고, 모르는 색·기본색은 버린다", () => {
    expect(toText([rich("빨강", { color: "red" }), rich("파란 형광펜", { color: "blue_background", bold: true }), rich("기본", { color: "default" }), rich("미래색", { color: "teal_background" })])).toEqual([
      { text: "빨강", color: "red" }, { text: "파란 형광펜", bold: true, bg: "blue" }, { text: "기본" }, { text: "미래색" },
    ]);
  });
  it("멘션·수식 조각은 표시를 남긴다", () => {
    expect(toText([rich("@2026-11-22", {}, { type: "mention" }), rich("x^2", {}, { type: "equation" })])).toEqual([{ text: "@2026-11-22", mention: true }, { text: "x^2", mention: true }]);
  });
  it("블록 색, 콜아웃 아이콘, 코드 언어, 제목 토글 단계", () => {
    expect(toLogBlock({ type: "paragraph", paragraph: { rich_text: [rich("가상")], color: "green_background" } })).toEqual({ type: "p", text: [{ text: "가상" }], bg: "green" });
    expect(toLogBlock({ type: "callout", callout: { rich_text: [rich("가상 안내")], color: "purple", icon: { type: "emoji", emoji: "💡" } } })).toEqual({ type: "callout", text: [{ text: "가상 안내" }], color: "purple", icon: "💡" });
    expect(toLogBlock({ type: "callout", callout: { rich_text: [], icon: { type: "external", external: { url: "https://example.com/i.png" } } } })).toEqual({ type: "callout", text: [], iconUrl: "https://example.com/i.png" });
    expect(toLogBlock({ type: "callout", callout: { rich_text: [], icon: { type: "external", external: { url: "javascript:alert(1)" } } } })).toEqual({ type: "callout", text: [] });
    expect(toLogBlock({ type: "code", code: { rich_text: [rich("a=1")], language: "python" } })).toEqual({ type: "code", text: [{ text: "a=1" }], lang: "python" });
    expect(toLogBlock({ type: "code", code: { rich_text: [rich("메모")], language: "plain text" } })).toEqual({ type: "code", text: [{ text: "메모" }] });
    expect(toLogBlock({ type: "heading_1", heading_1: { rich_text: [rich("가상 큰 토글")], is_toggleable: true, color: "red" } })).toEqual({ type: "toggle", text: [{ text: "가상 큰 토글" }], color: "red", level: 1 });
    expect(toLogBlock({ type: "equation", equation: { expression: "E=mc^2" } })).toEqual({ type: "code", text: [{ text: "E=mc^2" }] });
  });
  it("단 나눔과 표 머리줄", () => {
    expect(toLogBlock({ type: "column_list", has_children: true, column_list: {} })).toEqual({ type: "columns", text: [] });
    expect(toLogBlock({ type: "column", has_children: true, column: { width_ratio: 0.25 } })).toEqual({ type: "column", text: [], ratio: 0.25 });
    expect(toLogBlock({ type: "column", has_children: true, column: {} })).toEqual({ type: "column", text: [] });
    expect(toLogBlock({ type: "table", has_children: true, table: { has_column_header: true, has_row_header: false } })).toEqual({ type: "table", text: [], rows: [], headRow: true });
  });
});
