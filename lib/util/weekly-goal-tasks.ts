/** PT과제 is one task per row. Rows live newline-delimited inside the existing `task`
 * and `prior_outcome` text columns, so no storage migration is needed and older
 * multi-line entries simply read back as the rows they already looked like.
 * A row therefore never contains a newline; the row inputs are single-line.
 */
export function splitTaskRows(text: string): string[] {
  return text.split(/\r\n|\r|\n/).map(s => s.trim()).filter(s => s !== "");
}

export function joinTaskRows(rows: readonly string[]): string {
  return splitTaskRows(rows.join("\n")).join("\n");
}

/** Always hand the editor at least one row to type into. */
export function editableTaskRows(text: string): string[] {
  const rows = splitTaskRows(text);
  return rows.length > 0 ? rows : [""];
}

/** Outcomes are addressed by position, so an unfilled row in the middle has to survive
 * the round trip. Only trailing blanks are dropped.
 */
export function splitAlignedRows(text: string): string[] {
  const rows = text.split(/\r\n|\r|\n/).map(s => s.trim());
  while (rows.length > 0 && rows[rows.length - 1] === "") rows.pop();
  return rows;
}

export function joinAlignedRows(rows: readonly string[]): string {
  return splitAlignedRows(rows.map(s => s.replace(/\r\n|\r|\n/g, " ")).join("\n")).join("\n");
}

/** Previous-week task rows paired positionally with their recorded outcome.
 * Row counts are independent, so pad to whichever side is longer.
 */
export function pairPriorOutcomes(previousTask: string, priorOutcome: string): { task: string; outcome: string }[] {
  const tasks = splitTaskRows(previousTask);
  const outcomes = splitAlignedRows(priorOutcome);
  const length = Math.max(tasks.length, outcomes.length, 1);
  return Array.from({ length }, (_, i) => ({ task: tasks[i] ?? "", outcome: outcomes[i] ?? "" }));
}
