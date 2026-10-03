import type { ChannelKey } from "./channels";
import { fmtWon, mdShort } from "./channels";

const ch = (r: Record<string, unknown>, k: string): string =>
  String(r[k] ?? "");
const num = (r: Record<string, unknown>, k: string): number =>
  Number(r[k] ?? 0) || 0;

export function makeSummary(channelKey: ChannelKey, row: Record<string, unknown>) {
  switch (channelKey) {
    case "purchase": {
      const cost = num(row, "개당단가") * num(row, "주문개수");
      return {
        title: ch(row, "업체명") || "(이름 없음)",
        sub: `${mdShort(ch(row, "구매일")) || "-"} · ${fmtWon(num(row, "개당단가"))}원 × ${num(row, "주문개수")}건`,
        right: `₩${fmtWon(cost)}`,
        rightBadge: null as string | null,
      };
    }
    case "direct": {
      const done = num(row, "생산개수") > 0;
      const start = mdShort(ch(row, "시작일"));
      const end = mdShort(ch(row, "종료일"));
      const period = start && end && start !== end ? `${start}~${end}` : start || "-";
      return {
        title: ch(row, "소재") || "(소재 없음)",
        sub: `${period} · ${done ? `${num(row, "생산개수")}건 완료` : "생산중"}`,
        right: `₩${fmtWon(num(row, "기간예산"))}`,
        rightBadge: done ? null : "생산중",
      };
    }
    case "banner": {
      const cost = num(row, "개당단가") * num(row, "주문개수");
      return {
        title: ch(row, "업체명") || "(이름 없음)",
        sub: `${mdShort(ch(row, "날짜")) || "-"} 발주 · ${mdShort(ch(row, "도착일")) || "-"} 도착 · ${num(row, "주문개수")}장`,
        right: `₩${fmtWon(cost)}`,
        rightBadge: null,
      };
    }
    case "referral":
      return {
        title: `${ch(row, "대표자명") || "-"} · ${ch(row, "업체명") || "-"}`,
        sub: `${mdShort(ch(row, "접수일")) || "-"} · ${ch(row, "소개처")}${ch(row, "조건") ? " · " + ch(row, "조건") : ""}`,
        right: null as string | null,
        rightBadge: ch(row, "구분") || null,
      };
  }
}

