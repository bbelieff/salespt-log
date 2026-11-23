/**
 * 사업계획서 작성도구 — 공식 빌더·양식 고르기와 내려받기(docs/plans/active/bizplan-tool.md, ADR-0039).
 *
 * - 쓸 수 있는 사람: 경영일지 이용자 모두(관리자·활성 트레이너·승인된 수강생). 승인 대기·미등록은 안 된다.
 * - 폴더 안에서 고르는 규칙(pickKit): 빌더 = 이름 v 번호가 가장 큰 .md, 양식 = 이름에 「현장클리닉」·「인터뷰」가 든 .docx 중 최신.
 * - 드라이브 호출을 줄이려고 목록 1분, 파일 내용 10분 기억한다(파일이 바뀌면 수정 시각이 달라져 새로 읽는다).
 */
import { getEffectiveRole, isAdminEmail } from "@/auth/identity";
import { findUserByEmail } from "@/repo/users";
import { downloadKitFile, listKitFolder, type KitDriveFile } from "@/repo/bizplan-kit";
import { BIZPLAN_KIT_FILE_MAX_BYTES, bizplanKitFolderId, type BizplanKitKind } from "@/config/bizplan";

export type KitFileInfo = { name: string; version: string; updatedAt: string; size: number };
export type BizplanKitInfo = {
  ready: boolean;
  builder: KitFileInfo | null;
  clinic: KitFileInfo | null;
  interview: KitFileInfo | null;
  /** 관리자에게만 — 새 판을 올릴 폴더 주소. */
  folderUrl?: string;
};

export class BizplanKitError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "BizplanKitError";
  }
}

/** "빌더_v4.8_2in1.md" → [4, 8]. 번호가 없으면 []. */
export function versionOf(name: string): number[] {
  const m = name.match(/v(\d+(?:\.\d+)*)/i);
  return m ? m[1]!.split(".").map(Number) : [];
}

function compareVersion(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? -1) - (b[i] ?? -1);
    if (d) return d;
  }
  return 0;
}

const newest = (a: KitDriveFile, b: KitDriveFile) => b.modifiedTime.localeCompare(a.modifiedTime);

/** 폴더 목록 → 종류별 최신 파일. 임시 파일(~$, .으로 시작)은 뺀다. */
export function pickKit(files: KitDriveFile[]): Record<BizplanKitKind, KitDriveFile | null> {
  const usable = files.filter((f) => !/^(~\$|\.)/.test(f.name));
  const lower = (f: KitDriveFile) => f.name.toLowerCase();
  const builders = usable
    .filter((f) => lower(f).endsWith(".md"))
    .sort((a, b) => compareVersion(versionOf(b.name), versionOf(a.name)) || newest(a, b));
  const docx = usable.filter((f) => lower(f).endsWith(".docx")).sort(newest);
  return {
    builder: builders[0] ?? null,
    clinic: docx.find((f) => f.name.includes("현장클리닉")) ?? null,
    interview: docx.find((f) => f.name.includes("인터뷰")) ?? null,
  };
}

/** 경영일지 이용자인가 — 관리자, 활성 트레이너, 승인된(대기 아님) 수강생. */
export async function canUseBizplan(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  if (isAdminEmail(email)) return true;
  const role = await getEffectiveRole(email);
  if (role.role === "trainer") return role.status === "active";
  const user = await findUserByEmail(email);
  return !!user && user.status !== "pending";
}

let listCache: { at: number; files: KitDriveFile[] } | null = null;
const fileCache = new Map<string, { at: number; bytes: Uint8Array }>();
const LIST_TTL = 60_000;
const FILE_TTL = 10 * 60_000;

async function kitFiles(): Promise<KitDriveFile[]> {
  if (listCache && Date.now() - listCache.at < LIST_TTL) return listCache.files;
  const files = await listKitFolder(bizplanKitFolderId());
  listCache = { at: Date.now(), files };
  return files;
}

const info = (f: KitDriveFile | null): KitFileInfo | null =>
  f ? { name: f.name, version: versionOf(f.name).join("."), updatedAt: f.modifiedTime, size: f.size } : null;

export async function getBizplanKitInfo(email: string): Promise<BizplanKitInfo> {
  let picked: Record<BizplanKitKind, KitDriveFile | null>;
  try {
    picked = pickKit(await kitFiles());
  } catch (e) {
    // 폴더를 못 읽음(공유 안 됨·토큰 없음) — 화면은 「공식 빌더 준비 중」으로 계속 쓸 수 있게 한다.
    console.warn("[bizplan-kit] list failed", e instanceof Error ? e.message : "unknown");
    picked = { builder: null, clinic: null, interview: null };
  }
  const out: BizplanKitInfo = {
    ready: !!picked.builder,
    builder: info(picked.builder),
    clinic: info(picked.clinic),
    interview: info(picked.interview),
  };
  if (isAdminEmail(email)) out.folderUrl = `https://drive.google.com/drive/folders/${encodeURIComponent(bizplanKitFolderId())}`;
  return out;
}

export async function getBizplanKitFile(kind: BizplanKitKind): Promise<{ name: string; mimeType: string; bytes: Uint8Array }> {
  const f = pickKit(await kitFiles())[kind];
  if (!f) throw new BizplanKitError("아직 준비된 파일이 없어요.", 404);
  if (f.size > BIZPLAN_KIT_FILE_MAX_BYTES) throw new BizplanKitError("파일이 너무 커요.", 413);
  const key = `${f.id}:${f.modifiedTime}`;
  const hit = fileCache.get(key);
  if (hit && Date.now() - hit.at < FILE_TTL) return { name: f.name, mimeType: f.mimeType, bytes: hit.bytes };
  const bytes = await downloadKitFile(f.id);
  for (const k of fileCache.keys()) if (k.startsWith(`${f.id}:`)) fileCache.delete(k);
  fileCache.set(key, { at: Date.now(), bytes });
  return { name: f.name, mimeType: f.mimeType || "application/octet-stream", bytes };
}
