> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: STEP 1.5 DB관리시트 + STEP 2 컨택관리 → STEP 2 DB관리(DB 목록 · 일별 기록)로 이름·메뉴를 합친 기록.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: 메뉴(TabBar·DesktopNav), DB 목록, 일별 기록, 대시보드 오늘 챙길 일
> - **관련 문서**: [ADR-0037](../decisions/0037-step2-db-management.md) · [계획](../plans/completed/step2-db-management.md)

# 2026-11-07 feat(nav): STEP 2 = DB관리 (1.5·2 통합 1차)

- belie 「일별 기록, 컨택 전/컨택 완료로 가자」. 주소 그대로.
- 담당 파일: components/TabBar.tsx · components/desktop/DesktopNav.tsx · components/DbManagementTabs.tsx(신규) · components/ui/StepBadge.tsx · app/(app)/db-sheet/page.tsx · app/(app)/contact/page.tsx · app/(app)/db/page.tsx · lib/analytics/db-import/model.ts · lib/analytics/dashboard-follow-ups.ts · components/dashboard/* · lib/service/db-sheet.ts · app/api/db-sheet/route.ts · lib/query/db-sheet-hooks.ts · 문구 파일들(db-sheet 대화상자·contact·api daily·trash·badge) · 시험 · ADR-0037 · components.md.
- 계산·저장 변경 없음(문구·메뉴·표시만). 서버 「지원 안 함」 응답에 code 추가.
- 위험/복구: 화면 이름만. 되돌리기 = revert(데이터 없음). 업무매뉴얼·교안·카페 공지의 옛 이름은 앱 밖 — belie 수정.
