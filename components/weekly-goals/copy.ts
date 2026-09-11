import { GOAL_KEYS, GOAL_LABELS, type WeeklyGoalView, type WeeklyGoalPrivateRecord } from "@/types/weekly-goals";
export const MEETING_COLUMNS = ["지역", "기수", "수강생", "담당T", "금주미팅", "금주계약", "트레이닝 후 특이사항", "지난주 PT과제(성과)", "이번주 PT과제", "목표생산", "목표 유입", "목표 컨택", "목표미팅", "목표계약"];
export function publicGoalCopy(v: WeeklyGoalView): string {
  return [`${v.student.name} · ${v.student.cohort} · ${v.current.week}주차 (${v.current.start} ~ ${v.current.end})`,
    ...GOAL_KEYS.map(k => `${GOAL_LABELS[k]}: ${v.current.record.goals[k] ?? "미기재"}`),
    `PT과제: ${v.current.record.task || "미기재"}`].join("\n");
}
export function meetingCells(v: WeeklyGoalView, internal: WeeklyGoalPrivateRecord): string[] {
  return [v.student.region, v.student.cohort, v.student.name, v.student.trainers.join(", "),
    String(v.current.actuals.meetings), String(v.current.actuals.contracts), internal.specialNotes,
    internal.priorOutcome, v.current.record.task, ...GOAL_KEYS.map(k => String(v.current.record.goals[k] ?? "미기재"))]
    .map(s => s || "미기재");
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
