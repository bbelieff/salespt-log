## 2026-11-04 · 통화 정리 PR-5b — 「통화 정리 확인」 화면
- feat/call-summary-confirm-screen. belie 「Merged it」(PR-5a) 뒤 이어서.
- 담당 파일: `app/(app)/db-sheet/_components/{CallConfirmScreen.tsx,call-confirm-model.ts,CallUi.tsx,use-calls.ts,call-client.ts}`, `call.css`, page(1줄), components.md, 시험 2개, 합성 화면(확인 장면 2개), [plan](../plans/active/call-summary.md). 선행: PR-5a(#1307) 병합·배포(run 41662609120, health 200).
- 화면: 목업 통화확인_목업.html 구성. 「컨택진행 +1」 → 컨택결과 고르기(PR-4b 확정 방식), 캘린더 문구 뺌.
- 발견·처리: 통화 정리는 통화 연도 기준 매출 칸이라 업체 기준 연도가 다르면 그대로 덮을 때 기존 매출이 한 해씩 밀림 → 업체 기준 연도로 옮기고 기준 연도는 그대로, 칸 밖 해는 안내.
- 스킬: impeccable(Operate, craft-floor, detect 0건). 화면 확인: 합성 데이터로 폰 375(약속 있음·없음+기준 연도 2025)·PC 1280.
- 남김: 같은 시간 미팅 경고. 미확인: 실제 DB관리시트에 확정(스위치 켠 뒤).
- 사용자 화면 변화 없음(스위치 비어 있음). 되돌리기 = squash revert.
