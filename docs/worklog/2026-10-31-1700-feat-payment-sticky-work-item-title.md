## 2026-10-31 · 실무진행 — 펼친 진행건 제목 줄을 위에 붙이기
- feat/payment-sticky-work-item-title. belie: 스크롤했을 때 어떤 진행건을 건드리고 있는지 보이게 진행건 제목을 스티키로.
- 펼친 진행건 제목 줄(`.payment-slot-head`)이 「실무진행」 제목 바로 아래에 붙고, 그 진행건 카드를 지나면 함께 올라간다. 바탕은 진행건 색(emerald/blue/violet-50). 휴대폰은 입력 중이면 제목처럼 풀린다(키보드 가림 방지).
- 제목 top 이 화면마다 달라(globals·payment-company-compact.css) 같은 자리에 함께 적었다.
- 검증: 합성 화면 PC 1440×900·휴대폰 375 — 제목 아래와 진행건 제목 위 간격 0. 되돌리기 = squash revert.
