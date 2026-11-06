> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: DB관리시트 맨 위에 「정리 기다리는 통화 N건」 한 줄과 모아 보기를 더한 기록.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: DB관리시트 통화 정리(CallUi)
> - **관련 문서**: [계획](../plans/active/mobile-call-assist.md)

# 2026-11-07 feat(db-sheet): 정리 기다리는 통화 N건 한 줄

- 계기: belie 모바일 기획 2판 PR2. 운전 중 「나중에」로 미룬 통화가 업체 카드마다 흩어져 몇 건 남았는지 안 보임.
- 담당 파일: app/(app)/db-sheet/_components/CallUi.tsx(pending·strip) · page.tsx(callsOnly 걸러 보기) · call.css · tests/components/db-sheet-pending-calls.test.ts.
- 규칙: 기존 GET /api/calls(최근 7일 진행 중) 중 dialed·failed·review 만. 서버 무변경. 0건이면 줄 없음.
- 확인: vitest 5/5(+PR1 시험), tsc 통과.
- 위험/복구: 화면만. 되돌리기 = revert.
