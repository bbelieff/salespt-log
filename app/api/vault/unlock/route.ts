/**
 * POST   /api/vault/unlock { pin } → PIN 이 맞으면 10분 열림
 * DELETE /api/vault/unlock         → 지금 잠그기
 */
import { NextRequest, NextResponse } from "next/server";
import { getWritableUserEmail } from "@/auth/identity";
import { unlockVault } from "@/service/company-vault";
import { VAULT_UNLOCK_MS, VaultPin } from "@/types/company-vault";
import { withApiTiming } from "@/lib/analytics/api-timing";
import { clearTicket, vaultErrorBody, writeTicket } from "../cookie";

async function POST_handler(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const pin = VaultPin.safeParse(String(body?.pin ?? ""));
    if (!pin.success) return NextResponse.json({ error: "PIN은 숫자 4~8자리예요." }, { status: 400 });
    const ticket = await unlockVault(await getWritableUserEmail(), pin.data);
    const until = new Date(Date.now() + VAULT_UNLOCK_MS).toISOString();
    return writeTicket(NextResponse.json({ unlocked: true, unlockedUntil: until }), ticket);
  } catch (e) {
    const { status, error } = vaultErrorBody(e);
    return NextResponse.json({ error }, { status });
  }
}

async function DELETE_handler() {
  return clearTicket(NextResponse.json({ unlocked: false }));
}

export const POST = withApiTiming("api/vault/unlock:POST", POST_handler);
export const DELETE = withApiTiming("api/vault/unlock:DELETE", DELETE_handler);
