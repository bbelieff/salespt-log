## 2026-11-03 · 통화 정리 PR-4b — 확정 저장
- chore/call-summary-confirm. belie 「Merged it」 뒤 PR-4 에서 나눈 확정 저장을 이어서.
- 담당 파일: `lib/service/call-confirm.ts`, `app/api/calls/[id]/confirm/route.ts`, `app/api/calls/response.ts`(계정 정보 전체 전달·DB 충돌 문구), `lib/service/db-sheet.ts`(meeting 명령 선택 칸 `place` 2줄), `lib/repo/db/call-records.ts`(확정 잠금·풀기), data-model, 시험, [plan](../plans/active/call-summary.md). 선행: PR-4(#1302) 병합·배포(run 41633540781, health 200, 운영 `/api/calls` 401).
- 확정 = DB관리시트 기존 명령 save → contact → meeting(초안 있을 때만)을 사람이 누르는 것과 같은 경로로. 시트 동기화·실적 집계 그대로.
- 두 번 눌러도 한 번(review → confirmed 잠금), 중간 실패면 review 로 되돌림. 미팅카드는 확정에서만 생김(자동 등록 없음).
- meeting 명령 `place` 는 선택 칸 — 안 보내면 지금처럼 업체 소재지. 기존 화면 동작 변화 없음.
- 사용자 화면 변화 없음(스위치 비어 있음). 되돌리기 = squash revert.
