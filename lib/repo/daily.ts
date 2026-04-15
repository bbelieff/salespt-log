/**
 * Layer: repo — 일일 입력(앱 전용 탭) I/O.
 */
import { SHEET_RANGES } from "@/config";
import { DailyEntry } from "@/types";
import { readRange, appendRows } from "./sheets-client";

const HEADER = ["date", "production", "contact", "meeting", "contract", "note"] as const;

const headerRange = () => `${SHEET_RANGES.daily.tab}!${SHEET_RANGES.daily.header}`;
const dataRange = () => `${SHEET_RANGES.daily.tab}!${SHEET_RANGES.daily.range}`;

export async function fetchEntries(spreadsheetId: string): Promise<DailyEntry[]> {
  const rows = await readRange(spreadsheetId, dataRange());
  const out: DailyEntry[] = [];
  for (const r of rows) {
    const parsed = DailyEntry.safeParse({
      date: String(r[0] ?? ""),
      production: Number(r[1] ?? 0),
      contact: Number(r[2] ?? 0),
      meeting: Number(r[3] ?? 0),
      contract: Number(r[4] ?? 0),
      note: r[5] ? String(r[5]) : undefined,
    });
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export async function appendEntry(spreadsheetId: string, entry: DailyEntry): Promise<void> {
  const validated = DailyEntry.parse(entry);
  await appendRows(spreadsheetId, dataRange(), [
    [
      validated.date,
      validated.production,
      validated.contact,
      validated.meeting,
      validated.contract,
      validated.note ?? "",
    ],
  ]);
}

export async function ensureDailyHeader(spreadsheetId: string): Promise<void> {
  const existing = await readRange(spreadsheetId, headerRange());
  if (existing[0]?.[0] === "date") return;
  await appendRows(spreadsheetId, headerRange(), [HEADER.slice() as unknown as string[]]);
}
