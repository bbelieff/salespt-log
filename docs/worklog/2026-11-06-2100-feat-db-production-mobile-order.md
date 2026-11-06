> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 폰 DB생산에서 4채널 고르기를 맨 위로, 입력을 바로 밑으로 옮긴 기록.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: DB생산(app/(app)/db/page.tsx)
> - **관련 문서**: [계획](../plans/completed/db-production-mobile-order.md)

# 2026-11-06 feat(db): 폰 DB생산 순서 — 채널 → 입력 → 전체 종합

- belie 「4채널 클릭을 우선, 클릭시 생산 내용을 바로 밑에」.
- 담당 파일: app/(app)/db/page.tsx · tests/components/db-mobile-order.test.ts.
- CSS order 만 바꿈(flex-col, pc:block) — 같은 요소·데이터, PC 순서 그대로.
- 확인: 합성 화면 375px(채널 → 매입DB 입력 → 전체 종합), 1280px 원래 순서.
- 위험/복구: 배치만. 되돌리기 = revert.
