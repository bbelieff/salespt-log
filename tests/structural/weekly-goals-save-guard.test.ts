import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const editor = read("components/weekly-goals/WeeklyGoalEditor.tsx");
const internal = read("components/weekly-goals/GoalInternalEditor.tsx");
const copyPanel = read("components/weekly-goals/GoalCopyPanel.tsx");
const contactPage = read("app/(app)/contact/page.tsx");
const slotItem = read("app/(app)/contact/_components/MeetingSlotItem.tsx");
const slotList = read("app/(app)/contact/_components/MeetingSlotList.tsx");

describe("weekly-goals autosave split (no unified save footer)", () => {
  it("has no unified save footer or chained internal save", () => {
    expect(editor).not.toContain("internalSave");
    expect(editor).not.toContain("목표·PT과제·기록 저장");
    expect(editor).not.toContain("bindSave");
    expect(editor).not.toContain("autoCopyToken");
  });
  it("registers a public-only autosave guard entry backed by flush", () => {
    expect(editor).toContain('useDirtyEntry("weekly-goal-public"');
    expect(editor).toContain("publicAuto.flush()");
  });
  it("keeps public CAS revision on the saved (not draft) value", () => {
    expect(editor).toContain("revisionRef");
    expect(editor).toContain("buildPublicPayload");
  });
  it("keeps internal CAS revision and its own guard entry", () => {
    expect(internal).toContain('useDirtyEntry("weekly-goal-internal"');
    expect(internal).toContain("revision: result.revision");
    expect(internal).toContain("buildInternalPayload");
    expect(internal).toContain("auto.flush()");
  });
  it("copies to clipboard only on explicit user action", () => {
    expect(copyPanel).not.toContain("autoCopyToken");
    expect(copyPanel).not.toContain("copyGoalText(content.plain, content.html).then");
    expect(copyPanel).toContain("클립보드 복사");
  });
});

describe("contact autosave split (no SaveBar, no global confirm)", () => {
  it("removes the page save footer and its reserved padding", () => {
    expect(contactPage).not.toContain("SaveBar");
    expect(contactPage).not.toContain("SaveConfirmModal");
    expect(contactPage).not.toContain("pb-[160px]");
    expect(contactPage).not.toContain("use-contact-save");
    expect(contactPage).not.toContain("useSaveAllDirty");
  });
  it("autosaves numeric metrics through the shared queue, channels-only", () => {
    const metricsHook = read("app/(app)/contact/_lib/use-contact-metrics.ts");
    expect(contactPage).toContain("useContactMetrics");
    expect(metricsHook).toContain("useAutosave<Record<Channel, ChannelDailyRowMetrics>>");
    expect(metricsHook).toContain("metricsSavePayload");
    expect(metricsHook).toContain("isMetricsOnlyPayload");
    expect(contactPage).toContain('useDirtyEntry(\n    "contact-metrics"');
  });
  it("registers new meeting drafts per-draft with idempotent retry", () => {
    expect(contactPage).toContain("useSlotRegister");
    expect(slotList).toContain("onRegisterNew");
    expect(slotItem).toContain("예약 등록");
  });
  it("auto-saves registered meeting cards with no Modify Complete button", () => {
    expect(slotItem).not.toContain(">수정 완료<");
    expect(slotItem).toContain("useAutosave<MeetingDraft>");
    expect(slotItem).toContain("AutosaveStatus");
  });
  it("keeps explicit delete/move flows and invalid-date warnings", () => {
    expect(contactPage).toContain("handleRemoveSavedMeeting");
    expect(contactPage).toContain("RecordMoveModal");
    expect(slotList).toContain("missingSlotFields");
    expect(slotItem).toContain("isSameDayMeeting");
  });
});
