/**
 * POST /api/company-info/export { 업체명, 업체정보 } — 업체정보 TXT 추출 (§3-3).
 * 사용자 O(업체관리/피드백업체) 폴더에 `업체정보_{업체명}.txt` 1본 덮어쓰기.
 *
 * 에러 정책 (fix/txt-export-admin-oauth, 2026-06-11 라이브 quota 사고):
 * Drive 권한 계열(토큰 미설정/만료·SA quota)은 영어 raw 를 노출하지 않고
 * 한글 안내로 치환 + 서버 로그에 원인 분류 기록. 그 외는 기존 메시지 유지.
 */
import { NextRequest, NextResponse } from "next/server";
import { CompanyInfo } from "@/types";
import { exportCompanyInfoTxt } from "@/service/company-info-txt";
import { getCurrentUserEmail } from "@/auth/stub";
import { classifyDriveAuthError } from "@/service/company-info-txt";

const ADMIN_ACTION_MSG = "파일 저장 권한 설정이 필요해요. 운영자에게 알려주세요.";

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
    const cause = classifyDriveAuthError(msg);
    if (cause) {
      // 원인은 서버 로그에만 (토큰 값 노출 금지) — 화면엔 한글 안내.
      console.error(`[txt-export] Drive 권한 실패 — 원인=${cause}: ${msg.slice(0, 200)}`);
      return NextResponse.json({ error: ADMIN_ACTION_MSG }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
