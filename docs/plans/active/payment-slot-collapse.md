---
slug: payment-slot-collapse
status: active
created: 2026-06-05
owner: belie
related: practice-payment-polish
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 실무/수납 진행1/2/3 슬롯을 헤더 클릭으로 접기/펼치기. 완료 슬롯은 기본 접혀 요약만 → 스크롤 부담 해소.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/(app)/payment/_components/PaymentSlotForm.tsx`
> - **관련 문서**: [[docs/plans/completed/practice-payment-polish]]

# 실무/수납 슬롯 접기/펼치기

## Intent
수납완료 슬롯도 본문(볼륨바·진행기관·메모·ToDo·금액)이 항상 펼쳐져 길어 다른 진행 보려면 스크롤 과다.

## 변경 (PaymentSlotForm.tsx)
- 슬롯별 `open` 상태(`useState`). 헤더 클릭 토글 + 우측 셰브론(회전, ContractRow 아이콘 패턴 재사용).
- **기본 open**: 완료(진행률 100% 또는 승인>0 && 수납>=승인) → 접힘 / 진행 중 → 펼침.
- 본문(진행도 볼륨바 + 입력필드)을 `{open && (<>...</>)}` 로 감쌈.
- **접힘 요약 줄**(헤더): 진행기관명(없으면 '기관 미입력') · 진행률 %(0 회색/100 green/그외 파랑) · ₩수납액/승인금액. [10] 🏛 주제는 펼침 시만(접힘 땐 요약에 포함).
- ✕(삭제)는 `e.stopPropagation()` 로 토글과 분리. +진행 추가·볼륨바·입력 로직 보존. 슬롯별 독립.
- 토큰만 사용. 전환은 셰브론 회전 `transition-transform`.

## Acceptance Criteria
- [ ] 완료 슬롯 기본 접힘(요약만), 펼치면 전체 편집.
- [ ] 진행 중 슬롯 기본 펼침. 헤더 클릭 슬롯별 독립 토글.
- [ ] 수납완료+다수 진행 시 스크롤 확연히 감소.
- [ ] 저장/삭제/추가·모바일/데스크탑 회귀 0. `npm run check` 통과.

## 범위 밖
- 슬롯 데이터·색·계산 로직 변경.

## Log
- 2026-06-05 슬롯 open 상태 + 헤더 토글 + 접힘 요약. (PaymentSlotForm 500줄=cap, 추후 Field 프리미티브 분리 여지.)
