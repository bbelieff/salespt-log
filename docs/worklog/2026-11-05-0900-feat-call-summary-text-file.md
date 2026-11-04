## 2026-11-05 · 통화 정리 PR-7 — 받아쓴 통화 내용 .txt·.pdf 올리기
- feat/call-summary-text-file. belie: 「통화내용도 .txt, .pdf로 저장할 수 있기때문에 이걸 업로드할 수 있게」 + 「통화 글자」 문구가 무슨 말인지 모름.
- 담당 파일: `app/(app)/db-sheet/_components/{call-client.ts,CallUploadDialog.tsx}`, `lib/service/call-summary.ts`(오류 문구 1줄), components.md, 시험, 합성 화면 서버(가상 PDF·pdf.js 작업 파일), [plan](../plans/active/call-summary.md). 선행: PR-6(#1313) 병합·배포.
- 방식: 폰 안에서 글만 뽑아 기존 글자 경로로 — 서버·AI·DB 변경 없음. PDF 는 서류 읽기의 `readPdfTextLayer` 재사용(앞 10쪽, 스캔본 불가).
- 확인: 시험 + 합성 화면에서 가상 PDF 를 실제 pdf.js 로 읽어 보낸 본문 확인. 미확인: 익시오·에이닷 실제 파일.
- 되돌리기 = squash revert.
