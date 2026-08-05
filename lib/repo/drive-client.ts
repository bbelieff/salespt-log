/**
 * Layer: repo — Google Drive 전용 (시트 파일명 검색).
 *
 * 가드레일:
 *   • googleapis 는 오직 lib/repo/ 에서만 import.
 *   • read-only scope (drive.readonly) — 파일 검색만, 수정/생성 X.
 */
import { google, type drive_v3 } from "googleapis";
import { serviceAccount, authConfig, adminDriveRefreshToken } from "@/config";
import { pickSheetFromCandidates, filterSheetsByTokens } from "./sheet-title-match";
import { shareWithServiceAccount } from "./drive-sa-share";

let cached: drive_v3.Drive | null = null;
let cachedCreator: drive_v3.Drive | null = null;

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

// 파일 생성(복제·폴더·TXT·공지이미지) 전용 (ADR-0015/0016) — belie OAuth 필수.
// SA 는 Drive 용량 0 → 파일 소유 생성 불가("storage quota" — 2026-06-11 라이브 사고).
// 토큰 미설정 시 SA silent 폴백이 그 사고의 원인 → 폴백 제거, 명시 실패로 즉시 드러낸다.
// 발급: scripts/get-admin-drive-token.mjs → env ADMIN_DRIVE_REFRESH_TOKEN.
export function driveCreatorClient(): drive_v3.Drive {
  if (cachedCreator) return cachedCreator;
  const refresh = adminDriveRefreshToken();
  if (!refresh) {
    throw new Error(
      "ADMIN_DRIVE_REFRESH_TOKEN 미설정 — Drive 파일 생성은 관리자 OAuth 필수(ADR-0015). " +
        "서버 env 에 토큰을 추가하세요 (발급: scripts/get-admin-drive-token.mjs).",
    );
  }
  const { googleId, googleSecret } = authConfig();
  const oauth = new google.auth.OAuth2(googleId, googleSecret);
  oauth.setCredentials({ refresh_token: refresh });
  cachedCreator = google.drive({ version: "v3", auth: oauth });
  return cachedCreator;
}

// 템플릿 시트 복제 (ADR-0011/0015). 원본 불변·새 파일 생성. 반환=새 spreadsheetId.
// 복제 직후 SA 공유를 붙인다 — 호출부 3곳(일반 기수 라우트·아레나 라우트·pending 재시도)이
// 모두 이 함수를 지나므로, 여기 한 곳에 두면 어느 경로로 만들어도 갭이 생기지 않는다.
export async function copyTemplateSheet(
  templateId: string,
  newTitle: string,
  destFolderId: string,
): Promise<string> {
  const res = await driveCreatorClient().files.copy({
    fileId: templateId,
    requestBody: { name: newTitle, parents: [destFolderId] },
    supportsAllDrives: true,
    fields: "id",
  });
  const id = res.data.id;
  if (!id) throw new Error("[copyTemplateSheet] 복제 결과 id 없음");
  console.warn("[cohort-create] copyTemplateSheet " + JSON.stringify({ templateId, destFolderId, newId: id, newTitle }));
  await shareWithServiceAccount(driveCreatorClient(), id); // 상세 근거: ./drive-sa-share.ts (BBE-45)
  return id;
}

// 지정 부모(아레나 companyParentFolderId) 하위에 새 폴더 생성 (ADR-0012/0015). 반환=folderId.
export async function createFolder(
  name: string,
  parentId: string,
): Promise<string> {
  const res = await driveCreatorClient().files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    supportsAllDrives: true,
    fields: "id",
  });
  const id = res.data.id;
  if (!id) throw new Error("[createFolder] 생성 결과 id 없음");
  console.warn("[arena-create] createFolder " + JSON.stringify({ name, parentId, newId: id }));
  return id;
}

/**
 * 부모 폴더 안에서 이름 **정확 일치** 폴더 1개 찾기 (아레나 멱등 검사·재사용).
 * 아레나 폴더명은 결정적(`세일즈PT_A1_0기 이름_대표님 업체관리`)이라 정확일치가 안전.
 * 부모범위 쿼리 → corpora 미지정(allDrives 비호환 회귀 방지). 공유 드라이브 대응.
 */
export async function findFolderByExactName(
  name: string,
  parentFolderId: string,
): Promise<string | null> {
  const drive = driveClient();
  const safe = name.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q:
      `name = '${safe}' ` +
      `and mimeType = 'application/vnd.google-apps.folder' ` +
      `and '${parentFolderId}' in parents ` +
      `and trashed = false`,
    fields: "files(id, name)",
    pageSize: 5,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const files = (res.data.files ?? []).filter(
    (f): f is { id: string; name: string } =>
      typeof f.id === "string" && f.name === name,
  );
  return files[0]?.id ?? null;
}

export interface FolderContainsResult {
  /** 정확히 1개 매칭 시 폴더 id. 0개/2개+ 면 null. */
  id: string | null;
  /** 매칭된 폴더명들 (호출측이 0개=없음 vs 2개+=모호 를 구분·안내). */
  matchedNames: string[];
}

/**
 * 부모 폴더 안에서 이름을 **포함(contains)** 하는 폴더 찾기 (복제 대상 폴더).
 * 실제 이름폴더명이 `[{팀} {기수}기] {이름}` (예: `[서울 8기] 김승엽`) 형태라 정확일치 불가.
 *
 *   - 부모 범위 쿼리(corpora 미지정 — allDrives 금지, 회귀방지 ADR-0011/2026-06).
 *   - 0개면 driveId 범위(corpora:"drive") 폴백 — 공유 드라이브 전체 탐색.
 *   - `name.includes(이름)` 재필터 + id 중복 제거 후 "정확히 1개" 규칙.
 *   - 공유 드라이브 대응 supportsAllDrives + includeItemsFromAllDrives.
 */
export async function findFolderContainingName(
  name: string,
  parentFolderId: string,
): Promise<FolderContainsResult> {
  const drive = driveClient();
  const needle = name.trim();
  const safe = needle.replace(/'/g, "\\'");

  const pick = (raw: drive_v3.Schema$File[]): FolderContainsResult => {
    const files = raw.filter(
      (f): f is { id: string; name: string } =>
        typeof f.id === "string" &&
        typeof f.name === "string" &&
        f.name.includes(needle),
    );
    const uniq = Array.from(new Map(files.map((f) => [f.id, f])).values());
    if (uniq.length === 1) return { id: uniq[0]!.id, matchedNames: [uniq[0]!.name] };
    return { id: null, matchedNames: uniq.map((f) => f.name) };
  };

  // 1) 부모 범위.
  const inParent = await drive.files.list({
    q:
      `name contains '${safe}' ` +
      `and mimeType = 'application/vnd.google-apps.folder' ` +
      `and '${parentFolderId}' in parents ` +
      `and trashed = false`,
    fields: "files(id, name)",
    pageSize: 50,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  let result = pick(inParent.data.files ?? []);
  console.warn(
    "[cohort-create] findFolderContainingName parent " +
      JSON.stringify({
        name: needle,
        parentFolderId,
        matched: result.matchedNames.length,
      }),
  );
  // 부모 범위에서 뭐라도 잡혔으면(1개=사용 / 2개+=모호) 폴백하지 않음.
  if (result.id || result.matchedNames.length > 0) return result;

  // 2) driveId 범위 폴백 (부모 범위 0개일 때만).
  const meta = await getDriveFileMeta(parentFolderId);
  if (meta.ok && meta.driveId) {
    const inDrive = await drive.files.list({
      q:
        `name contains '${safe}' ` +
        `and mimeType = 'application/vnd.google-apps.folder' ` +
        `and trashed = false`,
      fields: "files(id, name)",
      pageSize: 100,
      corpora: "drive",
      driveId: meta.driveId,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    result = pick(inDrive.data.files ?? []);
    console.warn(
      "[cohort-create] findFolderContainingName driveFallback " +
        JSON.stringify({
          name: needle,
          driveId: meta.driveId,
          matched: result.matchedNames.length,
        }),
    );
  }
  return result;
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
    // corpora 미지정: includeItemsFromAllDrives 만으로 내 드라이브+공유 항목 검색.
    // (allDrives 는 parent 범위 쿼리와 비호환 → 통일성·회귀방지 위해 전부 제거.)
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const files = res.data.files ?? [];
  if (files.length !== 1) return null;
  return files[0]?.id ?? null;
}

/**
 * 모든 토큰을 제목에 포함하는 스프레드시트 1개 찾기 (self-claim 시트 매칭 완화).
 * 예: `["세일즈PT", "8기", "김승엽", "경영일지"]` → "수강생" 유무 무관 매칭.
 *
 * 정확도:
 *   - Drive `name contains` 는 토큰(prefix) 매칭이라 오탐 가능 → JS 에서 모든 토큰을
 *     실제 `.includes` 로 재검증.
 *   - 기수 토큰(`\d+기`)은 숫자 경계 정규식 `(^|[^0-9])N기` 로 검증 → "8기"가 "18기"에
 *     오매칭되지 않음.
 *   - 0개 → null. 1개 → id. 2개+ → 모호 → null(추측 금지). 단 "수강생" 포함 형이
 *     정확히 1개면 그것 우선(약한 tiebreak).
 * 공유 드라이브 대응 supportsAllDrives + includeItemsFromAllDrives.
 */
export async function findSheetByNameContainsAll(
  tokens: string[],
): Promise<string | null> {
  const clean = tokens.map((t) => t.trim()).filter(Boolean);
  if (clean.length === 0) return null;
  const drive = driveClient();
  const q =
    clean.map((t) => `name contains '${t.replace(/'/g, "\\'")}'`).join(" and ") +
    ` and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
  const res = await drive.files.list({
    q,
    fields: "files(id, name)",
    pageSize: 20,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const candidates = (res.data.files ?? []).filter(
    (f): f is { id: string; name: string } =>
      typeof f.id === "string" && typeof f.name === "string",
  );
  const picked = pickSheetFromCandidates(candidates, clean);
  console.warn(
    "[claim-match] findSheetByNameContainsAll " +
      JSON.stringify({ tokens: clean, candidates: candidates.length, picked: !!picked }),
  );
  return picked;
}

/**
 * **폴더 트리**(parentFolderId 기준 부모범위 BFS)에서 토큰을 모두 포함하는 스프레드시트
 * enumerate (read-only). 8기 등 레지스트리 미등록 시트 ID 자동 발견 → by-id 수식 설치용.
 *
 *   - `'X' in parents` 부모범위 BFS (기수폴더 > 이름폴더 > 시트), 깊이 MAX_DEPTH(3) 제한.
 *     **공유 드라이브 + 소유자 있는 일반 공유 폴더(Shared with me, driveId 없음) 모두 동작**
 *     — corpora/driveId 의존 제거(2026-06: 일반 폴더는 내부 시트가 corpus 검색에 안 잡힘).
 *   - supportsAllDrives + includeItemsFromAllDrives. corpora 미지정(allDrives 회귀 금지).
 *   - JS 에서 filterSheetsByTokens 재검증(기수 숫자 경계 "8기"≠"18기" 가드 포함).
 *   - 폴더가 SA 에 미공유면 빈 결과(접근 불가).
 */
export async function listSheetsInDriveByTokens(
  parentFolderId: string,
  tokens: string[],
): Promise<{ id: string; name: string }[]> {
  const clean = tokens.map((t) => t.trim()).filter(Boolean);
  if (clean.length === 0) return [];
  const drive = driveClient();
  // 부모범위 BFS 트리워크 (폴더 → 하위 이름폴더 → 시트). My Drive 공유 폴더는
  // 내부 시트가 corpus/driveId 검색에 안 잡혀(2026-06 진단), 부모범위 `'X' in parents`
  // 만이 견고. 공유 드라이브에도 동일 동작(supportsAllDrives+includeItemsFromAllDrives).
  const FOLDER = "application/vnd.google-apps.folder";
  const SHEET = "application/vnd.google-apps.spreadsheet";
  const MAX_DEPTH = 3; // 기수폴더(0)>이름폴더(1)>시트면 충분 — 안전 여유 3.
  const candidates: { id: string; name: string }[] = [];
  const queue: { id: string; depth: number }[] = [{ id: parentFolderId, depth: 0 }];
  const seen = new Set<string>();
  let folderBudget = 300; // runaway 방지 상한.
  while (queue.length > 0 && folderBudget-- > 0) {
    const { id: folderId, depth } = queue.shift()!;
    if (seen.has(folderId)) continue;
    seen.add(folderId);
    let pageToken: string | undefined;
    do {
      const res = await drive.files.list({
        q: `'${folderId.replace(/'/g, "\\'")}' in parents and trashed = false`,
        fields: "nextPageToken, files(id, name, mimeType)",
        pageSize: 200,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        pageToken,
      });
      for (const f of res.data.files ?? []) {
        if (!f.id) continue;
        // 하위 폴더는 깊이 한도 내에서만 더 내려감(업체관리 등 깊은 트리 과탐색 방지).
        if (f.mimeType === FOLDER) {
          if (depth + 1 < MAX_DEPTH) queue.push({ id: f.id, depth: depth + 1 });
        } else if (f.mimeType === SHEET && typeof f.name === "string")
          candidates.push({ id: f.id, name: f.name });
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
  }
  const matched = filterSheetsByTokens(candidates, clean);
  console.warn(
    "[install-by-folder] listSheetsInDriveByTokens " +
      JSON.stringify({
        parentFolderId,
        foldersWalked: seen.size,
        tokens: clean,
        candidates: candidates.length,
        matched: matched.length,
      }),
  );
  return matched;
}

/**
 * 파일/폴더의 이름 + 첫 부모 폴더 id 조회 (drive.readonly 로 가능).
 *
 * 용도(ADR-0007 연결-only):
 *   - [자동 찾기] 연동 스프레드시트의 부모 폴더를 구해 그 안에서 01 피드백업체 탐색.
 *   - [수동] 붙여넣은 폴더가 01 피드백업체 자체인지(이름) 판별해 직접 사용.
 *
 * 판별형 결과 + 진단 로그(2026-06): 실패 원인을 운영 로그에서 구분.
 *   - ok + parentsCount=0  → 파일만 공유되고 **부모 폴더는 미공유** (Drive 가 parents 를 빈 배열로 반환).
 *   - !ok + code 403       → 파일 접근 권한 자체 없음.
 *   - !ok + code 404       → 파일 못 찾음(잘못된 id/삭제).
 */
export type DriveFileMeta =
  | {
      ok: true;
      name: string;
      parentId: string | null;
      parentsCount: number;
      driveId: string | null; // 공유 드라이브 소속이면 그 드라이브 id (폴백 탐색용)
    }
  | { ok: false; code: number | null; message: string };

export async function getDriveFileMeta(fileId: string): Promise<DriveFileMeta> {
  const drive = driveClient();
  try {
    const res = await drive.files.get({
      fileId,
      fields: "name, parents, driveId",
      supportsAllDrives: true,
    });
    const parents = res.data.parents ?? [];
    const driveId = res.data.driveId ?? null;
    console.warn(
      "[drive-link] files.get ok " +
        JSON.stringify({
          fileId,
          name: res.data.name ?? "",
          parentsCount: parents.length,
          driveId,
        }),
    );
    return {
      ok: true,
      name: res.data.name ?? "",
      parentId: parents[0] ?? null,
      parentsCount: parents.length,
      driveId,
    };
  } catch (e: unknown) {
    const err = e as {
      code?: number | string;
      message?: string;
      response?: { status?: number };
    };
    const rawCode = err.code ?? err.response?.status ?? null;
    const code =
      typeof rawCode === "string" ? Number(rawCode) || null : rawCode;
    const message = err.message ?? "unknown";
    console.warn(
      "[drive-link] files.get FAILED " + JSON.stringify({ fileId, code, message }),
    );
    return { ok: false, code, message };
  }
}

/**
 * 부모 폴더 하위에서 prefix 로 시작하는 **폴더** 찾기 (ADR-0007).
 *
 * prefix 매칭 폴더 검색:
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
    // ⚠️ corpora:"allDrives" 금지 — `'X' in parents` 부모범위 쿼리와 비호환이라
    //    빈 결과 반환(자동찾기 전원 실패 회귀, 2026-06). includeItemsFromAllDrives 로 충분.
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const raw = res.data.files ?? [];
  const files = raw.filter(
    (f): f is { id: string; name: string } =>
      typeof f.name === "string" &&
      typeof f.id === "string" &&
      f.name.startsWith(prefix),
  );
  console.warn(
    "[drive-link] findFolderByNamePrefix " +
      JSON.stringify({ prefix, parentFolderId, raw: raw.length, matched: files.length }),
  );
  if (files.length === 0) return null;
  const exact = files.find((f) => f.name === prefix);
  if (exact) return exact.id;
  if (files.length > 5) return null;
  files.sort((a, b) => a.name.length - b.name.length);
  return files[0]?.id ?? null;
}

/**
 * 특정 **공유 드라이브(driveId)** 안에서 prefix 로 시작하는 폴더 찾기 (폴백, ADR-0007 읽기only).
 * 부모폴더 한 단계가 안 보여도(공유 방식), 시트가 든 그 드라이브 전체를 범위로 직접 탐색.
 * 한 드라이브 범위라 동명 폴더 혼선이 적음.
 */
export async function findFolderByNameInDrive(
  prefix: string,
  driveId: string,
): Promise<string | null> {
  const drive = driveClient();
  const safe = prefix.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q:
      `name contains '${safe}' ` +
      `and mimeType = 'application/vnd.google-apps.folder' ` +
      `and trashed = false`,
    fields: "files(id, name)",
    pageSize: 50,
    corpora: "drive",
    driveId,
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
