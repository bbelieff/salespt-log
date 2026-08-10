---
slug: db-append-rekey
status: completed
created: 2026-08-09
completed: 2026-08-10
worktree: ../wt/bbe59-db-append-rekey
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 03 DB관리 4섹션 append 의 row_key 를 시트 행번호 의존에서 UUID 로 떼어내는 R7 임계경로 마지막 조각(BBE-59, R7-#10)의 설계도.
> - **누가 읽나요**: 개발자(다음 인수 세션 포함), 반장(FM)
> - **어떤 기능·작업과 연결?**: `lib/repo/db.ts`(03 DB관리 4섹션 I/O), `lib/repo/db/db-tab-sync.ts`, `docs/plans/active/sheet-retirement-r7.md`(#10)
> - **읽고 나면 알 수 있는 것**: 왜 append 만 dual-sync 가 안 되는지 / 이번 PR이 뭘 풀고 뭘 안 풀었는지 / 남은 단계는 무엇인지
> - **관련 문서**: `docs/plans/active/sheet-retirement-r7.md` · `lib/repo/db/mirror.ts`(row_key 규칙) · Linear BBE-59

# BBE-59 — 03 DB관리 append 재키잉 (UUID 키 + row_key 마이그레이션)

## Intent (왜)

R7(시트탈출) 로드맵 #10. `sheet-retirement-r7.md` 실측: 03 DB관리 4섹션은 update/clear 8경로가
이미 dual-sync(파일럿=DB 동기 정본, 실패시 throw)인데 **append 4경로만 R2 async 미러**로 남아있다.
이유(§45-46 실측): row_key 가 `{섹션}:r{행번호}`인데 그 행번호를 **시트의 `findFirstEmptyRow` 가
쓰기 시점에** 할당한다 — DB 쪽이 키를 알기 전에 시트 쓰기가 먼저 끝나야 하고, 재시도하면 시트가
다른 빈 행을 다시 골라 **같은 논리적 append 가 DB 에 두 행으로 남는다**(매출 이중계상 위험,
R7 문서가 이 카드를 "매출 데이터 위험 3건" 중 하나로 명시).

부수 발견(이번 Gather 단계, §0.8②): row_key 가 **물리 행 번호**에 묶여 있어서, 행을 지웠다가
(clear = `_cleared:true` 병합) 같은 행 번호에 새 항목을 append 하면 **jsonb 얕은 병합이 옛
필드를 지우지 않고 새 payload 위에 남긴다**. 콜·지·기·소는 이미 이 패턴을 한 번 겪어
`발굴id:""` 를 clear 시 명시 무효화하는 땜질을 해뒀다(lead-chain §4-3 B3) — 그런데 매입DB·
직접생산·현수막 3섹션은 이 보호가 없다. UUID 키는 이 문제도 구조적으로 없앤다: 재사용된
물리 행이라도 새 항목은 **완전히 새 DB 행**이 되므로 잔존 필드가 원천적으로 생기지 않는다.

## 왜 한 PR로 다 안 하는가 (범위 결정, §0.5)

R7 문서가 이 카드를 **L(큰) 사이즈 + "카나리아 + 멱등성 테스트 의무"**로 명시했고, 실데이터
row_key 를 실제로 재작성(마이그레이션 실행)하는 건 §0.7 화이트리스트①(수강생 실데이터 비가역
변경)에 해당한다. 설계·구현·재작성 스크립트·실측 카나리아를 한 커밋에 몰아넣으면 검증이
얕아지고(§3.5 "PR은 작고 원자적") 벨리 승인 지점도 흐려진다. 그래서 3단계로 쪼갠다:

| 단계 | 내용 | 이 PR? | 벨리 승인 필요? |
|---|---|---|---|
| **Phase 1** | UUID 키 발급 메커니즘 + 신규 append 부터 적용 + 레거시(`r{row}`)·신규 키 **양쪽 다 읽기** + update/clear 가 물리 행의 **현재 키**를 조회해서 씀(레거시/신규 무관 정확 타격) | ✅ 이번 | 아니오 — 기존 행 row_key 는 그대로, 순수 additive |
| **Phase 2** | ~~row_key 자체를 UUID 로 재작성~~ → **범위 축소(2026-08-10, 아래 근거)**: `scripts/ops/backfill-db-row-numbers.mjs` — 기존 레거시 행(`{섹션}:r{row}`) payload 에 `_row` 만 jsonb 병합으로 채운다. **row_key 문자열 자체는 절대 안 바꾼다.** | ✅ 이 카드(별도 PR) | 아니오 — jsonb 병합만, 기존 update/clear 의 안전 패턴과 동일 |
| **Phase 3** | append 를 실제 dual-sync(동기·throw)로 전환 — Phase 1의 "재시도해도 같은 키" 보장이 전제 | 별도 PR | 아니오(게이트 기본 OFF 패턴 계승 시) |

이번 PR = **Phase 1만**. 완료 정의(§0.8): 코드 배포는 되지만 **행동 변화는 0**(기존 행 read/update/
clear 전부 이전과 동일 결과) — 새로 append 되는 행만 새 키 형식을 쓰기 시작한다.

## Acceptance Criteria (Phase 1)

- [x] `mintRowKey(section)` — UUID 기반 신규 키 발급(`lib/repo/db/row-key.ts`)
- [x] `findCurrentRowKey(spreadsheetId, section, row)` — 레거시/신규 키 양쪽 중 그 물리 행에
      매핑된 **현재** row_key 조회(DB 미설정·미러 전이면 null → 호출부가 레거시 키로 폴백)
- [x] append 4경로(매입DB·직접생산·현수막·콜지기소) — 신규 UUID 키로 미러 + payload 에 `_row`
      명시 필드 포함(행번호를 키가 아니라 payload 에서 얻도록 read 경로 이전)
- [x] update/clear 8경로 — `findCurrentRowKey` 로 현재 키를 조회해 그 키를 씀(레거시 행이면
      레거시 키 그대로, 신규 행이면 uuid 키). DB 미설정/미조회 시 레거시 키로 폴백(동작 불변).
- [x] `read-db-tab.ts` — row 번호를 `row_key` 파싱 대신 **payload.\_row 우선, 없으면 키 파싱**으로
      결정(레거시 행은 `_row` 가 없어 기존 파싱 경로 그대로 탐).
- [x] 신규 테스트: ①레거시 키 read/update/clear 왕복 불변 회귀 ②신규(uuid) 키 read/update/clear
      왕복 ③행 재사용(clear 후 재-append) 시 신규 키 경로에서 옛 필드 잔존 0 확인(핵심 회귀)
      ④`findCurrentRowKey` 폴백(DB 미설정·미조회) 단위 테스트
- [x] `npm run check` 통과 (typecheck·lint·structural 25·unit **1122**·파일크기·doc-drift, 전부 초록)
- [x] `docs/plans/active/sheet-retirement-r7.md` #10 진행상태 갱신

## Acceptance Criteria (Phase 2 — 별도 PR, 2026-08-10)

- [x] `scripts/ops/backfill-db-row-numbers.mjs` — 레거시 행 payload 에 `_row` jsonb 병합(row_key 불변)
- [x] 멱등: `payload->>'_row'` 가 이미 유효하면 그 행은 대상에서 제외(재실행 시 자동 수렴)
- [x] dry-run 기본, `--execute` 로만 실제 UPDATE(backfill-sheet-rows.mjs 관례 계승)
- [x] 순수 함수 단위 테스트(`legacyRowNumber`·`hasRowNumber`·`pendingRowNumber`) — DB 연결 없이 판정 로직 고정
- [x] `.github/workflows/db-backfill-row-numbers.yml` — VPS 실행 워크플로(db-backfill.yml 과 동일 SSH/재시도 패턴)
- [x] `npm run check` 통과
- [ ] 라이브 dry-run 실측 — VPS 워크플로 1회 실행(dry-run) 후 결과 수치를 PR에 첨부(다음 단계)
- [ ] `--execute` 실행 — dry-run 결과 확인 후 진행(§0.7: jsonb 병합만이라 벨리 승인 불요로 판단했으나,
      최초 실행 1회는 dry-run 수치를 belie/반장에게 공유 후 진행 — 완전 자동 결정은 아님)

**의도적 미포함(Phase 3 이관)**: append 실제 dual-sync(동기·throw) 전환 — R7-#11(BBE-60)의
스코프로 재확인(2026-08-10, 아래 §Phase 2 재설계 근거 참고). Phase 1 은 그 전제조건(재시도해도
같은 키)만 마련한다.

### Phase 2 재설계 — row_key 개명(rename) 대신 payload 병합으로 축소(2026-08-10)

belie 지시로 BBE-59 완주 착수 — 원래 설계(row_key 자체를 `{섹션}:r{row}` → `{섹션}:{uuid}`
로 재작성)를 실행 직전 재검토한 결과, **살아있는 파일럿 테이블에 대한 위험한 경쟁 조건**을
발견해 범위를 축소했다:

- **문제**: 03 화면은 이미 파일럿 기수에서 DB read(R2-5) 라이브다 — 학생이 그 순간에도 03 행을
  편집·삭제할 수 있다. `resolveWriteKey`(db/row-key.ts)는 "행번호로 현재 키 조회 → 그 키로
  write" 순서다. 이 스크립트가 SELECT 와 UPDATE(row_key 변경) 사이의 그 틈에 **같은 행의
  row_key 를 바꿔버리면**, 학생의 동시 편집이 옛 키를 찾다 실패 → `upsertSheetRow`의
  `ON CONFLICT` 가 그 키를 못 찾아 **엉뚱한 새 행(INSERT 분기)을 만든다** — 이 카드가 원래
  없애려던 "유령 행" 사고를 마이그레이션 스크립트 자신이 만드는 역설.
- **반증 시도**: "행 수가 적어 실제로 안 겹칠 것" 이라는 반론을 검토했으나, 파일럿 기수 인원×4섹션
  누적 행 수 + 마이그레이션 시간(초 단위 이상) 대비 사용자 편집 빈도를 볼 때 **0 이라고 증명할
  수 없다** — 반증 실패, 위험 채택.
  락(SELECT FOR UPDATE)으로 직렬화하는 안도 검토했으나 살아있는 요청 경로(`resolveWriteKey`)
  자체를 이 마이그레이션에 맞춰 잠그도록 고치는 건 스코프 밖(별도 설계 필요)이라 기각.
- **해법**: row_key 는 그대로 두고 **payload 에 `_row` 필드만 jsonb 병합**한다(신규 스크립트
  `scripts/ops/backfill-db-row-numbers.mjs`). jsonb 병합(`payload || jsonb_build_object(...)`)은
  이미 update/clear 전체가 쓰는 검증된 안전 패턴 — 동시 쓰기가 있어도 각자의 병합이 순서대로
  누적될 뿐 서로를 지우거나 유령 행을 만들지 않는다(경쟁 조건 자체가 성립하지 않는 연산).
- **이게 R7-#11(BBE-60) 착수를 막지 않는 이유**: `read-db-tab.ts`의 `rowNumOf`·`resolveWriteKey`
  는 이미 레거시(`r{row}` 파싱)·신규(`_row` 필드) 두 형식을 **동등하게** 다룬다(Phase 1). row_key
  형식 자체가 통일되지 않아도 #11 이 참조할 "행번호" 는 이 백필로 **모든 행에서 `_row` 로
  일관되게** 구한다. row_key 문자열 통일(레거시 행의 실제 개명)이 필요해지면 그건 **마이그레이션
  창(트래픽 없는 시간대) 또는 애플리케이션 레벨 락 설계**가 선행돼야 하는 별도 카드 — belie 결정함
  섹션에 등재.

## Context (참고)
- [[docs/plans/active/sheet-retirement-r7.md]] — #10, 매출 데이터 위험 목록
- [[lib/repo/db/mirror.ts]] — row_key 규칙 헤더(수정 필요 — 이 PR이 규칙을 갱신)
- [[lib/repo/db/db-tab-sync.ts]] — append 제외 사유 원문("행번호=시트 할당이라 재시도 시 중복행")
- [[lib/service/db.ts]] oldLeadIdOf — 이번 findCurrentRowKey 와 같은 모양의 선례(발굴id, 콜지기소 한정)
- [[scripts/ops/backfill-sheet-rows.mjs]] — Phase 2 스크립트가 따를 관례(dry-run 기본·--execute·URL 미노출)

## 마이그레이션 번호 (belie 지시 — 반장 확인 대기)

Phase 1은 스키마 변경(DDL) 이 없다 — `sheet_rows` 는 이미 범용 jsonb 라 새 컬럼 불필요.
**Phase 2**(실제 row_key 재작성)도 스키마 변경이 아니라 **데이터** 마이그레이션(UPDATE)이라
`lib/repo/db/migrations/NNNN_*.sql` 러너 대상이 맞는지 자체가 선택지다(대안: ops 스크립트로
직접 실행, 스키마 마이그레이션 파일 불필요). 번호가 필요해지면 실측 기준(2026-08-09 17시경):
- master 기존: `0001_users_cohorts.sql` · `0002_users_natural_key.sql`
- PR #736(BBE-58) 미머지 브랜치가 `0002_gcal_tokens.sql` 보유(번호 master 와 충돌 표기)
- PR #737(BBE-62) 미머지 브랜치가 `0002_gcal_tokens.sql`+`0003_gcal_event_ids.sql` 보유(#736 스택)
- 러너(`scripts/db-migrate.mjs`)의 `schema_migrations.version` = **파일명 전체**(숫자 접두어 아님)라
  번호 중복이 있어도 실행 자체는 안 깨짐(적용 순서만 파일명 정렬로 어긋남).
- **반장에게 머지 순서(①#736·#737 리넘버링 여부 ②그 다음 이 카드가 잡을 번호) 확인 요청함**
  (2026-08-09 17:15 KST, BBE-75 하트비트 경유 — Linear 미인증 세션이라 직접 코멘트 불가).
  회신 전 기본값: **`0005_*`**(#736/#737 이 0002/0003 유지하든 0003/0004 로 리넘버링되든 겹치지
  않는 최솟값). 회신 오면 파일명 rename 1건으로 즉시 반영.

## Steps
1. ✅ Gather — R7 문서·mirror.ts·db-tab-sync.ts·read-db-tab.ts·db.ts·db-production-cell.ts 전량
   실측(순환참조 지점·다른 rowKey 생성 호출부 전수 확인 — `매입DB:r|직접생산:r|현수막:r|콜지기소:r`
   grep 으로 db-production-cell.ts 도 같은 회귀 위험 있음을 발견해 함께 수정)
2. ✅ `lib/repo/db/row-key.ts` 신규 — mintRowKey·findCurrentRowKey·resolveWriteKey(순환참조 회피:
   read-db-tab.ts 를 참조하지 않고 client.ts 만 직접 사용)
3. ✅ `lib/repo/db.ts` append 4경로 — mintRowKey 사용 + payload `_row` 추가
4. ✅ `lib/repo/db.ts` update/clear 8경로 — resolveWriteKey 조회 후 그 키로 write(폴백=레거시)
5. ✅ `lib/repo/db-production-cell.ts`(생산개수 M) — 같은 이유로 resolveWriteKey 경유(빠뜨리면
   uuid 행에 유령 행이 생겨 M 동기화가 조용히 실패하는 회귀)
6. ✅ `lib/repo/db/read-db-tab.ts` — rowNum 결정을 payload.\_row 우선으로(rowNumOf 헬퍼)
7. ✅ 500줄 캡 초과(db.ts, UUID 발급 로직 추가로 536줄) → `db-tab-writers.ts`(셀 쓰기 공용, 순환참조
   없음)·`db-write.ts`(update/clear, append 는 행번호 발급과 묶여 db.ts 잔류)로 분리, db.ts 는
   re-export 유지(외부 호출부 `@/repo/db` import 무변경)
8. ✅ 유닛 테스트 3파일 19건(row-key 8·append/update/clear 위임 8·read rowNum 3) — 기존
   db-cleared-flag·db-tab-sync·db-tab-form-overlay 테스트도 회귀 없음 재확인
9. ✅ check.sh 전체 그린 — typecheck·lint·structural 25·unit **1122**(기존 1104 + 신규 19 -1 조정
   무관, 실측치)·파일크기·doc-drift
10. ✅ `docs/plans/active/sheet-retirement-r7.md` #10 진행상태 갱신
11. ⏳ PR 오픈(머지는 반장 판정 대기, R7 매출위험 관례 계승) → worklog 기록 + Linear 미러(도장)

## Log
- 2026-08-09 데탑 C작업원B(260809) — Phase 1 설계 확정, 구현 완료. check.sh 전체 그린(typecheck·
  lint·structural 25·unit 1122·파일크기·doc-drift). 신규 파일 3(`db/row-key.ts`·`db-tab-writers.ts`·
  `db-write.ts`) + 수정 4(`db.ts`·`db-production-cell.ts`·`db/read-db-tab.ts`·`db/mirror.ts` 주석)
  + 테스트 신규 3파일. PR 오픈 예정, 머지는 반장 판정 대기(R7 매출위험 관례).
- 2026-08-10 — **완주**. Phase 1 머지(PR #757 → `91bf42d`) + 배포 success + health 200.
  Phase 2 는 실행 직전 재검토에서 원래 설계(row_key 자체를 UUID 로 rename)의 라이브 경쟁조건
  위험을 발견해 범위 축소(위 §Phase 2 재설계 섹션) — row_key 불변, payload 에 `_row` 만 jsonb
  병합. PR #773 머지(`1b7945e`) + 배포 success + health 200. VPS 실행: dry-run 대상 1004건 →
  `--execute` 1004/1004 갱신, 충돌 0건. R7-#11(BBE-60) 착수 가능(선행 조건 충족).
