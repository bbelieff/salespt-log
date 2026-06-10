/**
 * POST /api/company-info/export { 업체명, 업체정보 } — 업체정보 TXT 추출 (§3-3).
 * 사용자 O(업체관리/피드백업체) 폴더에 `업체정보_{업체명}.txt` 1본 덮어쓰기.
 */
import { NextRequest, NextResponse } from "next/server";
import { CompanyInfo } from "@/types";
import { exportCompanyInfoTxt } from "@/service/company-info-txt";
import { getCurrentUserEmail } from "@/auth/stub";

export async function POST(req: NextRequest) {
  try {
    const email = await getCurrentUserEmail();
    const body = await req.json();
    const 업체명 = String(body?.업체명 ?? "").trim();
    const parsed = CompanyInfo.safeParse(body?.업체정보 ?? {});
    if (!업체명 || !parsed.success) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }
    const result = await exportCompanyInfoTxt(email, {
      업체명,
      업체정보: parsed.data,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
