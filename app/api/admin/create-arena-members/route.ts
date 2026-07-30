/**
 * POST /api/admin/create-arena-members — admin only. (ADR-0011/0012)
 *
 * body: {
 *   season: number,        // 시즌 번호 (예: 1) → config 키 "A{season}". rawText 의 "A{n}" 가 우선.
 *   rawText: string,       // 명단 원문. parseArenaRoster 가 기수·이름·회장(*)·입금($)·부부(괄호) 파싱.
 *   config?: { templateSheetId, sheetsFolderId, companyParentFolderId }  // 최초 1회 설정 저장
 * }
 *
 * 참가자별(순차 + 429 retry): registry 라벨 = "A{season}-{gisu}기" (claim 키와 일치).
 *   - 멱등: registry (A{season}-{gisu}기, 표시이름) + 유효 spreadsheetId 있으면 SKIP.
 *   - 시트/폴더명 = "세일즈PT_A{n}_{기수}기 {표시이름}_대표님 경영일지/업체관리" (부부=두 이름).
 *   - 시트: findSheetByExactName 재사용, 없으면 copyTemplateSheet(template→sheetsFolder).
 *   - 폴더: findFolderByExactName 재사용, 없으면 createFolder.
 *   - addTraineePrepRow(label, 표시이름, sheetId, "", folderId, memo) — prep + O(업체폴더) + Q(회장/입금) stamp.
 *   - writeProfile(sheetId, label, 표시이름) — 복제본 B3/C3 를 아레나 라벨로 기록.
 *
 * 응답: { ok, season, created:[{name,cohort,sheetId}], skipped, failed, errors }. 부분 실패 허용.
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { revalidateAdminPages } from "@/auth/revalidate-admin";
import {
  arenaSeasonLabel,
  arenaCohortLabel,
  decideArenaAction,
} from "@/service/cohort-token";
import { parseArenaRoster, participantMemo } from "@/service/arena-parse";
import { listCohorts, upsertCohortConfig } from "@/repo/cohorts";
import { DEFAULT_COHORT_TEMPLATE_ID } from "@/config/cohort-template";
import {
  copyTemplateSheet,
  createFolder,
  findSheetByExactName,
  findFolderByExactName,
} from "@/repo/drive-client";
import { addTraineePrepRow } from "@/repo/users-prep";
import { findExistingSheetIdByCohortName } from "@/repo/users";
import { writeProfile } from "@/repo/sales";
import { withApiTiming } from "@/lib/analytics/api-timing";

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

async function POST_handler(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { season?: unknown; rawText?: unknown; config?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const seasonInput = Number(body.season);
  const seasonFallback =
    Number.isInteger(seasonInput) && seasonInput > 0 ? seasonInput : 0;
  const rawText = String(body.rawText ?? "");
  // 명단 원문 파싱 (회장*·입금$·부부괄호·기수헤더). 시즌은 rawText "A{n}" 우선, 없으면 body.season.
  const parsed = parseArenaRoster(rawText, seasonFallback);
  const season = parsed.season;
  if (!Number.isInteger(season) || season <= 0) {
    return NextResponse.json(
      { error: "invalid_season", hint: "시즌을 알 수 없습니다 (원문 'A1' 또는 시즌 번호 입력)." },
      { status: 400 },
    );
  }
  const members = parsed.participants;
  if (members.length === 0) {
    return NextResponse.json(
      {
        error: "no_members",
        hint: "참가자가 없습니다. 'N기' 헤더 + 이름(콤마/줄바꿈) 형식인지 확인하세요.",
        errors: parsed.errors,
      },
      { status: 400 },
    );
  }
  if (members.length > 100) {
    return NextResponse.json(
      { error: "too_many", hint: "한 번에 최대 100명." },
      { status: 400 },
    );
  }

  const seasonKey = arenaSeasonLabel(season); // 시즌 레벨 config 키 "A{season}"

  // 설정 조회. config 가 오면 먼저 영속화하고 effective config 를 직접 구성(캐시 함정 회피).
  let cfg = (await listCohorts()).find((c) => c.label === seasonKey) ?? null;
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
      await upsertCohortConfig(seasonKey, {
        type: "arena",
        templateSheetId,
        sheetsFolderId,
        companyParentFolderId,
      });
      cfg = {
        label: seasonKey,
        status: cfg?.status ?? "active",
        note: cfg?.note ?? "",
        type: "arena",
        templateSheetId,
        rootFolderId: cfg?.rootFolderId ?? "",
        rosterSheetId: cfg?.rosterSheetId ?? "",
        sheetsFolderId,
        companyParentFolderId,
        // 시즌 개강일(J)은 로스터 생성이 정하지 않는다 — admin 이 /admin/cohorts 에서 입력하는
        // **전광판 시즌 판정 정본**(AR-2b). 기존 값 보존(생성이 덮어쓰면 시즌이 흔들린다).
        seasonStartISO: cfg?.seasonStartISO ?? "",
      };
    }
  }

  // 템플릿은 cohorts E 가 비면 SSOT 마스터(0605) 로 폴백 → 폴더 2종만 필수.
  const templateId = cfg?.templateSheetId || DEFAULT_COHORT_TEMPLATE_ID;
  if (!cfg?.sheetsFolderId || !cfg?.companyParentFolderId) {
    return NextResponse.json(
      {
        error: "arena_not_configured",
        hint: `${seasonKey} 아레나의 시트폴더/업체부모폴더가 등록되지 않았습니다. 먼저 설정을 저장하세요.`,
      },
      { status: 400 },
    );
  }

  const created: { name: string; cohort: string; sheetId: string }[] = [];
  const skipped: { name: string }[] = [];
  const failed: { name: string; reason: string }[] = [];

  for (const { gisu, displayName, isPresident, isDeposit } of members) {
    const name = displayName; // 부부면 "류서하(심나영)" — 시트제목·레지스트리 이름 모두 표시이름.
    try {
      // 참가자별 registry 라벨 = "A{season}-{gisu}기" (claim 매칭 키).
      const cohortLabel = arenaCohortLabel(season, gisu);
      const existingSheetId = await findExistingSheetIdByCohortName(
        cohortLabel,
        name,
      );
      const plan = decideArenaAction({ season, gisu, name, existingSheetId });

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
          copyTemplateSheet(templateId, plan.sheetTitle, cfg!.sheetsFolderId),
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

      const memo = participantMemo({ isPresident, isDeposit });
      await addTraineePrepRow(plan.cohortLabel, name, sheetId, "", folderId, memo);
      // 복제본 B3/C3 를 아레나 라벨로 기록 (claim 시 writeProfile skip 되므로 여기서).
      await writeProfile(sheetId, plan.cohortLabel, name);
      created.push({ name, cohort: plan.cohortLabel, sheetId });
    } catch (e) {
      failed.push({
        name,
        reason: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  revalidateAdminPages();
  return NextResponse.json({
    ok: true,
    season,
    created,
    skipped,
    failed,
    errors: parsed.errors,
  });
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const POST = withApiTiming("api/admin/create-arena-members:POST", POST_handler);
