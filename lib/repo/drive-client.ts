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

/**
 * 파일/폴더의 이름 + 첫 부모 폴더 id 조회 (drive.readonly 로 가능).
 *
 * 용도(ADR-0007 연결-only):
 *   - [자동 찾기] 연동 스프레드시트의 부모 폴더를 구해 그 안에서 01 피드백업체 탐색.
 *   - [수동] 붙여넣은 폴더가 01 피드백업체 자체인지(이름) 판별해 직접 사용.
 */
export async function getDriveFileMeta(
  fileId: string,
): Promise<{ name: string; parentId: string | null }> {
  const drive = driveClient();
  const res = await drive.files.get({
    fileId,
    fields: "name, parents",
    supportsAllDrives: true,
  });
  const parents = res.data.parents ?? [];
  return { name: res.data.name ?? "", parentId: parents[0] ?? null };
}

/**
 * 부모 폴더 하위에서 prefix 로 시작하는 **폴더** 찾기 (ADR-0007).
 *
 * findSheetByNamePrefix 와 동일 패턴이지만:
 *   - mimeType = folder (spreadsheet 아님)
 *   - parentFolderId 로 범위 제한
 *   - Scope 1은 Drive 읽기(files.list)만 — 생성/수정/삭제 금지.
 */
export async function findFolderByNamePrefix(
  prefix: string,
  parentFolderId: string,
): Promise<string | null> {
  const drive = driveClient();
  const safe = prefix.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q:
      `name contains '${safe}' ` +
      `and mimeType = 'application/vnd.google-apps.folder' ` +
      `and '${parentFolderId}' in parents ` +
      `and trashed = false`,
    fields: "files(id, name)",
    pageSize: 20,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const files = (res.data.files ?? []).filter(
    (f): f is { id: string; name: string } =>
      typeof f.name === "string" &&
      typeof f.id === "string" &&
      f.name.startsWith(prefix),
  );
  if (files.length === 0) return null;
  const exact = files.find((f) => f.name === prefix);
  if (exact) return exact.id;
  if (files.length > 5) return null;
  files.sort((a, b) => a.name.length - b.name.length);
  return files[0]?.id ?? null;
}

/**
 * prefix 매칭 — 파일명이 `{prefix}` 로 시작하는 시트 찾기.
 * 시트 이름 끝에 `(new)`, `v2`, ` 사본` 같은 suffix 가 붙은 케이스 처리용
 * (사용자가 시트 복제·이름변경 자유롭게 가능).
 *
 * 매칭 정책:
 *   - prefix 와 정확히 같은 이름 있으면 그것 우선 (suffix 없는 원본).
 *   - 그 외엔 이름 가장 짧은 것 우선 (suffix 길이 최소 = 가장 가까운 매칭).
 *   - 5개 초과 매칭이면 ambiguous → null (호출 측이 사용자에게 명확화 요청).
 *
 * Drive q `name contains` 는 토큰 매칭이라 한국어·공백 포함 prefix 도 OK.
 */
export async function findSheetByNamePrefix(
  prefix: string,
): Promise<string | null> {
  const drive = driveClient();
  const safe = prefix.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q:
      `name contains '${safe}' ` +
      `and mimeType = 'application/vnd.google-apps.spreadsheet' ` +
      `and trashed = false`,
    fields: "files(id, name)",
    pageSize: 20,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const files = (res.data.files ?? []).filter(
    (f): f is { id: string; name: string } =>
      typeof f.name === "string" &&
      typeof f.id === "string" &&
      f.name.startsWith(prefix),
  );
  if (files.length === 0) return null;
  // 정확 매칭(suffix 없는 원본) 우선.
  const exact = files.find((f) => f.name === prefix);
  if (exact) return exact.id;
  // 그 외엔 이름 길이 짧은 순(가장 적은 suffix) 우선.
  if (files.length > 5) return null; // 너무 많으면 ambiguous.
  files.sort((a, b) => a.name.length - b.name.length);
  return files[0]?.id ?? null;
}
