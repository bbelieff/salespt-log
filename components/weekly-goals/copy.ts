import { GOAL_KEYS, GOAL_LABELS, type WeeklyGoalView, type WeeklyGoalPrivateRecord } from "@/types/weekly-goals";
import { pairPriorOutcomes, splitTaskRows } from "@/util/weekly-goal-tasks";
export const MEETING_COLUMNS = ["지역", "기수", "수강생", "담당T", "금주미팅", "금주계약", "트레이닝 후 특이사항", "지난주 PT과제(성과)", "이번주 PT과제", "목표생산", "목표 유입", "목표 컨택", "목표미팅", "목표계약"];
export function publicGoalCopy(v: WeeklyGoalView): string {
  return [`${v.student.name} · ${v.student.cohort} · ${v.current.week}주차 (${v.current.start} ~ ${v.current.end})`,
    ...GOAL_KEYS.map(k => `${GOAL_LABELS[k]}: ${v.current.record.goals[k] ?? "미기재"}`),
    `PT과제: ${v.current.record.task || "미기재"}`].join("\n");
}
/** Previous-week task rows paired positionally with their outcome (`과제 → 성과`).
 * Single pair stays unnumbered; several rows are numbered so none are lost in one cell.
 */
function formatPriorOutcomeCell(previousTask: string, priorOutcome: string): string {
  const pairs = pairPriorOutcomes(previousTask, priorOutcome);
  if (pairs.every(p => !p.task && !p.outcome)) return "미기재";
  const rows = pairs.map(({ task, outcome }) => `${task || "과제 미기재"} → ${outcome || "미기재"}`);
  return rows.length > 1 ? rows.map((row, i) => `${i + 1}. ${row}`).join("\n") : rows[0] ?? "미기재";
}
export function meetingCells(v: WeeklyGoalView, internal: WeeklyGoalPrivateRecord): string[] {
  return [v.student.region, v.student.cohort, v.student.name, v.student.trainers.join(", "),
    String(v.reporting.actuals.meetings), String(v.reporting.actuals.contracts), internal.specialNotes,
    formatPriorOutcomeCell(v.previous?.record.task ?? "", internal.priorOutcome), v.current.record.task, ...GOAL_KEYS.map(k => String(v.current.record.goals[k] ?? "미기재"))]
    .map(s => s || "미기재");
}
export const GOAL_PIVOT_COLUMNS = ["수강생", "기수", "주차", "기간", "PT과제", ...GOAL_KEYS.map(k => GOAL_LABELS[k])];

/** Horizontal (pivoted) one-row projection — the shape a Notion table row expects.
 * PT과제 rows stay one cell; they are numbered so several tasks survive the flattening.
 */
export function goalPivotCells(v: WeeklyGoalView): string[] {
  const tasks = splitTaskRows(v.current.record.task);
  const task = tasks.length > 1 ? tasks.map((t, i) => `${i + 1}. ${t}`).join("\n") : tasks[0] ?? "";
  return [v.student.name, v.student.cohort, `${v.current.week}주차`, `${v.current.start} ~ ${v.current.end}`,
    task || "미기재", ...GOAL_KEYS.map(k => v.current.record.goals[k] === null ? "미기재" : String(v.current.record.goals[k]))
    ];
}

/** Header + value rows as real table HTML, so a Notion paste lands in cells instead of one text block.
 * Plain text stays TSV with the same two rows for editors without HTML clipboard support.
 */
export function goalClipboard(cells: string[]) {
  if (cells.length !== GOAL_PIVOT_COLUMNS.length) throw new Error("복사할 열 개수를 확인해 주세요.");
  const row = (values: string[], tag: "th" | "td") => "<tr>" + values
    .map(s => `<${tag}>` + escapeGoalHTML(s).replace(/\r\n|\r|\n/g, "<br>") + `</${tag}>`).join("") + "</tr>";
  const html = "<table><thead>" + row(GOAL_PIVOT_COLUMNS, "th") + "</thead><tbody>" + row(cells, "td") + "</tbody></table>";
  const flat = (values: string[]) => values.map(s => s.replace(/\t/g, " ").replace(/\r\n|\r|\n/g, " / ")).join("\t");
  return { html, plain: flat(GOAL_PIVOT_COLUMNS) + "\n" + flat(cells) };
}

export function escapeGoalHTML(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
export function meetingClipboard(cells: string[]) {
  if (cells.length !== MEETING_COLUMNS.length) throw new Error("회의록 열 개수를 확인해 주세요.");
  const html = "<table><tbody><tr>" + cells.map(s => "<td>" + escapeGoalHTML(s).replace(/\r\n|\r|\n/g, "<br>") + "</td>").join("") + "</tr></tbody></table>";
  // One logical TSV row even when a cell contains tabs/newlines. HTML preserves multiline.
  const plain = cells.map(s => s.replace(/\t/g, " ").replace(/\r\n|\r|\n/g, " / ")).join("\t");
  return { html, plain };
}
export async function copyGoalText(plain: string, html?: string): Promise<boolean> {
  try {
    if (html && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([plain], { type: "text/plain" }) })]);
    } else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(plain); }
    else return false;
    return true;
  } catch { return false; }
}
