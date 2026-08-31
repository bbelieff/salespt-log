/**
 * POST /api/drive-link — 업체 폴더 연결 (registry O열).
 *
 * 일반 기수: 참가자 루트 하위 `01 피드백업체` 폴더 (기존 로직 그대로).
 * 아레나(cohort A 접두, fix/drive-connect-arena 2026-06-12): 16C(cohorts!I) 하위
 *   `세일즈PT_A{n}_{m}기 {이름}_대표님 업체관리` 폴더 **자체**가 대상(하위 폴더 없음).
 *   auto = ①registry O 저장값 재확인 ②16C 하위 이름 매칭(부부 이름 포함).
 *   manual = 업체관리 폴더(또는 16C) URL — 본인 토큰(A{n}_{m}기·이름) 검증으로
 *   남의 폴더 연결 방지.
 *   auto ③ / manual 보조 (2026-09-01): 업체관리 폴더가 아예 없는 참가자는
 *   **수강생 시절 `01 피드백업체`** 로 연결한다 — findLegacyFeedbackFolder 참조.
 *
 * body: { mode: "auto" } | { parentFolderUrl: string }
 * ADR-0007: Scope 1은 Drive 읽기(files.list / files.get)만.
 */
import { NextResponse } from "next/server";
import { findUserByEmail, updateDriveLink } from "@/repo/users";
import {
  findFolderByNameInDrive,
  findFolderByNamePrefix,
  getDriveFileMeta,
} from "@/repo/drive-client";
import { listCohorts } from "@/repo/cohorts";
import { isArenaCohort, normalizeArenaCohort } from "@/repo/users-arena";
import { nameMatchCandidates } from "@/repo/name-match";
import { buildArenaCompanyFolderName } from "@/service/cohort-token";
import { getWritableUserEmail } from "@/auth/identity";
import type { User } from "@/types";
import { withApiTiming } from "@/lib/analytics/api-timing";

const FEEDBACK_PREFIX = "01";

/** 폴더 미공유/권한없음 공통 안내. */
function folderNotSharedResponse() {
  const saEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "";
  return NextResponse.json({
    ok: false,
    status: "error",
    errorKind: "folder_not_shared",
    saEmail,
    error:
      `이 시트가 들어있는 '폴더'를 서비스계정(${saEmail})에 '뷰어 또는 편집자'로 공유해 주세요. ` +
      `시트 파일만 공유하면 폴더 구조를 볼 수 없어요. ` +
      `폴더가 공유 드라이브에 있으면 그 드라이브에 위 계정을 멤버로 추가해도 자동으로 찾아요.`,
  });
}

function extractFolderId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1]!;
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  return null;
}

// ── 아레나 헬퍼 ──────────────────────────────────────────────────

/** "A1-4" → { season:1, gisu:4 }. 비정상이면 null. */
function parseArenaCohort(cohort: string): { season: number; gisu: number } | null {
  const m = normalizeArenaCohort(cohort).match(/^A(\d+)-(\d+)$/);
  return m ? { season: Number(m[1]), gisu: Number(m[2]) } : null;
}

/** 폴더명이 본인 업체관리 폴더인가 — `A{n}_{m}기` + 이름(부부 포함) + "업체관리" 토큰. */
function isOwnArenaCompanyFolder(folderName: string, user: User): boolean {
  const p = parseArenaCohort(user.cohort);
  if (!p) return false;
  if (!folderName.includes(`A${p.season}_${p.gisu}기`)) return false;
  if (!folderName.includes("업체관리")) return false;
  return nameMatchCandidates(user.name).some((n) => n && folderName.includes(n));
}

/** 16C(시즌 companyParentFolderId) 하위에서 본인 업체관리 폴더 탐색. */
async function findArenaCompanyFolder(user: User): Promise<string | null> {
  const p = parseArenaCohort(user.cohort);
  if (!p) return null;
  const season = (await listCohorts()).find(
    (c) => c.label === `A${p.season}` && c.companyParentFolderId,
  );
  if (!season) return null;
  // 정확명 우선(부부 후보 포함) → 토큰 prefix fallback.
  for (const n of nameMatchCandidates(user.name)) {
    const exact = await findFolderByNamePrefix(
      buildArenaCompanyFolderName(p.season, p.gisu, n),
      season.companyParentFolderId,
    );
    if (exact) return exact;
  }
  return findFolderByNamePrefix(
    `세일즈PT_A${p.season}_${p.gisu}기 ${user.name.trim()}`,
    season.companyParentFolderId,
  );
}

/**
 * 수강생 시절 `01 피드백업체` 폴더 — **아레나 참가자 구제 경로** (2026-09-01).
 *
 * 왜 필요한가 (belie 신고 "8기 김현민 드라이브 연결 안 됨" 실측):
 * 아레나 편입 방식이 두 갈래인데 한쪽만 업체관리 폴더를 만든다.
 *   · 관리자 화면(`/api/admin/create-arena-members`) — `createFolder` 로 **만든다**
 *   · ops 배치(`scripts/ops/arena-season2-batch.mjs`) — 시트 복제·O1/O2·SA공유·registry
 *     까지만. `createFolder` 참조 **0건** → 폴더가 안 생긴다
 * 그 결과 2026-08-05 배치로 편입된 A2 7·8기 참가자는 16C 하위에 폴더가 없어
 * `arena_folder_missing` 만 본다(Drive 전수 확인: `세일즈PT_A2_…업체관리` 폴더 0개,
 * A1 참가자 40여 명은 전원 존재 — 그쪽은 관리자 화면 경로였다).
 *
 * 폴더를 뒤늦게 만들어 주는 것으로는 못 고친다 — 옮겨 담아야 할 업체 폴더의 **주인이
 * 수강생 본인**이라 운영자 계정이 이동시킬 수 없다(2026-09-01 실측: 김현민 님 업체
 * 2건 모두 `The caller does not have permission`). 그래서 **폴더를 옮기지 않고,
 * 원래 있던 자리를 그대로 가리킨다.**
 *
 * 안전: **본인 시트의 부모 폴더 한 단계만** 본다. 공유드라이브 전체 검색
 * (`findFolderByNameInDrive`)은 **쓰지 않는다** — 같은 이름 폴더가 참가자마다 있어
 * 남의 업체 폴더가 붙을 수 있다. 못 찾으면 조용히 null → 기존 안내가 그대로 뜬다.
 */
async function findLegacyFeedbackFolder(user: User): Promise<string | null> {
  const ssId = (user.spreadsheetId ?? "").trim();
  if (!ssId) return null;
  const meta = await getDriveFileMeta(ssId);
  if (!meta.ok || !meta.parentId) return null;
  return findFolderByNamePrefix(FEEDBACK_PREFIX, meta.parentId);
}

const ARENA_NOT_FOUND = {
  ok: false,
  status: "error",
  errorKind: "arena_folder_missing",
  error:
    "'업체관리' 폴더를 찾지 못했어요. 운영자에게 받은 업체관리 폴더 주소를 붙여넣거나, 운영자에게 알려주세요.",
};

async function POST_handler(req: Request) {
  try {
    const email = await getWritableUserEmail();
    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: "등록되지 않은 사용자" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const mode = String(body.mode ?? "manual");
    const arena = isArenaCohort(user.cohort);

    let feedbackFolderId: string | null = null;
    let parentPathLabel = "";

    if (arena) {
      // ── 아레나: 업체관리 폴더 자체 연결 ──────────────────────────
      if (mode === "auto") {
        // 1순위: registry O 저장값(생성 배치 stamp) — 이름 재검증 후 즉시 연결.
        const saved = (user.feedbackFolderId ?? "").trim();
        if (saved) {
          const meta = await getDriveFileMeta(saved);
          if (meta.ok && isOwnArenaCompanyFolder(meta.name, user)) {
            feedbackFolderId = saved;
            parentPathLabel = "registry";
          }
        }
        // 2순위: 16C 하위 이름 매칭 (생성 stamp 누락 케이스 — 손기학 실측).
        if (!feedbackFolderId) {
          feedbackFolderId = await findArenaCompanyFolder(user);
          parentPathLabel = "16C";
        }
        // 3순위: 수강생 시절 `01 피드백업체` — 업체관리 폴더를 못 받은 참가자 구제.
        // (findLegacyFeedbackFolder 독블록 참조. 폴더 이동이 불가능해 자리를 그대로 쓴다)
        if (!feedbackFolderId) {
          feedbackFolderId = await findLegacyFeedbackFolder(user);
          parentPathLabel = "01";
        }
        if (!feedbackFolderId) {
          await updateDriveLink(email, { feedbackFolderId: "", driveLinkStatus: "error" });
          return NextResponse.json(ARENA_NOT_FOUND);
        }
      } else {
        const folderId = extractFolderId(String(body.parentFolderUrl ?? ""));
        if (!folderId) {
          return NextResponse.json(
            { error: "유효한 Drive 폴더 주소 또는 ID를 입력해 주세요." },
            { status: 400 },
          );
        }
        parentPathLabel = String(body.parentFolderUrl ?? "");
        const meta = await getDriveFileMeta(folderId);
        if (!meta.ok) return folderNotSharedResponse();
        if (isOwnArenaCompanyFolder(meta.name, user)) {
          feedbackFolderId = folderId; // 본인 업체관리 폴더 직접
        } else {
          // 상위(16C 등)로 보고 하위에서 본인 폴더 탐색.
          const p = parseArenaCohort(user.cohort);
          if (p) {
            for (const n of nameMatchCandidates(user.name)) {
              feedbackFolderId = await findFolderByNamePrefix(
                buildArenaCompanyFolderName(p.season, p.gisu, n),
                folderId,
              );
              if (feedbackFolderId) break;
            }
          }
          // 붙여넣은 것이 **본인의** `01 피드백업체` 폴더면 허용한다.
          // id 를 직접 대조하므로(이름 매칭 아님) 남의 폴더는 절대 통과 못 한다 —
          // 운영자가 손으로 고칠 때 쓰는 길. (2026-09-01, auto 3순위와 같은 사유)
          if (!feedbackFolderId) {
            const legacy = await findLegacyFeedbackFolder(user);
            if (legacy && legacy === folderId) feedbackFolderId = legacy;
          }
          if (!feedbackFolderId) {
            // 남의 폴더/무관 폴더 거부 — 본인 토큰 불일치.
            await updateDriveLink(email, { feedbackFolderId: "", driveLinkStatus: "error" });
            return NextResponse.json({
              ok: false,
              status: "error",
              errorKind: "arena_folder_mismatch",
              error:
                "이 폴더는 내 '업체관리' 폴더가 아니에요. 내 이름이 들어간 업체관리 폴더(또는 그 상위 폴더) 주소를 붙여넣어 주세요.",
            });
          }
        }
      }
    } else if (mode === "auto") {
      // ── 일반 기수 auto: 기존 로직 그대로 ────────────────────────
      const ssId = user.spreadsheetId;
      if (!ssId) {
        return NextResponse.json(
          { ok: false, error: "연동된 경영일지 시트가 없어요. 먼저 시트를 연결해 주세요.", status: "error" },
          { status: 400 },
        );
      }
      const meta = await getDriveFileMeta(ssId);
      if (!meta.ok) {
        await updateDriveLink(email, { feedbackFolderId: "", driveLinkStatus: "error" });
        if (meta.code === 404) {
          return NextResponse.json({
            ok: false,
            status: "error",
            errorKind: "sheet_not_found",
            error: "연동된 시트를 찾을 수 없어요. 시트 연결을 다시 확인해 주세요.",
          });
        }
        return folderNotSharedResponse();
      }
      if (meta.parentId) {
        feedbackFolderId = await findFolderByNamePrefix(FEEDBACK_PREFIX, meta.parentId);
      }
      if (!feedbackFolderId && meta.driveId) {
        feedbackFolderId =
          (await findFolderByNameInDrive("01 피드백업체", meta.driveId)) ??
          (await findFolderByNameInDrive(FEEDBACK_PREFIX, meta.driveId));
      }
      parentPathLabel = meta.parentId ?? meta.driveId ?? "";
      if (!feedbackFolderId) {
        await updateDriveLink(email, { feedbackFolderId: "", driveLinkStatus: "error" });
        return folderNotSharedResponse();
      }
    } else {
      // ── 일반 기수 manual: 기존 로직 그대로 ──────────────────────
      const url = String(body.parentFolderUrl ?? "").trim();
      const folderId = extractFolderId(url);
      if (!folderId) {
        return NextResponse.json(
          { error: "유효한 Drive 폴더 주소 또는 ID를 입력해 주세요." },
          { status: 400 },
        );
      }
      parentPathLabel = url;
      const meta = await getDriveFileMeta(folderId);
      if (meta.ok && meta.name.startsWith(FEEDBACK_PREFIX)) {
        feedbackFolderId = folderId;
      } else {
        feedbackFolderId = await findFolderByNamePrefix(FEEDBACK_PREFIX, folderId);
      }
    }

    await updateDriveLink(email, { driveParentPath: parentPathLabel });

    if (!feedbackFolderId) {
      await updateDriveLink(email, {
        feedbackFolderId: "",
        driveLinkStatus: "error",
      });
      return NextResponse.json({
        ok: false,
        status: "error",
        errorKind: "folder_01_missing",
        error:
          "상위 폴더는 찾았지만 ‘01 피드백업체’ 폴더가 없어요. 폴더 이름(‘01’로 시작)과 공유 권한을 확인해 주세요.",
      });
    }

    await updateDriveLink(email, { feedbackFolderId, driveLinkStatus: "ok" });
    return NextResponse.json({ ok: true, feedbackFolderId, status: "ok" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const POST = withApiTiming("api/drive-link:POST", POST_handler);
