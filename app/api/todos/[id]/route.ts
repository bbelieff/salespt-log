/**
 * PATCH  /api/todos/:id  → ToDo 부분 수정 (완료 토글·내용 변경)
 * DELETE /api/todos/:id  → ToDo 삭제 (행 clear)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { patchTodo, removeTodo } from "@/service";
import {
  getWritableUserEmail,
  requireStudentViewContext,
  StudentViewContextError,
} from "@/auth/identity";
import { TodoType } from "@/types";
import { withApiTiming } from "@/lib/analytics/api-timing";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const PatchBody = z.object({
  institutionRef: z.string().optional(),
  /** 몇 번째 진행건(1~3)의 기록인가. 없으면 옛 방식(기관 이름으로만 연결). */
  slot: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable().optional(),

  업체명: z.string().optional(),
  type: TodoType.optional(),
  제목: z.string().min(1, "제목 필수").optional(),
  예정일자: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD").optional(),
  예정시각: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "HH:MM")
    .or(z.literal(""))
    .optional(),
  장소: z.string().optional(),
  상세: z.string().optional(),
  showOnCalendar: z.boolean().optional(),
  완료여부: z.boolean().optional(),
  /** 완료한 할 일의 결과 한 줄(R 컬럼). 빈 문자열 = 결과 지우기. */
  result: z.string().max(200).optional(),
});

async function PATCH_handler(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 });
    const body = await req.json();
    const parsed = PatchBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const context = await requireStudentViewContext();
    const writableEmail = await getWritableUserEmail();
    if (writableEmail.toLowerCase() !== context.email.toLowerCase()) {
      return NextResponse.json(
        { error: "invalid_student_target", code: "invalid_student_target" },
        { status: 403 },
      );
    }
    await patchTodo(
      context.email,
      id,
      parsed.data,
      context.sheetOverride,
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (e instanceof StudentViewContextError) {
      return NextResponse.json(
        { error: e.code, code: e.code },
        { status: e.status },
      );
    }
    if (msg.startsWith("[no-sheet]")) {
      return NextResponse.json({ error: "no_sheet" }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function DELETE_handler(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 });
    const context = await requireStudentViewContext();
    const writableEmail = await getWritableUserEmail();
    if (writableEmail.toLowerCase() !== context.email.toLowerCase()) {
      return NextResponse.json(
        { error: "invalid_student_target", code: "invalid_student_target" },
        { status: 403 },
      );
    }
    await removeTodo(context.email, id, context.sheetOverride);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (e instanceof StudentViewContextError) {
      return NextResponse.json(
        { error: e.code, code: e.code },
        { status: e.status },
      );
    }
    if (msg.startsWith("[no-sheet]")) {
      return NextResponse.json({ error: "no_sheet" }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const PATCH = withApiTiming("api/todos/[id]:PATCH", PATCH_handler);
export const DELETE = withApiTiming("api/todos/[id]:DELETE", DELETE_handler);
