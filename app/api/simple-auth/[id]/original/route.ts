/** 원문 PDF 내려받기 — 파일 이름 「사업자명 서류이름.pdf」(belie 2026-11-08). 세금계산서는 엑셀(.xlsx, 2026-11-24). */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { originalOf } from "@/service/simple-auth";
import { withWho } from "../../response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  withWho(req, false, async (who) => {
    const id = z.string().uuid().parse((await params).id);
    const q = req.nextUrl.searchParams;
    const biz = z.string().max(20).parse(q.get("biz") ?? "");
    const doc = z.string().regex(/^(biz|vat|tax|localTax|ins|income|closed|taxinv|fs-\d{4})$/).parse(q.get("doc"));
    const { pdf, fileName, type } = await originalOf(who, id, biz, doc);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": type,
        "Content-Disposition": `attachment; filename="${doc === "taxinv" ? "tax-invoices.xlsx" : "document.pdf"}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "private, no-store",
      },
    });
  });
