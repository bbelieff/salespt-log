import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  session: "trainer@example.test" as string | null,
  jar: new Map<string, string>(),
  trainer: {
    email: "trainer@example.test",
    role: "trainer",
    status: "active",
    name: "Trainer",
  } as Record<string, unknown> | null,
  own: {
    email: "trainer@example.test",
    role: "trainer",
    status: "active",
    name: "Trainer",
    spreadsheetId: "trainer-sheet",
  } as Record<string, unknown> | null,
  target: {
    email: "student@example.test",
    role: "trainee",
    status: "active",
    assignedTrainer: "trainer@example.test",
    spreadsheetId: "student-sheet",
  } as Record<string, unknown> | null,
  arena: {
    email: "arena-student@example.test",
    spreadsheetId: "arena-sheet",
  } as { email: string; spreadsheetId: string } | null,
  loadDBOverview: vi.fn(),
  listLeadCandidates: vi.fn(),
  addPurchase: vi.fn(),
  addProduction: vi.fn(),
  addBanner: vi.fn(),
  addLead: vi.fn(),
  patchPurchase: vi.fn(),
  patchProduction: vi.fn(),
  patchBanner: vi.fn(),
  patchLead: vi.fn(),
  removePurchase: vi.fn(),
  removeProduction: vi.fn(),
  removeBanner: vi.fn(),
  removeLead: vi.fn(),
  buildExportWorkbookData: vi.fn(),
  serializeExportWorkbook: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (key: string) => m.jar.has(key) ? { value: m.jar.get(key) } : undefined,
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));
vi.mock("@/auth", () => ({
  auth: async () => m.session ? { user: { email: m.session } } : null,
}));
vi.mock("@/auth/dev-stub", () => ({ isDevStubAuthed: () => false }));
vi.mock("@/config", () => ({ adminEmails: () => [] }));
vi.mock("@/repo/users", () => ({
  findTrainerByEmail: async () => m.trainer,
  findUserByEmail: async (email: string) => {
    const normalized = email.toLowerCase();
    if (normalized === "student@example.test") return m.target;
    if (normalized === "foreign@example.test") {
      return {
        email: normalized,
        role: "trainee",
        status: "active",
        assignedTrainer: "somebody-else@example.test",
        spreadsheetId: "foreign-sheet",
      };
    }
    return m.own;
  },
  parseAssignedTrainers: (raw: string | null | undefined) =>
    String(raw ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
}));
vi.mock("@/repo/users-arena", () => ({
  resolveOwnArenaIdentity: async () => m.arena,
}));
vi.mock("@/service", () => ({
  loadDBOverview: m.loadDBOverview,
  listLeadCandidates: m.listLeadCandidates,
  addPurchase: m.addPurchase,
  addProduction: m.addProduction,
  addBanner: m.addBanner,
  addLead: m.addLead,
  patchPurchase: m.patchPurchase,
  patchProduction: m.patchProduction,
  patchBanner: m.patchBanner,
  patchLead: m.patchLead,
  removePurchase: m.removePurchase,
  removeProduction: m.removeProduction,
  removeBanner: m.removeBanner,
  removeLead: m.removeLead,
}));
vi.mock("@/service/export-xlsx", () => ({
  buildExportWorkbookData: m.buildExportWorkbookData,
  serializeExportWorkbook: m.serializeExportWorkbook,
  exportFileName: () => "records.xlsx",
}));
vi.mock("@/lib/analytics/api-timing", () => ({
  withApiTiming: (_label: string, handler: unknown) => handler,
}));

import { GET as dbGET } from "@/app/api/db/route";
import { POST as dbPOST } from "@/app/api/db/[channel]/route";
import {
  DELETE as dbDELETE,
  PATCH as dbPATCH,
} from "@/app/api/db/[channel]/[row]/route";
import { GET as leadsGET } from "@/app/api/leads/route";
import { GET as exportGET } from "@/app/api/export/route";

const PURCHASE = {
  구매일: "2026-10-10",
  업체명: "test-vendor",
  개당단가: 1000,
  주문개수: 1,
};
const channelContext = { params: Promise.resolve({ channel: "매입DB" }) };
const rowContext = {
  params: Promise.resolve({ channel: "매입DB", row: "2" }),
};

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function responseBody(response: Response) {
  return { status: response.status, body: await response.json() };
}

async function callAllRoutes() {
  return Promise.all([
    dbGET(),
    leadsGET(new NextRequest("https://app.example.test/api/leads?q=test")),
    exportGET(),
    dbPOST(
      jsonRequest("https://app.example.test/api/db/매입DB", "POST", PURCHASE),
      channelContext,
    ),
    dbPATCH(
      jsonRequest("https://app.example.test/api/db/매입DB/2", "PATCH", PURCHASE),
      rowContext,
    ),
    dbDELETE(
      jsonRequest("https://app.example.test/api/db/매입DB/2", "DELETE"),
      rowContext,
    ),
  ]);
}

function expectNoDownstreamCalls() {
  for (const fn of [
    m.loadDBOverview,
    m.listLeadCandidates,
    m.buildExportWorkbookData,
    m.addPurchase,
    m.patchPurchase,
    m.removePurchase,
  ]) {
    expect(fn).not.toHaveBeenCalled();
  }
}

describe("DB/leads/export resolved student context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.session = "trainer@example.test";
    m.jar.clear();
    m.trainer = {
      email: m.session,
      role: "trainer",
      status: "active",
      name: "Trainer",
    };
    m.own = {
      email: m.session,
      role: "trainer",
      status: "active",
      name: "Trainer",
      spreadsheetId: "trainer-sheet",
    };
    m.target = {
      email: "student@example.test",
      role: "trainee",
      status: "active",
      assignedTrainer: m.session,
      spreadsheetId: "student-sheet",
    };
    m.arena = {
      email: "arena-student@example.test",
      spreadsheetId: "arena-sheet",
    };
    m.loadDBOverview.mockResolvedValue({ purchases: [], productions: [], banners: [], leads: [] });
    m.listLeadCandidates.mockResolvedValue([]);
    m.buildExportWorkbookData.mockResolvedValue({});
    m.serializeExportWorkbook.mockReturnValue(Buffer.from("xlsx"));
    m.addPurchase.mockResolvedValue({ row: 2, idempotent: false, replayed: false });
    m.patchPurchase.mockResolvedValue(undefined);
    m.removePurchase.mockResolvedValue(undefined);
  });

  it("routes arena reads and writes to the authoritative trainee identity", async () => {
    m.jar.set("salespt_arena_self", "1");

    const responses = await callAllRoutes();

    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200, 200, 200]);
    expect(m.loadDBOverview).toHaveBeenCalledWith("arena-student@example.test");
    expect(m.listLeadCandidates).toHaveBeenCalledWith("arena-student@example.test", "test");
    expect(m.buildExportWorkbookData).toHaveBeenCalledWith("arena-student@example.test");
    expect(m.addPurchase).toHaveBeenCalledWith(
      "arena-student@example.test",
      expect.objectContaining(PURCHASE),
      null,
    );
    expect(m.patchPurchase).toHaveBeenCalledWith(
      "arena-student@example.test",
      2,
      expect.objectContaining(PURCHASE),
    );
    expect(m.removePurchase).toHaveBeenCalledWith("arena-student@example.test", 2);
  });

  it.each([
    ["unauthenticated", 401, () => { m.session = null; }],
    ["invalid_student_target", 403, () => { m.jar.set("salespt_as", "not-an-email"); }],
    ["invalid_student_target", 403, () => { m.jar.set("salespt_as", "foreign@example.test"); }],
    ["student_target_required", 403, () => undefined],
    ["student_view_forbidden", 403, () => {
      m.jar.set("salespt_arena_self", "1");
      m.arena = null;
    }],
  ])("denies %s before every downstream call", async (code, status, arrange) => {
    arrange();

    const responses = await callAllRoutes();

    for (const response of responses) {
      expect(await responseBody(response)).toEqual({
        status,
        body: { error: code, code },
      });
    }
    expectNoDownstreamCalls();
  });

  it("preserves an own trainee target", async () => {
    m.session = "own@example.test";
    m.trainer = null;
    m.own = {
      email: m.session,
      role: "trainee",
      status: "active",
      spreadsheetId: "own-sheet",
    };

    await callAllRoutes();

    expect(m.loadDBOverview).toHaveBeenCalledWith("own@example.test");
    expect(m.addPurchase).toHaveBeenCalledWith(
      "own@example.test",
      expect.objectContaining(PURCHASE),
      null,
    );
  });

  it("preserves a currently assigned trainee target", async () => {
    m.jar.set("salespt_as", "student@example.test");

    await callAllRoutes();

    expect(m.loadDBOverview).toHaveBeenCalledWith("student@example.test");
    expect(m.listLeadCandidates).toHaveBeenCalledWith("student@example.test", "test");
    expect(m.buildExportWorkbookData).toHaveBeenCalledWith("student@example.test");
    expect(m.addPurchase).toHaveBeenCalledWith(
      "student@example.test",
      expect.objectContaining(PURCHASE),
      null,
    );
  });
});
