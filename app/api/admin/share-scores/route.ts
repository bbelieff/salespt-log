/**
 * admin 공유왕 점수 API (arena-scoreboard-v2) — admin only.
 *
 * POST /api/admin/share-scores  → { rows: {email, points}[] } 일괄 저장.
 *   name/cohort 는 서버에서 참가자로 보강(비참가자 제외), 저장 후 SCOREBOARD_TAG 무효화.
 *   조회는 서버 컴포넌트의 listShareScoreTargets 로 충분(GET 없음).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { saveShareScores } from "@/service/scoreboard";

const Body = z.object({
  rows: z
    .array(
      z.object({
        email: z.string().min(1),
        points: z.number().int(),
      }),
    )
    .max(500),
});

export async function POST(req: Request) {
  const email = await getSessionEmail();
  if (!email)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(email))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const { rows } = Body.parse(await req.json());
    await saveShareScores(rows);
    return NextResponse.json({ ok: true, saved: rows.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
