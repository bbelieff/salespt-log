## 2026-11-01 · 통화 정리 PR-2 — 저장소·AI 호출·스위치
- chore/call-summary-store. belie 「PR-2 시작」, 「하나씩 운영에 붙여 조립」.
- 담당 파일: `lib/repo/db/call-records.ts`, `lib/repo/ai/call-gemini.ts`·`call-prompt.ts`, `lib/config/index.ts`(스위치 2줄), `.env.example`, 시험 3개, [plan](../plans/active/call-summary.md). 선행: PR-1(#1292) 병합·0014 운영 적용 완료.
- 대기열: `for update skip locked`, 멈춘 processing 10분 뒤 회수, 3회 넘으면 failed. 정리 끝·실패 때 녹음 경로를 돌려주고 비움(D3, 파일 삭제는 PR-4 작업자).
- AI: 0단계 지시문 그대로(+ 글자 입력 문구 한 줄). 키 `GEMINI_API_KEY` 는 VPS `.env` 직접(deploy 주입 아님). 키 없으면 보내지 않고 「설정 안 됨」. 가짜 답은 `CALL_AI_FAKE=1`·비운영만. 녹음은 요청에 그대로 실음 → 상한 14MB(약 45분), plan 업로드 상한 30MB → 14MB.
- 스위치 `CALL_SUMMARY_EMAILS` 를 PR-6 → PR-2 로 앞당김(화면보다 먼저). 미설정 = 아무도 안 보임.
- 사용자 화면 변화 없음(아무 곳에서도 아직 부르지 않음). 실제 Gemini 호출은 안 함(가짜 fetch 시험만). 되돌리기 = squash revert.
