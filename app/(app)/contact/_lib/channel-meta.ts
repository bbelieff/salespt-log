/** 컨택탭 채널 메타(설명·지표 도움말·색·배지) — ChannelTabsAndPanel 에서 분리(500줄 캡). 데이터 전용. */
import type { Channel } from "@/types";

export const CHANNEL_META: Record<
  Channel,
  {
    desc: string;
    helps: { production: string; inflow: string; contactProgress: string; meetingReservation: string };
    color: "blue" | "green" | "amber" | "purple";
    badgeClass: string;
  }
> = {
  매입DB: {
    desc: "DB생산업체로부터 구매",
    helps: {
      production: "구매한 DB 수",
      inflow: "오늘 전달받은 DB 수",
      contactProgress: "부재 제외, 실제 통화 수",
      meetingReservation: "미팅 예약 확정된 수",
    },
    color: "blue",
    badgeClass: "badge badge-purchase",
  },
  직접생산: {
    desc: "메타·구글·당근 등",
    helps: {
      production: "오늘 생산된 DB 수",
      inflow: "오늘 유입된 DB 수 (보통=생산)",
      contactProgress: "부재 제외, 실제 통화 수",
      meetingReservation: "미팅 예약 확정된 수",
    },
    color: "green",
    badgeClass: "badge badge-direct",
  },
  현수막: {
    desc: "오프라인 현수막 광고",
    helps: {
      production: "오늘 부착·노출된 현수막 수",
      inflow: "오늘 유입된 문의 수",
      contactProgress: "부재 제외, 실제 통화 수",
      meetingReservation: "미팅 예약 확정된 수",
    },
    color: "amber",
    badgeClass: "badge badge-banner",
  },
  "콜·지·기·소": {
    desc: "콜드콜·지인·기존고객·소개",
    helps: {
      production: "발굴한 컨택대상 수 (=유입)",
      inflow: "컨택대상 수 (생산과 동일)",
      contactProgress: "부재 제외, 실제 통화 수",
      meetingReservation: "미팅 예약 확정된 수",
    },
    color: "purple",
    badgeClass: "badge badge-referral",
  },
};
