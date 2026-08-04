---
slug: r3-3-meeting-contract-dual-sync
status: completed
created: 2026-08-05
owner: FM(260804)
related: db-write-flip, r3-single-cell-writers, 0010-meeting-reservation-card-count
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: R3-3 잔여 — 미팅 화면(04)에서 일어나는 02 계약 쓰기 6경로가 파일럿에서 DB 동기화 없이 시트만 바꾸던 구멍을 막는다(삭제 cascade 5 + 링크 편집 1).
> - **누가 읽나요**: 개발자, 에이전트, 운영자(belie)
> - **어떤 기능·작업과 연결?**: `lib/repo/contract-payment.ts:clearRowByLink` · `lib/service/contact.ts`(cascade·patchMeeting) · `lib/repo/db/contracts-clear.ts`
> - **읽고 나면 알 수 있는 것**: R3-3 PR-1/PR-2 뒤에 무엇이 남았나 / 왜 파일럿에게 유령 계약이 생길 수 있나 / 왜 DB 를 먼저 쓰는가
> - **관련 문서**: `docs/plans/active/db-write-flip.md`(R3 SoR §6 R3-3) · `docs/plans/active/foreman-linear-ops-r1.md`(반장 체제)

# R3-3 잔여 — 미팅 화면발 02 계약 쓰기 dual-sync (BBE-39)

## 0. 착수 선언 (§3-0)

belie 승인(2026-08-05 "R3-3 착수 승인"). **FM(반장)이 A 트랙 구역(02 계약 쓰기 경로)을 이 PR 한정으로
점유**한다 — A 트랙에 현재 활성 몸이 없고(신규 작업 대기), C 트랙 종료로 02 구역 소유권이 A 로 이관돼
있었다. 완료 후 구역은 A 로 반환한다.

## 1. 실측 — R3-3 은 어디까지 됐고 무엇이 남았나

| 항목 | 상태(실측 2026-08-05, `origin/master=af6bfb1`) |
|---|---|
| contracts 편집 4종(수납슬롯·계약일/업체명·수임비·해지) | ✅ 머지됨(PR-1, #544 계열) — `syncDb` 게이트 배선 완료 |
| company_archive(06) upsert·rename | ✅ 머지됨(PR-2) + fix-forward 2회(#548·#559 종결) |
| contracts **append** | 의도적 제외 유지 — 행번호를 시트가 할당해 재시도가 중복 계약행(매출 이중계상). B안(재키잉)은 belie 후속 결정 |
| 읽기 동반 flip(R3-2 의무 ⓐ) | ✅ 이미 충족 — `loadContractPayments`·대시보드가 `readContractsFromDb` 사용(R2-4 라이브) |
| TXT 내보내기 DB 기준 | ✅ 충족 — `/api/company-info/export` 는 화면이 넘긴 값을 Drive 에 쓸 뿐, 그 값의 출처가 이미 DB(파일럿) |
| **미팅 화면(04)발 02 쓰기 6경로** | ❌ **미배선 — 이번 PR 대상** |

### 무엇이 구멍인가 (파일럿 = DB 가 화면 정본)

`lib/service/contact.ts` 가 02 를 건드리는 6곳이 `{ syncDb }` 없이 repo 를 부른다:

| # | 경로 | 함수 | 결과(파일럿) |
|---|---|---|---|
| 1 | 미팅 상태를 계약→비계약으로 수정 | `patchMeeting` → `clearRowByLink` | 계약카드가 화면에서 안 지워질 수 있음 |
| 2 | 계약 미팅의 날짜·업체명 수정 | `patchMeeting` → `updateLinkFields` | 화면 계약카드가 옛 날짜·옛 업체명으로 남음 |
| 3 | 자손 미팅 cascade 삭제 | `cascadeDescendantMeetings` | 자손 계약카드가 유령으로 잔존 |
| 4 | 미팅 삭제(본인 계약) | `removeMeetingWithCascade` | 삭제한 계약이 화면·매출 집계에 잔존 |
| 5 | 미팅 결과 되돌리기(계약→예약) | `revertMeeting` | 되돌렸는데 계약카드 잔존 |
| 6 | 변경 미팅 되살리기 cascade | `restoreChildMeeting` 계열 | 위와 동일 |

이 경로들은 지금 **fire-and-forget 미러(3회 재시도 후 warn)** 에만 의존한다. 미러가 최종 실패하면
시트에서는 지워졌는데 **DB(=파일럿 화면 정본)에는 계약이 살아남아** 매출·퍼널이 과대 집계된다.
읽기는 이미 DB 로 넘어가 있어(위 표) **read-your-writes 위반**이다 — R3-2 PR-1 이 못박은 의무 ⓐ 위반.

## 2. 설계 — 파일럿은 "DB 먼저, 시트 나중"

기존 `clearRow`(실무/수납 화면 삭제, #532)는 **시트 → DB** 순서다. 이 순서를 링크키 삭제
(`clearRowByLink`)에 그대로 쓰면 **재시도가 성립하지 않는다**:

- 시트 clear 성공 → DB 동기 실패 → throw → 사용자가 다시 삭제 시도
- → `findRowByLink(계약일, 업체명)` 이 **이미 지워진 시트**를 뒤져서 `null` 반환
- → DB 는 영원히 안 지워짐 = **치유 불가능한 유령 계약**

그래서 이 경로만 순서를 뒤집는다(파일럿 한정):

```
파일럿:   DB _cleared 확정(1회 재시도) → 성공 시에만 시트 clear
비파일럿: 기존 그대로(시트 clear → async 미러)
```

- DB 에서 실패하면 **시트를 건드리기 전에 throw** → 아무 것도 안 바뀜 → 재시도가 그대로 성립(멱등).
- DB 성공 후 시트가 실패하면 화면(정본)은 이미 정확하고, 재시도 시 시트 행이 그대로라 다시 찾아
  수렴한다. 즉 **어느 지점에서 끊겨도 재시도가 항상 수렴**한다.
- 이 순서는 R3-1(`writeSalesRowsToDb` 먼저 → 시트 미러)과 같은 R3 표준 형태다.

`updateLinkFields`(경로 2)는 **순서를 바꾸지 않는다** — 호출부가 `meetingId` 를 함께 넘기고
`findRowByLink` 가 id 를 우선 매칭하므로, 시트가 새 값으로 바뀐 뒤에도 재시도가 같은 행을 찾는다.

### 지키는 불변식
- **비파일럿 완전 불변** — 시트 정본 + async 미러. `DATABASE_URL` 미설정도 완전 no-op(롤백 스위치).
- **조용한 반쪽쓰기 금지**(R3 §0) — 파일럿 DB 실패는 삼키지 않고 throw. 단 사용자 문구는 재시도 유도형.
- **§2.5 bulk-write 가드 무관** — 이 PR 은 셀 일괄 덮어쓰기를 추가하지 않는다(기존 clear/update 재사용).
- 미팅 자체의 저장·gcal 경로는 건드리지 않는다(R3-2 PR-2 프리미티브 그대로).

## 3. 실행 계약

```
task_id: R3-3-MEETING-CONTRACT-DUAL-SYNC-01
base: origin/master@af6bfb1
branch: feat/db-write-meeting-contract
worktree: wt/r3-3-meeting-contract-sync
owner: FM(260804) — A 트랙 구역 한시 점유(완료 시 반환)
reviewer: belie(승인 게이트) · 게이트키퍼 D(사후 판정 요청 가능)
blocked_by: none (belie 킥오프 완료)
file lease:
  · lib/repo/contract-payment.ts        (clearRowByLink 시그니처+순서)
  · lib/service/contact.ts              (syncDb 게이트 6경로 배선)
  · tests/repo/contract-clear-by-link-sync.test.ts     (신규)
  · tests/service/contact-contract-cascade-sync.test.ts (신규)
  · docs/plans/active/r3-3-meeting-contract-dual-sync.md · docs/worklog.md
lease 밖(건드리지 않음): lib/repo/db/*(기존 헬퍼 재사용만) · meetings-write.ts · gcal · 06 경로 ·
  app/** · components/** · 03 DB탭 · 01 영업관리
```

**수용 기준**
1. 파일럿(=DB 정본 기수): 6경로 전부 DB 동기 반영. DB 실패 시 시트 무변경 + 사용자 에러(재시도 유도).
2. 비파일럿: 호출 인자·순서·부작용이 이전과 동일(회귀 테스트로 고정).
3. `DATABASE_URL` 미설정: 전 경로 no-op(예외 없음).
4. 재시도 수렴: DB 성공·시트 실패 후 같은 조작을 다시 하면 최종 상태가 일치.
5. `scripts/check.sh` 초록(typecheck·lint·구조·전체 테스트·500줄 캡·doc-drift).
6. §6.8 완주: PR → 직렬 머지 → 배포 success → health 200.

**NOT_RUN 경계 (이 세션이 하지 않는 것)**
- 수강생 실데이터 쓰기·시트 직접 조작·VPS 접속·DB 마이그레이션 실행 0건.
- contracts **append** flip(B안 재키잉) — belie 결정 사항, 이 PR 스코프 밖.
- 오염 행 리페어 스크립트(과거 스테일 값 치유) — 📥 belie 결정 대기 항목 유지.
- 06/03/01 구역, gcal, 10기 크리티컬 패스(admin·scripts) 파일 일절 미접촉.

## 4. 후속(이 PR 밖 — 기록만)
- `updateUserFields` 全행 payload 의 해지필드 clobber 가능성(PR-1 리뷰 후속①, low·round-trip 안전).
- `arena-carryover` 마이그레이션 경로 미게이트(1회성·append 계열, 후속③).
- append flip(B안) + 오염행 리페어 = belie 결정 후 별도 PR.

## Log
- 2026-08-05 FM(260804) 착수. 실측으로 R3-3 잔여 = "미팅 화면발 02 쓰기 6경로 미배선" 확정
  (PR-1·PR-2 는 이미 머지·라이브). 설계 = 파일럿 한정 DB-first 순서 + 게이트 배선.
- 2026-08-05 **완료(§6.8 완주)** — PR **#666 → `9551c8b`** squash 머지. 배포 run `30939294995` 는
  1차 **VPS ssh 22 타임아웃(7회 재시도 전멸)** 로 실패 → **코드 무관**이라 롤백 대신 `gh run rerun --failed`
  → **success**, 공개 health **200**. 검증 = check.sh 초록 + 전체 115파일 **1019 테스트** green(신규 17).
- 2026-08-05 부수: 500줄 캡 split 2건(`contract-payment-link.ts`·`contact-cascade.ts`, 재수출 유지).
  02 구역 소유권은 A 트랙으로 반환.
- 남은 R3-3 계열(이 문서 밖): contracts append 진짜 flip(B안 재키잉) · 오염 행 리페어 = 📥 belie 결정 대기.
