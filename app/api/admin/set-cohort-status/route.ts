/**
 * POST /api/admin/set-cohort-status  { label, status: "active"|"archived" }  — admin only.
 * 기수 보관/활성 토글. cohorts 탭 없으면 자동 생성.
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { revalidateAdminPages } from "@/auth/revalidate-admin";
import { setCohortStatus, ensureCohortsTab } from "@/repo/cohorts";
import { listAllUsers } from "@/repo/users";

export async function POST(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { label?: string; status?: string } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_input" }, { status: 400 }); }

  const label = String(body.label ?? "").trim();
  const status = body.status === "archived" ? "archived" : "active";
  if (!label) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  // 탭 없으면 자동 생성 + 현재 trainee 들의 cohort 시드.
  const all = await listAllUsers();
  const seed = Array.from(
    new Set(
      all
        .filter((u) => u.role === "trainee" && u.cohort.trim())
        .map((u) => u.cohort.replace(/기\s*$/, "").trim())
        .filter(Boolean),
    ),
  );
  await ensureCohortsTab(seed);

  await setCohortStatus(label, status);
  revalidateAdminPages();
  return NextResponse.json({ updated: { label, status } });
}
