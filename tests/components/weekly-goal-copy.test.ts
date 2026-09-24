import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_GOALS, type WeeklyGoalPrivateRecord, type WeeklyGoalView } from "@/types/weekly-goals";
import { copyGoalText, escapeGoalHTML, goalClipboard, goalPivotCells, GOAL_PIVOT_COLUMNS, meetingCells, meetingClipboard, MEETING_COLUMNS, publicGoalCopy } from "@/components/weekly-goals/copy";

const view = (): WeeklyGoalView => ({
  student: { email: "fixture@example.test", name: "Fixture Student", cohort: "test-cohort", courseStart: "2026-09-04", region: "Fixture Region", trainers: ["Fixture Trainer 1", "Fixture Trainer 2"] },
  current: { week: 1, start: "2026-09-04", end: "2026-09-10", record: { goals: { ...EMPTY_GOALS, production: 0, contacts: 7 }, task: "Task line 1\nTask line 2", revision: 1, updatedAt: null }, actuals: { production: 2, inflow: 3, contacts: 4, meetings: 99, contracts: 88 } },
  reporting: { start: "2026-09-18", end: "2026-09-24", actuals: { production: 0, inflow: 0, contacts: 0, meetings: 5, contracts: 6 } },
  previous: null, cumulative: { production: 0, inflow: 0, contacts: 0, meetings: 0, contracts: 0 }, canReadInternal: true,
});
const internal: WeeklyGoalPrivateRecord = { specialNotes: "PRIVATE-NOTE", priorOutcome: "PRIVATE-OUTCOME", revision: 1, updatedAt: null };
/** Minimal quoted-TSV parser: one logical record may span physical lines inside quotes (" double as "). */
function parseTsv(plain: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let inQuotes = false;
  for (let i = 0; i < plain.length; i++) {
    const c = plain[i];
    if (inQuotes) {
      if (c === '"') {
        if (plain[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"' && field === "" && !quoted) { inQuotes = true; quoted = true; }
    else if (c === "\t") { row.push(field); field = ""; quoted = false; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; quoted = false; }
    else if (c === "\r") { /* normalized away by serializer */ }
    else field += c;
  }
  row.push(field);
  rows.push(row);
  return rows;
}
afterEach(() => vi.unstubAllGlobals());

describe("goal copy serialization", () => {
  it("uses explicit public fields even when runtime input contains internal data", () => {
    const source = { ...view(), internal, specialNotes: internal.specialNotes };
    const result = publicGoalCopy(source);
    expect(result).toContain("생산: 0");
    expect(result).toContain("유입: 미기재");
    expect(result).toContain("컨택완료: 7");
    expect(result).toContain("• Task line 1\n• Task line 2");
    expect(result).toContain("PT과제: • Task line 1");
    expect(result).not.toMatch(/PRIVATE|fixture@example/);
  });
  it("creates exactly the approved fourteen ordered columns with server-current reporting actuals", () => {
    expect(MEETING_COLUMNS).toHaveLength(14);
    expect(meetingCells(view(), internal)).toEqual([
      "Fixture Region", "test-cohort", "Fixture Student", "Fixture Trainer 1, Fixture Trainer 2", "5", "6",
      "PRIVATE-NOTE", "• 과제 미기재 → PRIVATE-OUTCOME", "• Task line 1\n• Task line 2", "0", "미기재", "7", "미기재", "미기재",
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
    expect(plain).toContain("\n");
    expect(plain).not.toMatch(/\r/);
    const rows = parseTsv(plain);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(14);
    expect(rows[0]?.[6]).toBe("first\tvalue\nsecond\nthird\nfourth");
    expect(plain.split("\n")[0]?.startsWith("Fixture Region\ttest-cohort")).toBe(true);
  });
  it("quotes tabs, quotes, and CRLF notes so the parser restores one logical row", () => {
    const cells = meetingCells(view(), internal);
    cells[6] = 'note "quoted"\twith tab\r\nsecond line';
    cells[8] = "• single task";
    const { plain } = meetingClipboard(cells);
    expect(plain).toContain('""quoted""');
    const rows = parseTsv(plain);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(14);
    expect(rows[0]?.[6]).toBe('note "quoted"\twith tab\nsecond line');
    expect(rows[0]?.[8]).toBe("• single task");
  });
  it.each([0, 13, 15])("rejects malformed preview with %i cells", length => {
    expect(() => meetingClipboard(Array<string>(length).fill("test"))).toThrow("열 개수");
  });
});

describe("previous-week task/outcome pairing in meeting row", () => {
  const withPrevious = (previousTask: string | null, priorOutcome: string, currentTask = "이번주 과제") => {
    const v = view();
    v.current = { ...v.current, week: 2, record: { ...v.current.record, task: currentTask } };
    v.previous = previousTask === null ? null : {
      week: 1,
      start: "2026-09-04",
      end: "2026-09-10",
      record: { goals: { ...EMPTY_GOALS }, task: previousTask, revision: 1, updatedAt: null },
      actuals: { production: 0, inflow: 0, contacts: 0, meetings: 0, contracts: 0 },
    };
    const record: WeeklyGoalPrivateRecord = { specialNotes: "NOTE", priorOutcome, revision: 1, updatedAt: null };
    return { v, record };
  };
  const priorCell = (v: WeeklyGoalView, record: WeeklyGoalPrivateRecord) => meetingCells(v, record)[7] ?? "";
  it("pairs two or more tasks with one bullet per row", () => {
    const { v, record } = withPrevious("지난과제A\n지난과제B", "성과A\n성과B");
    expect(priorCell(v, record)).toBe("• 지난과제A → 성과A\n• 지난과제B → 성과B");
  });
  it("uses a bullet even for a single pair", () => {
    const { v, record } = withPrevious("지난과제", "성과");
    expect(priorCell(v, record)).toBe("• 지난과제 → 성과");
  });
  it("preserves a blank middle outcome without shifting later rows", () => {
    const { v, record } = withPrevious("t1\nt2\nt3", "o1\n\no3");
    expect(priorCell(v, record)).toBe("• t1 → o1\n• t2 → 미기재\n• t3 → o3");
  });
  it("shows 미기재 for tasks beyond the last recorded outcome", () => {
    const { v, record } = withPrevious("t1\nt2\nt3", "o1");
    expect(priorCell(v, record)).toBe("• t1 → o1\n• t2 → 미기재\n• t3 → 미기재");
  });
  it("keeps extra outcomes with an explicit 과제 미기재 task label", () => {
    const { v, record } = withPrevious("t1", "o1\no2");
    expect(priorCell(v, record)).toBe("• t1 → o1\n• 과제 미기재 → o2");
  });
  it("shows 미기재 for an empty outcome on a single task", () => {
    const { v, record } = withPrevious("t1", "");
    expect(priorCell(v, record)).toBe("• t1 → 미기재");
  });
  it("keeps a historical outcome even with no previous week", () => {
    const { v, record } = withPrevious(null, "o1\no2");
    expect(priorCell(v, record)).toBe("• 과제 미기재 → o1\n• 과제 미기재 → o2");
  });
  it("returns 미기재 with no invented row when neither task nor outcome exists", () => {
    const emptyPrevious = withPrevious("", "");
    expect(priorCell(emptyPrevious.v, emptyPrevious.record)).toBe("미기재");
    const noWeek = withPrevious(null, "");
    expect(priorCell(noWeek.v, noWeek.record)).toBe("미기재");
  });
  it("handles CRLF and CR row boundaries exactly like the pairing utility", () => {
    const { v, record } = withPrevious("t1\r\nt2\rt3", "o1\r\no2\ro3");
    expect(priorCell(v, record)).toBe("• t1 → o1\n• t2 → o2\n• t3 → o3");
  });
  it("never uses the current-week task for the previous outcome", () => {
    const { v, record } = withPrevious("지난과제", "지난성과", "CURRENT-ONLY-TASK");
    const cells = meetingCells(v, record);
    expect(cells[7]).toBe("• 지난과제 → 지난성과");
    expect(cells[7]).not.toContain("CURRENT-ONLY-TASK");
    expect(cells[8]).toBe("• CURRENT-ONLY-TASK");
  });
  it("bullets a single current-week task and keeps 미기재 bullet-free", () => {
    const single = withPrevious("지난과제", "지난성과", "only task");
    expect(meetingCells(single.v, single.record)[8]).toBe("• only task");
    const empty = withPrevious("지난과제", "지난성과", "");
    expect(meetingCells(empty.v, empty.record)[8]).toBe("미기재");
    expect(meetingCells(empty.v, empty.record)[8]).not.toContain("•");
  });
  it("keeps fourteen ordered columns with the paired cell feeding preview and clipboard", () => {
    const { v, record } = withPrevious("지난과제A\n지난과제B", "성과A\n성과B");
    const cells = meetingCells(v, record);
    expect(MEETING_COLUMNS).toEqual(["지역", "기수", "수강생", "담당T", "금주미팅", "금주계약", "트레이닝 후 특이사항", "지난주 PT과제(성과)", "이번주 PT과제", "목표생산", "목표 유입", "목표 컨택", "목표미팅", "목표계약"]);
    expect(cells).toHaveLength(14);
    expect(cells[7]).toBe("• 지난과제A → 성과A\n• 지난과제B → 성과B");
    const { html, plain } = meetingClipboard(cells);
    expect(html).toContain("• 지난과제A → 성과A<br>• 지난과제B → 성과B");
    const rows = parseTsv(plain);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(14);
    expect(rows[0]?.[7]).toBe("• 지난과제A → 성과A\n• 지난과제B → 성과B");
  });
  it("escapes HTML metacharacters in the paired cell without breaking the single TSV row", () => {
    const { v, record } = withPrevious("a<b\nc&d", "e\"f\ng'h");
    const cells = meetingCells(v, record);
    expect(cells[7]).toBe("• a<b → e\"f\n• c&d → g'h");
    const { html, plain } = meetingClipboard(cells);
    expect(html).not.toMatch(/<b(?=[\s>])/);
    expect(html).toContain("a&lt;b → e&quot;f<br>• c&amp;d → g&#39;h");
    const rows = parseTsv(plain);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(14);
    expect(rows[0]?.[7]).toBe("• a<b → e\"f\n• c&d → g'h");
  });
});

describe("pivoted goal clipboard for a Notion table paste", () => {
  it("lays the record out horizontally, one column per field", () => {
    const cells = goalPivotCells(view());
    expect(cells).toHaveLength(GOAL_PIVOT_COLUMNS.length);
    expect(GOAL_PIVOT_COLUMNS.slice(4)).toEqual(["PT과제", "생산", "유입", "컨택완료", "미팅완료", "계약"]);
    expect(cells.slice(0, 4)).toEqual(["Fixture Student", "test-cohort", "1주차", "2026-09-04 ~ 2026-09-10"]);
    expect(cells.slice(5, 10)).toEqual(["0", "미기재", "7", "미기재", "미기재"]);
  });
  it("bullets several PT과제 rows so none are lost in the single cell", () => {
    expect(goalPivotCells(view())[4]).toBe("• Task line 1\n• Task line 2");
  });
  it("bullets a single task and shows 미기재 bullet-free for none", () => {
    const one = { ...view() };
    one.current = { ...one.current, record: { ...one.current.record, task: "only task" } };
    expect(goalPivotCells(one)[4]).toBe("• only task");
    const none = { ...view() };
    none.current = { ...none.current, record: { ...none.current.record, task: "" } };
    expect(goalPivotCells(none)[4]).toBe("미기재");
  });
  it("emits a real header+value table so Notion pastes into cells, not one text block", () => {
    const { html } = goalClipboard(goalPivotCells(view()));
    expect(html).toMatch(/^<table><thead><tr><th>/);
    expect(html.match(/<tr>/g)).toHaveLength(2);
    expect(html.match(/<th>/g)).toHaveLength(GOAL_PIVOT_COLUMNS.length);
    expect(html.match(/<td>/g)).toHaveLength(GOAL_PIVOT_COLUMNS.length);
    expect(html).toContain("• Task line 1<br>• Task line 2");
  });
  it("keeps the plain fallback to header+record logical rows with quoted multiline tasks", () => {
    const { plain } = goalClipboard(goalPivotCells(view()));
    const rows = parseTsv(plain);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveLength(GOAL_PIVOT_COLUMNS.length);
    expect(rows[1]).toHaveLength(GOAL_PIVOT_COLUMNS.length);
    expect(rows[0]).toEqual(GOAL_PIVOT_COLUMNS);
    expect(rows[1]?.[4]).toBe("• Task line 1\n• Task line 2");
  });
  it("escapes markup instead of letting a task inject HTML into the paste", () => {
    const cells = goalPivotCells(view());
    cells[4] = '<img src=x onerror="alert(1)">';
    const { html } = goalClipboard(cells);
    expect(html).not.toMatch(/<img/);
    expect(html).toContain("&lt;img");
  });
  it("rejects a row that does not match the column count", () => {
    expect(() => goalClipboard(["only", "two"])).toThrow("열 개수");
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
