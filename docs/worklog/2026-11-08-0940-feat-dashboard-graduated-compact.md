> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 수료 뒤 진행바 빼기 · 오늘 챙길 일 표 촘촘히 · 오늘 활동 카드 위치·현수막 대량 입력.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: 대시보드 · DB 목록
> - **관련 문서**: [계획](../plans/completed/dashboard-graduated-compact.md)

# 2026-11-08 feat: 대시보드·오늘 활동 다듬기

- 브랜치 feat/dashboard-graduated-compact. 담당 파일: components/dashboard/{DashboardProgressBanner.tsx,DashboardFollowUpsView.tsx,followups-table.css} · app/(app)/db-sheet/{db-sheet.css,_components/TodayActivity.tsx} · tests(course-banner, today-activity) · components.md.
- 결정: belie 2026-11-08 채팅 요청 4건 + 「바로운영반영」.
- 검증: 위 시험 + check.sh + CI. 운영은 배포 뒤 health·version.
- 위험/복구: 화면만(저장 경로 그대로). 되돌리기 = revert.
