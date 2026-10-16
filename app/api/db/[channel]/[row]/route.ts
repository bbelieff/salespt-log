/**
 * PATCH  /api/db/:channel/:row → row 값 update
 * DELETE /api/db/:channel/:row → row 값 clear
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  DBBanner,
  DBLead,
  DBProduction,
  DBPurchase,
} from "@/types";
import {
  patchBanner,
  patchLead,
  patchProduction,
  patchPurchase,
  removeBanner,
  removeLead,
  removeProduction,
  removePurchase,
} from "@/service";
import {
  getWritableUserEmail,
  requireStudentViewContext,
  StudentViewContextError,
} from "@/auth/identity";
import { withApiTiming } from "@/lib/analytics/api-timing";

const RowParam = z.coerce.number().int().min(2);

interface RouteContext {
  params: Promise<{ channel: string; row: string }>;
}

async function PATCH_handler(req: NextRequest, ctx: RouteContext) {
  try {
    const { channel, row } = await ctx.params;
    const decoded = decodeURIComponent(channel);
    const rowParsed = RowParam.safeParse(row);
    if (!rowParsed.success) {
      return NextResponse.json(
        { error: "row 정수 필수 (≥2)" },
        { status: 400 },
      );
    }
    const context = await requireStudentViewContext();
    const writableEmail = await getWritableUserEmail();
    if (writableEmail.toLowerCase() !== context.email.toLowerCase()) {
      throw new StudentViewContextError("student_view_forbidden", 403);
    }
    const email = context.email;
    const body = await req.json();

    switch (decoded) {
      case "매입DB": {
        const parsed = DBPurchase.safeParse(body);
        if (!parsed.success)
          return NextResponse.json(
            { error: parsed.error.message },
            { status: 400 },
          );
        await patchPurchase(email, rowParsed.data, parsed.data);
        break;
      }
      case "직접생산": {
        const parsed = DBProduction.safeParse(body);
        if (!parsed.success)
          return NextResponse.json(
            { error: parsed.error.message },
            { status: 400 },
          );
        await patchProduction(email, rowParsed.data, parsed.data);
        break;
      }
      case "현수막": {
        const parsed = DBBanner.safeParse(body);
        if (!parsed.success)
          return NextResponse.json(
            { error: parsed.error.message },
            { status: 400 },
          );
        await patchBanner(email, rowParsed.data, parsed.data);
        break;
      }
      case "콜·지·기·소": {
        // 발굴id 는 서버가 기존값 보존/지연부여 — 클라이언트발 id 차단(lead-chain §4-3 R13).
        const parsed = DBLead.omit({ 발굴id: true }).safeParse(body);
        if (!parsed.success)
          return NextResponse.json(
            { error: parsed.error.message },
            { status: 400 },
          );
        await patchLead(email, rowParsed.data, parsed.data);
        break;
      }
      default:
        return NextResponse.json(
          { error: `알 수 없는 채널: ${decoded}` },
          { status: 400 },
        );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof StudentViewContextError) {
      return NextResponse.json(
        { error: e.code, code: e.code },
        { status: e.status },
      );
    }
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function DELETE_handler(_req: NextRequest, ctx: RouteContext) {
  try {
    const { channel, row } = await ctx.params;
    const decoded = decodeURIComponent(channel);
    const rowParsed = RowParam.safeParse(row);
    if (!rowParsed.success) {
      return NextResponse.json(
        { error: "row 정수 필수 (≥2)" },
        { status: 400 },
      );
    }
    const context = await requireStudentViewContext();
    const writableEmail = await getWritableUserEmail();
    if (writableEmail.toLowerCase() !== context.email.toLowerCase()) {
      throw new StudentViewContextError("student_view_forbidden", 403);
    }
    const email = context.email;

    switch (decoded) {
      case "매입DB":
        await removePurchase(email, rowParsed.data);
        break;
      case "직접생산":
        await removeProduction(email, rowParsed.data);
        break;
      case "현수막":
        await removeBanner(email, rowParsed.data);
        break;
      case "콜·지·기·소":
        await removeLead(email, rowParsed.data);
        break;
      default:
        return NextResponse.json(
          { error: `알 수 없는 채널: ${decoded}` },
          { status: 400 },
        );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof StudentViewContextError) {
      return NextResponse.json(
        { error: e.code, code: e.code },
        { status: e.status },
      );
    }
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const PATCH = withApiTiming("api/db/[channel]/[row]:PATCH", PATCH_handler);
export const DELETE = withApiTiming("api/db/[channel]/[row]:DELETE", DELETE_handler);
