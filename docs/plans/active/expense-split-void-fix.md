---
slug: expense-split-void-fix
status: active
created: 2026-07-28
owner: belie
track: DevE (FOREMAN 배정 ②)
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 반복비용 "다음 달부터 적용"이 같은 달을 이중 계상하던 결함(#625 blocker ③)을 옛 occurrence 무효화 + 발효월 +1 로 고친다.
> - **누가 읽나요**: 개발자(DevE 구현·DevD VERIFY)
> - **어떤 기능·작업과 연결?**: `lib/repo/db/expense-ledger.ts`(splitRecurringRuleFromMonth), `components/dashboard/expense-ledger/ExpenseLedgerDialog.tsx`
> - **읽고 나면 알 수 있는 것**: 왜 두 번 계산됐나 / 왜 "다음 달"이 이번 달이었나 / 실피해가 왜 0인가
> - **관련 문서**: `scratchpad/expense-contamination-inventory.md`(오염 범위 실측), #625 VERIFY 판정, #629(#620 revert)

# 비용원장 split 이중계상 fix-forward (#625 blocker ③)

## 결함 2개

**③-A 이중 계상** — `splitRecurringRuleFromMonth` 는 규칙만 update/insert 하고 **occurrence 를 무효화하지 않았다**.
`unique(rule_id, occurrence_month)` 이고 새 규칙은 다른 `rule_id` 라, materialize 가 같은 달에 occurrence 를
하나 더 insert → **두 행 모두 `active`** → 합산 시 그 달 **이중 계상**(총비용 과대·영업이익 과소).
대조군인 archive(중단) 경로는 이미 `set status='voided' … where occurrence_date > $3` 를 갖고 있었다(#617).

**③-B 라벨과 동작 불일치** — 버튼은 "기록 화면 금액을 **다음 달부터** 적용"인데
`effectiveMonth: month`(= **조회 중인 달**, 기본=이번 달)를 보냈다. → 이미 확정된 이번 달 금액까지 바뀜.

## 수정

| 파일 | 변경 |
|---|---|
| `lib/repo/db/expense-ledger.ts` | split 트랜잭션에 **occurrence void 쿼리 추가**(archive 패턴 재사용: `occurrence_date > close` 이고 `status <> 'voided'`). 경계 계산을 `closeDateBeforeSplit()` 순수함수로 추출 |
| `components/.../ExpenseLedgerDialog.tsx` | `effectiveMonth: month` → **`shiftMonth(month, 1)`** (라벨대로 다음 달부터) |
| `tests/service/expense-ledger.test.ts` | 회귀 3종: 월/윤년/연 경계 close 날짜 · 발효월 occurrence void · anchorDay 25 정렬 |

경계 의미는 기존 `shouldVoidRecurringOccurrenceOnStop`(= `occurrenceDate > stoppedOn`)과 **동일**하게 맞췄다 —
중단·분할이 서로 다른 규칙을 갖지 않도록.

## 실피해 = 0 (조치 전 실측)

배포본 DB 조회(read-only, VPS): `expense_recurring_rules` **4건** · `expense_recurring_occurrences` **0건** ·
`supersedes_rule_id` 보유(=split 사용) **0건**. split 을 쓴 사용자가 아직 없어 **이중 계상 실사례 0**.
③-A/B 는 **첫 사용자가 쓰는 순간 발생할 잠복 결함**이며, 이 PR 이 그 전에 닫는다.

## 범위 밖(의도적)

- **#620 관련 오염 ①②·M1·M2 는 이 PR 대상이 아니다** — #629(revert)로 원인 코드가 이미 사라졌다.
  실측 확인: `parseProductionRow` 의 neo 확대 절 소멸 · `isProductionMeaningful` 원복(=phantom 의 정확한 negation 회복) ·
  `lib/service/db-cost-ledger.ts` 파일 자체 부재.
- **동결 가드 env 미적용**(`EXPENSE_CATEGORY_MIGRATION_FREEZE_R6` 가 VPS `.env` 에 없음 = 원장 쓰기 가능)은
  별건. 이 PR 은 동결 상태와 무관하게 정합하다.

## 수용 기준

- [x] split 이 발효일 이후 옛 occurrence 를 voided 로 전환
- [x] 발효월 = 조회 중인 달 **+1**(라벨과 일치)
- [x] 과거 확정분 무접촉(경계 `>` 유지)
- [x] archive 경로와 동일 경계 의미
- [x] 회귀 테스트 + check.sh 초록 + next build
- [ ] DevD VERIFY → 머지 큐 마지막(W1-1 → #630 → W1-2 → 이 PR)
