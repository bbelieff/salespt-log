/**
 * Layer: repo — 앱 산출물 Drive 업로드 (TXT + 공지 이미지).
 *
 * ① 업체정보 TXT (consultation-log §3-3, ADR-0016): `업체정보_{업체명}.txt` 를
 *    대상 폴더에 **업체당 1본 덮어쓰기**(항상 최신).
 * ② 공지 이미지 (announcement-popup §4): 공지 이미지 폴더에 업로드 +
 *    anyoneWithLink reader → 팝업 MD 에서 핫링크 렌더.
 * 쓰기 자격 = belie OAuth(driveCreatorClient, ADR-0015) — SA 는 파일 생성 불가.
 *
 * files.update 는 이 파일에서만 허용(구조 가드, ADR-0016) — 용도는 앱이 만든
 * text/plain TXT 1본 교체뿐. 시트(스프레드시트) 파일에는 절대 사용하지 않는다.
 */
import { Readable } from "node:stream";
import { noticeImageFolderId } from "@/config";
import { driveCreatorClient } from "./drive-client";

/**
 * 공지 이미지 업로드 (announcement-popup §4) — 공지 이미지 폴더(config 기본값,
 * env NOTICE_IMAGE_FOLDER_ID 오버라이드)에 생성 + anyoneWithLink reader 권한
 * → MD `![](url)` 로 바로 렌더 가능한 URL 반환.
 */
export async function uploadNoticeImage(
  fileName: string,
  mimeType: string,
  data: Buffer,
): Promise<{ fileId: string; url: string }> {
  const drive = driveCreatorClient();
  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [noticeImageFolderId()],
      mimeType,
    },
    media: { mimeType, body: Readable.from(data) },
    fields: "id",
    supportsAllDrives: true,
  });
  const fileId = res.data.id;
  if (!fileId) throw new Error("[drive-txt] 공지 이미지 생성 결과 id 없음");
  await drive.permissions.create({
    fileId,
    requestBody: { type: "anyone", role: "reader" },
    supportsAllDrives: true,
  });
  // lh3 직링크 — uc?export=view 는 redirect 경유로 <img> 임베드가 간헐 실패
  // (e2e 실측 naturalWidth=0). lh3/d/{id} 가 정식 임베드 호스트.
  return { fileId, url: `https://lh3.googleusercontent.com/d/${fileId}` };
}
