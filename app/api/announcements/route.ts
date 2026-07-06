/**
 * GET /api/announcements → { notices, updates, latestPr } (announcement-popup §3)
 *
 * 로그인 후 레이아웃 mount 시 1회 호출 (PR② notice-popup-ui). 활성 공지(대상·기간
 * 필터 — arena 판정은 사용자 cohort) + visible 업데이트 최신 6개. 10분 서버 캐시.
 * 빈도 제어(once/daily/always)는 클라 localStorage — 서버는 후보만 내려준다.
 */
import { NextResponse } from "next/server";
import { getAnnouncementsFor } from "@/service";
import { getCurrentUserEmail } from "@/auth/stub";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function GET_handler() {
  try {
    const email = await getCurrentUserEmail();
    const view = await getAnnouncementsFor(email);
    return NextResponse.json(view);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const GET = withApiTiming("api/announcements:GET", GET_handler);
