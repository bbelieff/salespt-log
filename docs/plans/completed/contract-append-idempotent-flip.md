---
slug: contract-append-idempotent-flip
status: completed
created: 2026-08-05
completed: 2026-08-09
owner: FM(260804) 발급 · 실행 = 경영일지 작업원C → 데탑 C작업원C(260809) 승계 완주(레인 repo-db)
related: db-write-flip, r3-3-meeting-contract-dual-sync
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 계약 "신규 추가"까지 DB 정본으로 넘기기 위한 실행 계약 — 핵심은 **중복 계약행(매출 이중계상) 위험의 해소 설계**.
> - **누가 읽나요**: 실행 워커(DevA), 반장(FM), 운영자(belie)
> - **어떤 기능·작업과 연결?**: `lib/repo/contract-payment.ts appendFromContract` · `lib/service/contract-payment.ts addFromContract·addPriorContract` · `lib/service/arena-carryover.ts`
> - **읽고 나면 알 수 있는 것**: 왜 append 만 남겨뒀나 / 중복행을 어떻게 막나 / 무엇을 검증해야 끝인가
> - **관련 문서**: `db-write-flip.md` §6 R3-3 · `r3-3-meeting-contract-dual-sync.md`(고치기·지우기 전환 완료분)

# 계약 신규 추가 DB 정본화 (append flip) — 실행 계약

## 0. 배경 — 왜 이것만 남았나

R3-3 으로 계약의 **고치기·지우기**는 DB 정본이 됐다(#535·#537·#544·#666). **추가(append)만** 아직
시트 우선이다. 이유는 하나뿐이다:

> `appendFromContract` 는 `findFirstEmptyRow` 로 **그때그때 빈 행**을 잡는다. 행 번호가 곧 DB 키(`r{row}`)다.
> 여기에 DB 동기 쓰기를 붙이면, DB 가 실패해 사용자가 **다시 저장** 했을 때 **새 행이 하나 더 append**
> 된다 → **같은 계약 2줄 = 매출 이중계상**. 그래서 R3-3 은 append 를 의도적으로 제외했다.

belie 승인(2026-08-05, 앞선 "보류" 결정을 뒤집음)에 따라 이 위험을 **먼저 없애고** 전환한다.

## 1. 위험 해소 설계 — "append" 를 **자연키 upsert** 로 바꾼다

행 번호를 키로 쓰는 한 재시도는 안전해질 수 없다. 그래서 **행을 잡기 전에 자연키로 기존 행을 먼저
찾는다.** 찾으면 update, 없을 때만 append. 이러면 몇 번을 다시 눌러도 행은 하나다.

| 경로 | 자연키(이미 시트에 있음) | 재시도 시 동작 |
|---|---|---|
| `addFromContract`(미팅에서 계약) | **AK = 연결 미팅 id**(`meetingId`) | 같은 미팅 → 기존 행 update |
| ↳ 미팅을 못 찾은 경우(폴백) | **계약일 + 업체명**(C·D) | 같은 날 같은 업체 → 기존 행 update |
| `addPriorContract`(이전 계약 직접 등록) | **AJ = `prior:<uuid>`** — 지금은 **서버 호출마다 새로 발급**돼 멱등이 아니다 → **요청 단위 id 로 승격**(클라이언트가 보낸 값 사용, 없으면 계약일+업체명+수임비 조합으로 중복 검사) | 같은 요청 재시도 → 기존 행 update |
| `arena-carryover`(이월 복사) | **AJ = 원본행id** (이미 멱등) | 이미 `{syncDb}` 승격 완료 — 변경 없음 |

찾기는 기존 `findRowByLink`(id 우선 → 계약일+업체명 폴백)를 그대로 쓴다. **새 검색 로직을 만들지 않는다.**

### 그다음에야 DB 정본 전환
자연키 upsert 가 들어간 뒤에만 append 경로에 `{ syncDb }` 를 관통시킨다. 순서는 R3-3 잔여와 동일하게
**파일럿은 DB 먼저 확정 → 시트**가 아니라 **시트 append(행 확보) → DB upsert(같은 자연키)** 로 둔다 —
여기서는 재시도가 자연키로 수렴하므로 시트-first 여도 치유 가능하다.

### 남는 경쟁 조건(명시)
같은 사람이 **두 창에서 동시에** 저장을 누르면 두 요청이 각각 빈 행을 잡을 수 있다(원자적 예약 불가).
자연키 검사가 두 번째 요청에서 첫 행을 찾아 update 로 수렴하지만, **완전 차단은 아니다**.
→ 수용 기준에 "동시 2요청" 테스트를 넣고, 남는 확률은 문서에 남긴다(행 잠금은 Sheets 로 불가).

## 2. 실행 계약

```
task_id: CONTRACT-APPEND-IDEMPOTENT-01
base: origin/master@3aaca3d
branch: feat/contract-append-idempotent    worktree: wt/contract-append-idempotent
owner: DevA 새 몸(레인 repo-db)            reviewer: FM · 게이트키퍼 D(선택)
blocked_by: none (구현 착수 가능) · **머지 blocked_by = 8/7 개막 완료**(§3 창구 조건 3개)
file lease:
  · lib/repo/contract-payment.ts (append 경로) · lib/repo/contract-payment-link.ts(재사용)
  · lib/service/contract-payment.ts (addFromContract·addPriorContract)
  · tests/repo/contract-append-idempotent.test.ts(신규) · tests/service/contract-append-gate.test.ts(신규)
  · docs/plans/active/contract-append-idempotent-flip.md · docs/worklog.md
lease 밖: lib/service/contact.ts · 06/03/01 구역 · gcal · app/** · components/** · arena-carryover(불변 확인만)
```

**수용 기준**
1. 같은 계약을 **연속 3회 저장**해도 02 행은 **1개**(미팅 경유·이전계약 등록 양쪽).
2. DB 동기 실패 후 재시도 → 행 1개 + DB 1행(자연키 upsert 로 수렴). 실패는 삼키지 않고 사용자 에러.
3. **비파일럿·`DATABASE_URL` 미설정 = 완전 불변**(호출 인자·부작용 회귀 테스트로 고정).
4. `arena-carryover` 경로 **동작 무변경**(기존 AJ 멱등 + `{syncDb}` 유지) — 회귀 테스트로 고정.
5. 동시 2요청 시나리오 테스트 존재 + 남는 확률을 이 문서에 기록.
6. `scripts/check.sh` 초록 · §6.8 완주(머지 → 배포 success → health 200).

**NOT_RUN (엄수)**
- 수강생 실데이터 수정·시트 수기값 덮어쓰기·리페어 스크립트 실행 **금지**(그건 결정함 9번 별건).
- DB 키 스킴 전면 교체(B안 재키잉) **금지** — 이 계약은 자연키 upsert 까지만.
- `lib/service/contact.ts`·06/03/01·gcal 미접촉. 500줄 캡 초과 시 **분리 선행**(R3-3 선례대로 재수출).

**롤백**: 이 PR revert 1건(squash). 되돌리면 append 는 다시 시트-first + async 미러(현행)로 복귀.

## 3. 머지 창구 (총괄 권고 접수 2026-08-05 — 계약 조건으로 승격)

**구현·PR·리뷰는 지금 진행. 단 머지·배포는 8/7 아레나 개막 이후 창구로 한다.**
(앞선 FM 판단 "8/6 초록이면 8/6 머지"는 **폐기** — 총괄 권고가 더 보수적이고, 8/6 은 A2 배치 55시트
검증일이라 매출 코드 배포를 겹치면 사고 원인 분리가 어려워진다.)

머지 전 **선행 조건 3개를 모두** 만족해야 한다:
1. **중복 방지 장치 선행 완료** — §1 자연키 upsert 가 테스트로 고정(연속 3회 저장 = 1행, 동시 2요청 수렴).
2. **레인 충돌 검사 통과** — 머지 직전에 다음 둘과 파일 교집합 0 확인:
   · 아레나 **W2**(`scripts/ops/arena-season2-batch.mjs` · 운영 데이터 · registry)
   · **카페 hw_config**(BBE-43, 8/7 개강 동시 반영분)
   겹치면 §3.5 대로 **순차** — 아레나·카페가 먼저다(개강·개막 크리티컬 패스).
3. **개막 안정 확인** — 8/7 A2 전환(`--flip-emails`) 후 전광판·health 정상 확인된 뒤.

→ 실무 순서: **8/5~8/6 구현 + PR 오픈(초록 유지) → 8/7 개막 완료 → 8/8 이후 머지 → §6.8 완주.**
belie 가 조기 머지를 명시 지시하면 그 지시가 우선한다(이 절만 무효).

## Log
- **2026-08-09 완주 (데탑 C작업원C(260809) 승계)** — PR **#746**(`b67de8a`) 머지 · 배포 run
  `31287998919` success · health 200(16:58 KST) · check.sh 초록(PR check `31287768440`).
  파일럿 실데이터 before/after 대조 = 24샘플 24/24 정상(감사 run `31287774124`, PR #746 코멘트).
  수용 기준 판정: **1 ✅**(연속 3회 = 1행, 테스트 고정) · **2 부분**(자연키 upsert 로 수렴은 고정,
  단 이 계약의 NOT_RUN 대로 append 의 `{syncDb}` 관통은 **미실행** — DB 정본 전환은 후속 카드)
  · **3 ✅**(dbEnabled/cohort 미참조 = 구조적 불변) · **4 ✅**(arena-carryover 회귀 테스트) ·
  **5 ✅**(동시 2요청 테스트 존재 + §1 잔여 확률 문서화) · **6 ✅**(§6.8 완주).
  **잔여 위험(신규 발견, worklog 결정함 17번)**: `findRowByLink` 는 meetingId 가 있어도 **못 찾으면**
  (계약일+업체명) 폴백까지 내려간다(`lib/repo/contract-payment.ts:346`). addFromContract 는 항상
  `dateCompanyFallback=true` 를 넘기므로, **같은 날·같은 업체의 서로 다른 계약 2건**이 한 행으로
  합쳐질 수 있다(수리 전에는 2행) → 그 조합에서만 매출 과소계상. 테스트 미커버. 후속 카드 권장안 =
  "meetingId 가 있는데 못 찾은 경우엔 폴백 금지 + 옛 행은 AK 백필". 별건으로 **기존 중복 1건**
  (9기 실데이터, 결정함 16번) 발견 — 이 PR 이전부터 존재, NOT_RUN 준수로 미수정.
- 2026-08-05 FM 발급. belie 승인(앞선 보류 뒤집음) + "중복행 위험 해소 설계 명시" 요구 반영 —
  §1 자연키 upsert 설계로 답함. 실행은 DevA 새 몸 배차(레인 repo-db, 충돌 0).
