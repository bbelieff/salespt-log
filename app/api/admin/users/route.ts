/**
 * GET /api/admin/users  → 등록된 모든 사용자 목록.
 *
 * Admin only. 비-Admin 은 403.
 * 응답: User[] (정렬: 최신 기수 → 이름 가나다)
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { listAllUsers } from "@/repo/users";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function GET_handler() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!isAdminEmail(sessionEmail)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const users = await listAllUsers();
  return NextResponse.json({ users });
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const GET = withApiTiming("api/admin/users:GET", GET_handler);
