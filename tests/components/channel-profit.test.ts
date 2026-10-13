// 2026-10-12 #7 — 영업이익 상세 「채널별 남은 돈」 계산 규칙(순수): 버킷·합계·순서·문장·금액 표기.
import { describe, expect, it } from "vitest";
import type { DashboardContractChannel } from "@/types";
import { contractChannelKey } from "@/util/contract-link";
import { periodBounds, periodDbCost, periodRevenue, type DateRange } from "@/util/finance-period";
import {
  channelBucketOf,
  channelHeadlineText,
  channelProfitHeadline,
  formatManShort,
  formatWonFull,
  missingChannelKeys,
  periodChannelProfit,
  type ChannelProfitRow,
} from "@/components/dashboard/channel-profit";

const slot = (수납액 = 0, 수납일 = "") => ({ 수납액, 수납일 });
const row = (n: number, 업체명: string, 계약일: string, over: Partial<ChannelProfitRow> = {}): ChannelProfitRow => ({
  row: n, 업체명, 계약일, 수임비: 0, 수납1: slot(), 수납2: slot(), 수납3: slot(), 반환액: 0, 해지일: "", linkedMeetingId: "", ...over,
});

// 오늘 2026-10-15(목) — 이번 주 10/12~10/18, 이번 달 10월.
const TODAY = "2026-10-15";
const rows: ChannelProfitRow[] = [
  row(3, "가상상사A", "2026-10-13", { linkedMeetingId: "m-a", 수임비: 3_000_000, 수납1: slot(2_000_000, "2026-10-14") }),
  row(4, "가상상사B", "2026-09-25", { linkedMeetingId: "m-b", 수임비: 1_000_000 }),
  row(5, "가상상사C", "2026-09-30", { linkedMeetingId: "m-c", 수임비: 2_000_000, 수납1: slot(1_500_000, "2026-10-12") }),
  row(6, "가상상사D", "2026-09-10", { linkedMeetingId: "m-d", 수임비: 500_000 }),
  row(7, "가상상사E", "2026-10-05", { 수임비: 2_500_000, 수납1: slot(3_000_000, "2026-10-13") }),
  row(8, "가상상사F", "2026-10-10", { linkedMeetingId: "manual:req-1", 수임비: 1_200_000 }),
  row(9, "가상상사G", "2026-09-20", { linkedMeetingId: "m-g", 수임비: 800_000, 반환액: 800_000, 해지일: "2026-10-11" }),
  row(10, "가상상사H", "2026-08-16", { 구분: "이월", linkedMeetingId: "m-h", 수임비: 1_000_000, 수납1: slot(500_000, "2026-10-09") } as Partial<ChannelProfitRow>),
  row(11, "가상상사I", "2026-08-31", { 수임비: 400_000 }),
];
const channels: DashboardContractChannel[] = [
  { key: "3|ak:m-a", channel: "현수막" },
  { key: "4|ak:m-b", channel: "현수막" },
  { key: "5|ak:m-c", channel: "매입DB" },
  { key: "6|ak:m-d", channel: "직접생산" },
  { key: "7|2026-10-05|가상상사E", channel: "콜·지·기·소" },
  { key: "8|ak:manual:req-1", channel: null },
  { key: "9|ak:m-g", channel: "매입DB" },
  { key: "10|ak:m-h", channel: "현수막" },
  { key: "11|2026-08-31|가상상사I", channel: null },
];
const overview = {
  purchases: [{ 구매일: "2026-09-29", 주문금액: 3_000_000 }, { 구매일: "2026-08-26", 주문금액: 1_000_000 }],
  productions: [{ 시작일: "2026-09-15", 기간예산: 2_500_000 }],
  banners: [{ 날짜: "2026-09-24", 주문금액: 1_800_000 }, { 날짜: "2026-10-13", 주문금액: 400_000 }],
};
const RANGES: Array<[string, DateRange]> = [
  ["전체", null],
  ["이번 달", periodBounds("month", "", "", TODAY)],
  ["이번 주", periodBounds("week", "", "", TODAY)],
  ["직접 설정", periodBounds("custom", "2026-09-01", "2026-09-30", TODAY)],
];

describe("channelBucketOf — 계약 행 → 버킷", () => {
  const bucketOf = channelBucketOf(channels);
  it("연결 미팅 채널 / manual → 영업기록 없음 / AK 빈 값·못 찾음 → 채널 모름", () => {
    expect(rows.map(bucketOf)).toEqual(["현수막", "현수막", "매입DB", "직접생산", "콜·지·기·소", "manual", "매입DB", "현수막", "unknown"]);
  });
  it("AK 있는 계약은 업체명을 바꿔도 채널 유지(키가 행+AK)", () => {
    expect(bucketOf({ ...rows[2]!, 업체명: "가상상사C(주)" })).toBe("매입DB");
  });
  it("응답에 없는 키(방금 추가·AK 없는 계약 이름 변경)는 pending — 영업기록 없음으로 몰지 않는다", () => {
    expect(bucketOf({ ...rows[8]!, 업체명: "가상상사I(변경)" })).toBe("pending");
    expect(bucketOf(row(12, "가상상사J", TODAY, { linkedMeetingId: "manual:new" }))).toBe("pending");
  });
  it("missingChannelKeys — 정렬·중복 제거, 다 있으면 빈 배열", () => {
    expect(missingChannelKeys(rows, channels)).toEqual([]);
    const extra = [...rows, row(12, "가상상사J", TODAY, { linkedMeetingId: "m-j" }), row(12, "가상상사J", TODAY, { linkedMeetingId: "m-j" })];
    expect(missingChannelKeys(extra, channels)).toEqual([contractChannelKey(extra[9]!)]);
  });
});

describe("periodChannelProfit — 합계 = 위 세 칸(원 단위)", () => {
  const bucketOf = channelBucketOf(channels);
  for (const [name, range] of RANGES) {
    it(`${name}: Σ버킷 매출 = periodRevenue, Σ채널 비용 = periodDbCost, 각 줄 남은 돈 = 매출 − 비용`, () => {
      const t = periodChannelProfit(rows, bucketOf, overview, range);
      const all = [...t.channels, t.manual, t.unknown, t.pending];
      expect(all.reduce((s, b) => s + b.revenue, 0)).toBe(periodRevenue(rows, range).revenue);
      expect(all.reduce((s, b) => s + b.contracts, 0)).toBe(periodRevenue(rows, range).contracts);
      expect(t.channels.reduce((s, b) => s + b.cost, 0)).toBe(periodDbCost(overview, range));
      for (const b of all) expect(b.left).toBe(b.revenue - b.cost);
      // 영업이익 = Σ채널 남은 돈 + 보조 줄 매출 − 추가 비용(여기선 0)
      const profit = periodRevenue(rows, range).revenue - periodDbCost(overview, range);
      expect(all.reduce((s, b) => s + b.left, 0)).toBe(profit);
    });
  }
  it("채널 4줄은 늘 CHANNEL_ORDER 고정, 콜·지·기·소·보조 줄 비용은 0", () => {
    const t = periodChannelProfit(rows, bucketOf, overview, null);
    expect(t.channels.map((c) => c.key)).toEqual(["매입DB", "직접생산", "현수막", "콜·지·기·소"]);
    expect(t.channels[3]!.cost).toBe(0);
    expect([t.manual.cost, t.unknown.cost, t.pending.cost]).toEqual([0, 0, 0]);
  });
  it("「전체」 값 — 해지 반환은 매입DB에서, 이월 계약은 현수막에 그대로", () => {
    const t = periodChannelProfit(rows, bucketOf, overview, null);
    const by = Object.fromEntries(t.channels.map((c) => [c.key, c]));
    expect(by["매입DB"]).toMatchObject({ revenue: 3_500_000, cost: 4_000_000, left: -500_000, contracts: 2 });
    expect(by["현수막"]).toMatchObject({ revenue: 7_500_000, cost: 2_200_000, left: 5_300_000, contracts: 3 });
    expect(t.manual).toMatchObject({ revenue: 1_200_000, contracts: 1 });
    expect(t.unknown).toMatchObject({ revenue: 400_000, contracts: 1 });
  });
  it("이번 주 — 해지일이 이번 주가 아니면 반환은 빠지지 않는다", () => {
    const t = periodChannelProfit(rows, bucketOf, overview, periodBounds("week", "", "", TODAY));
    expect(t.channels[0]).toMatchObject({ key: "매입DB", revenue: 1_500_000, contracts: 0 });
  });
});

describe("channelProfitHeadline — 표 위 한 줄", () => {
  const bucketOf = channelBucketOf(channels);
  const t = periodChannelProfit(rows, bucketOf, overview, null);
  const totals = { revenue: periodRevenue(rows, null).revenue, dbCost: periodDbCost(overview, null), additional: 600_000 };
  it("돈 쓴 채널 중 매출÷비용이 가장 큰 흑자 채널", () => {
    const h = channelProfitHeadline(t, totals);
    expect(h).toMatchObject({ kind: "best", channel: "현수막" });
    expect(channelHeadlineText(h)).toBe("현수막에 쓴 돈의 3.4배를 벌었어요");
  });
  it("돈 쓴 채널이 모두 적자", () => {
    const loss = periodChannelProfit(rows, bucketOf, { ...overview, banners: [{ 날짜: "2026-09-24", 주문금액: 9_000_000 }] }, null);
    const h = channelProfitHeadline(loss, totals);
    expect(h.kind).toBe("no-profit");
    expect(channelHeadlineText(h)).toBe("아직 쓴 돈보다 더 번 채널이 없어요");
  });
  it("돈 쓴 채널이 없으면(콜·지·기·소만 매출)", () => {
    const h = channelProfitHeadline(periodChannelProfit(rows, bucketOf, {}, null), { ...totals, dbCost: 0 });
    expect(channelHeadlineText(h)).toBe("이 기간엔 DB에 쓴 돈이 없어요");
  });
  it("빈 기간은 매출·DB 비용·추가 비용이 모두 0 일 때만 — 추가 비용을 못 읽었으면(null) 빈 기간이 아니다", () => {
    const empty = periodChannelProfit([], bucketOf, {}, null);
    expect(channelHeadlineText(channelProfitHeadline(empty, { revenue: 0, dbCost: 0, additional: 0 }))).toBe("이 기간에는 매출·비용 기록이 없어요");
    expect(channelProfitHeadline(empty, { revenue: 0, dbCost: 0, additional: null }).kind).toBe("no-spend");
    expect(channelProfitHeadline(empty, { revenue: 0, dbCost: 0, additional: 50_000 }).kind).toBe("no-spend");
  });
  it("비율이 같으면 남은 돈이 큰 쪽, 그것도 같으면 채널 순서", () => {
    const tie = {
      ...t,
      channels: [
        { key: "매입DB" as const, contracts: 1, revenue: 200, cost: 100, left: 100 },
        { key: "직접생산" as const, contracts: 1, revenue: 400, cost: 200, left: 200 },
        { key: "현수막" as const, contracts: 1, revenue: 400, cost: 200, left: 200 },
        { key: "콜·지·기·소" as const, contracts: 1, revenue: 900, cost: 0, left: 900 },
      ],
    };
    expect(channelProfitHeadline(tie, totals)).toMatchObject({ kind: "best", channel: "직접생산", ratio: 2 });
  });
});

describe("formatManShort / formatWonFull — 짧은 금액", () => {
  it("만원 반올림 후 부호 — −0만 없음", () => {
    expect(formatManShort(-3_000)).toBe("0만");
    expect(formatManShort(-5_000)).toBe("−1만");
    expect(formatManShort(0)).toBe("0만");
    expect(formatManShort(5_300_000)).toBe("530만");
    expect(formatManShort(-95_000_000)).toBe("−9,500만");
  });
  it("1억 이상은 0.1억 단위", () => {
    expect(formatManShort(99_990_000)).toBe("9,999만");
    expect(formatManShort(100_000_000)).toBe("1억");
    expect(formatManShort(186_000_000)).toBe("1.9억");
    expect(formatManShort(-120_000_000)).toBe("−1.2억");
    expect(formatManShort(1_234_567_890)).toBe("12.3억");
  });
  it("전체 금액(제목·화면 읽기)", () => {
    expect(formatWonFull(9_300_000)).toBe("₩9,300,000");
    expect(formatWonFull(-500_000)).toBe("−₩500,000");
  });
});
