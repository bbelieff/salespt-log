## 2026-11-01 · 통화 정리 PR-3 — AI 원답 → 저장 형식 변환
- chore/call-summary-extract. belie 「Start PR-3」.
- 담당 파일: `lib/service/call-extract-map.ts`, `tests/service/call-extract-map.test.ts`·`call-extract.cases.ts`, [plan](../plans/active/call-summary.md). 선행: PR-2(#1298) 병합·배포(run 41312547283, health 200).
- 0단계 convert.py 규칙을 TS 로: 말 금액 → 백만원(`wonToMillion` 재사용), 연도 → 매출 칸(`salesSlotOf`), 대출 줄, 직원 수, 미팅 날짜·15분 시각, 사무실이면 주소 붙임. 근거 문장 없는 답 버림, 칸마다 evidence.
- 고정 시험: 0단계 Gemini 원답 15건 → convert.py 결과와 같음. 사례 파일은 지어낸 업체만, 받아쓰기 제외.
- 소개처는 계약에 칸이 없어 버림(plan 「남은 차이」). 사용자 화면 변화 없음(아직 부르지 않음). 되돌리기 = squash revert.
