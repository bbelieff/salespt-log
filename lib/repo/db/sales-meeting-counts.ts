/** Layer: repo — canonical meeting counts inside a caller-owned sales transaction. */
import type { PoolClient } from "pg";

export async function lockedMeetingCounts(client: Pick<PoolClient, "query">, spreadsheetId: string): Promise<Map<string, number>> {
  const { meetingFromDbPayload } = await import("./read-daily");
  const rows = await client.query("select payload from sheet_rows where spreadsheet_id=$1 and tab='meetings' and coalesce((payload->>'_cleared')::boolean,false)=false", [spreadsheetId]);
  const counts = new Map<string, number>();
  for (const row of rows.rows) {
    const meeting = meetingFromDbPayload(row.payload);
    if (!meeting) continue;
    const key = `${meeting.예약일}:${meeting.channel}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
