/**
 * POST /api/admin/create-cohort-members — 수강시작일 기록·리포트 회귀 (사고 2회 재발 방지).
 *
 * 무엇을 지키는가:
 *  ① 갓 복제한 시트에는 allowTemplateOverwrite=true 로 쓴다. 안 그러면 템플릿(0605=8기 사본)의
 *     raw O1 이 §2.5 보존 가드에 걸려 **입력 날짜가 조용히 버려진다** → 개막 후 전 지표 0.
 *  ② 날짜가 기록되지 않으면 그 시트의 실측값(O1/O2/B3/C3)을 응답 dates[] 에 담는다 → 모달이
 *     "템플릿 날짜가 그대로 남았다"를 즉시 보여준다.
 *  ③ link 모드(남의 기존 시트)는 날짜를 쓰지도, 읽지도 않는다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getSessionEmail: vi.fn(),
  isAdminEmail: vi.fn(),
  revalidateAdminPages: vi.fn(),
  listCohorts: vi.fn(),
  appendArenaRoster: vi.fn(),
  upsertCohortConfig: vi.fn(),
  copyTemplateSheet: vi.fn(),
  findFolderContainingName: vi.fn(),
  addTraineePrepRow: vi.fn(),
  findExistingSheetIdByCohortName: vi.fn(),
  writeCourseDates: vi.fn(),
  readCourseDateCells: vi.fn(),
  dbEnabled: vi.fn(),
}));

vi.mock("@/auth/identity", () => ({
  getSessionEmail: api.getSessionEmail,
  isAdminEmail: api.isAdminEmail,
}));
vi.mock("@/auth/revalidate-admin", () => ({
  revalidateAdminPages: api.revalidateAdminPages,
}));
vi.mock("@/repo/cohorts", () => ({
  listCohorts: api.listCohorts,
  appendArenaRoster: api.appendArenaRoster,
  upsertCohortConfig: api.upsertCohortConfig,
}));
vi.mock("@/repo/drive-client", () => ({
  copyTemplateSheet: api.copyTemplateSheet,
  findFolderContainingName: api.findFolderContainingName,
}));
vi.mock("@/repo/users-prep", () => ({
  addTraineePrepRow: api.addTraineePrepRow,
  extractSpreadsheetId: (s: string) => String(s).trim(),
}));
vi.mock("@/repo/users", () => ({
  findExistingSheetIdByCohortName: api.findExistingSheetIdByCohortName,
}));
vi.mock("@/repo/course-dates", () => ({
  writeCourseDates: api.writeCourseDates,
  readCourseDateCells: api.readCourseDateCells,
}));
vi.mock("@/repo/db/client", () => ({ dbEnabled: api.dbEnabled }));
vi.mock("@/repo/db/cohort-pending", () => ({
  enqueueCohortCreate: vi.fn(),
  buildPendingCohortJob: vi.fn(),
}));
vi.mock("@/lib/analytics/api-timing", () => ({
  withApiTiming: (_label: string, handler: unknown) => handler,
}));

import { POST } from "@/app/api/admin/create-cohort-members/route";

const NEW_SHEET = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const EXISTING_SHEET = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

/** 복제 직후 시트에 남아있는 템플릿(0605 = 8기 사본) 잔재 — 실제 사고 때의 값. */
const TEMPLATE_RESIDUE = { o1: "2026-06-12", o2: "=O1+50", b3: "8", c3: "" };

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/admin/create-cohort-members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function post(body: Record<string, unknown>) {
  const res = await POST(request(body));
  return { status: res.status, body: await res.json() };
}

describe("POST /api/admin/create-cohort-members — 수강시작일", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    api.getSessionEmail.mockResolvedValue("admin@example.com");
    api.isAdminEmail.mockReturnValue(true);
    api.listCohorts.mockResolvedValue([
      { label: "10", status: "active", type: "cohort", rootFolderId: "root-folder" },
    ]);
    api.findExistingSheetIdByCohortName.mockResolvedValue(null);
    api.findFolderContainingName.mockResolvedValue({ id: "folder-1", matchedNames: ["김도연"] });
    api.copyTemplateSheet.mockResolvedValue(NEW_SHEET);
    api.addTraineePrepRow.mockResolvedValue(undefined);
    api.writeCourseDates.mockResolvedValue({ written: ["O1", "O2"], preserved: [] });
    api.readCourseDateCells.mockResolvedValue(TEMPLATE_RESIDUE);
    api.dbEnabled.mockReturnValue(false);
  });

  it("★갓 복제한 시트는 allowTemplateOverwrite=true 로 쓴다 (템플릿 잔재가 입력 날짜를 이기지 못하게)", async () => {
    const { status, body } = await post({
      token: "10",
      mode: "create",
      courseStartISO: "2026-08-07",
      members: [{ name: "김도연" }],
    });

    expect(status).toBe(200);
    expect(api.writeCourseDates).toHaveBeenCalledWith(
      NEW_SHEET,
      "2026-08-07",
      "2026-09-26", // O1 + 50일 (ADR-0005)
      { allowTemplateOverwrite: true },
    );
    expect(body.dates).toEqual([
      {
        name: "김도연",
        sheetId: NEW_SHEET,
        status: "written",
        written: ["O1", "O2"],
        courseStartISO: "2026-08-07",
        graduationISO: "2026-09-26",
      },
    ]);
    // 정상 경로에서는 리포트용 추가 시트 read 를 하지 않는다.
    expect(api.readCourseDateCells).not.toHaveBeenCalled();
  });

  it("★날짜 미입력 → 쓰지 않고, 시트에 실제로 남은 값을 실측해 리포트에 담는다", async () => {
    const { status, body } = await post({
      token: "10",
      mode: "create",
      members: [{ name: "김도연" }],
    });

    expect(status).toBe(200);
    expect(api.writeCourseDates).not.toHaveBeenCalled();
    expect(api.readCourseDateCells).toHaveBeenCalledWith(NEW_SHEET);
    expect(body.created).toEqual([{ name: "김도연", sheetId: NEW_SHEET }]);
    expect(body.dates[0]).toMatchObject({
      name: "김도연",
      status: "no_input",
      written: [],
      courseStartISO: "",
      // 화면이 "8기 · 2026-06-12 가 그대로 남았다"를 그대로 보여줄 수 있어야 한다.
      sheet: TEMPLATE_RESIDUE,
    });
  });

  it("기록 실패해도 생성은 성공 — status=error + 실측값 + 사유가 리포트에 남는다", async () => {
    api.writeCourseDates.mockRejectedValue(new Error("PERMISSION_DENIED"));

    const { status, body } = await post({
      token: "10",
      mode: "create",
      courseStartISO: "2026-08-07",
      members: [{ name: "김도연" }],
    });

    expect(status).toBe(200);
    expect(body.created).toHaveLength(1);
    expect(body.failed).toEqual([]);
    expect(body.dates[0]).toMatchObject({
      status: "error",
      reason: "PERMISSION_DENIED",
      sheet: TEMPLATE_RESIDUE,
    });
  });

  it("실측 read 마저 실패해도 생성·경고는 살아남는다(리포트만 sheet 없음)", async () => {
    api.readCourseDateCells.mockRejectedValue(new Error("read 실패"));

    const { status, body } = await post({
      token: "10",
      mode: "create",
      members: [{ name: "김도연" }],
    });

    expect(status).toBe(200);
    expect(body.created).toHaveLength(1);
    expect(body.dates[0]).toMatchObject({ status: "no_input" });
    expect(body.dates[0].sheet).toBeUndefined();
  });

  it("★link 모드(남의 기존 시트)는 날짜를 쓰지도 읽지도 않는다", async () => {
    const { status, body } = await post({
      token: "10",
      mode: "link",
      courseStartISO: "2026-08-07",
      members: [{ name: "김도연", sheetUrl: EXISTING_SHEET }],
    });

    expect(status).toBe(200);
    expect(body.created).toEqual([{ name: "김도연", sheetId: EXISTING_SHEET }]);
    expect(api.writeCourseDates).not.toHaveBeenCalled();
    expect(api.readCourseDateCells).not.toHaveBeenCalled();
    expect(body.dates).toEqual([]);
  });

  it("이미 등록된 멤버(skip)는 시트를 만들지도 날짜를 건드리지도 않는다", async () => {
    api.findExistingSheetIdByCohortName.mockResolvedValue(EXISTING_SHEET);

    const { body } = await post({
      token: "10",
      mode: "create",
      courseStartISO: "2026-08-07",
      members: [{ name: "김도연" }],
    });

    expect(body.skipped).toEqual([{ name: "김도연" }]);
    expect(api.copyTemplateSheet).not.toHaveBeenCalled();
    expect(api.writeCourseDates).not.toHaveBeenCalled();
    expect(body.dates).toEqual([]);
  });

  it("날짜 형식이 틀리면 400 — 아무것도 만들지 않는다", async () => {
    const { status, body } = await post({
      token: "10",
      mode: "create",
      courseStartISO: "2026-13-45",
      members: [{ name: "김도연" }],
    });

    expect(status).toBe(400);
    expect(body.error).toBe("invalid_input");
    expect(api.copyTemplateSheet).not.toHaveBeenCalled();
  });
});
