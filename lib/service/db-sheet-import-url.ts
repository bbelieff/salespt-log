/** 구글시트 공유 주소 가져오기(2026-10-24) — 라우트는 이 서비스만 부른다. 내려받기는 저장소 계층(repo). */
import { fetchGoogleSheetCsv, GoogleSheetImportError } from "@/repo/google-sheet-export";

export { GoogleSheetImportError };
export async function loadGoogleSheetImportText(shareUrl: string): Promise<string> {
  return fetchGoogleSheetCsv(shareUrl);
}
