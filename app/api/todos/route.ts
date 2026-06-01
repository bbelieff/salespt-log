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
import { TodoType } from "@/types";

const CreateBody = z.object({
  contractRef: z.string().min(1, "contractRef 필수"),
  institutionRef: z.string().default(""),
  업체명: z.string().default(""),
  type: TodoType.default("기타"),
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
});

export async function GET(req: NextRequest) {
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
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const email = await getCurrentUserEmail();
    const todo = await createTodo(email, parsed.data);
    return NextResponse.json({ ok: true, todo });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
