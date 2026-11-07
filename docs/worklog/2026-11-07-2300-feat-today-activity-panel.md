> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: DB 목록에 「오늘 활동」 반쪽 패널(일별 기록을 옆으로).
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: DB 목록 화면
> - **관련 문서**: [계획](../plans/completed/today-activity-panel.md)

# 2026-11-07 feat: 오늘 활동 패널

- 브랜치 feat/today-activity-panel(#1359 위). 담당 파일: app/(app)/db-sheet/{page.tsx,db-sheet.css,_components/TodayActivity.tsx} · tests/components/today-activity.test.ts · docs/design/components.md.
- 결정: belie 2026-11-07 목업 0-v2·B안 + 「DB 등록 중심」 워크플로 — 손 입력은 현수막 게시만.
- 검증: 위 시험 + 합성 화면 PC·폰. 운영은 배포 뒤 확인.
- 위험/복구: 저장은 기존 일별 기록 API(현수막 줄만). 되돌리기 = revert.
