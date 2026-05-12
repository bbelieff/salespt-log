/**
 * GET /api/_debug/registry?email=foo@bar.com
 *
 * **임시 디버그 엔드포인트** — claim 무한루프 사고 추적용 (2026-05-13).
 * 캐시 우회로 registry 시트 raw row 를 직접 읽어 parseRow 결과까지 노출.
 * Admin email 만 접근 — production 노출 안전.
 *
 * 응답:
 *   200 {
 *     allRowsCount, regSheetId, regTab,
 *     match: { rowIdx, raw: [...], parsed: User|null, parseFailReason? }[]
 *   }
 *   401 / 403 / 500
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { registry } from "@/config";
import { readRange } from "@/repo/sheets-client";
import { User } from "@/types";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSessionEmail();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.toLowerCase() ?? "";

  try {
    const reg = registry();
    const rows = await readRange(reg.spreadsheetId, `${reg.tab}!A2:G`);

    const result: Array<Record<string, unknown>> = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const rowEmail = String(r[0] ?? "").trim().toLowerCase();
      const rowCohort = String(r[1] ?? "").trim();
      const rowName = String(r[2] ?? "").trim();
      // email 매칭 OR (7기/김송송) 매칭 모두 잡기
      const matchByEmail = email && rowEmail === email;
      const matchByCohortName = rowCohort.replace(/기\s*$/, "") === "7" && rowName === "김송송";
      if (!matchByEmail && !matchByCohortName) continue;

      const rawStatus = String(r[5] ?? "").trim();
      const status: User["status"] = rawStatus === "pending" ? "pending" : "active";
      const rawRole = String(r[4] ?? "").trim();
      const role: User["role"] =
        rawRole === "trainer" || rawRole === "admin" ? rawRole : "trainee";
      const parsed = User.safeParse({
        email: r[0],
        cohort: r[1] ?? "",
        name: r[2] ?? "",
        spreadsheetId: r[3] ?? "",
        role,
        status,
        assignedTrainer: r[6] ?? "",
      });

      result.push({
        sheetRow: i + 2,
        raw: {
          A_email: r[0] ?? null,
          B_cohort: r[1] ?? null,
          C_name: r[2] ?? null,
          D_spreadsheetId: r[3] ?? null,
          E_role: r[4] ?? null,
          F_status: r[5] ?? null,
          G_assignedTrainer: r[6] ?? null,
        },
        normalized: { role, status },
        parseSuccess: parsed.success,
        parseError: parsed.success ? null : (parsed.error as z.ZodError).issues,
        parsed: parsed.success ? parsed.data : null,
      });
    }

    return NextResponse.json({
      query: { email },
      regSheetId: reg.spreadsheetId,
      regTab: reg.tab,
      allRowsCount: rows.length,
      matches: result,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
