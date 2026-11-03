## 2026-11-03 · 통화 정리 PR-4 — API·처리 작업자
- chore/call-summary-api. belie 「Start PR-4」.
- 담당 파일: `lib/service/call-summary.ts`, `lib/repo/call-audio.ts`, `lib/repo/db/call-records.ts`(없는 업체·하루 수·닫기), `app/api/calls/**`, `instrumentation.ts`(작업자 시작 3줄), `.env.example`, data-model, 시험 4개, [plan](../plans/active/call-summary.md). 선행: PR-3(#1299) 병합·배포(run 41627875613, health 200).
- API: 📞 기록 · 업체별 목록 · 상태 · 녹음/글자 올리기 · 닫기. 스위치 밖 404, 쓰기는 내 계정·같은 사이트만.
- 녹음은 레포 밖 임시 폴더(무작위 이름), 정리 끝·실패·닫기 때 지우고 하루 넘은 파일도 지움. 하루 상한 30.
- 작업자: 5초마다 대기열을 비움, 429·5xx 는 다시 대기(3회). 스위치가 비면 돌지 않음 → 지금 운영에서는 아무 일도 안 함.
- 확정 저장(DB정보·미팅)은 PR-4b 로 나눔. 사용자 화면 변화 없음. 되돌리기 = squash revert.
