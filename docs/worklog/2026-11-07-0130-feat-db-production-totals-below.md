> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: DB생산 PC 에서도 전체 종합을 아래로, 채널 합계를 구매목록 추가 아래로 옮긴 기록.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: DB생산(app/(app)/db)
> - **관련 문서**: [계획](../plans/completed/db-production-totals-below.md) · [폰 순서](../plans/completed/db-production-mobile-order.md)

# 2026-11-07 feat(db): DB생산 전체 종합·채널 합계를 아래로

- belie 「PC 에서도 채널합계는 아래로 · 개별채널합계도 구매목록 아래로」.
- 담당 파일: app/(app)/db/page.tsx(pc:block·pc:order-none 제거) · app/(app)/db/_components/DbChannelWorkspace.tsx(합계 카드를 추가 폼 뒤로) · tests/components/db-mobile-order.test.ts · tests/components/desktop-fluid.test.ts.
- 같은 요소·데이터, 배치만. 확인: 합성 화면 1280px(채널 → 구매목록 → 추가 → 합계 → 전체 종합) · 1600px(왼쪽 목록, 오른쪽 추가·합계) · 375px.
- 위험/복구: 배치만. 되돌리기 = revert.
