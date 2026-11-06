> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 통화 창이 열린 동안 새소식 자동 팝업을 미루고, 모바일 기획 2판 4건을 마친 기록.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: 새소식 팝업(AnnouncementsGate) · DB관리시트 통화(CallUi)
> - **관련 문서**: [계획](../plans/completed/mobile-call-assist.md)

# 2026-11-07 feat(announcements): 통화 중 새소식 미루기 — 모바일 기획 2판 완료

- 계기: belie 모바일 기획 2판 PR4. 통화 흐름 중간에 새소식이 끼어들 수 있음.
- 담당 파일: components/announcements/call-focus.ts(신규) · AnnouncementsGate.tsx · app/(app)/db-sheet/_components/CallUi.tsx · tests/components/announcements-call-focus.test.ts.
- 동작: 거는 창·대본·녹음 올리기·「방금 통화하셨나요?」·정리 확인 중 하나라도 열려 있으면 자동 팝업을 미루고 모두 닫히면 띄운다. 헤더 「새소식」 수동 열기는 바로.
- 2판 4건(PR #1351 대본·#1353 정리 대기 줄·#1356 길찾기·이번) 완료 → 계획 completed. 1판 큰 변경은 보류 그대로.
- 확인: vitest 관련 32 통과, tsc. 실기기 확인 항목(전화 앱 복귀·지도 3앱)은 belie.
- 위험/복구: 화면만. 되돌리기 = revert.
