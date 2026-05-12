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
 * 사용자 OAuth access_token 으로 시트 공유 권한을 Service Account 에 추가.
 *
 * 이유: 트레이너/admin 이 만든 시트는 보통 SA 와 공유되지 않아 Drive 검색·데이터
 * read 가 모두 실패 ("매칭되는 시트를 찾지 못했습니다" 사고 2026-05-12).
 * admin 이 prep row 등록할 때 본인 OAuth token 으로 그 시트에 SA 를 writer 로
 * 자동 추가 — 수동 시트 공유 작업 제거.
 *
 * 권한: 호출자(=admin)가 그 시트의 owner 또는 editor 여야 성공. viewer 면 fail.
 * fail 시 안내 메시지 반환 — 사용자가 시트 소유자에게 권한 부여 요청.
 *
 * NOTE: googleapis 는 lib/repo/ 전용 — structural test 준수.
 */
export async function shareSheetWithServiceAccount(
  spreadsheetId: string,
  userAccessToken: string,
): Promise<{ shared: boolean; alreadyShared: boolean; error?: string }> {
  const sa = serviceAccount();
  const oauth = new google.auth.OAuth2();
  oauth.setCredentials({ access_token: userAccessToken });
  const drive = google.drive({ version: "v3", auth: oauth });
  try {
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        role: "writer",
        type: "user",
        emailAddress: sa.client_email,
      },
      supportsAllDrives: true,
      sendNotificationEmail: false,
    });
    return { shared: true, alreadyShared: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 이미 공유돼 있으면 409 또는 비슷한 메시지 — 멱등 처리.
    if (/already.*shared|permission.*exists|duplicate/i.test(msg)) {
      return { shared: true, alreadyShared: true };
    }
    return { shared: false, alreadyShared: false, error: msg };
  }
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
