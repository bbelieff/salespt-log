import { NextResponse } from "next/server";
import { getActiveUserEmail, getSessionEmail } from "@/auth/identity";

/** 비서 사서함 belongs to the signed-in person; looking at another student's screen shows none (§16). */
export async function inboxRoute(work: (email: string, viewingOther: boolean) => Promise<Response>): Promise<Response> {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const viewing = await getActiveUserEmail().catch(() => email);
    return await work(email, viewing.toLowerCase() !== email.toLowerCase());
  } catch {
    return NextResponse.json({ error: "사서함을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요." }, { status: 503 });
  }
}

export const noStore = { headers: { "Cache-Control": "no-store" } };
