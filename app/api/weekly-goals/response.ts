import { NextResponse, type NextRequest } from "next/server";
import { WeeklyGoalError } from "@/service/weekly-goals";
export async function goalResponse(run: () => Promise<unknown>) {
  try {
    return NextResponse.json(await run(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    const status = e instanceof WeeklyGoalError ? e.status : e instanceof SyntaxError ? 400 : 503;
    const error = e instanceof WeeklyGoalError ? e.message : status === 400 ? "입력을 확인해 주세요." : "불러오거나 저장하지 못했어요. 입력을 보관하고 다시 시도해 주세요.";
    return NextResponse.json({ error }, { status, headers: { "Cache-Control": "private, no-store" } });
  }
}
export function goalWriteAllowed(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  // The VPS proxy terminates HTTPS; nextUrl can point at its internal HTTP listener.
  // Use deployment-owned configuration, never client-supplied forwarded hosts.
  let expectedOrigin = req.nextUrl.origin;
  if (process.env.AUTH_URL) {
    try {
      const configured = new URL(process.env.AUTH_URL);
      if (!["https:", "http:"].includes(configured.protocol)) return false;
      expectedOrigin = configured.origin;
    } catch { return false; }
  }
  return (!origin || origin === expectedOrigin) && req.headers.get("sec-fetch-site") !== "cross-site" &&
    (req.headers.get("content-type") ?? "").startsWith("application/json");
}
