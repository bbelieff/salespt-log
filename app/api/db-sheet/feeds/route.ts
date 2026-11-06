/**
 * DB 시트 자동 확인 연결(2026-11-06 belie) — GET 목록, POST 연결·지금 확인·끄기/켜기·해제·유입 반영 답.
 * 수강생 본인 화면에서만 바꿀 수 있다(관리자·트레이너가 남의 화면을 볼 때는 보기만).
 */
import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireStudentViewContext, getWritableUserEmail, StudentViewContextError } from "@/auth/identity";
import { DbSheetUnavailable, resolveDbSheetContext } from "@/service/db-sheet";
import { GoogleSheetImportError } from "@/service/db-sheet-import-url";
import { answerDbSheetFeedInflow, checkDbSheetFeedNow, connectDbSheetFeed, DbSheetFeedError, listDbSheetFeeds, removeDbSheetFeed, setDbSheetFeedEnabled } from "@/service/db-sheet-feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Id = z.string().uuid();
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("connect"), url: z.string().min(1).max(2000), supplier: z.string().max(100), channel: z.string().max(20), rules: z.record(z.string(), z.string()).default({}) }),
  z.object({ action: z.literal("check"), id: Id }),
  z.object({ action: z.literal("enable"), id: Id, enabled: z.boolean() }),
  z.object({ action: z.literal("remove"), id: Id }),
  z.object({ action: z.literal("answer"), ids: z.array(Id).min(1).max(1000) }),
]);

function failure(error: unknown) {
  if (error instanceof StudentViewContextError) return NextResponse.json({ error: error.code }, { status: error.status });
  if (error instanceof DbSheetFeedError || error instanceof GoogleSheetImportError) return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "요청 내용을 확인해 주세요." }, { status: 400 });
  if (error instanceof DbSheetUnavailable) return NextResponse.json({ error: error.message }, { status: 503 });
  return NextResponse.json({ error: "연결 정보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요." }, { status: 503 });
}

export async function GET() {
  try {
    const view = await requireStudentViewContext();
    const ctx = await resolveDbSheetContext(view.email, view.sheetOverride);
    const editable = (await getWritableUserEmail().catch(() => "")).toLowerCase() === view.email.toLowerCase();
    return NextResponse.json({ feeds: await listDbSheetFeeds(ctx), editable }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(req: NextRequest) {
  try {
    const view = await requireStudentViewContext();
    if ((await getWritableUserEmail()).toLowerCase() !== view.email.toLowerCase()) return NextResponse.json({ error: "조회 중인 계정의 연결은 바꿀 수 없어요." }, { status: 403 });
    if (req.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ error: "다른 사이트에서 보낸 요청은 허용하지 않습니다." }, { status: 403 });
    if (req.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") return NextResponse.json({ error: "JSON 형식으로 요청해 주세요." }, { status: 415 });
    const body = Body.parse(await req.json());
    const ctx = await resolveDbSheetContext(view.email, view.sheetOverride);
    switch (body.action) {
      case "connect": return NextResponse.json({ feed: await connectDbSheetFeed(ctx, body) });
      case "check": return NextResponse.json({ result: await checkDbSheetFeedNow(ctx, body.id), feeds: await listDbSheetFeeds(ctx) });
      case "enable": await setDbSheetFeedEnabled(ctx, body.id, body.enabled); break;
      case "remove": await removeDbSheetFeed(ctx, body.id); break;
      case "answer": await answerDbSheetFeedInflow(ctx, body.ids); break;
    }
    return NextResponse.json({ feeds: await listDbSheetFeeds(ctx) });
  } catch (error) { return failure(error); }
}
