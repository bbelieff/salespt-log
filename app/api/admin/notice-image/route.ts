/**
 * POST /api/admin/notice-image — 공지 이미지 업로드 (announcement-popup §4, admin only).
 *
 * multipart/form-data { file } → Drive 공지 이미지 폴더(belie OAuth, ADR-0015)
 * + anyoneWithLink reader → { url } (MD 이미지 문법 삽입용). 최대 5MB, 이미지만.
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { uploadNoticeImageAdmin } from "@/service";
import { withApiTiming } from "@/lib/analytics/api-timing";

const MAX_BYTES = 5 * 1024 * 1024;

async function POST_handler(req: Request) {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file 필드 필수" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "이미지 파일만 업로드할 수 있어요" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "5MB 이하 이미지만 올릴 수 있어요" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const safeName = `notice_${Date.now()}_${file.name.replace(/[^\w.\-가-힣]/g, "_")}`;
    const { url, fileId } = await uploadNoticeImageAdmin(safeName, file.type, buf);
    return NextResponse.json({ ok: true, url, fileId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const POST = withApiTiming("api/admin/notice-image:POST", POST_handler);
