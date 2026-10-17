---
slug: db-sheet-status-view-chips-r1
status: active
created: 2026-10-16
worktree: C:/Users/belie/Desktop/Belief/클로드/wt/codex-db-sheet-status-view-chips-r1
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: DB관리시트 상태 필터 칩 5개의 승인 범위와 PR HOLD까지의 검증 계획.
> - **누가 읽나요**: 구현 작업원 B, 독립 검수자 E, Foreman.
> - **어떤 기능·작업과 연결?**: DB관리시트의 클라이언트 목록 필터.
> - **읽고 나면 알 수 있는 것**: 상태 선택 규칙, 정확한 변경 범위, 검증 상태와 복구 방법.
> - **관련 문서**: [AGENTS](../../../AGENTS.md), [제품 규칙](../../../CLAUDE.md).

# DB관리시트 상태 필터 칩

WORK-ID: SALES-PT-DB-SHEET-STATUS-VIEW-CHIPS-R1. 사용자 승인 요청을 받아 B가 구현하고 E가 독립 검수한다. 기준 master는 400d637a4656f9af6b87b59a655f017592fbdd44, 브랜치는 codex/db-sheet-status-view-chips-r1이다. 이번 결과는 non-draft PR HOLD까지이며 최종 exact-tree 검수와 Foreman 직렬 release 전에는 merge/deploy하지 않는다.

## 승인 동작

- 상단 칩은 미컨택 / 부재 / 단순거절 / 재통화 / 컨택진행(미팅·거절) 5개다.
- 각 칩은 독립 토글이다. 1~4개 선택은 선택 결과를 OR로 표시한다. 0개 또는 5개 선택은 상태 제한 없이 전체를 표시하며 unknown 결과도 포함한다.
- 마지막 칩은 result의 컨택진행·상담 후 거절만 포함한다. stage는 필터 기준이 아니다.
- 기존 검색·공급처·유입일 필터와 AND로 결합한다. 초기화는 상태 선택과 기존 필터를 함께 해제한다.
- 정렬·행 식별자·하단 건수·상세/편집·dirty 저장 큐는 기존 흐름을 유지한다. 필터는 원본 행을 수정하거나 중복·삭제하지 않는다.
- user-data-write=0. DB/Sheet/API/인증/파서/모델/공용 타입·유틸/서비스 변경과 운영 고객 편집은 범위 밖이다.

## 정확한 파일 lease

1. app/(app)/db-sheet/page.tsx
2. app/(app)/db-sheet/db-sheet.css
3. app/(app)/db-sheet/_components/status-filter.ts
4. tests/components/db-sheet-status-filter.test.ts
5. tests/browser/db-sheet-status-view-chips/App.tsx
6. tests/browser/db-sheet-status-view-chips/server.mjs
7. tests/browser/db-sheet-status-view-chips/verify.mjs
8. docs/plans/active/db-sheet-status-view-chips-r1.md

docs/worklog.md 및 다른 plan은 lease에 포함하지 않는다. #1158/#1136/#798, 타인/Claude worktree와 다른 작업원의 backend·weekly UI lane은 보존한다. helper=NONE.

## 수용 기준과 검증 상태

- PASS: RED는 helper import 부재로 실패. GREEN은 32개 선택 조합·unknown 결과·기존 필터 AND·원본 순서/객체 보존·reset을 포함해 35/35다.
- PASS: 합성 전용 최소 fixture가 production 순수 helper와 CSS를 사용하여 PC 1280, 모바일 320/375/430을 실제 Chrome에서 렌더했다. PC 1줄, 모바일 2줄 wrap, 모바일 최소 높이 44px, 가로 overflow 0, 쓰기 요청 0이다. aria-pressed/group, Space 키, 체크 표시, loading/error/empty도 통과했다. 전체 인증 앱이나 운영 고객 데이터 검증을 뜻하지 않는다.
- PASS: 이전 후보의 typecheck. 전체 check는 resource gate로 중단되기 전 typecheck/lint/구조94가 통과했으며 전체 단위·통합 완료 증거는 아니다.
- PASS: current master 반영 시 원래 7개 경로의 SHA256이 체크포인트와 7/7 동일하다. focused/render 증거는 이 바이트 동일성에 한해 재사용한다. E의 독립 판정은 PASS_PRECOMMIT이며 최종 commit/tree 검수는 남아 있다.
- PENDING: 새 plan 내용 독립 확인, 정확히 8개 경로·diff-check·secret/고위험 개인정보 검사.
- PENDING: VITEST_MIN/MAX_THREADS=1 및 VITEST_MIN/MAX_FORKS=1을 적용한 정상 pre-commit commit 1회. 우회하지 않으며 실패하면 재시도 없이 반환한다.
- NOT_RUN: process-local bundled Node 24.19.0의 정상 production build 1회. hook PASS 이후에만 순차 실행하며 실패 시 중단한다.
- NOT_RUN: push, non-draft PR HOLD, 해당 head CI/security, E 최종 exact-tree review. 성공/미실행 상태는 실제 결과를 PR과 RESULT에 보고한다.

## 복구와 전달

현재 7개 후보는 d0393171 기준 repo 밖 recovery patch와 SHA-bound stash로 보존했다. current master 전진·복원 시 충돌은 없었다. 향후 배포된 변경을 되돌릴 때는 해당 squash commit을 revert하고 정상 재배포·health를 확인한다. 이 기능의 선택 상태는 클라이언트 메모리뿐이며 운영 데이터 migration/rollback은 없다.

PR HOLD 결과에는 head/tree, 8개 파일 hash, hook/build/CI/security 상태, 재사용한 비식별 화면 증거와 남은 검수를 포함한다. 사용자 데이터 쓰기 및 운영 변경은 0을 유지한다.
