---
slug: today-label-pos
status: active
created: 2026-05-18
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: TODAY 라벨 좌측 정렬 + 우측 padding 으로 미팅 뱃지 가림 방지
> - **누가 읽나요**: 개발자

# today-label-pos

## 사용자 보고 (2026-05-18)
"모바일 보니깐 오늘의 뱃지가 today를 너무 가려서 안가릴수 있게... 투데이 폰트위치를 살짝 왼쪽으로 이동"

## Fix
- TODAY span: `text-center px-1` → `text-left pl-1.5 pr-5`
- 우측 padding 5 (≈20px) — 우측 상단 뱃지(20px h-5 w-5) 영역만큼 공간 확보
- 컨택/일정계약 양탭 WeekHeader 동일 적용

## Acceptance
- [ ] 모바일에서 TODAY 글자 가림 없음
- [ ] 뱃지 위치 다른 날짜와 동일 (변경 없음)
