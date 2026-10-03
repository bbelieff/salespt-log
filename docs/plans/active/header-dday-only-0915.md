---
slug: header-dday-only-0915
status: active
created: 2026-09-15
---

# D-day 중복 제거 운영 반영

사용자가 D-day만 운영 게시 승인했다. 최상단 TopHeader의 D-day 및 불필요 날짜 계산을 제거하고 DashboardProgressBanner는 그대로 유지한다. 다른 대기 디자인·정렬·비용 행 변경은 포함하지 않는다.

- [x] 정상 날짜·로딩 상태 모두 아래 진행바에만 D-day 1개: 집중 회귀 30개 통과, 기존 skip 1.
- [ ] 필수 검사·CI·병합·운영 배포·실화면 검증.
- 데이터·헤더 높이·역할 전환 변경 없음. 롤백은 이 커밋 revert.
