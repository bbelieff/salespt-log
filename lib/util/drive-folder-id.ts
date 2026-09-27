/**
 * Layer: util (순수 — import 0). 드라이브 폴더 주소 → 폴더 ID.
 *
 * 왜 필요한가: 관리자가 「루트 폴더 ID」 칸에 주소를 통째로 붙여넣으면
 * (`https://drive.google.com/drive/folders/<ID>?usp=drive_link`) 드라이브 검색 조건에
 * 주소가 그대로 들어가 전원 「File not found」로 실패했다(2026-09-28 12기 생성).
 * 주소든 ID 든 받아서 ID 만 돌려준다. 못 알아보면 입력값을 그대로 돌려준다
 * (호출 측 동작을 바꾸지 않기 위해 — 빈 문자열이면 빈 문자열).
 */
export function extractDriveFolderId(input: string): string {
  const trimmed = input.trim();
  const m = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/) ?? trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m ? m[1]! : trimmed;
}
