/**
 * R2-3 정합 대조 (db-read-schedule): 일정·계약 탭 주간 뷰의 DB 경로가
 * 시트 경로와 같은 결과를 내는지 고정.
 *
 * • groupMeetingsBoth == findByDateRangeBoth 의미(예약일/미팅날짜 두 view, 범위 밖 제외)
 * • weekFunnelFromRows == readWeekFunnel 의미(주 블록 7일 × 4채널 E~H 합)
 * 비파일럿 시트 고정·게이트는 daily-source.test.ts 가 커버(불변).
 */
import { describe, expect, it } from "vitest";
import { Meeting } from "@/types";
import { groupMeetingsBoth } from "@/service/contact-week";
import {
  weekFunnelFromRows,
  type DailyMetricRow,
} from "@/service/daily-source";

function mtg(id: string, 예약일: string, 미팅날짜: string, 시각 = "10:00"): Meeting {
  return Meeting.parse({
    id,
    예약일,
    예약시각: 시각,
    미팅날짜,
    미팅시간: 시각,
    channel: "매입DB",
    업체명: `업체${id}`,
    장소: "서울",
    예약비고: "",
    상태: "예약",
    계약여부: false,
    수임비: 0,
    미팅사유: "",
    계약조건: "",
  });
}

const WEEK = ["2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10", "2026-07-11", "2026-07-12"];

describe("R2-3 groupMeetingsBoth — findByDateRangeBoth 동치", () => {
  const all = [
    mtg("a", "2026-07-06", "2026-07-08"), // 예약일·미팅날짜 둘 다 주 내(서로 다른 슬롯)
    mtg("b", "2026-07-08", "2026-07-20"), // 미팅날짜는 주 밖 — 예약 view 에만
    mtg("c", "2026-06-30", "2026-07-06"), // 예약일은 주 밖 — 미팅 view 에만
    mtg("d", "2026-06-01", "2026-06-02"), // 완전 범위 밖 — 양쪽 제외
  ];

  it("두 view 에 각 날짜 기준으로 정확히 배분, 범위 밖 제외", () => {
    const { byMeetingDate, byReservationDate } = groupMeetingsBoth(all, WEEK);
    expect(byReservationDate.get("2026-07-06")!.map((m) => m.id)).toEqual(["a"]);
    expect(byReservationDate.get("2026-07-08")!.map((m) => m.id)).toEqual(["b"]);
    expect(byMeetingDate.get("2026-07-08")!.map((m) => m.id)).toEqual(["a"]);
    expect(byMeetingDate.get("2026-07-06")!.map((m) => m.id)).toEqual(["c"]);
    const allIds = [...byMeetingDate.values(), ...byReservationDate.values()].flat().map((m) => m.id);
    expect(allIds).not.toContain("d");
  });

  it("7개 슬롯 전부 존재(빈 날도 빈 배열) — UI 슬롯 계약 유지", () => {
    const { byMeetingDate } = groupMeetingsBoth([], WEEK);
    expect([...byMeetingDate.keys()]).toEqual(WEEK);
    for (const d of WEEK) expect(byMeetingDate.get(d)).toEqual([]);
  });
});

describe("R2-3 weekFunnelFromRows — readWeekFunnel(E~H 주 블록 합) 동치", () => {
  const rows: DailyMetricRow[] = [
    { date: "2026-07-06", channel: "매입DB", production: 10, inflow: 5, contactProgress: 4, meetingReservation: 2 },
    { date: "2026-07-06", channel: "현수막", production: 3, inflow: 0, contactProgress: 1, meetingReservation: 0 },
    { date: "2026-07-12", channel: "콜·지·기·소", production: 1, inflow: 2, contactProgress: 2, meetingReservation: 1 },
    { date: "2026-07-13", channel: "매입DB", production: 99, inflow: 99, contactProgress: 99, meetingReservation: 99 }, // 다음 주 — 제외
  ];

  it("주 블록 7일 내 전 채널 합 — 블록 밖 제외 (시트 28행 합과 동일 의미)", () => {
    expect(weekFunnelFromRows(rows, WEEK)).toEqual({
      생산: 14, 유입: 7, 컨택진행: 7, 미팅예약: 3,
    });
  });

  it("빈 주 = 전부 0 (1~10주 밖 가드와 동일 결과)", () => {
    expect(weekFunnelFromRows(rows, ["2026-01-01"])).toEqual({
      생산: 0, 유입: 0, 컨택진행: 0, 미팅예약: 0,
    });
  });
});
