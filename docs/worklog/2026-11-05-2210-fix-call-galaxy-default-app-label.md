## 2026-11-05 · 통화 정리 PR-12 — 실제 갤럭시 메뉴 이름
- fix/call-galaxy-default-app-label(master 위). belie 「갤럭시 폰 없음, 알아서 테스트」 → 삼성 Remote Test Lab 실기기(갤럭시 A27, One UI 8.5, 한국어)로 가상 데이터 시험 화면 점검(로그인·실데이터 없음).
- 발견: 기본 전화 앱 바꾸는 메뉴가 실기기에서 「기본 앱 선택」 → 안내 문구 수정.
- 확인됨: 📞→기본 전화 앱 번호 채워 열림, 복귀 시 녹음 올리기 안내, 안드로이드 파일 고르기(내 파일·최근 파일), .txt 번호 맞춤, 첫 업로드 고지, 확인 화면·키보드.
- 남은 위험: 파일 고르기 때 Chrome 의 「오디오 녹음 허용?」 질문(안드로이드 Chrome 공통 동작, 거부해도 진행). 실제 통화 녹음 폴더 생성·삼성 인터넷은 미확인.
- 담당 파일: `app/(app)/db-sheet/_components/call-client.ts`, `tests/components/db-sheet-call-front.test.ts`, [plan](../plans/active/call-summary.md).
- 되돌리기 = squash revert.
