---
status: completed
slug: work-tools-cafe-link
created: 2026-10-30
owner: belie
completed: 2026-10-30
---

# PC 업무도구에 세일즈PT 카페 바로가기

## Intent
belie(2026-10-30): 업무도구에 세일즈PT 카페 접속 버튼. 수강생은 전원 카페 회원이라 가입 벽이 없다.

## Acceptance Criteria
- [x] PC 사이드탭 업무도구 4번째 행 「세일즈PT 카페 ↗」 → `SALESPT_CAFE_URL`(https://cafe.naver.com/salespt) 새 탭.
- [x] 축소 상태에서 아이콘 + title 「세일즈PT 카페 (새 탭)」.
- [x] 주소는 `lib/config/links.ts` 한 곳.
- [x] components.md 업무도구 표 갱신, desktop-glass-shell 테스트 갱신.

## 범위 밖
- 휴대폰 실무 도구 줄은 그대로(요청은 업무도구). 트레이닝일지는 [training-log-own-only](../active/training-log-own-only.md) 계획.
