/**
 * Layer: repo (순수 — I/O 없음). 주차 그리드(01 영업관리 C:H, 28행) → ChannelDailyRow[].
 *
 * **날짜(C열) 병합 forward-fill** (readweek-merged-date-rows 2026-06-18):
 * 하루 첫 행(매입DB)에만 날짜가 있고 나머지 채널 행(직접생산/현수막/콜지기소)은
 * 셀 병합으로 빈칸이라, 빈 날짜 행을 스킵하면 그 채널 일별값이 통째 누락된다.
 * → 마지막으로 본 날짜(lastISO)를 상속한다. 채널(D열)은 행마다 존재하므로 그걸로 판별.
 * 한 셀 #VALUE! 등은 numCell 로 셀별 격리(sheet-value-error). 날짜변환은 주입(toISO).
 */
import { ChannelDailyRow } from "@/types";
import { numCell } from "./cell";

export function parseWeekRows(
  data: (string | number | boolean)[][],
  toISO: (v: string | number | boolean) => string | null,
): ChannelDailyRow[] {
  const rows: ChannelDailyRow[] = [];
  let lastISO = ""; // 직전 행에서 본 날짜 — 병합 빈칸 상속용
  for (let i = 0; i < 28; i++) {
    const r = data[i] ?? [];
    // C=0날짜, D=1채널, E=2생산, F=3유입, G=4컨택진행, H=5미팅예약
    const channelRaw = r[1];
    if (channelRaw === undefined || String(channelRaw).trim() === "") continue;
    const thisISO = r[0] === undefined ? null : toISO(r[0]);
    if (thisISO) lastISO = thisISO; // 날짜 있으면 갱신, 없으면 직전 날짜 상속
    if (!lastISO) continue; // 첫 날짜 전(상단 빈 행)
    const parsed = ChannelDailyRow.safeParse({
      date: lastISO,
      channel: String(channelRaw),
      production: numCell(r[2]),
      inflow: numCell(r[3]),
      contactProgress: numCell(r[4]),
      meetingReservation: numCell(r[5]),
    });
    if (parsed.success) rows.push(parsed.data);
  }
  return rows;
}
