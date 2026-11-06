> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: DB 가져오기 창에 「구글시트 연동」 칸·연결 중 표시·「자동 확인만 연결」을 더한 기록.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: DB관리시트 가져오기(ImportDialog) · DB 시트 자동 확인
> - **관련 문서**: [계획](../plans/completed/db-sheet-feed-connect-only.md) · [자동 확인 계획](../plans/active/db-sheet-feed.md)

# 2026-11-07 feat(db-sheet): 가져오기 창 구글시트 연동 칸 · 자동 확인만 연결

- 계기: 수강생 화면 「DB는 추가했지만 자동 확인은 연결하지 못했어요」 — 운영 DB에 0016(db_sheet_feeds)·0017(push slot dbfeed) 미적용이 원인. belie 승인으로 2026-11-06 적용(표 생성·제약 확인).
  이미 다 들어온 시트는 새 DB 0건이라 다시 연결할 길이 없어 이 변경.
- 담당 파일: app/(app)/db-sheet/_components/ImportDialog.tsx · adaptive-import.css · app/(app)/db-sheet/page.tsx(feeds 전달) · tests/components/db-sheet-feed-ui.test.ts.
- 서버·API 변경 없음(기존 connect 그대로, 연결 시 지금 줄은 seen 처리).
- 확인: 합성 화면 PC(첫 화면·연결 중 칸·0건 자동 확인만 연결·연결된 시트 배치)·375px. vitest 10/10.
- 위험/복구: 화면만. 되돌리기 = revert. 교훈: 새 migration 이 든 기능은 병합 뒤 운영 apply 를 따로 확인.
