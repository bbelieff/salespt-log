---
slug: contact-db-check-reliable
status: active
created: 2026-06-04
owner: belie
related: fix-crosstab-channel-sync
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 컨택탭 생산 저장 후 'DB관리로 가라' 불일치 검사를 모든 저장 경로에서 동일하게 수행하도록 중앙화(과거 registerNewSlot 경로 누락 + dbOverview 미로딩 silent skip 수정).
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/(app)/contact/page.tsx`, `_lib/useDbProductionCheck.ts`(신규)
> - **관련 문서**: [[docs/plans/completed/fix-crosstab-channel-sync]]

# 컨택 DB 일치검사 중앙화 (신뢰성)

## 원인 (전수 확인)
- 생산 메트릭 시트 쓰기 경로 = `handleSave`·`registerNewSlot` 의 saveMetrics 2곳.
- DB 불일치 검사가 `handleSave` 에만 → `registerNewSlot`(미팅 등록 저장)으론 팝업 미표시.
- 검사가 `if (dbOverview.data)` 가드라 미로딩이면 조용히 skip.

## 수정 (중앙화)
- 신규 훅 **`_lib/useDbProductionCheck.ts`**: `dbMismatch`/`dbMatchOk` 상태 + `checkDbAfterSave(dateAtClick, channels)`.
  - dbOverview 미로딩이면 `await refetch()` 로 신선값 확보(skip 금지, 그래도 없으면 `console.warn`).
  - 검사는 *그 저장에 쓰인 channels* 로(draft 전역 아님 — registerNewSlot 은 draftAtClick 스냅샷).
- page: **단일 진입점 `saveMetricsAndCheck(dateAtClick, channels)`** = `saveMetrics.mutateAsync` + `checkDbAfterSave`.
  - `handleSave` → `saveMetricsAndCheck(date, draft)` (인라인 검사 제거).
  - `registerNewSlot` → appendMeeting 성공 후 `saveMetricsAndCheck(date, draftAtClick)`.
- ⚠️ 새 저장 경로도 반드시 `saveMetricsAndCheck` 사용(주석 명시, `saveMetrics.mutateAsync` 직접 호출 금지).
- (removeMeeting·patchMeeting·removeNewSlot·스텝퍼 = 생산 미변경 → 검사 비대상, 미수정.)

## Acceptance Criteria
- [ ] (a)생산만 저장 (b)생산+미팅등록(등록이 마지막 저장) 두 경로 모두 불일치 팝업/일치 긍정모달.
- [ ] /api/db 미로딩이어도 저장 시 refetch 로 검사 보장.
- [ ] removeMeeting/patchMeeting 등 비생산 경로 변화 없음(회귀 0).
- [ ] `npm run check` 통과.

## 범위 밖
- 비생산 경로, 검사 로직 자체(findProductionMismatch) 변경.

## Log
- 2026-06-04 useDbProductionCheck 훅 + saveMetricsAndCheck 단일 진입점. 500줄 캡 위해 훅 분리.
