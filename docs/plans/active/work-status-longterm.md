> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 「전체 진행건」 막대에 수납완료 옆 「장기관리」 칸을 더한 수정(대시보드·실무/수납 공통).
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `lib/analytics/payment-work-status.ts`(buildWorkStatusItems·workStatusOf), `components/payment/WorkStatusBar.tsx`, `lib/service/db-sheet-status.ts`
> - **읽고 나면 알 수 있는 것**: 무엇을 장기관리건으로 세는지 · 어디에 보이는지
> - **관련 문서**: [payment-wait-longterm](payment-wait-longterm.md)

# 전체 진행건 — 장기관리 칸 (2026-10-24 belie, 알림 세션 경유)

원문: 「전체 진행건 바 아래 수납완료 옆에 장기관리건에 대해서도 집계를 해줘. 대시보드와 실무/수납탭에도 똑같이」.

- 장기관리건 = ① 조건 대기·장기관리 진행건(수납액이 있어도 — `isSlotClosed` 와 같은 우선순위) ② 업체가 장기관리(`long-term.ts`)일 때 수납완료가 아닌 진행건. 수납완료·중도중지 규칙은 그대로.
- 막대·범례에 수납완료 다음 「장기관리 N」(돌색), 눌러서 목록 보기·해당 진행건 이동도 다른 칸과 같다. 대시보드·실무/수납이 같은 함수라 한 번에 반영. DB관리시트 상태 글자도 「장기관리」.
- 자율결정: 업체 장기관리의 수납완료 진행건은 수납완료로 둔다(돈이 들어온 사실 우선). 조건 대기·단기관리는 진행으로 둔다(belie 기존 확정: 단기는 진행 중).
- 시험: `tests/components/work-status-longterm.test.ts` 4건 + 기존 업무 현황 시험.
- 되돌리기: squash revert. 데이터 무변경.
