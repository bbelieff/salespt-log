## 2026-11-05 · 통화 정리 PR-8 — 첫 실사용 피드백
- feat/call-summary-feedback(PR-7 위). belie 「희열」 업체 시험 피드백 4건 + 별개 1건.
- 담당 파일: `lib/util/call-place.ts`(새), `lib/service/call-extract-map.ts`, `lib/repo/ai/call-prompt.ts`(1줄), `app/(app)/db-sheet/_components/{call-confirm-model.ts,CallConfirmScreen.tsx,DbDetail.tsx,AbsenceLog.tsx}`, `call.css`, 시험 4개, components.md, [plan](../plans/active/call-summary.md).
- 추가(belie): 전화 버튼 초록 강조, 폰 DB정보 칸 글자 잘림(여백 0 — 글자를 15px 이하로 줄이면 아이폰이 눌 때 확대하므로 크기는 유지). `CallDial.tsx`·`db-sheet.css` 추가.
- 처리: 날짜 칸 높이 · 장소 「업장」→ 주소 · 사업자구분·과세유형 5개 선택지 · 부재 기록은 결과 「부재」일 때만.
- 미처리: 익시오 바로 열기 — 공개된 웹 주소 없음, 앱 설정 파일 확인 필요(이 PC 에 adb 없음, 출처 불명 APK 는 받지 않음). belie 에게 폰 종류·파일 확보 방법 질문.
- 되돌리기 = squash revert.
