/**
 * admin 팝업관리 API (announcement-popup §4) — admin only.
 *
 * GET  /api/admin/announcements          → { notices, updates } raw 전체 (무캐시)
 * POST /api/admin/announcements          → 공지 저장(upsert) { notice }
 * PATCH /api/admin/announcements         → 업데이트 행 보정 { pr, ...patch }
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import {
  listAnnouncementsAdmin,
  patchUpdateAdmin,
  saveNoticeAdmin,
} from "@/service";
import { NoticeAudience, NoticeDisplayMode } from "@/types";

async function guard(): Promise<NextResponse | null> {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return null;
}

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  try {
    return NextResponse.json(await listAnnouncementsAdmin());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

const SaveBody = z.object({
  id: z.string().optional(),
  created: z.string().optional(),
  title: z.string().min(1, "제목 필수"),
  bodyMd: z.string().default(""),
  audience: NoticeAudience.default("all"),
  displayMode: NoticeDisplayMode.default("once"),
  start: z.string().default(""),
  end: z.string().default(""),
  pinned: z.boolean().default(false),
  active: z.boolean().default(true),
});

export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  try {
    const body = SaveBody.parse(await req.json());
    const notice = await saveNoticeAdmin(body);
    return NextResponse.json({ ok: true, notice });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

const PatchBody = z.object({
  pr: z.number().int().positive(),
  titleUser: z.string().optional(),
  bodyMd: z.string().optional(),
  milestone: z.string().optional(),
  visible: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  try {
    const { pr, ...patch } = PatchBody.parse(await req.json());
    const ok = await patchUpdateAdmin(pr, patch);
    if (!ok) return NextResponse.json({ error: "pr_not_found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
