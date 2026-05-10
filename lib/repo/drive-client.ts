/**
 * Layer: repo — Google Drive 전용 (시트 파일명 검색).
 *
 * 가드레일:
 *   • googleapis 는 오직 lib/repo/ 에서만 import.
 *   • read-only scope (drive.readonly) — 파일 검색만, 수정/생성 X.
 */
import { google, type drive_v3 } from "googleapis";
import { serviceAccount } from "@/config";

let cached: drive_v3.Drive | null = null;

export function driveClient(): drive_v3.Drive {
  if (cached) return cached;
  const sa = serviceAccount();
  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  cached = google.drive({ version: "v3", auth });
  return cached;
}

/**
 * 파일명 정확 일치로 스프레드시트 1개 찾기.
 * 트레이너가 만든 시트 이름 규칙: `세일즈PT_ N기 이름 수강생 경영일지`.
 *
 * 반환:
 *   - 정확히 1개 매칭 → spreadsheetId
 *   - 0개 또는 2개 이상 → null (호출 측이 안내)
 */
export async function findSheetByExactName(
  exactName: string,
): Promise<string | null> {
  const drive = driveClient();
  // 작은따옴표 escape: 시트 이름에 들어갈 수 있는 ' 만 escape
  const safeName = exactName.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q:
      `name = '${safeName}' ` +
      `and mimeType = 'application/vnd.google-apps.spreadsheet' ` +
      `and trashed = false`,
    fields: "files(id, name)",
    pageSize: 5,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const files = res.data.files ?? [];
  if (files.length !== 1) return null;
  return files[0]?.id ?? null;
}
