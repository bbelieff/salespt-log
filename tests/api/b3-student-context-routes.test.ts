import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  cookies: new Map<string, string>(),
  users: new Map<string, Record<string, unknown>>(),
  trainer: null as Record<string, unknown> | null,
  arena: null as { email: string; spreadsheetId: string } | null,
  findUserByEmail: vi.fn(),
  findTrainerByEmail: vi.fn(),
  resolveOwnArenaIdentity: vi.fn(),
  loadCompanyInfoByContract: vi.fn(),
  saveCompanyInfoByContract: vi.fn(),
  loadContractPayments: vi.fn(),
  addFromContract: vi.fn(),
  syncContractFee: vi.fn(),
  patchContractPayment: vi.fn(),
  removeContractPayment: vi.fn(),
  removeContractPaymentWithCascade: vi.fn(),
  terminateContract: vi.fn(),
  previewMeetingLink: vi.fn(),
  linkMeetingToContract: vi.fn(),
  editContractLinkedFields: vi.fn(),
  addPriorContract: vi.fn(),
  addStandaloneContract: vi.fn(),
  listLinkableMeetings: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: m.auth }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = m.cookies.get(name);
      return value === undefined ? undefined : { value };
    },
  }),
}));
vi.mock("@/repo/users", () => ({
  findUserByEmail: m.findUserByEmail,
  findTrainerByEmail: m.findTrainerByEmail,
  parseAssignedTrainers: (value: string | null | undefined) =>
    String(value ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
}));
vi.mock("@/repo/users-arena", () => ({
  resolveOwnArenaIdentity: m.resolveOwnArenaIdentity,
}));
vi.mock("@/service/contract-payment", () => ({
  loadCompanyInfoByContract: m.loadCompanyInfoByContract,
  saveCompanyInfoByContract: m.saveCompanyInfoByContract,
}));
vi.mock("@/service", () => ({
  loadContractPayments: m.loadContractPayments,
  addFromContract: m.addFromContract,
  syncContractFee: m.syncContractFee,
  patchContractPayment: m.patchContractPayment,
  removeContractPayment: m.removeContractPayment,
  removeContractPaymentWithCascade: m.removeContractPaymentWithCascade,
  terminateContract: m.terminateContract,
  previewMeetingLink: m.previewMeetingLink,
  linkMeetingToContract: m.linkMeetingToContract,
  editContractLinkedFields: m.editContractLinkedFields,
  addPriorContract: m.addPriorContract,
  addStandaloneContract: m.addStandaloneContract,
  listLinkableMeetings: m.listLinkableMeetings,
}));

import {
  GET as companyGET,
  POST as companyPOST,
} from "@/app/api/company-info/route";
import {
  GET as paymentsGET,
  PATCH as paymentsPATCH,
  POST as paymentsPOST,
} from "@/app/api/contract-payment/route";
import {
  DELETE as paymentDELETE,
  PATCH as paymentPATCH,
} from "@/app/api/contract-payment/[row]/route";
import { POST as terminatePOST } from "@/app/api/contract-payment/[row]/terminate/route";
import {
  GET as linkGET,
  POST as linkPOST,
} from "@/app/api/contract-payment/[row]/link-meeting/route";
import { POST as editLinkedPOST } from "@/app/api/contract-payment/edit-linked/route";
import { POST as priorPOST } from "@/app/api/contract-payment/prior/route";
import { POST as standalonePOST } from "@/app/api/contract-payment/standalone/route";
import { GET as linkableGET } from "@/app/api/meetings/linkable/route";

const SESSION = "trainer@example.test";
const TARGET = "student@example.test";
const ARENA = "arena@example.test";
const DATE = "2026-10-10";
const rowContext = { params: Promise.resolve({ row: "3" }) };

function user(
  email: string,
  role: "trainer" | "trainee",
  overrides: Record<string, unknown> = {},
) {
  return {
    email,
    cohort: role === "trainer" ? "관리" : "10",
    name: role === "trainer" ? "Trainer" : "Student",
    spreadsheetId: role === "trainee" ? "sheet-fixture" : "",
    role,
    status: "active",
    assignedTrainer: "",
    ...overrides,
  };
}

function jsonRequest(path: string, method: string, body: unknown) {
  return new NextRequest(`https://app.example.test${path}`, {
    method,
    body: JSON.stringify(body),
  });
}

function paymentBody() {
  return { 계약일: DATE, 업체명: "Fixture", 수임비: 1_000 };
}

async function invokeEveryRoute(): Promise<Response[]> {
  const query = new URLSearchParams({ 계약일: DATE, 업체명: "Fixture" });
  return Promise.all([
    companyGET(
      new NextRequest(`https://app.example.test/api/company-info?${query}`),
    ),
    companyPOST(
      jsonRequest("/api/company-info", "POST", {
        계약일: DATE,
        업체명: "Fixture",
        업체정보: {},
      }),
    ),
    paymentsGET(),
    paymentsPOST(jsonRequest("/api/contract-payment", "POST", paymentBody())),
    paymentsPATCH(jsonRequest("/api/contract-payment", "PATCH", paymentBody())),
    paymentPATCH(
      jsonRequest("/api/contract-payment/3", "PATCH", paymentBody()),
      rowContext,
    ),
    paymentDELETE(
      new NextRequest("https://app.example.test/api/contract-payment/3", {
        method: "DELETE",
      }),
      rowContext,
    ),
    terminatePOST(
      jsonRequest("/api/contract-payment/3/terminate", "POST", {
        사유: "fixture",
        반환액: 0,
        숨김: false,
      }),
      rowContext,
    ),
    linkGET(
      new NextRequest(
        "https://app.example.test/api/contract-payment/3/link-meeting?meetingId=meeting-fixture",
      ),
      rowContext,
    ),
    linkPOST(
      jsonRequest("/api/contract-payment/3/link-meeting", "POST", {
        meetingId: "meeting-fixture",
        업체명: "Fixture",
        수임비: 1_000,
        업체정보: {},
      }),
      rowContext,
    ),
    editLinkedPOST(
      jsonRequest("/api/contract-payment/edit-linked", "POST", {
        meetingId: "meeting-fixture",
        old: { 계약일: DATE, 업체명: "Fixture" },
        next: { 수임비: 2_000 },
      }),
    ),
    priorPOST(
      jsonRequest("/api/contract-payment/prior", "POST", paymentBody()),
    ),
    standalonePOST(
      jsonRequest("/api/contract-payment/standalone", "POST", {
        ...paymentBody(),
        requestKey: "11111111-1111-4111-8111-111111111111",
      }),
    ),
    linkableGET(),
  ]);
}

function downstreamMocks() {
  return [
    m.loadCompanyInfoByContract,
    m.saveCompanyInfoByContract,
    m.loadContractPayments,
    m.addFromContract,
    m.syncContractFee,
    m.patchContractPayment,
    m.removeContractPayment,
    m.terminateContract,
    m.previewMeetingLink,
    m.linkMeetingToContract,
    m.editContractLinkedFields,
    m.addPriorContract,
    m.addStandaloneContract,
    m.listLinkableMeetings,
  ];
}

function setSession(email: string | null) {
  m.auth.mockResolvedValue(
    email ? { user: { email } } : null,
  );
}

function setOwnContext() {
  setSession(TARGET);
  m.users.set(TARGET, user(TARGET, "trainee"));
}

function setAssignedContext() {
  setSession(SESSION);
  m.trainer = user(SESSION, "trainer");
  m.users.set(
    TARGET,
    user(TARGET, "trainee", { assignedTrainer: SESSION }),
  );
  m.cookies.set("salespt_as", TARGET);
}

function setArenaContext() {
  setSession(SESSION);
  m.trainer = user(SESSION, "trainer");
  m.cookies.set("salespt_arena_self", "1");
  m.arena = { email: ARENA, spreadsheetId: "arena-sheet-fixture" };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.STUB_USER_EMAIL;
  m.cookies.clear();
  m.users.clear();
  m.trainer = null;
  m.arena = null;
  setSession(null);
  m.findUserByEmail.mockImplementation(async (email: string) =>
    m.users.get(email.toLowerCase()) ?? null,
  );
  m.findTrainerByEmail.mockImplementation(async () => m.trainer);
  m.resolveOwnArenaIdentity.mockImplementation(async () => m.arena);
  m.loadCompanyInfoByContract.mockResolvedValue(null);
  m.saveCompanyInfoByContract.mockResolvedValue({ meetingUpdated: false });
  m.loadContractPayments.mockResolvedValue([]);
  m.addFromContract.mockResolvedValue({ row: 3 });
  m.syncContractFee.mockResolvedValue(null);
  m.previewMeetingLink.mockResolvedValue({});
  m.linkMeetingToContract.mockResolvedValue({ failures: [] });
  m.editContractLinkedFields.mockResolvedValue({ failures: [] });
  m.addPriorContract.mockResolvedValue({ row: 3 });
  m.addStandaloneContract.mockResolvedValue({ row: 3 });
  m.listLinkableMeetings.mockResolvedValue([]);
});

describe("B3 student-context routes", () => {
  it.each([
    ["unauthenticated", 401, () => setSession(null)],
    [
      "invalid_student_target",
      403,
      () => {
        setSession(SESSION);
        m.trainer = user(SESSION, "trainer");
        m.users.set(
          TARGET,
          user(TARGET, "trainee", {
            assignedTrainer: "another-trainer@example.test",
          }),
        );
        m.cookies.set("salespt_as", TARGET);
      },
    ],
    [
      "student_target_required",
      403,
      () => {
        setSession(SESSION);
        m.trainer = user(SESSION, "trainer");
      },
    ],
    [
      "student_view_forbidden",
      403,
      () => setSession("unmapped@example.test"),
    ],
  ])("fails closed with stable %s and no service calls", async (code, status, setup) => {
    setup();

    const responses = await invokeEveryRoute();

    for (const response of responses) {
      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toEqual({ error: code, code });
    }
    for (const downstream of downstreamMocks()) {
      expect(downstream).not.toHaveBeenCalled();
    }
    expect(m.removeContractPaymentWithCascade).not.toHaveBeenCalled();
  });

  it.each([
    ["own", TARGET, setOwnContext],
    ["assigned", TARGET, setAssignedContext],
    ["arena", ARENA, setArenaContext],
  ])("uses the resolved %s identity for every downstream call", async (_mode, email, setup) => {
    setup();

    const responses = await invokeEveryRoute();

    expect(responses.map((response) => response.status)).toEqual(
      Array(responses.length).fill(200),
    );
    for (const downstream of downstreamMocks()) {
      expect(downstream).toHaveBeenCalledTimes(1);
      expect(downstream.mock.calls[0]?.[0]).toBe(email);
    }
    expect(m.removeContractPaymentWithCascade).not.toHaveBeenCalled();
  });

  it("binds company GET to the resolved arena trainee email", async () => {
    setArenaContext();
    const query = new URLSearchParams({ 계약일: DATE, 업체명: "Fixture" });

    const response = await companyGET(
      new NextRequest(`https://app.example.test/api/company-info?${query}`),
    );

    expect(response.status).toBe(200);
    expect(m.loadCompanyInfoByContract).toHaveBeenCalledWith(ARENA, {
      계약일: DATE,
      업체명: "Fixture",
    });
  });
});
