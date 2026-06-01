/**
 * POST /api/drive-link — Drive 부모 폴더 연결 + 01 피드백업체 자동 탐색.
 *
 * body: { parentFolderUrl: string }
 *   - Google Drive 폴더 URL 또는 폴더 ID
 *
 * ADR-0007: Scope 1은 Drive 읽기(files.list)만 — 생성/수정/삭제 금지.
 */
import { NextResponse } from "next/server";
import { findUserByEmail, updateDriveLink } from "@/repo/users";
import { findFolderByNamePrefix } from "@/repo/drive-client";
import { getCurrentUserEmail } from "@/auth/stub";

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

    const body = await req.json();
    const parentFolderUrl = String(body.parentFolderUrl ?? "").trim();
    const parentFolderId = extractFolderId(parentFolderUrl);
    if (!parentFolderId) {
      return NextResponse.json(
        { error: "유효한 Drive 폴더 URL 또는 ID를 입력해주세요." },
        { status: 400 },
      );
    }

    await updateDriveLink(email, { driveParentPath: parentFolderUrl });

    const feedbackFolderId = await findFolderByNamePrefix("01", parentFolderId);
    if (!feedbackFolderId) {
      await updateDriveLink(email, {
        feedbackFolderId: "",
        driveLinkStatus: "error",
      });
      return NextResponse.json({
        ok: false,
        error: "부모 폴더에서 '01 피드백업체' 폴더를 찾을 수 없습니다. 폴더 이름과 SA 공유를 확인해주세요.",
        status: "error",
      });
    }

    await updateDriveLink(email, {
      feedbackFolderId,
      driveLinkStatus: "ok",
    });

    return NextResponse.json({ ok: true, feedbackFolderId, status: "ok" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
