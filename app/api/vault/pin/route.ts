/**
 * POST   /api/vault/pin { pin, currentPin? } → PIN 만들기·바꾸기(만들면 바로 열림)
 * DELETE /api/vault/pin                      → 관리자만: 지금 보는 수강생의 PIN 초기화(보관 내용 유지)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionEmail, getWritableUserEmail, isAdminEmail } from "@/auth/identity";
import { resetVaultPin, setVaultPin } from "@/service/company-vault";
import { VAULT_UNLOCK_MS, VaultPin } from "@/types/company-vault";
import { withApiTiming } from "@/lib/analytics/api-timing";
import { clearTicket, vaultErrorBody, writeTicket } from "../cookie";

async function POST_handler(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const pin = VaultPin.safeParse(String(body?.pin ?? ""));
    if (!pin.success) return NextResponse.json({ error: "PIN은 숫자 4~8자리예요." }, { status: 400 });
    const current = body?.currentPin ? String(body.currentPin) : undefined;
    const ticket = await setVaultPin(await getWritableUserEmail(), pin.data, current);
    const until = new Date(Date.now() + VAULT_UNLOCK_MS).toISOString();
    return writeTicket(NextResponse.json({ unlocked: true, unlockedUntil: until }), ticket);
  } catch (e) {
    const { status, error } = vaultErrorBody(e);
    return NextResponse.json({ error }, { status });
  }
}

async function DELETE_handler() {
  try {
    if (!isAdminEmail(await getSessionEmail())) {
      return NextResponse.json({ error: "관리자만 PIN을 초기화할 수 있어요." }, { status: 403 });
    }
    await resetVaultPin(await getWritableUserEmail());
    return clearTicket(NextResponse.json({ reset: true }));
  } catch (e) {
    const { status, error } = vaultErrorBody(e);
    return NextResponse.json({ error }, { status });
  }
}

export const POST = withApiTiming("api/vault/pin:POST", POST_handler);
export const DELETE = withApiTiming("api/vault/pin:DELETE", DELETE_handler);
