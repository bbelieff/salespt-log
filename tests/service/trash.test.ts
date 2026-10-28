/** 앱 휴지통 서비스 — 세 곳을 한 표로 모으고, 되살리기는 종류별로 나눠 하나가 막혀도 나머지는 진행. 합성 데이터만. */
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  listDeletedTodos: vi.fn(), restoreTodo: vi.fn(), deletedMeetings: vi.fn(), restoreDeletedMeeting: vi.fn(),
  resolveDbSheetContext: vi.fn(), loadDbSheetTrash: vi.fn(), executeDbSheet: vi.fn(),
}));
vi.mock("@/service/todos", () => ({ listDeletedTodos: m.listDeletedTodos, restoreTodo: m.restoreTodo }));
vi.mock("@/service/meeting-archive", () => ({ deletedMeetings: m.deletedMeetings, restoreDeletedMeeting: m.restoreDeletedMeeting }));
vi.mock("@/service/db-sheet", () => ({ resolveDbSheetContext: m.resolveDbSheetContext, loadDbSheetTrash: m.loadDbSheetTrash, executeDbSheet: m.executeDbSheet }));
vi.mock("@/repo/db/db-sheet", () => ({ DbSheetDuplicate: class DbSheetDuplicate extends Error {} }));
import { listTrash, restoreTrash } from "@/service/trash";
import { DbSheetDuplicate } from "@/repo/db/db-sheet";

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.listDeletedTodos.mockResolvedValue([{ todo: { id: "t1", 업체명: "합성상사", 제목: "결과발표", 예정일자: "2026-11-02", 예정시각: "09:00", institutionRef: "합성재단" }, deletedAt: "2026-10-28T11:00:00.000Z" }]);
  m.deletedMeetings.mockResolvedValue([{ meeting: { id: "m1", 업체명: "합성식당", 미팅날짜: "2026-10-20", 미팅시간: "14:00", 장소: "" }, restorable: false, reason: "연결된 계약 이력이 있어 개별 복원할 수 없어요.", deletedAt: "2026-10-28T12:00:00.000Z" }]);
  m.resolveDbSheetContext.mockResolvedValue({ spreadsheetId: "s" });
  m.loadDbSheetTrash.mockResolvedValue([{ id: "l1", company: "합성공방", owner: "", phone: "010-0000-0000", supplier: "", deletedAt: "2026-10-27T09:00:00.000Z" }]);
});

describe("listTrash", () => {
  it("세 곳을 지운 순(최근 먼저)으로 · 막힌 미팅은 이유", async () => {
    const out = await listTrash("me@example.test");
    expect(out.map((i) => `${i.kind}:${i.id}`)).toEqual(["meeting:m1", "todo:t1", "lead:l1"]);
    expect(out[0]?.blocked).toContain("계약");
    expect(out[1]).toMatchObject({ name: "합성상사", detail: "결과발표 · 2026-11-02 09:00 · 합성재단" });
  });
  it("한 곳을 못 읽어도 나머지는 보인다(DB관리시트 미지원 계정 등)", async () => {
    m.resolveDbSheetContext.mockRejectedValue(new Error("unsupported"));
    expect((await listTrash("me@example.test")).map((i) => i.kind)).toEqual(["meeting", "todo"]);
  });
});

describe("restoreTrash", () => {
  it("종류별로 되살리고, 막힌 것은 이유와 함께 · 나머지는 진행", async () => {
    m.restoreDeletedMeeting.mockRejectedValue(new Error("MEETING_ARCHIVE_COMPLEX"));
    m.executeDbSheet.mockRejectedValueOnce(new (DbSheetDuplicate as unknown as new (msg: string) => Error)("dup")).mockResolvedValueOnce({});
    const r = await restoreTrash("me@example.test", [{ kind: "todo", id: "t1" }, { kind: "meeting", id: "m1" }, { kind: "lead", id: "l1" }, { kind: "lead", id: "l2" }]);
    expect(m.restoreTodo).toHaveBeenCalledWith("me@example.test", "t1", undefined);
    expect(m.executeDbSheet).toHaveBeenCalledWith({ spreadsheetId: "s" }, { action: "trash-restore", ids: ["l1"] });
    expect(r.restored).toBe(2);
    expect(r.failed).toEqual([
      { kind: "meeting", id: "m1", reason: "계약·연결된 미팅이라 되살릴 수 없어요" },
      { kind: "lead", id: "l1", reason: "같은 업체가 DB관리시트에 이미 있어요" },
    ]);
  });
});
