/**
 * POST /api/company-info/export { 업체명, 업체정보 } — 업체정보 TXT **직접 다운로드**.
 *
 * 드라이브 미사용(토큰·공유드라이브·SA 용량 전부 무관) — 서버가 TXT 본문을 생성해
 * attachment 로 반환하면 브라우저가 바로 내려받는다.
 * (구: belie OAuth 로 Drive 1본 덮어쓰기 → 토큰 만료 시 전면 실패. 개인 gmail 은
 *  공유드라이브 불가·SA 용량 0 이라 Drive 저장이 구조적으로 취약 → 다운로드로 전환.)
 */
import { NextRequest, NextResponse } from "next/server";
import { CompanyInfo } from "@/types";
import {
  formatCompanyInfoTxt,
  companyInfoTxtFileName,
} from "@/service/company-info-txt";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const 업체명 = String(body?.업체명 ?? "").trim();
    const parsed = CompanyInfo.safeParse(body?.업체정보 ?? {});
    if (!업체명 || !parsed.success) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }
    // 추출시각 — KST 사람이 읽는 형식 (메모장 가독, §3-3).
    const now = new Date()
      .toLocaleString("sv-SE", { timeZone: "Asia/Seoul" })
      .slice(0, 16);
    const content = formatCompanyInfoTxt(업체명, parsed.data, now);
    // Windows 메모장 한글 깨짐 방지 BOM + UTF-8.
    const payload = "﻿" + content;
    const fileName = companyInfoTxtFileName(업체명);
    const enc = encodeURIComponent(fileName);
    return new NextResponse(payload, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        // RFC 5987 filename* — 한글 파일명 안전.
        "Content-Disposition": `attachment; filename="${enc}"; filename*=UTF-8''${enc}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
