## 2026-11-05 · 통화 정리 PR-9 — 익시오·에이닷을 기본 통화 앱으로 걸기
- feat/call-default-app. belie: 「익시오로 찍었으면 익시오를 열어줘야 함」 + 「검색하면 앞서간 방법이 있을 것」(아이폰).
- 조사: 익시오·에이닷 웹 여는 주소(URL 스킴) 공개 없음. 대신 iOS 18.2+ 「기본 통화 앱」에 익시오·에이닷 지원(클리앙·팩트샵·애플맛 블로그) → tel: 이 그 앱으로 열림. ixi-o.com 의 apple-app-site-association 은 익시오 앱(com.lguplus.aicallagent)을 열 뿐 번호 화면 경로는 미공개.
- 변경: 익시오·에이닷은 tel: 로 건다. 처음 한 번 바꾸는 길 안내(아이폰/안드로이드 경로), [바꿨어요, 걸기]는 이 폰에 기록, [번호만 복사]는 예전 길.
- 담당 파일: `app/(app)/db-sheet/_components/{CallDial.tsx,call-client.ts}`, 시험, 합성 화면(`?s=pick-ios`), components.md, [plan](../plans/active/call-summary.md).
- 미확인: 실제 아이폰에서 익시오를 기본 통화 앱으로 둔 뒤 tel: 이 익시오로 열리는지(belie 폰).
- 함께 고침: master(#1317) 의 `tests/components/contact-script-panel.test.ts` 가 전체 시험 중 「대본 불러오는 중…」에서 검사해 커밋 검사가 2번 연속 실패 → 기대값은 그대로, 불러오기가 끝날 때까지(최대 2초) 기다리게만 함(단독 실행은 원래 통과).
