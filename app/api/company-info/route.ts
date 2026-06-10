/**
 * GET  /api/company-info?계약일=YYYY-MM-DD&업체명=… → 06 에서 업체정보 read
 * POST /api/company-info { 계약일, 업체명, 업체정보 } → 04 원본 + 06 동기화 저장
 * (payment 계약 카드용 — consultation-log §3-1)
 */
import { NextRequest, NextResponse } from "next/server";
import { CompanyInfo } from "@/types";
import {
  loadCompanyInfoByContract,
  saveCompanyInfoByContract,
} from "@/service/contract-payment";
import { getCurrentUserEmail } from "@/auth/stub";

export async function GET(req: NextRequest) {
  try {
    const email = await getCurrentUserEmail();
    const sp = req.nextUrl.searchParams;
    const 계약일 = String(sp.get("계약일") ?? "").trim();
    const 업체명 = String(sp.get("업체명") ?? "").trim();
    if (!계약일 || !업체명) {
      return NextResponse.json({ error: "계약일·업체명 필수" }, { status: 400 });
    }
    const 업체정보 = await loadCompanyInfoByContract(email, { 계약일, 업체명 });
    return NextResponse.json({ 업체정보 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const email = await getCurrentUserEmail();
    const body = await req.json();
    const 계약일 = String(body?.계약일 ?? "").trim();
    const 업체명 = String(body?.업체명 ?? "").trim();
    const parsed = CompanyInfo.safeParse(body?.업체정보 ?? {});
    if (!계약일 || !업체명 || !parsed.success) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }
    const result = await saveCompanyInfoByContract(email, {
      계약일,
      업체명,
      업체정보: parsed.data,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
