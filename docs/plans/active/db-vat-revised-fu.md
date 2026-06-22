---
slug: db-vat-revised-fu
status: active
created: 2026-06-22
owner: belie
related: 0021-vat-handling-standard, pr-db-channels-full, sheet-structure, data-model
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 부가세여부를 주문금액 자리(매입DB F·현수막 U)에 저장하고 주문금액을 계산값으로 전환하는 C3 개정.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: lib/repo/db.ts, channels/RowForm, 대시보드 비용
> - **읽고 나면 알 수 있는 것**: #425와 무엇이 다른지, 전환(lazy) 방식, 검증
> - **관련 문서**: [ADR-0021](../../decisions/0021-vat-handling-standard.md), [정본 §3-A](../../handoff/pr-db-channels-full.md)

# C3 개정 — 부가세여부 F/U + 주문금액 계산값

## 배경
#425 는 부가세여부를 gap컬럼 H/W 에 뒀으나, 정본 §3-A 는 **주문금액 자리(매입DB F·현수막 U)**에 저장하고
주문금액은 시트 미저장(계산)으로 확정. 본 PR 이 #425 를 대체(ADR-0021).

## 방식 (전환 안전·lazy)
- read: F/U 가 boolean 이면 신규(부가세여부), number(구 주문금액 수식)면 H/W(#425)에서 fallback.
  주문금액 = 개당단가×주문개수 계산(시트 미read). → 대시보드는 `rows[].주문금액`(계산값) 그대로 사용(무변경).
- write: 신규 레이아웃(F/U=부가세여부) 기록 + 구 H/W 빈칸 정리. **블로킹 마이그레이션 없음**(편집 시 점진 이전).
- §2.5: 구 F/U 는 수식 셀 → 덮어쓰기 허용. 행 단위 update(불버크).

## 변경
- `lib/repo/db.ts`: SPEC 매입DB/현수막 formula 제거, read(전환)·append/update(F/U 기록·H/W 정리).
- `channels.ts`: 현수막에 총액(formOnly)+부가세토글+개당단가 역산 추가(매입DB와 동일 패턴).
- ADR-0021(부가세 표준), sheet-structure/data-model 갱신.

## 수용 기준
- 매입DB/현수막 추가: 부가세 포함/미포함 → 개당단가(부가세 제외) 역산 일치, F/U=TRUE/FALSE 저장.
- 기존 행(구 레이아웃) read 정상(부가세여부 H/W fallback, 주문금액 계산). 편집 시 F/U 로 이전·H/W 정리.
- 대시보드 비용(매입·현수막)=개당단가×개수 계산값, 영업이익 정상.
- typecheck/lint/structural/unit/doc-drift/size + build + 배포 success + health 200.

## 후속
C1 직접생산(I:O, N=부가세여부) → C2 현수막 게시로그 → C4 → C5 → §7 매출측.

## Log
- 2026-06-22 구현(feat/db-vat-revised-fu): F/U 부가세여부 + 주문금액 계산값, 전환 read·lazy 이전.
