/**
 * PATCH  /api/todos/:id  → ToDo 부분 수정 (완료 토글·내용 변경)
 * DELETE /api/todos/:id  → ToDo 삭제 (행 clear)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { patchTodo, removeTodo } from "@/service";
import { getWritableUserEmail } from "@/auth/identity";
import { TodoType } from "@/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const PatchBody = z.object({
  institutionRef: z.string().optional(),
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
});

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 });
    const body = await req.json();
    const parsed = PatchBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const email = await getWritableUserEmail();
    await patchTodo(email, id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 });
    const email = await getWritableUserEmail();
    await removeTodo(email, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
