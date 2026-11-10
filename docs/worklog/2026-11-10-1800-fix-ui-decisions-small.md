## 2026-11-10 · UI 결정 3건 (DB 추가 입구 하나 · 주차 추이 이번 주 · 공지 미리보기/기본 꺼짐)

- 브랜치 `fix/ui-decisions-small`. 요청: belie UI 점검 결정 「추천대로」 3건.
- 담당 파일: `app/(app)/db-sheet/page.tsx`·`_components/TodayActivity.tsx`·`_components/SupplierSummary.tsx`, `components/dashboard/WeeklyDualChart.tsx`·`app/(app)/dashboard/page.tsx`, `app/admin/popup/_components/NoticeManager.tsx`, 시험 5개, `docs/design/components.md`.
- 변경: ① 「오늘 활동」·공급처 성과 창의 중복 DB 추가 버튼 제거(같은 가져오기 창) — 목록 위 버튼 + 빈 목록 안내만. ② 주차 추이 이번 주 brand-red·「이번 주」, 미래 주 점선 빈 칸·선 끊김, 「N주차까지 계약 M건」. ③ 공지 「미리보기」(수강생 팝업 그대로, 저장 없음), 새 공지 기본 꺼짐 + 「켜기/끄기」.
- 검증: tsc 통과, vitest 관련 18파일 통과(새 2파일 7건). check.sh·build·실제 화면 NOT_RUN(총괄이 직렬 실행).
- 계획: [ui-decisions-small](../plans/completed/ui-decisions-small.md)
- 위험/복구: 화면만, revert 1건. 운영 데이터·서버 계약 변경 없음.
