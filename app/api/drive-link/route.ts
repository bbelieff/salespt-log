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
  findFolderByNamePrefix,
  getDriveFileMeta,
} from "@/repo/drive-client";
import { getCurrentUserEmail } from "@/auth/stub";

const FEEDBACK_PREFIX = "01";

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
      if (!meta.parentId) {
        await updateDriveLink(email, { feedbackFolderId: "", driveLinkStatus: "error" });
        return NextResponse.json({
          ok: false,
          error: "시트의 상위 폴더를 찾을 수 없어요. 폴더 공유 권한을 확인해 주세요.",
          status: "error",
        });
      }
      parentPathLabel = meta.parentId;
      feedbackFolderId = await findFolderByNamePrefix(FEEDBACK_PREFIX, meta.parentId);
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
      const meta = await getDriveFileMeta(folderId).catch(() => null);
      if (meta && meta.name.startsWith(FEEDBACK_PREFIX)) {
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
        error:
          "‘01 피드백업체’ 폴더를 찾지 못했어요. 폴더 이름과 공유 권한을 확인해 주세요.",
        status: "error",
      });
    }

    await updateDriveLink(email, { feedbackFolderId, driveLinkStatus: "ok" });
    return NextResponse.json({ ok: true, feedbackFolderId, status: "ok" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
