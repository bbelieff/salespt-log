> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 폰 DB정보 「컨택내용」을 누르면 업체정보 시작까지 자동 스크롤하게 한 기록.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: DB관리시트 DB정보(DbDetail) · 업체정보·미팅예약 칸
> - **관련 문서**: [계획](../plans/completed/db-contact-scroll-mobile.md)

# 2026-11-06 fix(db-sheet): 폰 「컨택내용」 → 업체정보 시작까지 자동 스크롤

- belie 「완전바닥 말고 업체정보 시작하는 구간까지만」.
- 담당 파일: app/(app)/db-sheet/_components/DbDetail.tsx · tests/components/db-sheet-ui-controls.test.ts.
- 열릴 때만(700px 미만) 칸 제목 줄을 scrollIntoView(block:start). PC 좌우 배치·접기 변화 없음.
- 확인: 합성 DB시트 375px — 즉시 이동 시 칸 제목이 DB정보 머리 바로 아래(82px). 브라우저 창(백그라운드 페이지)에서는 부드러운 스크롤 자체가 돌지 않아 애니메이션은 실제 폰에서 확인 필요.
- 위험/복구: 화면 이동만. 되돌리기 = revert.
