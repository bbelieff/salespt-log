---
slug: production-step10
status: active
created: 2026-05-17
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 컨택탭 생산 stepper 에 +10/-10 빠른 가산 버튼
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: ChannelTabsAndPanel, MetricStepper

# production-step10 — [C-1]

## 사용자 요청 (2026-05-17)
"생산버튼은 +10, -10버튼도 만들어야 겠어"

## 변경
- `ChannelTabsAndPanel.tsx` — 생산(production) 키일 때만 ±10 버튼 추가
- `MetricStepper.tsx` — `bigStep?: number` prop 추가 (재사용 가능, 추후 다른 곳에서도)
- ±10 버튼 스타일: 작은 알약 (rounded-full, text-[11px])

## Acceptance
- [ ] 생산 행에만 -10 / +10 버튼 보임
- [ ] 다른 행 (유입/컨택/미팅)은 ±1만
- [ ] 값 음수 안 됨
- [ ] check.sh 통과
