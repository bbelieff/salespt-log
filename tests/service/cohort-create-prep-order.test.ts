/**
 * 기수 생성 재시도(completeOnePending) — 사전등록 행은 시트를 다 찍은 뒤에 (2026-10-24 사고).
 * addTraineePrepRow 가 시트를 읽어 기수·이름·날짜 캐시를 박으므로, 먼저 부르면 갓 복제한 시트의
 * 템플릿 잔재(8 / 빈 이름 / 6/12)가 굳어 새 기수 수강생 주차가 통째로 어긋난다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  copyTemplateSheet: vi.fn(),
  addTraineePrepRow: vi.fn(),
  findExistingSheetIdByCohortName: vi.fn(),
  writeCourseDates: vi.fn(),
  writeProfile: vi.fn(),
  appendArenaRoster: vi.fn(),
}));
vi.mock("@/repo/db/cohort-pending", () => ({ listPendingCohortCreates: vi.fn(), markCohortCreateDone: vi.fn(), markCohortCreateFailed: vi.fn() }));
vi.mock("@/repo/drive-client", () => ({ copyTemplateSheet: api.copyTemplateSheet }));
vi.mock("@/repo/cohorts", () => ({ appendArenaRoster: api.appendArenaRoster }));
vi.mock("@/repo/users-prep", () => ({ addTraineePrepRow: api.addTraineePrepRow }));
vi.mock("@/repo/users", () => ({ findExistingSheetIdByCohortName: api.findExistingSheetIdByCohortName }));
vi.mock("@/repo/course-dates", () => ({ writeCourseDates: api.writeCourseDates }));
vi.mock("@/repo/sales", () => ({ writeProfile: api.writeProfile }));

import { completeOnePending } from "@/service/cohort-create";

const job = {
  id: 1, cohortLabel: "12", cohortType: "cohort", name: "가상수강생", mode: "create", sheetId: "",
  folderId: "folder-1", templateId: "template-1", sheetTitle: "가상 시트", rosterSheetId: "",
  courseStartISO: "2026-10-02", status: "pending", attempts: 0, lastError: "",
} as unknown as Parameters<typeof completeOnePending>[0];

describe("completeOnePending — 찍고 나서 등록", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.findExistingSheetIdByCohortName.mockResolvedValue(null);
    api.copyTemplateSheet.mockResolvedValue("new-sheet");
    api.writeCourseDates.mockResolvedValue({ written: ["O1", "O2"], preserved: [] });
  });

  it("★갓 복제한 시트: B3:C3·O1/O2(템플릿 덮기) 다음에 사전등록", async () => {
    await expect(completeOnePending(job)).resolves.toBe("new-sheet");
    expect(api.writeProfile).toHaveBeenCalledWith("new-sheet", "12", "가상수강생");
    expect(api.writeCourseDates).toHaveBeenCalledWith("new-sheet", "2026-10-02", expect.any(String), { allowTemplateOverwrite: true });
    const prep = api.addTraineePrepRow.mock.invocationCallOrder[0]!;
    expect(api.writeProfile.mock.invocationCallOrder[0]!).toBeLessThan(prep);
    expect(api.writeCourseDates.mock.invocationCallOrder[0]!).toBeLessThan(prep);
  });

  it("이미 있는 시트를 재사용하면 기수·이름을 덮지 않고, 날짜도 보존 가드를 그대로 둔다", async () => {
    api.findExistingSheetIdByCohortName.mockResolvedValue("old-sheet");
    await completeOnePending(job);
    expect(api.copyTemplateSheet).not.toHaveBeenCalled();
    expect(api.writeProfile).not.toHaveBeenCalled();
    expect(api.writeCourseDates).toHaveBeenCalledWith("old-sheet", "2026-10-02", expect.any(String), undefined);
  });
});
