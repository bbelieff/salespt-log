---
slug: fix-contract-carryover-flag-clobber
status: active
created: 2026-07-14
completed: 2026-07-14
owner: belie
related: contract-count-exclude-terminated, db-write-flip, arena-carryover-migration
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: `updateUserFields` 의 DB 미러가 이월 계약의 `구분='이월'` flag 를 ''로 덮어써(클로버) DB-시트가 갈리고 아레나 수치가 팽창하던 버그를 fix-forward.
> - **누가 읽나요**: 개발자, 에이전트, 운영자(belie)
> - **어떤 기능·작업과 연결?**: lib/repo/contract-payment.ts(updateUserFields·미러), arena-carryover, DB 파일럿 이월 분류, #549 과다계상의 근본 원인.
> - **읽고 나면 알 수 있는 것**: 왜 DB 이월 flag 가 사라졌나 / 어디서 클로버됐나 / 최소 수정은 무엇인가 / 남은 데이터 리페어는 무엇인가
> - **관련 문서**: db-write-flip.md §6(D 후속·low 문서화), PR #541(DevD 검증 코멘트), contract-count-exclude-terminated.md(#549·#553)

# fix — 계약 이월 flag(구분) 미러 클로버

## 0. 버그 (DevD parity 검증, #541 코멘트)
- `arena-carryover.ts:99~105`: 이월 계약을 아레나 시트로 복사 = ①`appendFromContract` 가 새 행에 **구분='이월'** 세팅(시트 AI:AJ + DB 미러 `구분:'이월'`) → ②`updateUserFields(arenaSheetId, {...cp, row})` 가 F:AH 를 재복사하며 **`persistContractRow` 미러에 원본 cp 전체(구분='')를 실어** DB 의 `구분='이월'` 을 jsonb 병합(`payload || excluded.payload`, 신값 우선)으로 **''로 클로버**.
- 결과: **시트 AI='이월' 은 생존**(updateUserFields 는 F:AH 만 씀), **DB 구분만 ''**. → DB-read 이월계약이 `구분=''` → 분류가 `isCarryoverContract` 의 **날짜분기(계약일<시작)로만 구제**됨. 유예기 계약(계약일≥시작)·비-ISO 계약일이면 **DB=아레나 계상 / 시트=제외** 로 갈리고 **아레나 팽창**. #549 채널축 과다계상(#553 fix)의 근본(계약 flag 신뢰 불가)도 이것.

## 1. 수정 (최소·타겟 — 04 쓰기 경로=A 구역 무접촉)
- `updateUserFields` 는 시트에서 **F:AH(사용자 편집영역)만** 쓴다 → AI(구분)·AJ(이월원본행id)는 안 건드림. 그러니 DB 미러에서도 **이 두 flag 를 제외**해야 정합.
- 신규 순수 헬퍼 `userFieldsMirrorPayload(cp)` = `{...cp}` 에서 `구분`·`이월원본행id` 삭제 → `persistContractRow` 에 전달. jsonb 병합이 그 키를 안 건드려 **DB 의 구분='이월' 보존**.
- 이월 마킹은 `appendFromContract` 전담(변경 없음). 다른 미러 경로(`updateLinkFields` 부분 payload·`contract-payment-sync` 수임비·`writeTermination` 해지)는 全행 미러 아님 → 클로버 없음(무접촉).

## 2. 왜 이게 근본 수정인가
- 계약 이월 flag 가 신뢰 가능해지면 `isCarryoverContract` 의 flag 분기가 정상 작동 → 유예기 이월·비-ISO 계약일도 정확 분류. `computeContractRevenue`(이월 매출 분리)·아레나 계상이 DB/시트 일치.
- 채널축(#553)은 미팅 flag(04 AO) 게이트라 이미 무관·정상. 이 수정은 **02 계약 flag** 신뢰성 회복.

## 3. 수용 기준
- 단위테스트: `userFieldsMirrorPayload` 가 구분·이월원본행id 제거(빈 '' 포함)·나머지 보존·원본 무변. check.sh 초록. §6.8 배포·health 200.

## 4. 남은 것 (후속 — 이 PR 스코프 밖)
- **기존 클로버된 DB 행 리페어**: 이 수정은 **향후 클로버 차단**만. 과거 arena-carryover 로 이미 `구분=''` 된 파일럿 DB 이월행은 자가치유 안 됨(carryover 멱등 skip). belie/파일럿 영향 범위 확인 후 결정. (belie=7기=비파일럿=시트경로라 무영향; 8·9·연습·아레나 DB경로만.)
  - 🛑 **[2026-07-15 정정 — 아래 backfill 방안은 무효. 실행 금지]** ~~backfill(시트 AI='이월' → DB 구분 재기록)~~ 은 **실행해도 안 고쳐진다**: `contractFromDbPayload` 가 ①열문자(AI) 복원 → ②**필드명 키 overlay** 순이라, jsonb 에 잔류한 `구분: ''` 가 backfill 의 `AI:'이월'` 을 **항상 이긴다**(DevD ① 판정). **유효한 리페어 = 필드명 키 `구분:'이월'` upsert** → `scripts/ops/repair-carryover-flag.mjs`(dry-run 기본). 상세 = `docs/plans/active/carryover-mirror-partial-4.md` §3.
- D 권고 (b) `channelStackingFromDb`·`computeContractRevenue` date 폴백 통일: channelStacking 은 미팅 flag 기반이라 무관, computeContractRevenue 는 이미 isCarryoverContract(date 폴백 내장) → flag 신뢰 회복 후 추가 불요(YAGNI).

## Log
- 2026-07-14 착수·수정(DevC): DevD #541 parity 플래그 fix-forward. `userFieldsMirrorPayload` 헬퍼 + updateUserFields 미러 교체 + 회귀테스트4. 04 write(A)·03(F)·06(B) 무접촉. **자율결정(reversible)**: 최소 스코프=구분·이월원본행id만 제외(해지/계약일 등 다른 non-F:AH 필드는 arena-carryover 흐름에서 실제 클로버 안 하므로 미변경 — 과한 안전장치 회피). revert=`git revert`. 기존 데이터 리페어는 §4 후속.
