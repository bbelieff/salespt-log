---
slug: prior-contract-button-emphasis
status: active
created: 2026-06-22
owner: belie
related: tokens
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 실무수납 "이전 계약업체 등록" 버튼을 보조(회색 아웃라인)에서 secondary-strong(블루 톤)으로 강조.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: app/(app)/payment/_components/PriorContractSection.tsx
> - **읽고 나면 알 수 있는 것**: 위계(주행동과 충돌 방지) 의도
> - **관련 문서**: docs/design/tokens.md

# fix — 이전 계약업체 등록 버튼 강조

## 변경
- 회색 아웃라인 → **블루 톤 secondary-strong**(border-blue-200·bg-blue-50·text-blue-700, hover bg-blue-100) + **＋ 아이콘**.
- 솔리드 블루(bg-blue-500) 주행동(저장/계속 등록)보다 약한 위계 유지. 표준 팔레트 토큰만(arbitrary value 없음).

## 수용 기준
- 모바일/PC 에서 눈에 띄되 저장 버튼과 시각 위계 유지. typecheck/lint/structural/unit/doc-drift/size + build + 배포 + health 200.

## Log
- 2026-06-22 구현(fix/prior-contract-button-emphasis): 버튼 secondary-strong + ＋아이콘.
