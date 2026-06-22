---
slug: payment-company-info-link
status: active
created: 2026-06-22
owner: belie
related: data-model, sheet-structure
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 실무수납 계약 카드가 업체정보를 비워 보이던 문제를, 06 비면 04 미팅에서 읽는 fallback 으로 해결.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: lib/service/contract-payment.ts(loadCompanyInfoByContract), 실무수납 카드
> - **읽고 나면 알 수 있는 것**: 왜 빈 값이었는지, fallback 동작
> - **관련 문서**: data-model.md(CompanyInfo)

# fix — 실무수납 업체정보 연동 (04 fallback)

## 원인
06 업체정보는 계약 생성 시점 스냅샷 1회. 계약 후 미팅에서 업체정보를 채우면 06 스냅샷이 빈
채로 남아 실무수납(06 read)만 빈 값. 일정·계약 탭은 04 직접 read 라 정상.

## 수정
- `loadCompanyInfoByContract`: 06 읽고 **비었으면 04 미팅 fallback**(계약일=미팅날짜 매칭 + 업체명) →
  미팅의 업체정보 반환(04=권위 소스). `hasCompanyInfo` 헬퍼로 빈 값 판정.
- 06 동기화(미팅 업체정보 저장 시)는 `contact.ts patchMeeting` 에 이미 존재 → 별도 변경 없음.
  fallback 이 06 staleness 와 무관하게 항상 04 최신값을 보장.

## 수용 기준
- 미팅 업체정보 입력 → 계약 → 실무수납 카드에 업체정보 표시.
- 계약 후 미팅 업체정보 수정 → 실무수납 반영(04 fallback).
- 일정·계약 탭 회귀 없음. typecheck/lint/structural/unit/doc-drift/size + build + 배포 + health 200.

## Log
- 2026-06-22 구현(fix/payment-company-info-link): loadCompanyInfoByContract 04 fallback + hasCompanyInfo.
