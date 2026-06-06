/**
 * POST /api/admin/create-arena-members — admin only. (ADR-0011/0012)
 *
 * body: {
 *   season: number,          // 시즌 번호 (예: 1) → label "A{season}"
 *   names: string[],         // 참가자 이름 다건
 *   config?: { templateSheetId, sheetsFolderId, companyParentFolderId }  // 최초 1회 설정 저장
 * }
 *
 * 참가자별(순차 + 429 retry):
 *   - 멱등: registry (A{season}, name) + 유효 spreadsheetId 있으면 SKIP.
 *   - 시트: findSheetByExactName(시트제목) 재사용, 없으면 copyTemplateSheet(template→sheetsFolder).
 *   - 폴더: findFolderByExactName(폴더명, companyParent) 재사용, 없으면 createFolder.
 *   - addTraineePrepRow("A{season}", name, sheetId, "", folderId) — prep(빈 email) + O열에 업체폴더 stamp.
 *
 * 응답: { ok, label, created:[{name,sheetId}], skipped:[{name}], failed:[{name,reason}] }. 부분 실패 허용.
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { revalidateAdminPages } from "@/auth/revalidate-admin";
import {
  arenaSeasonLabel,
  decideArenaAction,
} from "@/service/cohort-token";
import { listCohorts, upsertCohortConfig } from "@/repo/cohorts";
import {
  copyTemplateSheet,
  createFolder,
  findSheetByExactName,
  findFolderByExactName,
} from "@/repo/drive-client";
import { addTraineePrepRow } from "@/repo/users-prep";
import { findExistingSheetIdByCohortName } from "@/repo/users";

/** Drive 쓰기(copy/create)는 sheets-client 자동 retry 밖 → 여기서 429 재시도. */
async function driveWriteRetry<T>(fn: () => Promise<T>): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (e) {
      const code =
        (e as { code?: number }).code ?? (e as { status?: number }).status;
      if (code !== 429 || attempt >= 3) throw e;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      attempt++;
    }
  }
}

export async function POST(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { season?: unknown; names?: unknown; config?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const season = Number(body.season);
  if (!Number.isInteger(season) || season <= 0) {
    return NextResponse.json(
      { error: "invalid_season", hint: "시즌은 양의 정수여야 합니다 (예: 1)." },
      { status: 400 },
    );
  }
  const names = Array.isArray(body.names)
    ? (body.names as unknown[]).map((n) => String(n ?? "").trim()).filter(Boolean)
    : [];
  if (names.length === 0) {
    return NextResponse.json({ error: "no_members" }, { status: 400 });
  }
  if (names.length > 100) {
    return NextResponse.json(
      { error: "too_many", hint: "한 번에 최대 100명." },
      { status: 400 },
    );
  }

  const label = arenaSeasonLabel(season);

  // 설정 조회. config 가 오면 먼저 영속화하고 effective config 를 직접 구성(캐시 함정 회피).
  let cfg = (await listCohorts()).find((c) => c.label === label) ?? null;
  if (body.config && typeof body.config === "object") {
    const c = body.config as {
      templateSheetId?: unknown;
      sheetsFolderId?: unknown;
      companyParentFolderId?: unknown;
    };
    const templateSheetId = String(c.templateSheetId ?? "").trim();
    const sheetsFolderId = String(c.sheetsFolderId ?? "").trim();
    const companyParentFolderId = String(c.companyParentFolderId ?? "").trim();
    if (templateSheetId || sheetsFolderId || companyParentFolderId) {
      await upsertCohortConfig(label, {
        type: "arena",
        templateSheetId,
        sheetsFolderId,
        companyParentFolderId,
      });
      cfg = {
        label,
        status: cfg?.status ?? "active",
        note: cfg?.note ?? "",
        type: "arena",
        templateSheetId,
        rootFolderId: cfg?.rootFolderId ?? "",
        rosterSheetId: cfg?.rosterSheetId ?? "",
        sheetsFolderId,
        companyParentFolderId,
      };
    }
  }

  if (!cfg?.templateSheetId || !cfg?.sheetsFolderId || !cfg?.companyParentFolderId) {
    return NextResponse.json(
      {
        error: "arena_not_configured",
        hint: `${label} 아레나의 템플릿/시트폴더/업체부모폴더가 등록되지 않았습니다. 먼저 설정을 저장하세요.`,
      },
      { status: 400 },
    );
  }

  const created: { name: string; sheetId: string }[] = [];
  const skipped: { name: string }[] = [];
  const failed: { name: string; reason: string }[] = [];

  for (const name of names) {
    try {
      const existingSheetId = await findExistingSheetIdByCohortName(label, name);
      const plan = decideArenaAction({ season, name, existingSheetId });

      if (plan.action === "skip") {
        skipped.push({ name: plan.name });
        continue;
      }
      if (plan.action === "fail") {
        failed.push({ name: plan.name, reason: plan.reason });
        continue;
      }

      // 시트: 정확 일치 재사용 → 없으면 템플릿 복제.
      const reuseSheet = await findSheetByExactName(plan.sheetTitle);
      const sheetId =
        reuseSheet ??
        (await driveWriteRetry(() =>
          copyTemplateSheet(cfg!.templateSheetId, plan.sheetTitle, cfg!.sheetsFolderId),
        ));

      // 업체관리 폴더: 정확 일치 재사용 → 없으면 생성.
      const reuseFolder = await findFolderByExactName(
        plan.folderName,
        cfg!.companyParentFolderId,
      );
      const folderId =
        reuseFolder ??
        (await driveWriteRetry(() =>
          createFolder(plan.folderName, cfg!.companyParentFolderId),
        ));

      await addTraineePrepRow(label, name, sheetId, "", folderId);
      created.push({ name, sheetId });
    } catch (e) {
      failed.push({
        name,
        reason: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  revalidateAdminPages();
  return NextResponse.json({ ok: true, label, created, skipped, failed });
}
