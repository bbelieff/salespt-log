> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 화석 코드 정비 A(바로 정리) — 아무도 안 쓰는 코드·옛 정책 상수·시트 시절 함수를 동작 변화 없이 지운다.
> - **누가 읽나요**: 개발자, 운영자(belie)
> - **어떤 기능·작업과 연결?**: 화석 코드 전수 조사(2026-10-15, 기준 커밋 1bda4f66) A1~A9 · ADR-0030·0031·0032
> - **읽고 나면 알 수 있는 것**: 무엇을 지웠고 왜 안전한가 / 일부러 남긴 것 / 되돌리는 법
> - **관련 문서**: `docs/plans/active/yc-hardening-safe-fixes.md`, `docs/architecture.md`, `docs/quality.md`

---
slug: fossil-a1-dead-code
status: active
created: 2026-10-15
branch: chore/fossil-a1-dead-code
---

# 화석 코드 정비 A1 — 안 쓰는 코드 삭제

## 지운 것 (호출 0건을 다시 세고 지움)

| 묶음 | 대상 | 근거 |
|---|---|---|
| 컴포넌트 3 | `contact/_components/MeetingDirtyGuard.tsx`·`MeetingSlotCard.tsx`, `components/ui/MetricStepper.tsx` | import 0 — 전역 `DirtyGuard`·현재 컨택 패널이 대체 |
| API 1 | `app/api/admin/users` | fetch 0 — 화면은 서버에서 직접 읽음 |
| 시트 레지스트리 시절 함수 | `repo/users.ts` 7개, `cohorts.getCohortStatus`, `users-arena.findArenaSheetIdByName`, `sales.readProfile`, `drive-txt.upsertTxtInFolder`, `service/contact.getMeetingById`(+재수출), `service/index.resolveUser`, `query.useMonthsMeetings`, `config.cohortMasterSheetId` | 호출 0 |
| 전환 검증·옛 경로 | `dashboard-aggregates.shadowCompareDashboard`, `gcal-sync.onMeetingChanged`, `me.computeGraduationISO`(테스트용 사본 — 정본은 `service/cohort-dates`) | 호출 0 |
| 실행 불가 코드 | `repo/db/expense-ledger.ts` `return;` 뒤 표 생성 53줄 | 도달 불가 |
| 사본 | `repo/db/read-db-tab.ts` 열문자 변환 → `@/util/sheet-column` | AZ 이후 오동작하던 사본 |
| 옛 시트 좌표 | `SHEET_RANGES.sales.revenueCols`(Q~T), `contractPayment.progressCols`, `dashboard.summary`, DB관리 섹션 `formulaCols: []` | 참조 0 |
| 폐지된 정책 상수 | `EDIT_WINDOW_DAYS`(69), `ALLOWED_GRAD_OFFSETS` | ADR-0031 편집유예 폐지 · 참조 0. 구조 테스트 G2 는 "되살리지 말 것" 안내로 |

## 일부러 남긴 것

- `chooseWriteSource` — `chooseDailySource` 와 본문이 같지만 **쓰기만 따로 되돌리는 스위치**라 남긴다(ADR-0030 §4 롤백 경계).
- `computeContractRevenue` — 운영 호출 0 이지만 테스트 14곳이 이월·해지 규칙을 이걸로 검증 중 → 테스트 이관과 함께 별도.
- `app/api/weekly-goals/students` — fetch 0 이나 라우트 테스트가 있어 별도.

## 검증 · 되돌리기

- typecheck 통과, `check.sh`(pre-commit) 전체. 동작 변화 없음(삭제·주석·사본 교체만).
- 되돌리기: squash revert 1건.

## 후속 (2026-10-15) — 연습장 실측 근거 삭제
- 옛 이월 payload `{_carryRaw}` 분기(`read-daily.ts readMeetingRowStateFromDb`) — 가짜로 바꾼 운영 사본에서 meetings 탭 `_carryRaw` **0행**. 열문자 legacy 복원 분기는 그대로.
