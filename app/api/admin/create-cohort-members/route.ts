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
import { writeProfile } from "@/repo/sales";
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
        // ★기수·이름(B3:C3) 도장 — 날짜(O1/O2)와 **같은 이유**로 필요하다(2026-09-04 사고).
        // 복제본의 B3 에는 템플릿(8기 사본)의 기수가, C3 에는 남의 이름 또는 빈값이 딸려온다.
        // B3 는 기수의 **정본**(sheet-structure.md §6 — registry B 열은 deprecated)이라,
        // 안 덮으면 11기 수강생이 앱에서 「8기」로 보인다. 클레임 경로는 이걸 못 고친다 —
        // 사전등록 행에 이미 spreadsheetId 가 있으면 writeProfile 을 건너뛰기 때문
        // (lib/service/auth.ts `if (!existingSheetId && ...)`). 그래서 **여기서** 찍어야 한다.
        // 실패해도 생성 자체는 성공 — 날짜와 같은 방침으로 흡수하고 로그만 남긴다.
        //
        // 아레나는 제외 — `create-arena-members` 가 **이미** 같은 처리를 한다
        // (그 라우트 224줄, 주석까지 동일: "claim 시 writeProfile skip 되므로 여기서").
        // 라벨 모양도 다르다(여기 parsed.label 은 "A2", 아레나가 쓰는 건 "A2-6기") —
        // 숫자 기수만 찍는다.
        try {
          if (parsed.type === "cohort") await writeProfile(newSheetId, parsed.label, name);
        } catch (e) {
          console.warn(
            `[create-cohort-members] B3:C3 기수·이름 기록 실패 — ${parsed.label} ${name}`,
            e instanceof Error ? e.message : e,
          );
        }
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

/**
 * 오류를 **응답에 실어 보낸다** (2026-08-31 신설).
 *
 * 왜: 11기 생성이 빈 본문 500 으로 죽었는데, 운영 서버 로그가 pm2 에 하나도 안 잡혀
 * (#914) 원인을 밖에서 볼 방법이 없었다. 멤버별 실패는 이미 `failed[]` 로 오지만,
 * **멤버 루프 이전**(기수 설정 조회·저장 등)에서 터지면 Next 기본 500 = 빈 본문이라
 * admin 화면에도 콘솔에도 아무 것도 안 남는다.
 *
 * 이 엔드포인트는 **admin 전용**이라 오류 메시지를 그대로 보여줘도 노출면이 늘지 않는다
 * (권한 검사는 핸들러 안에서 먼저 수행). 값(시트 ID·토큰)은 메시지에 안 싣는다 —
 * Error.message 만 전달하고 스택은 뺀다.
 */
async function POST_guarded(req: Request) {
  try {
    return await POST_handler(req);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[create-cohort-members] 실패:", message);
    return NextResponse.json(
      { ok: false, error: message, where: "setup" },
      { status: 500 },
    );
  }
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const POST = withApiTiming("api/admin/create-cohort-members:POST", POST_guarded);
