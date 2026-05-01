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
import { getCurrentUserEmail } from "@/auth/stub";

const RowParam = z.coerce.number().int().min(2);

interface RouteContext {
  params: Promise<{ channel: string; row: string }>;
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
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
    const body = await req.json();
    const email = getCurrentUserEmail();

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
        const parsed = DBLead.safeParse(body);
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
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
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
    const email = getCurrentUserEmail();

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
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
