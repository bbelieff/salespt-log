/**
 * GET  /api/todos?contractRef=...  → { todos: Todo[] } (한 계약의 ToDo 목록)
 * POST /api/todos                  → { ok, todo } 새 ToDo 생성 (id/생성시각 서버 생성)
 *
 * 슬롯 ToDo 섹션(payment)이 사용. 캘린더는 month API(loadMonthMeetings)에서 함께 조회.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createTodo, listTodos } from "@/service";
import { getCurrentUserEmail } from "@/auth/stub";
import { getWritableUserEmail } from "@/auth/identity";
import { TodoType } from "@/types";
import { withApiTiming } from "@/lib/analytics/api-timing";

const CreateBody = z.object({
  // 일반이벤트(type=일반)는 계약 비연동 → contractRef 빈값 허용 (consultation-log §1-3).
  contractRef: z.string().default(""),
  institutionRef: z.string().default(""),
  업체명: z.string().default(""),
  type: TodoType.default("기타"),
  분류: z.string().default(""), // 일반이벤트 카테고리 "기존"|"기타"
  제목: z.string().min(1, "제목 필수"),
  예정일자: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  예정시각: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "HH:MM")
    .or(z.literal(""))
    .default(""),
  장소: z.string().default(""),
  상세: z.string().default(""),
  showOnCalendar: z.boolean().default(true),
}).refine((d) => d.type === "일반" || d.contractRef.trim() !== "", {
  message: "contractRef 필수 (일반이벤트 제외)",
});

async function GET_handler(req: NextRequest) {
  try {
    const contractRef = req.nextUrl.searchParams.get("contractRef");
    if (!contractRef) {
      return NextResponse.json({ error: "contractRef 필수" }, { status: 400 });
    }
    const email = await getCurrentUserEmail();
    const todos = await listTodos(email, contractRef);
    return NextResponse.json({ todos });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (msg.startsWith("[no-sheet]")) {
      return NextResponse.json({ error: "no_sheet" }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function POST_handler(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const email = await getWritableUserEmail(); // 쓰기 진입점(ADR-0029: archived 차단 폐지)
    const todo = await createTodo(email, parsed.data);
    return NextResponse.json({ ok: true, todo });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (msg.startsWith("[no-sheet]")) {
      return NextResponse.json({ error: "no_sheet" }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const GET = withApiTiming("api/todos:GET", GET_handler);
export const POST = withApiTiming("api/todos:POST", POST_handler);
