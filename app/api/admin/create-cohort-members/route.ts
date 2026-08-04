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
 * 응답: { ok, label, display, type, created:[{name,sheetId}], skipped:[{name}], failed:[{name,reason}],
 *         pending:[{name,reason}], dates:[DateOutcome] }
 *   dates — create 로 복제한 시트별 O1/O2 기록 결과. 기록 안 됐으면 시트 실측값(O1/O2/B3/C3)을
 *           함께 담아 모달이 "템플릿 날짜가 그대로 남았다"를 즉시 보여준다.
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
import {
  writeCourseDates,
  readCourseDateCells,
  type CourseDateCells,
} from "@/repo/course-dates";
import {
  computeGraduationISO,
  isValidISODate,
  classifyCourseDateOutcome,
  needsSheetReadback,
  type CourseDateStatus,
} from "@/service/cohort-dates";
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

/**
 * 새 시트 날짜 기록 결과 1건 — 응답 `dates[]` 로 모달에 그대로 표시된다.
 * status !== "written" 이면 `sheet` 에 **시트에 실제로 남은 값**을 실측해 담는다.
 */
interface DateOutcome {
  name: string;
  sheetId: string;
  status: CourseDateStatus;
  /** 실제로 기록한 셀 (["O1","O2"]) */
  written: string[];
  /** 기록을 시도한 입력값 (미입력이면 "") */
  courseStartISO: string;
  graduationISO: string;
  /** 미기록 시 실측 readback — 화면에 "시트에 남아있는 값"으로 표시 */
  sheet?: CourseDateCells;
  reason?: string;
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
    courseStartISO?: unknown;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  // 수강시작일(선택) — 있으면 **생성(create) 시** 새 시트 O1/O2 를 세팅(R3-5). 형식 오류만 거부.
  // link 모드(기존 시트 연동)는 무시 — 남의 시트 날짜를 덮어쓰지 않는다.
  const courseStartISO = String(body.courseStartISO ?? "").trim();
  if (courseStartISO && !isValidISODate(courseStartISO)) {
    return NextResponse.json(
      { error: "invalid_input", hint: "수강시작일은 YYYY-MM-DD 형식이어야 합니다." },
      { status: 400 },
    );
  }
  // 종강일 = 수강시작 + 50(ADR-0005 7기+). 요청당 상수 → 루프 밖 1회 계산.
  const graduationISO = courseStartISO ? computeGraduationISO(courseStartISO) : "";

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
        seasonStartISO: "",
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
  // 새 시트 날짜 기록 결과 — "조용히 템플릿 날짜가 남는" 사고를 화면에서 보이게 하는 리포트.
  const dates: DateOutcome[] = [];

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
                courseStartISO, // 재시도가 O1/O2 세팅에 사용
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

      // 새 시트 O1/O2 날짜 세팅(R3-5) — **create 모드만**(복제된 새 시트). link 은 제외(남의 시트 비접촉).
      // 실패해도 생성은 성공이므로 흡수하되, 결과는 응답 dates[] 로 **화면에 올린다**(로그만 남기고
      // 조용히 넘어가다 개막 후에야 발견된 사고 2회 — 연습용2·10기 6명).
      if (plan.action === "create") {
        let written: string[] = [];
        let reason = "";
        if (courseStartISO) {
          try {
            // 방금 copyTemplateSheet 로 만든 **빈 복제본** — 여기 있는 O1/O2 는 사용자가 쓴 값이
            // 아니라 템플릿(0605=8기 사본)에서 딸려온 이전 기수 날짜다. §2.5 보존 가드를 그대로
            // 두면 입력 날짜가 버려지고 잔재가 남아 주차 앵커가 통째로 어긋난다(전 지표 0).
            // 아레나 경로(#658)와 동일 처방 — 재사용 시트·link 모드에는 절대 켜지 않는다.
            const r = await writeCourseDates(newSheetId, courseStartISO, graduationISO, {
              allowTemplateOverwrite: true,
            });
            written = r.written;
          } catch (dateErr) {
            reason =
              dateErr instanceof Error ? dateErr.message : "O1/O2 기록 실패";
          }
        }
        const status = classifyCourseDateOutcome({
          courseStartISO,
          written,
          error: reason || undefined,
        });
        // 미기록이면 시트에 **실제로 남은 값**을 읽어 리포트에 담는다(정상 경로는 추가 read 0회).
        let sheet: CourseDateCells | undefined;
        if (needsSheetReadback(status)) {
          console.warn(
            `[create-cohort] 수강시작일 미기록(${status}): ${name}${reason ? ` — ${reason}` : ""}`,
          );
          try {
            sheet = await readCourseDateCells(newSheetId);
          } catch {
            /* 리포트를 못 읽는 것이 생성 실패는 아니다 — status 만으로도 경고는 뜬다 */
          }
        }
        dates.push({
          name,
          sheetId: newSheetId,
          status,
          written,
          courseStartISO,
          graduationISO,
          sheet,
          reason: reason || undefined,
        });
      }

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
    dates,
  });
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const POST = withApiTiming("api/admin/create-cohort-members:POST", POST_handler);
