> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: R6 비용 카테고리 lifecycle 후보를 최신 master의 회귀 수정과 함께 안전하게 다시 통합하는 실행 계획입니다.
> - **누가 읽나요**: R6 구현자, 독립 검증자, migration·release 담당자
> - **어떤 기능·작업과 연결?**: PR #622의 exact20 R6 경로와 2026-07-26 이후 비용원장 수정
> - **읽고 나면 알 수 있는 것**: 어떤 충돌을 보존해야 하는가 / 무엇을 검증해야 하는가 / release 전에 어떤 HOLD가 남는가
> - **관련 문서**: `docs/worklog.md`, `docs/domains/data-model.md`, PR #622

# R6 Current-Master Integration R1

status: active
work-id: R6-CURRENT-MASTER-INTEGRATION-R1
base: 3fe78acc233deaeccf65b2dd181bd420395b7877

## 목표

PR #622의 검증된 R6 lifecycle·UI·cache 계약을 현재 `origin/master` 위에 재통합한다. post-d629 master의 #629 rollback, #633 날짜 매핑 수정, #640 반복비용 split 무효화와 이후 dashboard/auth 수정은 보존한다.

## 범위

- R6 `d629152f..d934c17d` exact20 경로
- 이 계획과 `docs/worklog.md` append-only checkpoint
- 충돌은 verified R6 기능과 current-master 수정의 합집합만 최소 해소한다.

## 주요 충돌

- UI: `ExpenseLedgerDialog.tsx`, `ExpenseLedgerTable.tsx`, `expense-ledger-ui.test.ts`
- 계약·저장소: `lib/types/expense-ledger.ts`, `lib/service/expense-ledger.ts`, `lib/repo/db/expense-ledger.ts`
- #629가 삭제한 `expense-ledger-db-cost-ui.test.ts`는 자동 복원하지 않고 필요한 R6 assertion만 retained test에 보존한다.

## 검증

- [x] verified lineage를 `838540b2` → `675d1eb6` → `ca88e125` 순서로 통합하고 conflict marker 0
- [x] exact20별 verified byte 유지 또는 master 보존을 위한 delta 기록
- [x] lifecycle API/repo/service, cache, UI, current-master 비용 호환 focused 13 files / 95 tests PASS
- [x] typecheck, `scripts/check.sh` (structural 23/23, unit/integration 901/901), production build 70/70, diff-check, 정상 hook
- [ ] commit/push 후 DRAFT/HOLD successor PR; migration-before-ready 문구 유지
- [ ] 독립 verifier와 DevG에 exact SHA/tree/manifest 전달

## verified exact20 결합 결과

원본 `d934c17d`와 byte-identical인 13개 경로는 그대로 유지한다. 아래 7개만 post-d629 master 계약을 보존하기 위해 달라졌다.

- `ExpenseLedgerDialog.tsx`: lifecycle 삭제·재분류와 2탭 record hub는 유지하되 #629 이후의 상단 DB/additional 합계 props를 보존하고, 반복 규칙 future 수정은 현재 master처럼 다음 달부터 적용한다.
- `ExpenseLedgerTable.tsx`: #629가 제거한 DB system-cost row 계약은 복원하지 않고 현재 `ExpenseLedgerView`를 유지하며, 반복 행의 이동 대상만 record hub로 바꾼다.
- `lib/repo/db/expense-ledger.ts`: R6 category lock·불변 검사를 #640의 split close-date·미래 occurrence void 로직과 합친다.
- `lib/service/expense-ledger.ts`, `lib/types/expense-ledger.ts`: R6 system-category 불변·삭제·재분류 계약을 유지하되 #629가 되돌린 DB-cost parity 필드·enum은 재도입하지 않는다.
- `tests/components/expense-ledger-db-cost-ui.test.ts`: #629의 삭제 상태를 유지한다. R6 lifecycle UI assertion은 retained `expense-ledger-ui.test.ts`와 cache test에서 검증한다.
- `tests/components/expense-ledger-ui.test.ts`: current-master 합계·날짜·반복비용 회귀와 R6 record hub·삭제·재분류·44px target을 한 suite로 결합한다.

## production-data successor tuple binding

이 후보의 migration 호환 판정은 Foreman이 독립 PASS로 동결한 최신 tuple에 결합한다: protected digest `4cf80e9a…`, business digest `5d15af3f…`, pre totals `b9b4427c…`, expected post-D `73f17d02…`, bootstrap `+1`, audit `+1`, moves `0`. 이 문서는 해당 값을 실행 권한으로 해석하지 않으며, DevE integrated PASS 전후 모두 production DB write는 금지한다.

## 금지·HOLD

DB migration A-D, env/PM2, live·Sheets·운영 데이터 write, PR ready·merge·deploy는 이 작업 범위가 아니다. 독립 integrated PASS와 별도 migration GO 전까지 DRAFT/HOLD를 유지한다.

## 진행 실측 (2026-08-03 · A(260803))

- successor PR 은 **머지됨**: `3b50096 feat(expenses): R6 lifecycle current-master integration [HOLD] (#647)`.
  즉 위 검증 목록의 "commit/push 후 DRAFT/HOLD successor PR" 은 충족됐다.
- 다만 **HOLD 는 해제되지 않았다** — DB migration A-D·독립 integrated PASS·migration GO 가 남아 있다.
  따라서 이 계획서는 `completed/` 로 옮기지 않고 **active 유지**한다.
- 배포 실측 (2026-08-03 A(260803) 보강): "Deploy to VPS" run `30737985008` (headSha `3b50096`) = **success**.
  공개 health 200 확인. 운영 DB write 는 계속 0 — HOLD 상태는 그대로다.

## Rollback

successor PR은 current master 기반 단일 통합 commit으로 유지한다. 검증 실패 시 PR을 머지하지 않고 candidate branch만 폐기 가능하며, production·DB 상태는 변하지 않는다.
