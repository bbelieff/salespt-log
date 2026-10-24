> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 오늘 챙길 일 카드의 흐르는 무지개 테두리 바깥으로 같은 색 빛이 6px 번지게 한 수정.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `components/dashboard/followups-table.css`, `DashboardFollowUpsView.tsx`(`.ft-glow`)
> - **읽고 나면 알 수 있는 것**: 층 구조 · 왜 안쪽 면을 ::after 로 옮겼는지 · 확인 결과
> - **관련 문서**: [followups-card-and-launcher](followups-card-and-launcher.md)

# 오늘 챙길 일 테두리 빛 번짐 (2026-10-25 belie)

belie 결정 흐름: 비교 시안(아티팩트 「오늘 챙길 일 테두리 잔광」) → 「D 인데 바깥 테두리만 6px」 → 「번짐 색상은 테두리 색상과 동일하게」.

- 층(카드 isolation): 카드 배경 = 무지개 테두리(border-box) → 빛 두 겹(z -2: `::before` 2px 흐림 · `.ft-glow` 6px 흐림) → 안쪽 면(`::after`, z -1) → 글자.
  빛을 카드 뒤(z -1)에만 두면 isolation 안에서 카드 자기 배경 위에 그려져 안쪽이 무지개로 덮인다(1차 확인에서 발견) → 안쪽 면을 별도 층으로 올렸다.
- 빛은 테두리와 같은 무지개·같은 진하기·같은 3.5초 흐름(색 맞물림). 움직임 줄이기면 모두 정지. 상세 창은 body 포털이라 isolation 영향 없음.
- `.ft-glow` 는 경과·장기누락이 있을 때만 그린다(aria-hidden).
- 확인(합성 대시보드 dashboard-followups-server): 1280·375px 안쪽 깨끗, 바깥만 번짐, 가로 넘침 없음. 관련 시험 55건.
- 되돌리기: squash revert.
