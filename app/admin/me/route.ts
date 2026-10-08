/**
 * GET /admin/me → 관리자 본인 화면(예: 0기 GM 시트)으로 바로 연다.
 *
 * /dashboard 주소는 누구에게나 같고, 누구 화면을 보여줄지는 마지막으로 누른 [웹앱 →]이
 * 남긴 쿠키가 정한다. 그래서 /dashboard 즐겨찾기는 그때그때 다른 사람 화면이 열린다.
 * 이 주소는 대리 보기를 끄고 본인 화면으로 보내므로 즐겨찾기해 두면 항상 본인 화면이 열린다.
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail, setImpersonation } from "@/auth/identity";
import { revalidateAdminPages } from "@/auth/revalidate-admin";

export async function GET(req: Request) {
  const email = await getSessionEmail();
  if (!email) return NextResponse.redirect(new URL("/", req.url));
  if (!isAdminEmail(email)) return NextResponse.redirect(new URL("/dashboard", req.url));
  await setImpersonation(null);
  revalidateAdminPages();
  return NextResponse.redirect(new URL("/dashboard", req.url));
}
