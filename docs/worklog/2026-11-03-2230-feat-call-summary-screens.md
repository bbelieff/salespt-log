## 2026-11-03 · 통화 정리 PR-5a — 📞·녹음 올리기 화면
- feat/call-summary-screens. belie 「Start PR-5」. PR-5 를 5a(앞단, 목업 v5)·5b(「통화 정리 확인」)로 나눔.
- 담당 파일: `app/(app)/db-sheet/_components/{call-client.ts,use-calls.ts,CallDial.tsx,CallUploadDialog.tsx,CallUi.tsx}`, `app/(app)/db-sheet/call.css`, Grid(callSlot)·DbDetail(callBar)·page(3줄), `lib/service/call-summary.ts`·`lib/repo/db/call-records.ts`·`app/api/calls/route.ts`(진행 중 목록·통화 시각), components.md, 시험, 합성 화면 `tests/browser/call-summary-front/`, [plan](../plans/active/call-summary.md). 선행: PR-4b(#1304) 병합·배포(run 41642552676, health 200).
- 스킬: impeccable(Operate, 기존 db-sheet 토큰·SheetDialog 재사용, craft-floor 확인, detect 0건).
- 화면 확인(합성 데이터, 앱 안 브라우저): 폰 375 목록·앱 고르기·복사 안내·녹음 올리기(안드로이드/아이폰)·파일 일치/불일치·DB정보 통화 줄, PC 통화 줄. 가로 넘침 0. 고친 것: 번호 없는 줄 정렬, 「바꾸기」 색, 을/를 조사.
- 미확인: 실제 폰의 tel:·클립보드·파일 고르기·돌아올 때 묻기(스위치 켠 뒤 belie 폰에서), 익시오·에이닷 URL 스킴.
- 사용자 화면 변화 없음(스위치 비어 있음). 되돌리기 = squash revert.
