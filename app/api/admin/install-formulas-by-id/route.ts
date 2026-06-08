/**
 * POST /api/admin/install-formulas-by-id — admin only.
 *
 * 레지스트리 **미등록** 시트에 자동 집계 수식 설치 (시트 ID/URL 직접 지정).
 * 용도: ★ 양식 템플릿 + 8기 기복사본 등 users 탭에 없는 시트에 수식 전파
 * (콜·지·기·소 계약 N/O fix #319 후속 — 향후 복사본이 결함 상속하지 않도록 템플릿 포함).
 *
 * install-formulas-bulk(레지스트리 순회)와 동일한 installFormulas 로직 재사용 →
 * §2.5 bulk-write 보존 가드(isSafeToOverwrite: raw 값 skip, 수식/빈셀만 교체) 동일 적용.
 *
 * body: { sheetIds: string[] }  // 시트 ID/URL + **폴더 URL** 혼용 가능
 *   - `/folders/{id}` 패턴은 폴더로 간주 → 그 폴더(+하위)의 경영일지 시트를 자동 추가.
 * 응답: { processed, success: [...], failed: [...], expandedFromFolders: [{folderId, found}] }
 *
 * 전제: SA(masterbot) 가 각 시트의 writer 권한 보유(폴더 공유 등). 없으면 failed.
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { installFormulas } from "@/repo/setup-formulas";
import { extractSpreadsheetId } from "@/repo/users-prep";
import { listSheetsInDriveByTokens } from "@/repo/drive-client";

export const dynamic = "force-dynamic";

/** `/folders/{id}` URL 이면 폴더 ID, 아니면 null (시트로 처리). */
function folderIdOf(input: string): string | null {
  const m = input.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  return m ? m[1]! : null;
}

export async function POST(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { sheetIds?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const raw = Array.isArray(body.sheetIds) ? (body.sheetIds as unknown[]) : [];
  // 입력 분기: `/folders/{id}` URL = 폴더(안의 경영일지 자동 발견), 그 외 = 시트 ID/URL.
  const idSet = new Set<string>();
  const expandedFromFolders: { folderId: string; found: number }[] = [];
  for (const x of raw) {
    const s = String(x ?? "").trim();
    if (!s) continue;
    const folderId = folderIdOf(s);
    if (folderId) {
      // 폴더 → 부모범위 BFS 로 경영일지 시트 enumerate (discover 와 동일 로직).
      try {
        const found = await listSheetsInDriveByTokens(folderId, ["경영일지"]);
        for (const f of found) idSet.add(f.id);
        expandedFromFolders.push({ folderId, found: found.length });
      } catch {
        expandedFromFolders.push({ folderId, found: 0 });
      }
      continue;
    }
    const id = extractSpreadsheetId(s);
    if (/^[a-zA-Z0-9_-]{20,}$/.test(id)) idSet.add(id);
  }
  const ids = Array.from(idSet);
  if (ids.length === 0) {
    return NextResponse.json(
      {
        error: "no_valid_ids",
        hint: "유효한 시트 ID/URL 또는 폴더 URL 을 입력하세요. (폴더면 안에 경영일지 시트가 있어야 함, 폴더가 서비스계정에 공유됐는지 확인)",
      },
      { status: 400 },
    );
  }
  if (ids.length > 50) {
    return NextResponse.json(
      { error: "too_many", hint: "한 번에 최대 50개." },
      { status: 400 },
    );
  }

  const success: {
    sheetId: string;
    installed: number;
    preserved: number;
    preservedCells: string[];
  }[] = [];
  const failed: { sheetId: string; error: string }[] = [];

  // 순차 처리 — Sheets API rate limit 안전. 각 시트 1회 batchUpdate.
  for (const id of ids) {
    try {
      const report = await installFormulas(id);
      success.push({
        sheetId: id,
        installed: report.installed,
        preserved: report.preserved,
        preservedCells: report.preservedCells.slice(0, 50),
      });
    } catch (e) {
      failed.push({
        sheetId: id,
        error: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  return NextResponse.json({
    processed: ids.length,
    success,
    failed,
    expandedFromFolders,
  });
}
