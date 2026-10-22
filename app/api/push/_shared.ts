import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSessionEmail } from "@/auth/identity";
import { PushNotAvailable } from "@/service/push";

/** Push belongs to the signed-in person, never to an impersonated student view. */
export async function pushRoute(work: (email: string) => Promise<Response>): Promise<Response> {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    return await work(email);
  } catch (error) {
    if (error instanceof PushNotAvailable) return NextResponse.json({ error: "알림 시범 대상이 아니에요." }, { status: 403 });
    if (error instanceof ZodError) return NextResponse.json({ error: "설정 값을 확인해 주세요." }, { status: 400 });
    return NextResponse.json({ error: "알림 설정을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요." }, { status: 503 });
  }
}

export const noStore = { headers: { "Cache-Control": "no-store" } };
