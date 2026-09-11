import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_GOALS, type WeeklyGoalPrivateRecord, type WeeklyGoalView } from "@/types/weekly-goals";
import { copyGoalText, escapeGoalHTML, meetingCells, meetingClipboard, MEETING_COLUMNS, publicGoalCopy } from "@/components/weekly-goals/copy";

const view = (): WeeklyGoalView => ({
  student: { email: "fixture@example.test", name: "Fixture Student", cohort: "test-cohort", courseStart: "2026-09-04", region: "Fixture Region", trainers: ["Fixture Trainer 1", "Fixture Trainer 2"] },
  current: { week: 1, start: "2026-09-04", end: "2026-09-10", record: { goals: { ...EMPTY_GOALS, production: 0, contacts: 7 }, task: "Task line 1\nTask line 2", revision: 1, updatedAt: null }, actuals: { production: 2, inflow: 3, contacts: 4, meetings: 5, contracts: 6 } },
  previous: null, canReadInternal: true,
});
const internal: WeeklyGoalPrivateRecord = { specialNotes: "PRIVATE-NOTE", priorOutcome: "PRIVATE-OUTCOME", revision: 1, updatedAt: null };
afterEach(() => vi.unstubAllGlobals());

describe("goal copy serialization", () => {
  it("uses explicit public fields even when runtime input contains internal data", () => {
    const source = { ...view(), internal, specialNotes: internal.specialNotes };
    const result = publicGoalCopy(source);
    expect(result).toContain("생산: 0");
    expect(result).toContain("유입: 미기재");
    expect(result).toContain("컨택완료: 7");
    expect(result).toContain("Task line 1\nTask line 2");
    expect(result).not.toMatch(/PRIVATE|fixture@example/);
  });
  it("creates exactly the approved fourteen ordered columns with current actuals", () => {
    expect(MEETING_COLUMNS).toHaveLength(14);
    expect(meetingCells(view(), internal)).toEqual([
      "Fixture Region", "test-cohort", "Fixture Student", "Fixture Trainer 1, Fixture Trainer 2", "5", "6",
      "PRIVATE-NOTE", "PRIVATE-OUTCOME", "Task line 1\nTask line 2", "0", "미기재", "7", "미기재", "미기재",
    ]);
  });
  it("escapes every HTML metacharacter rather than interpreting editable preview markup", () => {
    expect(escapeGoalHTML('&<>"\'')).toBe("&amp;&lt;&gt;&quot;&#39;");
    const cells = meetingCells(view(), internal);
    cells[6] = '<img src=x onerror="alert(1)"><script>bad</script>&';
    const { html } = meetingClipboard(cells);
    expect(html).not.toMatch(/<img|<script/);
    expect(html).toContain("&lt;img");
    expect(html.match(/<td>/g)).toHaveLength(14);
    expect(html.match(/<tr>/g)).toHaveLength(1);
    expect(html).not.toMatch(/<thead|<th[ >]/);
  });
  it("preserves multiline HTML and fourteen TSV columns despite tabs and all newline forms", () => {
    const cells = meetingCells(view(), internal);
    cells[6] = "first\tvalue\r\nsecond\nthird\rfourth";
    const { html, plain } = meetingClipboard(cells);
    expect(html).toContain("first\tvalue<br>second<br>third<br>fourth");
    expect(plain).not.toMatch(/[\r\n]/);
    expect(plain.split("\t")).toHaveLength(14);
    expect(plain.split("\t")[6]).toBe("first value / second / third / fourth");
  });
  it.each([0, 13, 15])("rejects malformed preview with %i cells", length => {
    expect(() => meetingClipboard(Array<string>(length).fill("test"))).toThrow("열 개수");
  });
});

describe("clipboard capability and denied access", () => {
  it("writes both HTML and plain formats when rich clipboard is available", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const items: Record<string, Blob>[] = [];
    vi.stubGlobal("navigator", { clipboard: { write } });
    vi.stubGlobal("ClipboardItem", class { constructor(item: Record<string, Blob>) { items.push(item); } });
    expect(await copyGoalText("fixture plain", "<b>fixture html</b>")).toBe(true);
    expect(write).toHaveBeenCalledOnce();
    expect(await items[0]?.["text/plain"]?.text()).toBe("fixture plain");
    expect(await items[0]?.["text/html"]?.text()).toBe("<b>fixture html</b>");
  });
  it("uses plain clipboard if rich ClipboardItem support is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    vi.stubGlobal("ClipboardItem", undefined);
    expect(await copyGoalText("fixture plain", "<b>fixture html</b>")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("fixture plain");
  });
  it("returns false for unavailable clipboard so the panel can offer selectable text", async () => {
    vi.stubGlobal("navigator", {});
    expect(await copyGoalText("preserved fallback text")).toBe(false);
  });
  it("does not pretend success when clipboard permission is denied", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    expect(await copyGoalText("preserved fallback text")).toBe(false);
  });
  it("returns false on rich clipboard failure without leaking the exception", async () => {
    vi.stubGlobal("navigator", { clipboard: { write: vi.fn().mockRejectedValue(new Error("denied")) } });
    vi.stubGlobal("ClipboardItem", class {});
    await expect(copyGoalText("plain", "<p>html</p>")).resolves.toBe(false);
  });
});
