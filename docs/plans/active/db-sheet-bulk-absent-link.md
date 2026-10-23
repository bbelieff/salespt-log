> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: DB관리시트 승인 목업 4가지(일괄 선택·줄 누르면 DB정보 / 장기관리·진행종료 / 부재 기록 / 따로 잡은 미팅 연결)를 두 PR 로 나눠 구현한 계획과 검증 기록.
> - **누가 읽나요**: 개발자/PM
> - **어떤 기능·작업과 연결?**: `app/(app)/db-sheet/*` · `lib/types/db-sheet.ts` · `lib/repo/db/db-sheet.ts` · `lib/service/db-sheet.ts` · `lib/analytics/dashboard-follow-ups.ts`
> - **읽고 나면 알 수 있는 것**: 무엇을 어떤 규칙으로 바꿨나 / 저장 데이터가 어떻게 달라지나(뒤 호환) / 어떻게 검증했나
> - **관련 문서**: [컨택결과 규칙](db-sheet-contact-rules.md) · [data-model](../../domains/data-model.md) · [components](../../design/components.md)

# DB관리시트 일괄 작업·장기관리·부재 기록·미팅 연결 (2026-10-23)

승인 목업: 표(일괄 선택) + DB정보(부재 기록·미팅 연결). 운영 데이터 일괄 수정·마이그레이션 없음 — 새 값은 모두 리드 `data`(jsonb) 의 선택 필드라 옛 행은 그대로 읽힌다.

## PR 나눔
- **PR 1 — A+C** `feat/db-sheet-bulk-absent-link` (base origin/master `6592f72c`)
- **PR 2 — B+D** `feat/db-sheet-absence-meeting-link` (PR 1 위에 쌓음)

## A. 표 일괄 선택 · 줄 누르면 DB정보 (PR 1)
- [x] 번호 칸 앞 체크칸 + 보이는 줄 전체 선택(일부면 indeterminate). 선택은 화면 상태(저장 안 함), 필터에 걸린 줄만 작업 대상.
- [x] 일괄 줄: 「유입 반영」「유입 미반영」 — 줄마다 기존 `inflow-preview` → `inflow`(막힌 줄은 이유와 함께 건너뜀, 이미 그 상태면 건너뜀).
- [x] 「삭제」 — 확인 팝업 대신 10초 「되돌리기」. 줄마다 `delete-preview` 로 막힘만 확인하고 화면에서 숨김(서버 무변경). 10초 뒤 기존 `delete`(confirmed) 확정. 되돌리면 같은 객체·같은 자리로 복원. 화면을 떠나면 DirtyGuard: 저장=확정, 버리기=되돌리기. 확정 실패 줄은 목록에 되살리고 안내.
- [x] 표 안 편집은 컨택결과·다음 연락일만(`QUICK_EDIT_KEYS`). 나머지 칸은 누르면 DB정보.
- [x] 표에서 재통화로 바꾸고 다음 연락일이 비면 그 줄 아래 「재통화 일정을 정해 주세요」(DB정보 안내와 같은 문구).
- [x] 자율결정: 다음 연락일 칸을 기본 표시 항목에 넣고, 예전 저장값(v5 이하)에는 컨택결과 뒤에 한 번 넣는다(`db-sheet-v6-columns`). 숨겨 둔 사용자가 다시 끄면 그대로. 되돌리기 = 이 커밋 revert.

## C. 장기관리 · 진행종료 (PR 1)
- [x] `manualStage`(장기관리·진행종료·DB컨택중) — 새 명령 `stage`. 일반 저장은 보존, 새 컨택결과 기록·미팅 등록은 지움(다시 연락을 시작했다는 뜻). 미팅 연결 행은 거부.
- [x] 현재상태 정렬·필터 칩 「장기관리」(현재상태 기준). AS신청 → 진행종료 규칙 유지.
- [x] 오늘 챙길 일(첫 연락·다시 연락)에서 장기관리·진행종료 제외(`leadIsActive`).
- [x] 「DB컨택중으로 되돌리기」 — 부재 결과여도 DB컨택중(직접 정한 값).

## B. 부재 기록 (PR 2, `feat/db-sheet-absence-meeting-link`)
- [x] 리드 `absences`(날짜·시각 08~21) — `absence` 명령, 같은 날짜·시각 한 번, 최근 60줄. 컨택결과·실적 무변경.
- [x] DB정보 「부재 기록」 상자: 목록·추가·지우기·시간 막대·안 걸어 본 시간대 안내. 미팅 연결 행엔 없음.
## D. 따로 잡은 미팅 연결 (PR 2)
- [x] 후보 `GET /api/db-sheet/meeting-candidates?lead=` — 안 이어진 STEP 2 미팅 중 같거나 비슷한 업체명((주)·공백 무시), 취소·삭제·이전 기록·uuid 아닌 옛 id 제외, 최대 10.
- [x] `link-meeting` — meetingId 만 채움(`linkedExisting`), 실적(sales 행) 무변경 시험으로 확인, 다른 DB 에 연결된 미팅 거부. 지연(다시 연락) 목록에서 빠짐.
- [x] `unlink-meeting` — 「연결」로 붙인 것만, 현재상태 다시 계산.
- [x] 실제 1건(지연 알림 업체)은 belie 결정대로 수강생이 직접 연결 — 에이전트가 운영 데이터를 바꾸지 않는다.

## 검증 (PR 2)
- `tests/repo/db-sheet-absence-meeting-link.pglite.test.ts`(6) + DB관리시트 시험 424개 통과. 실화면(db-sheet-live, 합성 미팅 2건) 1280: 부재 2건 기록·시간 막대·안내, 후보 2건 → 연결(현재상태 미팅예약·부재 상자 숨김) → 풀기(미컨택·후보 다시 표시).

## 검증
- PR 1: `tests/components/db-sheet-bulk-store.test.ts`(7) · `tests/components/db-sheet-grid-selection.test.ts`(10) · `tests/repo/db-sheet-manual-stage.pglite.test.ts`(5) + 기존 DB관리시트 시험 33파일 통과.
- 실제 화면: db-sheet-live(실제 페이지+API+합성 PGlite) 1280·375 — 결과는 PR 본문과 워크로그.
