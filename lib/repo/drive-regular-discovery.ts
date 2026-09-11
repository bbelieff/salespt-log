/** Regular auto only: read-only, bounded parent queries; names never prove ownership. */
import type { drive_v3 } from "googleapis";
import { driveClient } from "@/repo/drive-client";

const FOLDER = "application/vnd.google-apps.folder";
const SHEET = "application/vnd.google-apps.spreadsheet";
const MAX_PERSONAL_FOLDERS = 50;
const MAX_CHILDREN = 1000;

export type RegularDiscoveryResult =
  | { ok: true; feedbackFolderId: string; parentId: string }
  | { ok: false; reason: "not_found" | "ambiguous" | "incomplete" };

/** One page only. Partial/error responses are not evidence of uniqueness. */
async function listChildren(
  parentId: string, foldersOnly: boolean, limit: number, deadline: number,
): Promise<drive_v3.Schema$File[] | null> {
  const remaining = deadline - Date.now();
  if (remaining <= 0 || !/^[a-zA-Z0-9_-]+$/.test(parentId)) return null;
  try {
    const res = await driveClient().files.list({
      q: `'${parentId}' in parents and trashed = false and ` +
        (foldersOnly ? `mimeType = '${FOLDER}'` : `(mimeType = '${FOLDER}' or mimeType = '${SHEET}')`),
      fields: "nextPageToken,incompleteSearch,files(id,name,mimeType)",
      pageSize: Math.min(limit + 1, MAX_CHILDREN),
      supportsAllDrives: true, includeItemsFromAllDrives: true,
    }, { timeout: Math.min(5000, remaining), retry: false });
    if (Date.now() >= deadline) return null;
    const files = res.data.files ?? [];
    if (res.data.nextPageToken || res.data.incompleteSearch || files.length > limit) return null;
    if (files.some((f) => !f.id || !/^[a-zA-Z0-9_-]+$/.test(f.id) ||
      ![FOLDER, SHEET].includes(f.mimeType ?? "") ||
      (f.mimeType === FOLDER && typeof f.name !== "string"))) return null;
    return files;
  } catch {
    // No remote names/IDs/error payloads in logs or API responses.
    return null;
  }
}

function pickFeedback(files: drive_v3.Schema$File[], parentId: string): RegularDiscoveryResult {
  const candidates = files.filter((f) => f.id && f.mimeType === FOLDER && f.name?.startsWith("01"));
  if (!candidates.length) return { ok: false, reason: "not_found" };
  if (candidates.length !== 1) return { ok: false, reason: "ambiguous" };
  return { ok: true, parentId, feedbackFolderId: candidates[0]!.id! };
}

/** Existing sheet-parent metadata is ownership proof; require one feedback candidate. */
export async function findRegularFeedbackInParent(parentId: string): Promise<RegularDiscoveryResult> {
  const children = await listChildren(parentId, true, MAX_CHILDREN, Date.now() + 5000);
  return children ? pickFeedback(children, parentId) : { ok: false, reason: "incomplete" };
}

/** Scan only root's direct personal folders; prove the exact registry spreadsheet is inside. */
export async function discoverRegularFeedbackFolder(
  spreadsheetId: string,
  rootFolderId: string,
): Promise<RegularDiscoveryResult> {
  const deadline = Date.now() + 15_000;
  const folders = await listChildren(rootFolderId, true, MAX_PERSONAL_FOLDERS, deadline);
  if (!folders) return { ok: false, reason: "incomplete" };
  const owners: { parentId: string; children: drive_v3.Schema$File[] }[] = [];
  for (const folder of folders) {
    if (!folder.id || folder.mimeType !== FOLDER) continue;
    const children = await listChildren(folder.id, false, MAX_CHILDREN, deadline);
    if (!children) return { ok: false, reason: "incomplete" };
    if (children.some((f) => f.id === spreadsheetId && f.mimeType === SHEET)) {
      owners.push({ parentId: folder.id, children });
    }
  }
  if (owners.length > 1) return { ok: false, reason: "ambiguous" };
  const owner = owners[0];
  return owner ? pickFeedback(owner.children, owner.parentId) : { ok: false, reason: "not_found" };
}
