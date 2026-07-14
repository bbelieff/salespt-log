---
slug: carryover-mirror-partial-4
status: active
created: 2026-07-15
completed: 2026-07-15
owner: belie
related: fix-contract-carryover-flag-clobber, db-write-flip, arena-carryover-migration
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: #558(이월 flag 클로버 수리)이 **PARTIAL** 이라는 DevD 판정의 잔존 4건을 해소 — 누출 차단(F:AH 화이트리스트)·flag 쓰기 내구성·리페어 방안 정정·날짜 폴백 가드.
> - **누가 읽나요**: 개발자, 에이전트, 운영자(belie)
> - **어떤 기능·작업과 연결?**: `contracts-clear.ts`(미러 payload)·`contract-payment.ts`(appendFromContract)·`arena-carryover.ts`·`scripts/ops/repair-carryover-flag.mjs`
> - **읽고 나면 알 수 있는 것**: #558 이 왜 부분수리였나 / 왜 backfill 리페어가 무효인가 / 왜 append 통째 dual-sync 는 안 되나
> - **관련 문서**: `docs/plans/completed/fix-contract-carryover-flag-clobber.md`(1차·§4 리페어 방안 **무효**), PR #541 DevD 코멘트, #558

# #558 PARTIAL — 잔존 4건 해소

## 0. 판정 (DevD, issuecomment-4970999949)
- ✅ **write-path CLOSED**: `updateUserFields` 가 `userFieldsMirrorPayload` 를 경유하도록 한 #558 수리는 **정확**(모든 호출부 자동 커버). "클로버 경로 잔여 0" 은 참.
- 🔴 **잔존 4건** — 내 1차 감사는 **"클로버 경로"만** 봤고 **누출·내구성·리페어 방식**을 못 봤다. DevD 가 옳다. (기록정정: worklog)

## 1. ③ 누출 — 미러 payload 를 **F:AH 화이트리스트**로 (해소)
- **문제**: `userFieldsMirrorPayload` 가 `구분`·`이월원본행id` **만** 제외 → **해지(AL~AO)·`linkedMeetingId`(AK)** 는 여전히 미러. `arena-carryover` 는 **이전 기수의 옛 계약(외래 소스)** 을 넘기므로, **해지된 옛 계약을 이월하면 DB 만 해지**(반환액 차감·해지 뱃지) / 시트는 미해지 → 갈림. 게다가 옛 기수 미팅 id(AK)가 새 행에 누출.
  - ⚠️ **기존 테스트가 "해지일 보존(무해)" 을 스펙으로 고정**하고 있었다 → 테스트도 정정.
- **수정**: denylist → **화이트리스트**. `updateUserFields` 가 시트에 실제 쓰는 **F:AH** 필드만 담는다(체크박스 7 + 수납1~3 + 로드맵메모). C/D/E 도 F:AH 밖이라 제외(정본 = `appendFromContract`·`updateLinkFields`·`syncFeeFromContract`).
- **이점**: 앞으로 **AP 이후에 필드가 늘어도 자동 누출되지 않는다**(denylist 였다면 누출).

## 2. ② flag 쓰기 내구성 — carryover 만 dual-sync 승격 (해소)
- **문제**: `구분='이월'` 의 **유일한 DB writer** 가 `appendFromContract` 의 `mirrorSheetRow` = **fire-and-forget(재시도 0·throw 0, warn 만)**. 1회 실패 → DB 에 flag 없음 / 시트 AI='이월' → **클로버와 동일한 divergence 가 실패 트리거로 재현**.
- **DevD 권고 (ii) "appendFromContract dual-sync 편입" 은 그대로 채택 불가** — `addPriorContract` 는 매 호출 **새 `prior:uuid`** 라 **멱등키가 없다**. dual-sync(실패 throw) 를 걸면 사용자 재시도가 append 를 재실행 → **중복 계약행 = 매출 이중계상**(db-write-flip §6 R3-3 에 명문화된 안전장치).
- **채택안(자율결정·reversible)**: `appendFromContract` 에 `opts?: ContractWriteOpts` 를 열고, **시트 AJ 원본키가 멱등키인 `arena-carryover` 만** `{syncDb: dbPrimary}` 로 승격. 실패해도 재실행 시 `carriedC` 가 skip 하므로 **중복행이 안 생긴다**. `addPriorContract`·`addFromContract` 는 **기존 no-throw 미러 유지**.
  - `arena-carryover` 는 `updateUserFields` 에도 같은 opts 를 넘겨 복사 전체를 파일럿에서 durable 하게.
  - **Revert**: opts 인자 제거(기존 미러로 복귀).

## 3. ① 리페어 방안 **무효 → 정정** (실행 전 필독)
- **완료 plan `fix-contract-carryover-flag-clobber.md` §4 의 "시트 AI→DB backfill" 은 실행해도 안 고쳐진다.**
  `contractFromDbPayload` 가 ①**열문자**(AI) 복원 → ②**필드명 키 overlay** 순이고, overlay 는 `p[k] !== undefined` 만 보므로 jsonb 에 잔류한 **`구분: ''`(빈 문자열)가 backfill 의 `AI:'이월'` 을 항상 이긴다**.
- **유효한 리페어** = **필드명 키 `구분:'이월'` upsert**(또는 payload 에서 `'구분'` 키 제거).
- **신규 스크립트**: `scripts/ops/repair-carryover-flag.mjs` — 시트 AI='이월' 을 정본으로 DB 에 필드명 키 `{구분:'이월', 이월원본행id:<AJ>}` jsonb 병합. **기본 dry-run**, `--execute` 로 반영. 역방향(DB만 이월)은 **보고만**. VPS 실행(SA·DATABASE_URL 보유).
- 실행은 **belie 결정**(📥#5 — 프로덕션 실데이터).

## 4. ④ 날짜 폴백 **제거 금지** (가드)
- flag 신뢰는 **463d0a5(#558) 이후 기록된 행에만** 성립. 그 이전 파일럿 DB 이월행은 리페어 전까지 `구분=''` → `isCarryoverContract` 의 **날짜 폴백만이 유일한 구제책**(load-bearing).
- `computeContractRevenue` 는 **flag-only**(`p.구분 === "이월"`, 날짜 폴백 없음) — **DB-read 경로에 배선 금지**(즉시 아레나 팽창). 현재 프로덕션 호출부 없음.
- **가드 테스트 박제**: `contract-carryover-split.test.ts` 에 "클로버된 옛 행(구분='')도 날짜로 구제" 케이스 + 제거금지 주석.

## 5. 수용 기준
- 화이트리스트 단위테스트(F:AH만·해지/AK/구분 누출 0·원본 무변) + **호출부 회귀**(DevD iv — `persistContractRow` 가 받는 payload 에 누출 키 0). ④ 가드 테스트. check.sh 초록. §6.8 배포·health 200.

## Log
- 2026-07-15 구현(DevC): DevD 판정 4건 **코드로 직접 검증 후** 해소. ①`contractFromDbPayload` 열문자→필드명 overlay 순서 확인 → backfill 리페어 무효 확정, 정정 스크립트 신설. ②`mirrorSheetRow` = 재시도0·throw0 확인 → carryover 만 dual-sync 승격(append 통째 승격은 중복행 위험으로 기각). ③화이트리스트 전환 + **잘못된 스펙을 고정하던 테스트 정정**. ④날짜 폴백 가드 박제. **기록정정**: 내 "전수감사 잔여 0" 은 클로버 경로 한정이었고 누출·내구성은 못 봄 — DevD 가 옳다.
