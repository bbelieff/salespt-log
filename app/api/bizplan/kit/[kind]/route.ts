/** 사업계획서 작성도구 — 공식 빌더·양식 파일 받기(경영일지 이용자만). 꾸러미에 넣으려고 화면이 내려받는다. */
import { NextResponse, type NextRequest } from "next/server";
import { getSessionEmail } from "@/auth/identity";
import { BIZPLAN_KIT_KINDS, type BizplanKitKind } from "@/config/bizplan";
import { BizplanKitError, canUseBizplan, getBizplanKitFile } from "@/service/bizplan-kit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(_req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!(BIZPLAN_KIT_KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ error: "없는 파일이에요." }, { status: 404, headers });
  }
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401, headers });
  if (!(await canUseBizplan(email))) return NextResponse.json({ error: "경영일지 이용자만 쓸 수 있어요." }, { status: 403, headers });
  try {
    const f = await getBizplanKitFile(kind as BizplanKitKind);
    return new NextResponse(Buffer.from(f.bytes), {
      headers: {
        ...headers,
        "Content-Type": f.mimeType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`,
        "X-Kit-Name": encodeURIComponent(f.name),
      },
    });
  } catch (e) {
    if (e instanceof BizplanKitError) return NextResponse.json({ error: e.message }, { status: e.status, headers });
    return NextResponse.json({ error: "공식 파일을 불러오지 못했어요. 잠시 뒤 다시 해 주세요." }, { status: 503, headers });
  }
}
