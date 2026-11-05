## 2026-11-05 · 통화 정리 PR-10 — 전체 공개
- feat/call-summary-open(master 위). belie 지시 「우선 전체공개해」.
- 담당 파일: `lib/config/index.ts`(스위치 `*`), `tests/repo/call-summary-flag.test.ts`, `.env.example`, [plan](../plans/active/call-summary.md).
- 새소식: `Changelog-Done` 으로 그룹 `call-summary` 공개.
- 운영: VPS `.env` `CALL_SUMMARY_EMAILS="*"` + 재시작(배포 뒤). 되돌리기 = 값을 이메일 목록으로 + 재시작, 코드는 squash revert.
- 비용 경계: Gemini 선불·자동 충전 끔 → 잔액 소진 시 정리 실패로 멈춤(초과 청구 없음).
