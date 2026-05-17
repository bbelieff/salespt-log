---
slug: weekly-design-unify
status: active
created: 2026-05-17
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 일정·계약 WeekHeader 디자인을 컨택탭과 일관성 맞춤
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: schedule/_components/WeekHeader

# weekly-design-unify — [A1]

## 사용자 요청 (2026-05-17)
"컨택관리랑 일정계약 주차별 위클리 디자인 일관성 필요. 장점만 차용하기"

## 변경 (schedule WeekHeader 만 — contact 는 이미 좋음)
- 주말 색: border-red-300 (보더) → text-red-500 (텍스트, 컨택과 일관)
- "오늘" 플로팅 배지 추가 — 컨택탭과 동일 위치/스타일
- 일자 박스 active style: shadow 강화 (shadow-md, 컨택과 동일)
- aria-label 추가 (접근성 + 컨택과 일관)

## Acceptance
- [ ] 컨택탭과 일정계약탭 헤더 디자인이 시각적으로 동일
- [ ] check.sh 통과
