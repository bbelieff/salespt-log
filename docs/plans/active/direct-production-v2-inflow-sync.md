---
slug: direct-production-v2-inflow-sync
status: active
created: 2026-06-22
owner: belie
related: 0020-production-metric-ssot-to-db, 0022-direct-production-period-twostage, 0024-direct-production-inflow-sync
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 직접생산은 기간·예산만 적고, 컨택 유입을 저장하면 그 기간의 생산개수(M)·생산(E)이 자동 집계되도록 전환.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: contact/page.tsx·ChannelTabsAndPanel, db/page.tsx·channels.ts, lib/service/contact.ts·db.ts, lib/repo/sales.ts·db.ts
> - **관련 문서**: [[docs/decisions/0024-direct-production-inflow-sync]], ADR-0020(직접생산 한정 supersede), ADR-0022

# feat — 직접생산 DB↔컨택 연동 v2 (유입 = 생산수 자동 카운트)

## 데이터 (03 DB관리 직접생산 I:O 컬럼 불변)
- M(생산개수)을 **시스템 동기화값**으로 전환(사용자 입력 제거). 개당단가=L÷M 계산(미저장).
- 새 컬럼 없음. 기존 행 M 보존(마이그레이션 안 함).

## 동기화 (컨택 유입 저장 시, 직접생산)
1. **E=유입 미러**: `batchWriteChannelDailyRows` 가 직접생산 채널은 E=F(유입) 도 기록(현재 F:H만).
   DB집계 쪽 `syncProduction(직접생산)` 제거(이중쓰기 방지). `productionCountFor` 직접생산 미사용(함수는 유지·타 채널 사용).
2. **M 동기화**: 유입 저장 후, 그 날짜 D 를 포함하는 활성 직접생산 레코드 R(시작≤D≤종료, 겹침금지로 유일)을
   찾아 `R.M = Σ(영업관리 F 직접생산, R 기간)` 으로 **M 셀만** 타겟 update. 유입− 대칭(재계산).
3. **활성 레코드 없음**(기간 밖) → 유입은 저장(E=F 미러) + 보류 + 모달 "진행 중 생산 없음 — DB생산에서 생산목록 먼저 추가" [DB생산으로 가기]/[화면 유지].

## 생산목록 추가 (DB생산)
- 입력 = 시작일·종료일·소재·기간예산(+부가세). 생산개수 입력칸 제거(자동).
- 저장 시 기존 기간과 겹치면 차단(겹침 금지 검증 — 활성 레코드 유일성 보장).
- 저장 후 안내 팝업: "컨택관리에서 유입 +입력·저장하면 생산개수 자동 카운트" [컨택관리로 가기]/[화면 유지].

## 컨택 직접생산 첫 행 (읽기전용)
- 활성 레코드 있으면 "진행중 · 생산 #N(소재) 시작~종료 [DB생산 링크]" + 생산수(=Σ기간유입, 오늘 draft 라이브 반영).
- 없으면 "진행 중 생산 없음".
- 오늘합계 칸은 헤더+첫행 세로 병합(rowSpan 효과)으로 실제 병합 표시(빈칸 제거).

## 수용 기준 (배포 후 belie 클릭)
- 기간내 유입+ → 생산수·개당단가 자동, 유입− 대칭, 기간밖 보류 모달, 겹침 차단,
  E=유입 단일기록(이중X), 기존 직접생산 행 영향 없음.
- typecheck/lint/test/doc-drift 통과 + build + 배포 + health 200.

## Log
- 2026-06-22 구현(feat/direct-production-v2-inflow-sync): ADR-0024 작성 + 유입→M/E 동기화 + 겹침금지 + UI.
