/**
 * POST /api/admin/discover-folder-sheets — admin only, **read-only**.
 *
 * 폴더가 속한 공유 드라이브에서 토큰을 모두 포함하는 스프레드시트 ID/이름 enumerate.
 * 용도: 8기 등 레지스트리 미등록 시트의 ID 를 admin 이 직접 안 찾고 자동 발견 →
 * 결과를 검토 후 install-formulas-by-id 로 수식 설치 (읽기/쓰기 분리, #320 후속).
 *
 * body: { folderId: string, tokens?: string[] }  // folderId 는 ID 또는 폴더 URL
 *   tokens 기본값 ["세일즈PT","경영일지"]. 8기 한정 시 ["세일즈PT","8기","경영일지"].
 * 응답: { driveScoped: boolean, count, sheets: [{sheetId, name}] }
 *
 * 전제: SA(masterbot) 가 해당 공유 드라이브 멤버. 아니면 빈 결과.
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { listSheetsInDriveByTokens } from "@/repo/drive-client";

export const dynamic = "force-dynamic";

/** 폴더 ID 또는 /folders/{id} URL 에서 폴더 ID 추출. */
function extractFolderId(input: string): string {
  const t = input.trim();
  const m = t.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (m) return m[1]!;
  return t;
}

export async function POST(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { folderId?: unknown; tokens?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const folderId = extractFolderId(String(body.folderId ?? ""));
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(folderId)) {
    return NextResponse.json(
      { error: "invalid_folder", hint: "유효한 폴더 ID 또는 폴더 URL 을 입력하세요." },
      { status: 400 },
    );
  }
  const tokens =
    Array.isArray(body.tokens) && body.tokens.length > 0
      ? (body.tokens as unknown[]).map((t) => String(t ?? "").trim()).filter(Boolean)
      : ["세일즈PT", "경영일지"];

  try {
    const matched = await listSheetsInDriveByTokens(folderId, tokens);
    return NextResponse.json({
      driveScoped: true,
      count: matched.length,
      tokens,
      sheets: matched.map((m) => ({ sheetId: m.id, name: m.name })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "discover_failed", hint: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
