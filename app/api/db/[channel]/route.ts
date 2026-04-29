/**
 * POST /api/db/:channel → append (channel = 매입DB | 직접생산 | 현수막 | 콜·지·기·소)
 *
 * 응답: { ok: true, row: number }
 */
import { NextRequest, NextResponse } from "next/server";
import {
  DBBanner,
  DBLead,
  DBProduction,
  DBPurchase,
} from "@/types";
import {
  addBanner,
  addLead,
  addProduction,
  addPurchase,
} from "@/service";
import { getCurrentUserEmail } from "@/auth/stub";

interface RouteContext {
  params: Promise<{ channel: string }>;
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const { channel } = await ctx.params;
    const decoded = decodeURIComponent(channel);
    const body = await req.json();
    const email = getCurrentUserEmail();

    let result: { row: number };
    switch (decoded) {
      case "매입DB": {
        const parsed = DBPurchase.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.message },
            { status: 400 },
          );
        }
        result = await addPurchase(email, parsed.data);
        break;
      }
      case "직접생산": {
        const parsed = DBProduction.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.message },
            { status: 400 },
          );
        }
        result = await addProduction(email, parsed.data);
        break;
      }
      case "현수막": {
        const parsed = DBBanner.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.message },
            { status: 400 },
          );
        }
        result = await addBanner(email, parsed.data);
        break;
      }
      case "콜·지·기·소": {
        const parsed = DBLead.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.message },
            { status: 400 },
          );
        }
        result = await addLead(email, parsed.data);
        break;
      }
      default:
        return NextResponse.json(
          { error: `알 수 없는 채널: ${decoded}` },
          { status: 400 },
        );
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
