import type { Channel } from "@/types";

/** 채널 4색 배지 클래스 (고정 4종, tokens.md 채널 색). */
export const CHANNEL_BADGE: Record<Channel, string> = {
  매입DB: "badge badge-purchase",
  직접생산: "badge badge-direct",
  현수막: "badge badge-banner",
  "콜·지·기·소": "badge badge-referral",
};
