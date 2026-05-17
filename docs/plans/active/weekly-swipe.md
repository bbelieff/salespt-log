---
slug: weekly-swipe
status: active
created: 2026-05-17
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 컨택/일정계약 위클리 영역 좌우 스와이프로 주 이동
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: useSwipe hook + contact/schedule page

# weekly-swipe — [A3]

## 사용자 요청 (2026-05-17)
"컨택관리, 일정계약 탭의 위클리 슬라이더 기능 넣기. 양옆 밀어서 주 단위로 이동 할수있게"

## 변경
- `lib/hooks/useSwipe.ts` (신규) — 가벼운 touch 핸들러, 의존성 없음
- contact/page.tsx — `weekSwipe` → WeekHeader sticky 컨테이너 spread
- schedule/page.tsx — 동일 패턴

## 동작
- 왼쪽 스와이프 (→ 다음 주)
- 오른쪽 스와이프 (← 이전 주)
- 50px threshold + 세로 우세 시 무시 (스크롤 충돌 방지)

## Acceptance
- [ ] 모바일 스와이프 동작
- [ ] 세로 스크롤 정상 작동 (스와이프 오판 X)
- [ ] check.sh 통과
