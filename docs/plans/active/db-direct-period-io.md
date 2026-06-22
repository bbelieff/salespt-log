---
slug: db-direct-period-io
status: active
created: 2026-06-22
owner: belie
related: 0022-direct-production-period-twostage, 0021-vat-handling-standard, pr-db-channels-full
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 직접생산을 시작일·종료일 + 2단계로 바꾸고 I:O 재배치(개당단가 드롭·부가세여부 N)하는 C1.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: DBProduction, lib/repo/db.ts, lib/service/db.ts, DB관리 직접생산 폼
> - **읽고 나면 알 수 있는 것**: 컬럼 배치·전환·집계·검증
> - **관련 문서**: [ADR-0022](../../decisions/0022-direct-production-period-twostage.md), [정본 §3-A](../../handoff/pr-db-channels-full.md)

# PR-C1 — 직접생산 I:O 재배치 + 기간·2단계

## 스코프
직접생산을 단일 날짜 → 시작일(I)·종료일(J), 2단계(생산 시작→완료), I:O 재배치(개당단가 시트 드롭, 부가세여부 N, 기타 O). 집계=종료일&완료. 예산 ex-VAT(ADR-0021/0022).

## 방식 (전환 안전·lazy)
- read: J(종료일)가 날짜면 신규, 아니면 구 I:N(날짜/소재/예산/생산개수/개당단가/기타) → 시작=종료=날짜로 흡수.
- write: 신규 I:O 기록(개당단가 미저장). 블로킹 마이그레이션 없음(편집 시 점진 이전).
- 예산: 예산입력+부가세토글 → 기간예산(부가세 제외) 저장. 개당단가=예산÷개수 계산.

## 변경
- types: DBProduction 날짜→시작일/종료일, +부가세여부, 개당단가 계산값.
- repo/db.ts: SPEC 직접생산 I:O(수식 없음), 전환 read, append/update 신규 레이아웃.
- service/db.ts: productionCountFor(직접생산)=종료일&완료, dateOfRow·sync=종료일.
- channels/RowForm: 시작일·종료일·예산 역산·부가세토글·생산개수(hideInAdd, 2단계). 편집 시 예산입력 복원.
- RowCard: 직접생산 요약=기간+생산중/완료 배지. page: CHANNEL_DATE_FIELD=종료일.
- ADR-0022, sheet-structure/data-model.

## 수용 기준
- 생산 시작(시작/종료·소재·예산, 생산개수 빈) → E 미반영(생산중), 예산 반영. 완료(생산개수 입력) → 종료일 E 반영.
- 편집 재진입 시 예산입력 복원(라운드트립). 레거시 단일날짜 행 정상 로드/집계(시작=종료).
- 매입DB·현수막·콜 회귀 없음. XP 가중치 불변(회귀 확인).
- typecheck/lint/structural/unit/doc-drift/size + build + 배포 success + health 200.

## 후속
C2 현수막 게시로그 → C4 컨택 첫행 → C5 넛지 → §7 매출.

## Log
- 2026-06-22 구현(feat/db-direct-period-io): I:O 재배치·시작/종료·2단계·종료일&완료 집계. 전환 lazy.
