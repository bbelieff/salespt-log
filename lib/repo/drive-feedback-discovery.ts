/**
 * Layer: repo — 일반 기수 피드백 폴더 발견 (drive-auto-link 2026-09-24).
 *
 * 범위: 서버가 확인한 등록 spreadsheetId 1개에만 동작한다.
 * 클라이언트가 임의 sheetId 를 지정해 admin 조회를 유도할 수 없다 —
 * 호출부(route)는 반드시 user.spreadsheetId(서버 확인값)만 넘긴다.
 *
 * 순서:
 *   1) SA files.get(시트) → 유일 부모 1개 확정(MIME·미삭제·단일부모 검증).
 *   2) SA 메타는 성공인데 parents 가 비어 있으면, **등록 시트 1개에 한해**
 *      admin OAuth(driveCreatorClient) files.get READ 1회로 부모를 재확인한다.
 *      생성·공유·쓰기 호출 없음. 토큰 미설정·OAuth 실패는 원문 없이
 *      parent_metadata_unavailable 로만 반환한다.
 *   3) 확정 부모의 **직접 자식** 중 `01` prefix 폴더만 후보로 삼는다.
 *      전 페이지를 순회하고, 0개→folder_missing, 2개+→folder_ambiguous.
 *      공유 드라이브 전체 탐색(corpora/driveId 범위)은 절대 하지 않는다.
 *   4) 최종 후보는 SA files.get + files.list(page1) 로 검증 후에만 성공.
 *
 * 시간 bound: 발견 전체 15000ms·저장값 검증 5000ms, 호출당 min(5000,잔여).
 * 모든 Drive 호출에 {timeout, retry:false} 를 붙여 UI 25초 안에 끝낸다.
 * 페이지 사이클·20페이지 초과·incompleteSearch 는 부분 성공으로 쓰지 않고
 * retryable 로 거부한다(부분 목록을 유일성 증거로 쓰지 않음).
 *
 * ADR-0015 예외 메모: 본 파일의 admin READ 1회는 파일 생성(복제·폴더)이 아니라
 * SA 가 가리는 parents 빈 배열을 메우는 읽기 전용 폴백이다. 자세한 근거는
 * docs/plans/active/drive-auto-link.md §ADR-0015 노트 참조. broad scope 변경 없음.
 *
 * 로깅·에러에 식별자 금지: id·email·토큰을 기록/반환하지 않는다.
 */

import { driveClient, driveCreatorClient } from "./drive-client";

export const FEEDBACK_PREFIX = "01";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const SPREADSHEET_MIME = "application/vnd.google-apps.spreadsheet";

/** 외부 호출 bound — UI 25초 안에 마치도록 발견 15초·검증 5초로 나눈다. */
export const DISCOVERY_DEADLINE_MS = 15000;
export const VERIFY_DEADLINE_MS = 5000;
const PER_CALL_TIMEOUT_CAP_MS = 5000;
const MAX_PAGES = 20;

export type DiscoveryReason =
  | "parent_metadata_unavailable"
  | "sheet_not_found"
  | "folder_missing"
  | "folder_ambiguous"
  | "folder_not_shared"
  | "retryable";

export type DiscoverySuccess = {
  ok: true;
  feedbackFolderId: string;
  parentId: string;
  parentSource: "sa" | "admin";
};

export type DiscoveryFailure = {
  ok: false;
  reason: DiscoveryReason;
  /** 한글 간결 안내. 식별자·토큰 미포함. */
  message: string;
};

export type DiscoveryResult = DiscoverySuccess | DiscoveryFailure;

/** drive_v3.Drive 중 본 파일이 쓰는 최소 표면. 테스트는 이 모양의 가짜를 주입한다. */
export interface MinimalDrive {
  files: {
    get: (params: any, options?: { timeout?: number; retry?: boolean }) => Promise<{ data: any }>;
    list: (params: any, options?: { timeout?: number; retry?: boolean }) => Promise<{ data: any }>;
  };
}

export interface DiscoverDeps {
  saDrive?: MinimalDrive;
  /** null 이면 admin 폴백을 시도하지 않는다. 미지정 시 driveCreatorClient() 로 지연 생성. */
  adminDrive?: MinimalDrive | null;
  getAdminDrive?: () => MinimalDrive;
  /** 테스트용 가짜 시계. 미지정 시 Date.now. */
  now?: () => number;
  discoveryDeadlineMs?: number;
  verifyDeadlineMs?: number;
  maxPages?: number;
}

const MESSAGES: Record<DiscoveryReason, string> = {
  parent_metadata_unavailable:
    "시트 상위 폴더 정보를 확인하지 못했어요. 운영자에게 연결 확인을 요청해 주세요.",
  sheet_not_found:
    "연동된 시트를 찾을 수 없어요. 시트 연결을 다시 확인해 주세요.",
  folder_missing:
    "상위 폴더에서 ‘01’로 시작하는 피드백 폴더를 찾지 못했어요. 폴더 이름과 공유 권한을 확인해 주세요.",
  folder_ambiguous:
    "‘01’로 시작하는 폴더가 여러 개 있어 자동으로 고를 수 없어요. 운영자에게 알려주세요.",
  folder_not_shared:
    "폴더 공유 권한을 확인해 주세요. 서비스 계정에 폴더 공유가 필요해요.",
  retryable: "일시적인 오류예요. 잠시 후 다시 시도해 주세요.",
};

export function messageForReason(reason: DiscoveryReason): string {
  return MESSAGES[reason];
}

type Code = number | null;

function toCode(e: unknown): Code {
  const err = e as {
    code?: number | string;
    response?: { status?: number };
  };
  const raw = err?.code ?? err?.response?.status ?? null;
  if (raw === null || raw === undefined) return null;
  const n = typeof raw === "string" ? Number(raw) : raw;
  return Number.isFinite(n) ? (n as number) : null;
}

function isRetryableCode(code: Code): boolean {
  if (code === null) return true; // 네트워크·원인 불명 → 재시도 가능으로 분류
  return code === 401 || code === 408 || code === 429 || code === 500 || code === 502 || code === 503 || code === 504;
}

function fail(reason: DiscoveryReason): DiscoveryFailure {
  return { ok: false, reason, message: MESSAGES[reason] };
}

function logResult(extra: Record<string, unknown>): void {
  // id·email·토큰 금지 — 사유·개수·출처만.
  console.warn("[drive-feedback-discovery] " + JSON.stringify(extra));
}

function defaultAdminDrive(): MinimalDrive {
  return driveCreatorClient() as unknown as MinimalDrive;
}

function defaultSaDrive(): MinimalDrive {
  return driveClient() as unknown as MinimalDrive;
}

/** Drive id 화이트리스트 — q 삽입 전 검증. 가짜·실제 id 모두 통과하는 최소 규칙. */
function isSafeDriveId(id: string): boolean {
  return /^[A-Za-z0-9_-]{10,}$/.test(id);
}

/** q 문자열 리터럴 escape (역슬래시·작은따옴표). 검증된 id 에만 쓴다. */
function escapeQId(id: string): string {
  return id.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** 부모 후보 정규화 — trim·빈값 제거·중복 제거. 호출부는 길이로 단일성을 본다. */
function uniqueParents(parents: unknown): string[] {
  if (!Array.isArray(parents)) return [];
  const seen = new Set<string>();
  for (const p of parents) {
    if (typeof p !== "string") continue;
    const t = p.trim();
    if (!t || !isSafeDriveId(t)) continue;
    seen.add(t);
  }
  return [...seen];
}

/** 남은 시간으로 이번 호출 옵션을 만든다. 0 이하면 null(=데드라인 초과). */
function callOptions(deadline: number, now: () => number): { timeout: number; retry: false } | null {
  const remaining = deadline - now();
  if (remaining <= 0) return null;
  return { timeout: Math.min(PER_CALL_TIMEOUT_CAP_MS, remaining), retry: false };
}

interface SheetMeta {
  name?: string | null;
  mimeType?: string | null;
  trashed?: boolean | null;
  parents?: string[] | null;
}

async function getSheetMeta(
  drive: MinimalDrive,
  sheetId: string,
  opts: { timeout: number; retry: false } | null,
): Promise<{ ok: true; meta: SheetMeta } | { ok: false; code: Code } | { ok: false; code: "deadline" }> {
  if (!opts) return { ok: false, code: null };
  try {
    const res = await drive.files.get({
      fileId: sheetId,
      fields: "id, name, mimeType, trashed, parents, driveId",
      supportsAllDrives: true,
    }, opts);
    const d = res.data ?? {};
    const parents = Array.isArray(d.parents)
      ? (d.parents as unknown[]).filter((p): p is string => typeof p === "string")
      : [];
    return {
      ok: true,
      meta: {
        name: typeof d.name === "string" ? d.name : null,
        mimeType: typeof d.mimeType === "string" ? d.mimeType : null,
        trashed: typeof d.trashed === "boolean" ? d.trashed : null,
        parents,
      },
    };
  } catch (e) {
    return { ok: false, code: toCode(e) };
  }
}

/** 단일 시트 메타가 부모 확정 자격이 있는가. MIME·미삭제·유일부모를 함께 본다. */
function singleParentOf(meta: SheetMeta): { ok: true; parentId: string } | { ok: false; empty: boolean } {
  if (meta.mimeType !== SPREADSHEET_MIME) return { ok: false, empty: false };
  if (meta.trashed === true) return { ok: false, empty: false };
  const uniq = uniqueParents(meta.parents);
  // 원본 parents 에 유효 id 가 2개 이상이면 추측 금지. 빈값·무효값만 있으면 empty.
  const rawCount = Array.isArray(meta.parents)
    ? new Set(meta.parents.filter((p): p is string => typeof p === "string").map((p) => p.trim()).filter(Boolean)).size
    : 0;
  if (uniq.length === 1 && rawCount === 1) return { ok: true, parentId: uniq[0]! };
  if (uniq.length === 0 && rawCount === 0) return { ok: false, empty: true };
  return { ok: false, empty: false };
}

/**
 * 등록 시트 1개의 유일 부모를 확정한다. SA 우선, parents 누락 시에만 admin READ 1회.
 * 임의 sheetId 를 admin 조회에 쓸 수 없도록 sheetId 는 호출부가 준 등록값 그대로만 쓴다.
 */
async function resolveParentId(
  spreadsheetId: string,
  saDrive: MinimalDrive,
  deps: DiscoverDeps,
  deadline: number,
  now: () => number,
): Promise<
  | { ok: true; parentId: string; source: "sa" | "admin" }
  | { ok: false; reason: DiscoveryReason }
> {
  if (!isSafeDriveId(spreadsheetId)) return { ok: false, reason: "parent_metadata_unavailable" };
  const saOpts = callOptions(deadline, now);
  if (!saOpts) return { ok: false, reason: "retryable" };
  const sa = await getSheetMeta(saDrive, spreadsheetId, saOpts);
  if (!sa.ok) {
    if (sa.code === 404) return { ok: false, reason: "sheet_not_found" };
    if (sa.code === 403) return { ok: false, reason: "parent_metadata_unavailable" };
    if (sa.code === "deadline") return { ok: false, reason: "retryable" };
    if (isRetryableCode(sa.code)) return { ok: false, reason: "retryable" };
    return { ok: false, reason: "parent_metadata_unavailable" };
  }
  const single = singleParentOf(sa.meta);
  if (single.ok) return { ok: true, parentId: single.parentId, source: "sa" };
  if (!single.empty) return { ok: false, reason: "parent_metadata_unavailable" };

  // SA 는 시트를 보지만 parents 를 가림 → 등록 시트 1개에 한해 admin READ 폴백.
  if (deps.adminDrive === null) return { ok: false, reason: "parent_metadata_unavailable" };
  let admin: MinimalDrive;
  try {
    admin = deps.adminDrive ?? deps.getAdminDrive?.() ?? defaultAdminDrive();
  } catch {
    // 토큰 미설정 등 구성 오류 — 원문 없이 안내만(공유 탓 아님).
    return { ok: false, reason: "parent_metadata_unavailable" };
  }
  const adminOpts = callOptions(deadline, now);
  if (!adminOpts) return { ok: false, reason: "retryable" };
  let ag: { ok: true; meta: SheetMeta } | { ok: false; code: Code | "deadline" };
  try {
    ag = await getSheetMeta(admin, spreadsheetId, adminOpts);
  } catch {
    return { ok: false, reason: "parent_metadata_unavailable" };
  }
  if (!ag.ok) {
    if (ag.code === 404) return { ok: false, reason: "sheet_not_found" };
    if (ag.code === "deadline") return { ok: false, reason: "retryable" };
    if (isRetryableCode(ag.code)) return { ok: false, reason: "retryable" };
    // 403 포함 그 외 OAuth·권한 실패 — 원문 없이 안내만(공유 탓 아님).
    return { ok: false, reason: "parent_metadata_unavailable" };
  }
  const aSingle = singleParentOf(ag.meta);
  if (!aSingle.ok) return { ok: false, reason: "parent_metadata_unavailable" };
  return { ok: true, parentId: aSingle.parentId, source: "admin" };
}

interface ChildEntry {
  id: string;
  name: string;
  mimeType?: string | null;
  trashed?: boolean | null;
  parents?: string[] | null;
}

async function listDirectChildren(
  saDrive: MinimalDrive,
  parentId: string,
  deadline: number,
  now: () => number,
  maxPages: number,
): Promise<
  | { ok: true; files: ChildEntry[] }
  | { ok: false; reason: DiscoveryReason }
> {
  if (!isSafeDriveId(parentId)) return { ok: false, reason: "parent_metadata_unavailable" };
  const out: ChildEntry[] = [];
  const seenTokens = new Set<string>();
  let pageToken: string | undefined = undefined;
  for (let page = 0; page < maxPages; page++) {
    const opts = callOptions(deadline, now);
    if (!opts) return { ok: false, reason: "retryable" };
    let data: {
      files?: unknown[];
      nextPageToken?: string | null;
      incompleteSearch?: boolean | null;
    };
    try {
      // 부모 범위 쿼리만 사용. corpora·driveId 를 절대 넘기지 않는다
      // (공유 드라이브 전체 탐색 금지 — 다른 학생 동명 폴더 혼입 방지).
      const res = await saDrive.files.list({
        q:
          `name contains '${FEEDBACK_PREFIX}' ` +
          `and mimeType = '${FOLDER_MIME}' ` +
          `and '${escapeQId(parentId)}' in parents ` +
          `and trashed = false`,
        fields: "nextPageToken, incompleteSearch, files(id, name, mimeType, trashed, parents)",
        pageSize: 100,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        ...(pageToken ? { pageToken } : {}),
      }, opts);
      data = res.data ?? {};
    } catch (e) {
      const code = toCode(e);
      if (code === 403 || code === 404) return { ok: false, reason: "folder_not_shared" };
      if (isRetryableCode(code)) return { ok: false, reason: "retryable" };
      if (code === 401) return { ok: false, reason: "retryable" };
      return { ok: false, reason: "folder_not_shared" };
    }
    // 부분 검색 결과를 유일성 증거로 쓰지 않는다.
    if (data.incompleteSearch === true) return { ok: false, reason: "retryable" };
    const raw = Array.isArray(data.files) ? data.files : [];
    for (const f of raw) {
      const r = f as Record<string, unknown>;
      if (typeof r.id !== "string" || typeof r.name !== "string") continue;
      if (!isSafeDriveId(r.id)) continue;
      if (!r.name.startsWith(FEEDBACK_PREFIX)) continue;
      if (r.mimeType !== undefined && r.mimeType !== null && r.mimeType !== FOLDER_MIME) continue;
      if (r.trashed === true) continue;
      // parents 가 명시돼 있고 확정 부모를 포함하지 않으면 다른 부모의 폴더 → 제외.
      // parents 자체가 없으면(가려짐) 허용 — 부모 범위 쿼리가 관계를 증명한다(실패 실측).
      if (Array.isArray(r.parents)) {
        const ps = (r.parents as unknown[]).filter(
          (p): p is string => typeof p === "string",
        );
        if (ps.length > 0 && !ps.includes(parentId)) continue;
      }
      out.push({
        id: r.id,
        name: r.name,
        mimeType: typeof r.mimeType === "string" ? r.mimeType : null,
        trashed: typeof r.trashed === "boolean" ? r.trashed : null,
        parents: Array.isArray(r.parents)
          ? (r.parents as unknown[]).filter((p): p is string => typeof p === "string")
          : null,
      });
    }
    const next =
      typeof data.nextPageToken === "string" && data.nextPageToken ? data.nextPageToken : "";
    if (!next) return { ok: true, files: out };
    if (seenTokens.has(next)) return { ok: false, reason: "retryable" };
    seenTokens.add(next);
    pageToken = next;
  }
  return { ok: false, reason: "retryable" };
}

async function verifyCandidate(
  saDrive: MinimalDrive,
  folderId: string,
  deadline: number,
  now: () => number,
): Promise<{ ok: true } | { ok: false; reason: DiscoveryReason }> {
  if (!isSafeDriveId(folderId)) return { ok: false, reason: "folder_missing" };
  const getOpts = callOptions(deadline, now);
  if (!getOpts) return { ok: false, reason: "retryable" };
  try {
    const res = await saDrive.files.get({
      fileId: folderId,
      fields: "id, name, mimeType, trashed, parents",
      supportsAllDrives: true,
    }, getOpts);
    const d = res.data ?? {};
    if (d.mimeType !== FOLDER_MIME || d.trashed === true) {
      return { ok: false, reason: "folder_missing" };
    }
    if (typeof d.name !== "string" || !d.name.startsWith(FEEDBACK_PREFIX)) {
      return { ok: false, reason: "folder_missing" };
    }
  } catch (e) {
    const code = toCode(e);
    if (isRetryableCode(code)) return { ok: false, reason: "retryable" };
    // GET 실패(403/404 포함)는 검증된 접근 실패로만 공유 오류를 낸다.
    return { ok: false, reason: "folder_not_shared" };
  }
  const listOpts = callOptions(deadline, now);
  if (!listOpts) return { ok: false, reason: "retryable" };
  try {
    await saDrive.files.list({
      q: `'${escapeQId(folderId)}' in parents and trashed = false`,
      fields: "files(id)",
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    }, listOpts);
  } catch (e) {
    const code = toCode(e);
    if (isRetryableCode(code)) return { ok: false, reason: "retryable" };
    return { ok: false, reason: "folder_not_shared" };
  }
  return { ok: true };
}

/**
 * 등록 spreadsheetId → 피드백 폴더 발견. 성공 시 검증된 폴더만 반환한다.
 * 빈 spreadsheetId 면 Drive 호출 없이 parent_metadata_unavailable.
 */
export async function discoverFeedbackFolder(
  spreadsheetId: string,
  deps: DiscoverDeps = {},
): Promise<DiscoveryResult> {
  const sid = (spreadsheetId ?? "").trim();
  if (!sid || !isSafeDriveId(sid)) {
    logResult({ outcome: "fail", reason: "parent_metadata_unavailable" });
    return fail("parent_metadata_unavailable");
  }
  const now = deps.now ?? Date.now;
  const deadline = now() + (deps.discoveryDeadlineMs ?? DISCOVERY_DEADLINE_MS);
  const maxPages = deps.maxPages ?? MAX_PAGES;
  const saDrive = deps.saDrive ?? defaultSaDrive();

  const parent = await resolveParentId(sid, saDrive, deps, deadline, now);
  if (!parent.ok) {
    logResult({ outcome: "fail", reason: parent.reason });
    return fail(parent.reason);
  }

  const children = await listDirectChildren(saDrive, parent.parentId, deadline, now, maxPages);
  if (!children.ok) {
    logResult({ outcome: "fail", reason: children.reason, source: parent.source });
    return fail(children.reason);
  }
  if (children.files.length === 0) {
    logResult({ outcome: "fail", reason: "folder_missing", source: parent.source });
    return fail("folder_missing");
  }
  if (children.files.length > 1) {
    logResult({
      outcome: "fail",
      reason: "folder_ambiguous",
      source: parent.source,
      candidates: children.files.length,
    });
    return fail("folder_ambiguous");
  }

  const candidate = children.files[0]!;
  const verified = await verifyCandidate(saDrive, candidate.id, deadline, now);
  if (!verified.ok) {
    logResult({ outcome: "fail", reason: verified.reason, source: parent.source });
    return fail(verified.reason);
  }
  logResult({ outcome: "ok", source: parent.source, candidates: 1 });
  return {
    ok: true,
    feedbackFolderId: candidate.id,
    parentId: parent.parentId,
    parentSource: parent.source,
  };
}

/**
 * 저장된 feedbackFolderId 재사용 검증 — SA GET + LIST(page1).
 * 부모 메타에 의존하지 않아 auto 1순위로 쓴다. 실패 사유는 호출부가
 * discovery 로 넘어가기 위한 신호일 뿐, 그대로 지우면 안 된다.
 */
export async function verifySavedFeedbackFolder(
  folderId: string,
  deps: DiscoverDeps = {},
): Promise<{ ok: true } | { ok: false; reason: DiscoveryReason }> {
  const fid = (folderId ?? "").trim();
  if (!fid || !isSafeDriveId(fid)) return { ok: false, reason: "folder_missing" };
  const now = deps.now ?? Date.now;
  const deadline = now() + (deps.verifyDeadlineMs ?? VERIFY_DEADLINE_MS);
  const saDrive = deps.saDrive ?? defaultSaDrive();
  return verifyCandidate(saDrive, fid, deadline, now);
}
