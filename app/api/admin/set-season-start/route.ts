/**
 * POST /api/admin/set-season-start  { label, seasonStartISO }  — admin only.
 *
 * (아레나) 시즌 개강일 설정 — **전광판 시즌 판정 정본**(AR-2b, cohorts J열).
 * label = 시즌 레벨 라벨("A1"/"A2"). seasonStartISO = "YYYY-MM-DD" 또는 "" (미정으로 되돌림).
 *
 * 이 값이 비어 있으면 전광판은 시즌 번호를 표시하지 않고(헤더 "아레나") 집계 스코프도
 * 적용하지 않는다 — 즉 데이터를 감추지 않는다. 개막일을 넣는 순간 그 날짜부터 해당
 * 시즌으로 전환된다(참가자별 registry K 는 템플릿 O1 오염 때문에 쓰지 않는다).
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { revalidateAdminPages } from "@/auth/revalidate-admin";
import { setSeasonStart, ensureCohortsTab } from "@/repo/cohorts";
import { arenaSeasonLabelParts } from "@/service/cohort-token";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function POST_handler(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { label?: string; seasonStartISO?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const label = String(body.label ?? "").trim();
  const iso = String(body.seasonStartISO ?? "").trim();

  // 시즌 레벨 라벨만 허용 — 참가자 라벨("A2-1기")·일반 기수("8")에 개강일을 넣지 못하게.
  if (arenaSeasonLabelParts(label) === null) {
    return NextResponse.json(
      { error: "invalid_label", hint: '시즌 라벨은 "A1" 형식이어야 합니다.' },
      { status: 400 },
    );
  }
  if (iso !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return NextResponse.json(
      { error: "invalid_date", hint: "YYYY-MM-DD 형식으로 입력해 주세요." },
      { status: 400 },
    );
  }

  await ensureCohortsTab();
  await setSeasonStart(label, iso);
  revalidateAdminPages();
  return NextResponse.json({ updated: { label, seasonStartISO: iso } });
}

export const POST = withApiTiming("api/admin/set-season-start:POST", POST_handler);
