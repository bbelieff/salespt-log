> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: DB정보 통화 줄에 「대본 보기」를 더하고, 📞 로 건 뒤 대본 창이 열려 있게 한 기록.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: DB관리시트 통화 정리 앞단(CallUi) · 업체정보 대본(ContactScriptPanel)
> - **관련 문서**: [계획](../plans/completed/mobile-call-assist.md)

# 2026-11-07 feat(db-sheet): 통화 줄 「대본 보기」 · 📞 뒤 대본 창

- 계기: belie 모바일 기획 2판(기존 질서 유지, 더하기만) PR1. 대본이 업체정보 → 대본 탭 깊이에 있어 통화 중 찾기 어려움.
- 담당 파일: app/(app)/db-sheet/_components/CallUi.tsx · CallScriptSheet.tsx(신규) · call.css · tests/components/db-sheet-call-script.test.ts.
- 동작: 걸기 창이 실제로 건 뒤 닫히면 대본 창을 연다(「번호를 복사했어요」 안내는 가리지 않음). 대본이 열린 동안 「방금 통화하셨나요?」는 미루고 닫으면 묻는다. 기존 대본 탭 길은 그대로.
- 확인: vitest 관련 19/19. 실기기(전화 앱 → 복귀 시 대본 창 유지)는 belie 확인 항목.
- 위험/복구: 화면만, 서버 무변경. 되돌리기 = revert.
