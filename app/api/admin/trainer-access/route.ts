import { NextResponse } from "next/server";
import { listTrainerAccessSettings, saveTrainerAccessSettings, requireTrainerAccessAdmin, TrainerAccessError } from "@/service/trainer-access-settings";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store, private" };
function failure(error: unknown) {
  const safe = error instanceof TrainerAccessError ? error : new TrainerAccessError(503);
  return NextResponse.json({ error: safe.message }, { status: safe.status, headers });
}
/** GET: all active qualifications plus saved settings. Admin-only; no browser identity. */
export async function GET() {
  try { return NextResponse.json({ trainers: await listTrainerAccessSettings() }, { headers }); }
  catch (error) { return failure(error); }
}
/** PUT: one exact account and complete grade/grants/version. Other methods are Next 405. */
export async function PUT(req: Request) {
  try {
    await requireTrainerAccessAdmin();
    let validOrigin = false;
    try {
      const expected = new URL(process.env.AUTH_URL || process.env.NEXTAUTH_URL ||
        (process.env.NODE_ENV === "production" ? "https://salesptlog.online" : req.url));
      validOrigin = ["http:", "https:"].includes(expected.protocol) && req.headers.get("origin") === expected.origin;
    } catch { /* malformed server origin fails closed */ }
    if (!validOrigin || req.headers.get("sec-fetch-site") === "cross-site"
      || req.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") throw new TrainerAccessError(403);
    const text = await req.text();
    if (text.length > 4096) throw new TrainerAccessError(400);
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new TrainerAccessError(400); }
    await saveTrainerAccessSettings(body);
    return NextResponse.json({ saved: true }, { headers });
  } catch (error) { return failure(error); }
}
