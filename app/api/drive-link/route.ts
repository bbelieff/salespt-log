/**
 * POST /api/drive-link — Drive 01 피드백업체 폴더 연결.
 *
 * body:
 *   { mode: "auto" }                  — URL 없이 연동된 경영일지 시트의 상위 폴더에서 자동 탐색
 *   { parentFolderUrl: string }       — (수동) 01 피드백업체 폴더 URL 또는 그 상위 폴더 URL/ID
 *
 * ADR-0007: Scope 1은 Drive 읽기(files.list / files.get)만 — 생성/수정/삭제 금지.
 */
import { NextResponse } from "next/server";
import { findUserByEmail, updateDriveLink } from "@/repo/users";
import {
  findFolderByNameInDrive,
  findFolderByNamePrefix,
  getDriveFileMeta,
} from "@/repo/drive-client";
import { getCurrentUserEmail } from "@/auth/stub";

const FEEDBACK_PREFIX = "01";

/** 폴더 미공유/권한없음 공통 안내 — 무엇을(폴더) 누구에게(SA) 어떤 권한(뷰어)으로. */
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

export async function POST(req: Request) {
  try {
    const email = await getCurrentUserEmail();
    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: "등록되지 않은 사용자" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const mode = String(body.mode ?? "manual");

    let feedbackFolderId: string | null = null;
    let parentPathLabel = "";

    if (mode === "auto") {
      // 연동된 경영일지 시트의 상위 폴더 → 그 안에서 01 피드백업체 탐색 (URL 불필요).
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
        // 403 등 — 파일 접근 자체 불가 → 공유 안내.
        return folderNotSharedResponse();
      }
      // (a) 부모 폴더 안에서 01 피드백업체 탐색 (부모가 보이는 경우).
      if (meta.parentId) {
        feedbackFolderId = await findFolderByNamePrefix(FEEDBACK_PREFIX, meta.parentId);
      }
      // (b) 폴백: 부모가 안 보이거나(공유 드라이브 등) (a) 실패면, 시트가 든 그
      //     (공유)드라이브 전체에서 직접 탐색. 정확명 우선 → prefix.
      if (!feedbackFolderId && meta.driveId) {
        feedbackFolderId =
          (await findFolderByNameInDrive("01 피드백업체", meta.driveId)) ??
          (await findFolderByNameInDrive(FEEDBACK_PREFIX, meta.driveId));
      }
      parentPathLabel = meta.parentId ?? meta.driveId ?? "";
      // (a)·(b) 둘 다 실패 시에만 공유 안내.
      if (!feedbackFolderId) {
        await updateDriveLink(email, { feedbackFolderId: "", driveLinkStatus: "error" });
        return folderNotSharedResponse();
      }
    } else {
      // 수동: 붙여넣은 게 01 피드백업체 폴더 자체면 직접 사용, 상위 폴더면 그 안에서 탐색.
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
        // 붙여넣은 게 01 피드백업체 폴더 자체.
        feedbackFolderId = folderId;
      } else {
        // 상위 폴더로 보고 그 안에서 탐색.
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
