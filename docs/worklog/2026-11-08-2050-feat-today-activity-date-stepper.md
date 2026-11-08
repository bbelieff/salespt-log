> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 오늘 활동 날짜 ‹ › 넘기기.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: DB 목록 「오늘 활동」
> - **관련 문서**: [계획](../plans/completed/today-activity-date-stepper.md)

# 2026-11-08 feat: 오늘 활동 날짜 넘기기

- 브랜치 feat/today-activity-date-stepper. 담당 파일: app/(app)/db-sheet/_components/TodayActivity.tsx · tests/components/today-activity.test.ts · docs/design/components.md.
- 결정: belie 2026-11-08 채팅 「이게 좋겠는데」(‹ › 안).
- 검증: today-activity 시험 7건 + check.sh + CI. 운영은 배포 뒤 health·version.
- 위험/복구: 화면만. 지난 날 현수막 저장은 일별 기록과 같은 API. 되돌리기 = revert.
