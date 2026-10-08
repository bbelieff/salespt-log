/**
 * GET /api/vault?meetingId=… | ?계약일=…&업체명=…  → 보관함 상태(열려 있으면 항목까지)
 * PUT /api/vault { target, items }                    → 보관 항목 저장(열려 있을 때만)
 * (company-vault, belie 2026-10-08)
 */
import { NextRequest, NextResponse } from "next/server";
import { getWritableUserEmail } from "@/auth/identity";
import { loadVault, saveVault } from "@/service/company-vault";
import { VaultTarget } from "@/types/company-vault";
import { withApiTiming } from "@/lib/analytics/api-timing";
import { readTicket, vaultErrorBody, writeTicket } from "./cookie";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "no-store");
  return res;
}

async function GET_handler(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const target = VaultTarget.parse({
      meetingId: sp.get("meetingId") ?? undefined,
      계약일: sp.get("계약일") ?? undefined,
      업체명: sp.get("업체명") ?? undefined,
    });
    const { view, ticket } = await loadVault(await getWritableUserEmail(), target, readTicket(req));
    return noStore(writeTicket(NextResponse.json(view), ticket));
  } catch (e) {
    const { status, error } = vaultErrorBody(e);
    return noStore(NextResponse.json({ error }, { status }));
  }
}

async function PUT_handler(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const target = VaultTarget.safeParse(body?.target ?? {});
    if (!target.success) return NextResponse.json({ error: "어느 업체인지 알 수 없어요." }, { status: 400 });
    const { view, ticket } = await saveVault(await getWritableUserEmail(), target.data, body?.items, readTicket(req));
    return noStore(writeTicket(NextResponse.json(view), ticket));
  } catch (e) {
    const { status, error } = vaultErrorBody(e);
    return noStore(NextResponse.json({ error }, { status }));
  }
}

export const GET = withApiTiming("api/vault:GET", GET_handler);
export const PUT = withApiTiming("api/vault:PUT", PUT_handler);
