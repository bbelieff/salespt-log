---
slug: payment-master-detail
status: active
created: 2026-06-03
owner: belie
related: responsive-desktop-toss-copy, practice-payment-polish
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 실무/수납 탭을 데스크탑에서 마스터-디테일(좌 컴팩트 목록 / 우 sticky 상세)로. 모바일은 기존 아코디언 유지.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/(app)/payment/page.tsx`, `app/(app)/payment/_components/ContractRow.tsx`
> - **읽고 나면 알 수 있는 것**: 모드 분기(usePcBreakpoint), ContractRow 3모드, 회귀 방지 전략
> - **관련 문서**: [[docs/design/components]], [[docs/plans/active/practice-and-drive]]

# 실무/수납 데스크탑 마스터-디테일 (C) + 폴리시(D8)

## Intent (왜)
데스크탑/태블릿 피드백: 데스크탑에서 카드 그리드 + 인라인 아코디언은 여러 계약을 오가며 보기 불편. 좌측 목록에서 고르고 우측에 상세를 sticky로 두는 마스터-디테일이 데스크탑에 적합.

## 현재 동작
- `pc:grid-cols-2` 카드 그리드 + 각 카드 인라인 아코디언(`open` 내부상태).

## 변경
- **ContractRow 3모드**(props로):
  - 기본(미지정) = 기존 모바일 아코디언 — **회귀 0**.
  - `selectable`+`selected`+`onSelect` = 컴팩트 목록 아이템(바디 숨김, 헤더 클릭=선택, 액센트 보더+ring).
  - `forceOpen` = 상세 패널(바디 항상 열림, 토글 없음).
- **page.tsx**:
  - `usePcBreakpoint()`(matchMedia 1024) 로 **데스크탑=마스터디테일 / 모바일=아코디언 단일 트리** 렌더(중복 마운트·todos 쿼리 방지, 하이드레이션은 모바일 기준 시작).
  - `selectedRow` 상태(기본 = 첫 카드 폴백 `selectedCp`).
  - 데스크탑: `grid-cols-3` 좌(col-span-1) 컴팩트 목록 / 우(col-span-2) `sticky top-24` 상세. 상세는 `key=detail-<row>` 로 선택 변경 시 remount → draft 재초기화.
  - 저장·삭제는 상세 패널의 기존 버튼/로직 그대로(`makeDeleteRequest` 헬퍼로 통합).

## D8 폴리시
- 마스터-디테일 자체가 데스크탑 위계·정렬을 개선 → **과한 재작성 없음**(범위 준수). 선택 카드 액센트(파란 ring)로 좌우 연결감.

## Acceptance Criteria
- [ ] 데스크탑(≥1024): 좌 목록 클릭 → 우 상세 갱신, 기본 선택=첫 카드, 선택 카드 액센트.
- [ ] 모바일(<1024): 기존 아코디언 동작·외형 그대로(회귀 0).
- [ ] 저장·삭제·슬롯 추가/제거·투두 동작 보존.
- [ ] 파일 ≤500줄, `npm run check` + `next build` 통과.

## 범위 밖
- 데이터 모델·02 구조 변경, 색 토큰 변경.

## Log
- 2026-06-03 구현. usePcBreakpoint 분기 + ContractRow 3모드. check·build 통과.
