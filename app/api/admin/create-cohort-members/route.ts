/**
 * POST /api/admin/create-cohort-members — admin only.
 *
 * body: {
 *   token: string,                       // 기수 토큰 ("8" | "8기" | "a1" | "A1회")
 *   mode: "create" | "link",
 *   members: [{ name: string, sheetUrl?: string }]   // link 모드는 sheetUrl 필수
 * }
 *
 * create: 루트 폴더 안 "{이름}" 폴더를 찾아 템플릿 시트를 복제(ADR-0011) → registry prep row
 *         (email 빈값 = self-claim 대기). 아레나면 roster 시트에 1행 append.
 * link  : 기존 시트 URL 을 받아 registry prep row 만 등록.
 *
 * 멱등: (label, name) 이 이미 시트와 함께 registry 에 있으면 skip (복제 안 함).
 * 부분 실패 허용 — 한 명 실패해도 나머지 진행. 순차 처리(rate limit 안전) + 429 retry.
 *
 * 응답: { ok, label, display, type, created:[{name,sheetId}], skipped:[{name}], failed:[{name,reason}] }
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { revalidateAdminPages } from "@/auth/revalidate-admin";
import { parseCohortToken, decideMemberAction } from "@/service/cohort-token";
import { listCohorts, appendArenaRoster, upsertCohortConfig } from "@/repo/cohorts";
import { DEFAULT_COHORT_TEMPLATE_ID } from "@/config/cohort-template";
import { copyTemplateSheet, findFolderContainingName } from "@/repo/drive-client";
import { addTraineePrepRow, extractSpreadsheetId } from "@/repo/users-prep";
import { findExistingSheetIdByCohortName } from "@/repo/users";
import { dbEnabled } from "@/repo/db/client";
import {
  enqueueCohortCreate,
  buildPendingCohortJob,
} from "@/repo/db/cohort-pending";
import { withApiTiming } from "@/lib/analytics/api-timing";

interface MemberInput {
  name?: unknown;
  sheetUrl?: unknown;
}

const sheetUrlOf = (id: string) =>
  `https://docs.google.com/spreadsheets/d/${id}/edit`;
const folderUrlOf = (id: string) =>
  `https://drive.google.com/drive/folders/${id}`;

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Drive files.copy 는 sheets-client 의 자동 retry 밖 → 여기서 429 재시도. */
async function copyWithRetry(
  templateId: string,
  title: string,
  folderId: string,
): Promise<string> {
  let attempt = 0;
  for (;;) {
    try {
      return await copyTemplateSheet(templateId, title, folderId);
    } catch (e) {
      const code = (e as { code?: number; status?: number }).code ??
        (e as { status?: number }).status;
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

  let body: {
    token?: unknown;
    mode?: unknown;
    members?: unknown;
    config?: unknown;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const parsed = parseCohortToken(String(body.token ?? ""));
  if (!parsed) {
    return NextResponse.json(
      { error: "invalid_token", hint: '기수 토큰 형식: "8" / "8기" / "a1" / "A1회"' },
      { status: 400 },
    );
  }
  const mode = body.mode === "link" ? "link" : "create";
  const members = Array.isArray(body.members) ? (body.members as MemberInput[]) : [];
  if (members.length === 0) {
    return NextResponse.json({ error: "no_members" }, { status: 400 });
  }
  if (members.length > 100) {
    return NextResponse.json(
      { error: "too_many", hint: "한 번에 최대 100명." },
      { status: 400 },
    );
  }

  // 기수 설정 조회. create 모드에서 body.config 가 오면 먼저 영속화(upsertCohortConfig)
  // 하고, 동일 요청 캐시 함정을 피하려 effective config 를 직접 구성한다.
  let cfg = (await listCohorts()).find((c) => c.label === parsed.label) ?? null;
  if (mode === "create" && body.config && typeof body.config === "object") {
    const c = body.config as {
      templateSheetId?: unknown;
      rootFolderId?: unknown;
      rosterSheetId?: unknown;
    };
    const templateSheetId = String(c.templateSheetId ?? "").trim();
    const rootFolderId = String(c.rootFolderId ?? "").trim();
    const rosterSheetId = String(c.rosterSheetId ?? "").trim();
    if (templateSheetId || rootFolderId || rosterSheetId) {
      await upsertCohortConfig(parsed.label, {
        type: parsed.type,
        templateSheetId,
        rootFolderId,
        rosterSheetId,
      });
      cfg = {
        label: parsed.label,
        status: cfg?.status ?? "active",
        note: cfg?.note ?? "",
        type: parsed.type,
        templateSheetId,
        rootFolderId,
        rosterSheetId,
        sheetsFolderId: cfg?.sheetsFolderId ?? "",
        companyParentFolderId: cfg?.companyParentFolderId ?? "",
      };
    }
  }

  // 템플릿은 cohorts E 가 비면 SSOT 마스터(0605) 로 폴백 → 루트 폴더만 필수.
  const templateId = cfg?.templateSheetId || DEFAULT_COHORT_TEMPLATE_ID;
  if (mode === "create") {
    if (!cfg?.rootFolderId) {
      return NextResponse.json(
        {
          error: "cohort_not_configured",
          hint: `${parsed.display} 의 루트 폴더가 등록되지 않았습니다. 먼저 기수 설정을 저장하세요.`,
        },
        { status: 400 },
      );
    }
    if (parsed.type === "arena" && !cfg?.rosterSheetId) {
      return NextResponse.json(
        {
          error: "arena_roster_missing",
          hint: `${parsed.display} 아레나 전체 명단 시트(rosterSheetId)가 등록되지 않았습니다.`,
        },
        { status: 400 },
      );
    }
  }

  const created: { name: string; sheetId: string }[] = [];
  const skipped: { name: string }[] = [];
  const failed: { name: string; reason: string }[] = [];
  // R3-5: Drive 복제 실패로 큐에 적재된(생성 비차단) 멤버 — 재시도 대기.
  const pending: { name: string; reason: string }[] = [];

  for (const m of members) {
    const name = String(m.name ?? "").trim();
    try {
      const existingSheetId = name
        ? await findExistingSheetIdByCohortName(parsed.label, name)
        : null;

      // create 모드: 루트 폴더 안에서 이름 포함 폴더 매칭 (0=없음 / 1=사용 / 2+=명확화).
      let folderId: string | null = null;
      let folderError: string | undefined;
      if (mode === "create" && name && !existingSheetId) {
        const fm = await findFolderContainingName(name, cfg!.rootFolderId);
        folderId = fm.id;
        if (!fm.id) {
          folderError =
            fm.matchedNames.length > 1
              ? `이름 폴더 여러 개 — 명확화 필요: ${fm.matchedNames.join(" / ")}`
              : "이름 폴더 없음 (루트 폴더 내 매칭 실패)";
        }
      }

      const sheetId =
        mode === "link" ? extractSpreadsheetId(String(m.sheetUrl ?? "")) : undefined;

      const plan = decideMemberAction({
        mode,
        parsed,
        name,
        existingSheetId,
        folderId,
        folderError,
        sheetId,
      });

      if (plan.action === "skip") {
        skipped.push({ name: plan.name });
        continue;
      }
      if (plan.action === "fail") {
        failed.push({ name: plan.name, reason: plan.reason });
        continue;
      }

      let newSheetId: string;
      let folderUrl = "";
      if (plan.action === "create") {
        try {
          newSheetId = await copyWithRetry(templateId, plan.title, plan.folderId);
        } catch (copyErr) {
          // Drive 복제 실패 → 생성을 막지 않고 DB pending 큐에 정본 적재(R3-5). 재시도가 완주.
          const reason =
            copyErr instanceof Error ? copyErr.message : "시트 복제 실패";
          if (dbEnabled()) {
            await enqueueCohortCreate(
              buildPendingCohortJob({
                cohortLabel: parsed.label,
                cohortType: parsed.type,
                name,
                mode: "create",
                folderId: plan.folderId,
                templateId,
                sheetTitle: plan.title,
                rosterSheetId: cfg?.rosterSheetId ?? "",
              }),
            );
            pending.push({ name, reason });
          } else {
            // DB 미설정이면 큐 불가 → 기존 동작(실패 목록)로 폴백.
            failed.push({ name, reason: `${reason} (DB 미설정 — 큐 불가)` });
          }
          continue;
        }
        folderUrl = folderUrlOf(plan.folderId);
      } else {
        newSheetId = plan.sheetId;
      }

      await addTraineePrepRow(parsed.label, name, newSheetId);

      if (parsed.type === "arena" && cfg?.rosterSheetId) {
        await appendArenaRoster(cfg.rosterSheetId, {
          name,
          sheetUrl: sheetUrlOf(newSheetId),
          folderUrl,
          regDateISO: todayISO(),
        });
      }

      created.push({ name, sheetId: newSheetId });
    } catch (e) {
      failed.push({
        name: name || String(m.name ?? ""),
        reason: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  revalidateAdminPages();
  return NextResponse.json({
    ok: true,
    label: parsed.label,
    display: parsed.display,
    type: parsed.type,
    created,
    skipped,
    failed,
    pending,
  });
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const POST = withApiTiming("api/admin/create-cohort-members:POST", POST_handler);
