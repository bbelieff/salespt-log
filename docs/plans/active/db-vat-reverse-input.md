---
slug: db-vat-reverse-input
status: active
created: 2026-06-21
owner: belie
related: pr-db-channels-full, 0020-production-metric-ssot-to-db
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 매입DB 입력을 "총액+개수+부가세 토글" 로 받아 부가세 제외 개당단가를 역산하는 PR-C3 작업 계획.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: lib/pricing.ts, DB관리 폼(RowForm), 매입DB 채널 메타(channels.ts)
> - **읽고 나면 알 수 있는 것**: 왜 컬럼을 안 늘렸는지, 어떻게 저장되는지, 편집 라운드트립
> - **관련 문서**: [activation-redesign 정본](../../handoff/pr-db-channels-full.md)

# PR-C3 — 부가세 역산 입력 (매입DB)

## 스코프
activation-redesign C-시리즈 2번째 PR. 매입DB 비용 입력 시 영수증의 **총액**(부가세 포함일 수 있음)을
그대로 받고, 개당단가는 시스템이 역산한다. 수강생이 직접 단가를 나눠 계산할 필요가 없어진다.

## 결정 (R4 확정 — 컬럼 추가 없음)
- 입력 = 총액 + 주문개수 + **부가세 포함 토글**. 저장 = **부가세 제외 개당단가** 한 값(기존 컬럼).
- 역산 = `총액 ÷ (포함이면 1.1) ÷ 개수`, 원 단위 반올림. 시트 스키마(매입DB B:G) 불변, 마이그레이션 없음.
- 트레이드오프: 총액·부가세여부는 저장 안 함 → 재편집 시 토글 off + 저장된 개당단가 기준으로
  총액(=개당단가×개수)을 역복원해 보여줌(원 영수증 총액·부가세 플래그 복원 불가). belie 수용.

## 변경
- `lib/pricing.ts`(신규): `unitPriceFromTotal(total,count,hasVat)` 순수 헬퍼 + 단위테스트.
- `app/(app)/db/_lib/channels.ts`: `FieldType` 에 `"toggle"`, `FieldDef.formOnly`(저장 제외 입력도우미) 추가.
  매입DB fields = …총액(formOnly)·부가세포함(toggle,formOnly)·주문개수·개당단가(formula=역산)·주문금액(formula).
- `app/(app)/db/_components/RowForm.tsx`: toggle 렌더 + `computed`(formula 값 채운 제출 row) +
  편집 시 총액 역복원. 제출 row 는 자동값 포함 → 매입DB 개당단가가 payload 로 전달돼 저장됨
  (진짜 시트 수식 컬럼은 `lib/repo/db.ts` `writeRow` 가 재치환하므로 다른 채널엔 영향 없음).

## 수용 기준
- 매입DB 추가: 총액 11,000 / 개수 10 / 부가세 포함 → 개당단가 1,000 저장(시트 D열), 주문금액 시트수식.
- 부가세 미포함 토글 → 총액÷개수 그대로.
- 기존 매입DB 행 편집 → 개당단가 그대로 유지(라운드트립), 저장 깨짐 없음.
- 직접생산·현수막·콜·지·기·소 폼/저장 회귀 없음(개당단가·주문금액 시트수식 유지).
- typecheck/lint/structural/unit/doc-drift/size + build + 배포 success + health 200.

## 후속(별도 PR, 정본 순서)
- C1 직접생산 기간+2단계 · C2 현수막 주문→도착→게시(AF:AI 로그) · C4 컨택 첫 행 읽기전용 · C5 미기록 넛지.

## Log
- 2026-06-21 구현(feat/db-vat-reverse-input): pricing 헬퍼 + 매입DB 역산 폼. 컬럼 추가 없음(R4).
