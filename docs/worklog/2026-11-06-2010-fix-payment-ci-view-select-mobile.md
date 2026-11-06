> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 폰 업체정보·팝업의 보기 선택이 14px 로 눌려 못 누르던 것을 고친 기록.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: 실무진행 업체정보(compact 모바일) · 업체정보 팝업 · 공고필터 버튼
> - **관련 문서**: [계획](../plans/completed/payment-ci-view-select-mobile.md)

# 2026-11-06 fix(payment): 폰 업체정보·팝업 보기 선택이 눌리지 않던 것

- belie 「모바일에서 업체정보>팝업 이 눌리지도 않고 실행도 안됨」.
- 원인: #1330 이 보기 선택을 공고필터와 한 묶음에 넣은 뒤 폰 CSS `width:0;flex:1` 이 묶음 안에서 14px 로 눌림.
- 담당 파일: app/(app)/payment/payment-company-compact.css · tests/components/payment-mobile-details-mock.test.ts.
- 확인: 합성 실무 화면 320·375·412px — 보기 선택 80~140px, 겹침·가로 넘침 없음, 팝업 「대본」 전환 동작.
- 위험/복구: CSS 3줄(767px 이하 compact 안). 되돌리기 = 이 커밋 revert.
