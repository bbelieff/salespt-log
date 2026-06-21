---
slug: db-production-aggregate-write
status: active
created: 2026-06-19
owner: belie
related: 0020-production-metric-ssot-to-db, sheet-structure
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 생산(E)을 DB생산 raw 집계로 자동 기입하고 컨택의 생산 이중입력·불일치 모달을 제거하는 PR1 작업 계획.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: lib/service/db.ts, lib/repo/sales.ts, 컨택 결과모달, 01 영업관리 E
> - **읽고 나면 알 수 있는 것**: 변경 파일, 집계 트리거, 수용 기준
> - **관련 문서**: [ADR-0020](../../decisions/0020-production-metric-ssot-to-db.md)

# PR1 — DB생산 집계쓰기 (생산 E SSOT 이동)

## 스코프
activation redesign 5-PR 묶음의 출발점. DB raw 변경 시 생산(E) 자동 집계·기입 + 컨택 생산 불일치(CrossTabHintModal) 제거. 컨택 생산 스테퍼 UI 제거는 PR2.

## 변경
- `lib/repo/sales.ts`: `batchWriteChannelDailyRows` → F:H 만(생산 E 드롭). `writeProductionCell(sid,date,channel,count)` 추가(E 기입, 편집기간 밖 skip, app-owned overwrite·무가드).
- `lib/service/db.ts`: `productionCountFor`(순수 집계) + `syncProduction`/`oldDateOf`. add/patch/remove 12 함수가 변경된 (채널,날짜) E 재집계.
- 컨택: `ContactResultModals` 불일치/일치 모달 제거(피커만), page.tsx 에서 `useDbProductionCheck`/`dbOverview`/`checkDbAfterSave`/`router` 제거. `_lib/useDbProductionCheck.ts`·`dbProductionCheck.ts` 삭제.
- ADR-0020, sheet-structure.md(E 출처 = DB집계), 단위테스트(productionCountFor).

## 수용 기준
- DB raw 추가/수정/삭제 → 해당 날짜·채널 01 영업관리 E 가 DB합으로 자동 반영(시트 before/after 확인).
- 컨택 어디에서도 DB↔생산 불일치 경고 안 뜸. 컨택 저장은 F:H 만.
- typecheck/lint/structural/unit/doc-drift/size + build + 배포 success + health 200.

## 후속(별도 PR)
- PR2 컨택 경량화(생산 스테퍼 제거) · PR3 현수막 게시 · PR4 직접생산 기간폼 · PR5 비용 넛지.

## Log
- 2026-06-19 구현(feat/db-production-aggregate-write): 집계쓰기 + 컨택 불일치 제거 + ADR-0020.
