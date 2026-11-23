/**
 * Layer: repo — 사업계획서 공식 빌더 폴더(관리자 구글 드라이브) 읽기 전용.
 * 관리자 OAuth(driveCreatorClient, ADR-0015)로 목록과 파일 내용만 읽는다. 쓰기·공유 변경 없음.
 */
import { driveCreatorClient } from "./drive-client";

export type KitDriveFile = { id: string; name: string; mimeType: string; modifiedTime: string; size: number };

export async function listKitFolder(folderId: string): Promise<KitDriveFile[]> {
  const res = await driveCreatorClient().files.list({
    q: `'${folderId.replace(/'/g, "\'")}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, modifiedTime, size)",
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return (res.data.files ?? []).map((f) => ({
    id: f.id ?? "",
    name: f.name ?? "",
    mimeType: f.mimeType ?? "",
    modifiedTime: f.modifiedTime ?? "",
    size: Number(f.size ?? 0),
  })).filter((f) => f.id && f.name);
}

export async function downloadKitFile(fileId: string): Promise<Uint8Array> {
  const res = await driveCreatorClient().files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );
  return new Uint8Array(res.data as ArrayBuffer);
}
