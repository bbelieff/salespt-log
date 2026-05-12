/**
 * POST /api/admin/share-all-sheets — admin only.
 *
 * registry 에 등록된 모든 trainee row 의 spreadsheetId 에 Service Account 를
 * writer 로 자동 추가 (이미 공유돼 있으면 멱등 skip).
 *
 * 사용 시점: OAuth scope 확장 후 첫 마이그레이션. admin 이 한 번 클릭하면
 * 17명+ 시트 일괄 공유. 수동 시트 공유 작업 영구 제거.
 *
 * 권한: admin 이 owner/editor 인 시트만 공유 추가 가능. viewer 면 fail —
 * 응답에 shareFailed 로 보고.
 *
 * 응답: { ok, processed, shared, alreadyShared, shareFailed[{email, error}] }
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { getServerAccessToken } from "@/auth/google-token";
import { revalidateAdminPages } from "@/auth/revalidate-admin";
import { listAllUsers } from "@/repo/users";
import { shareSheetWithServiceAccount } from "@/repo/drive-client";

export async function POST() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const userToken = await getServerAccessToken();
  if (!userToken) {
    return NextResponse.json(
      {
        error: "no_oauth_token",
        hint:
          "OAuth scope 확장 후 admin 이 재로그인해야 합니다. " +
          "로그아웃 → Google 다시 로그인 → drive 권한 동의.",
      },
      { status: 400 },
    );
  }

  const all = await listAllUsers();
  // trainee 중 spreadsheetId 있는 row 만 — 중복(같은 시트 공유 다중 계정)은 한 번.
  const sheetIds = Array.from(
    new Set(
      all
        .filter((u) => u.role === "trainee" && u.spreadsheetId)
        .map((u) => u.spreadsheetId),
    ),
  );

  let shared = 0;
  let alreadyShared = 0;
  const shareFailed: { sheetId: string; error: string }[] = [];

  for (const sheetId of sheetIds) {
    const r = await shareSheetWithServiceAccount(sheetId, userToken);
    if (r.shared && r.alreadyShared) alreadyShared++;
    else if (r.shared) shared++;
    else shareFailed.push({ sheetId, error: r.error ?? "unknown" });
  }

  revalidateAdminPages();
  return NextResponse.json({
    ok: true,
    processed: sheetIds.length,
    shared,
    alreadyShared,
    shareFailed,
  });
}
