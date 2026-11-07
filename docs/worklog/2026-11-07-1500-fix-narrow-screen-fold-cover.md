> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 폴드 커버 화면처럼 360px보다 좁은 폰에서 화면이 잘리지 않게 한 기록.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: 전역 반응형(globals.css)·컨택관리·일정·계약·실무/수납·대시보드
> - **관련 문서**: [계획](../plans/completed/narrow-screen-fold-cover.md) · [tokens §좁은 화면 비례 축소](../design/tokens.md)

# 2026-11-07 fix: 좁은 폰(폴드 커버) 잘림 없애기

- 담당 파일: app/globals.css · tailwind.config.ts · components/badges/badge-medal.css · components/dashboard/followups-table.css · components/dashboard/ProductivityIndicators.tsx · components/company-info/CompanyInfoHeader.tsx · app/(app)/contact/_components/{WeekHeader,ChannelTabsAndPanel}.tsx · app/(app)/schedule/_components/{WeekHeader,MeetingResultCard}.tsx · app/(app)/payment/_components/PaymentSlotForm.tsx · tests/structural/narrow-screen-scale.test.ts · tests/browser/dashboard-followups-{server.mjs,fixture.tsx}(합성 화면에 /contact·/calendar·/db 추가, 없어진 하단 탭 제거).
- 방식: 360px 미만은 루트 글자·--app-px 를 화면 폭 비율로(전역 한 곳) + 360px 에서도 빠듯한 줄은 flex-wrap 으로 아랫줄.
- 검증: 합성 화면 280·300·344·360px 자동 잘림 검사(가로 스크롤·화면 밖 칸·잘린 글자) + 화면 캡처. 실제 폴드 기기는 미확인.
- 위험/복구: 360px 이상·PC 는 값 동일(픽셀 글자 = N×1px). 되돌리기 = revert.
