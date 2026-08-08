> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 구글 캘린더 이벤트ID 맵을 시트 셀(04!AT · 05!O)에서 Postgres
>   `gcal_event_ids` 로 이전(BBE-62, R7 Phase 2 #13) — DB 정본 + 시트 폴백·미러.
> - **누가 읽나요**: 반장(FM), belie, 이 카드를 이어받는 세션
> - **어떤 기능·작업과 연결?**: `lib/repo/gcal-event-ids.ts`·`lib/repo/db/gcal-event-ids-db.ts`·`migrations/0003_gcal_event_ids.sql`·`lib/service/gcal-sync.ts`
> - **읽고 나면 알 수 있는 것**: 왜 삭제가 tombstone 인가 / 고아 이벤트를 어떻게 막았나 / 셀 락이 왜 사라졌나
> - **관련 문서**: `docs/plans/active/gcal-token-db.md`(BBE-58, 선행 PR) · BBE-62 카드

# BBE-62 — gcal 이벤트ID 맵 DB 이전 (R7 Phase 2 #13)

## 선행 의존 — BBE-58 이 먼저 머지돼야 한다
이 브랜치는 `feat/gcal-token-db`(BBE-58) **위에 쌓여 있다**. 토큰이 DB 로 옮겨지기 전에
이벤트ID 를 옮기면 중간 상태에서 캘린더가 끊길 수 있다(belie 지시). 58 머지 후 이 PR 을
master 로 리베이스한다.

## 무엇을 바꿨나
기존: 일정 행의 셀 하나에 **사용자별 JSON 맵** `{"email":"eventId"}` → read-merge-write +
`withCellLock`(프로세스 내 셀 락) + `ensureGridColumns`(그리드 열 확장) + A열 풀스캔.

이제: `(spreadsheet_id, kind, item_id, email) → event_id` **4-키 행**. 사용자별로 행이
분리돼 **lost update 가 구조적으로 불가능**해졌고, 그래서 `withCellLock` 이 필요 없다 —
**단일 pm2 인스턴스 전제도 함께 사라진다**(카드가 적은 "부수 효과"). 셀 락·JSON 인코딩·
`ensureGridColumns` 는 **시트 미러 경로에만** 남는다(Phase 4 에서 통째 폐기).

## 최대 위험과 방어 — 지울 수 없는 고아 이벤트

`removeAll`(gcal-sync.ts:132)은 `readGcalMap` 이 준 맵을 순회해 각 사용자 토큰으로 이벤트를
지운다. **맵이 비면 아무것도 못 지운다** → 구글에 영구 고아가 남는다(매핑이 없어 이후에도
못 찾는다). 그래서 DB-only 로 플립하고 DB 가 비어 있으면 전원 고아가 된다.

**방어 = 키 단위 DB 우선 병합**(`mergeGcalMaps`, 순수함수·테스트 5건):
- 읽기 = `시트맵 ∪ DB맵`, 같은 email 키는 **DB 가 이김**
- DB 의 `""` = **tombstone(지워짐)** → 결과에서 제외
- 시트에만 있던 키는 DB 로 **lazy backfill**(`do nothing`)

이 규칙 하나로 네 상황이 모두 맞는다: 미이전(시트 값 사용) / 이전됨(동일) / 삭제 후 미러
성공(양쪽 비었음) / **삭제 후 미러 실패(DB tombstone 이 시트 잔재를 이김)**.

## 왜 DELETE 가 아니라 tombstone 인가
전환기엔 시트 미러가 남아 있어서, DB 행을 지우면 다음 읽기가 시트 값을 주워 **이미 지운
이벤트가 되살아난다**. 시트 은퇴(R7 Phase 4 #20) 후에는 tombstone 없이 DELETE 로 단순화 가능
— 그때 정리하도록 마이그레이션·모듈 헤더에 근거를 남겼다.

## 곁다리 정리 — EXCLUDE_MARKER 단일화
`"-"` 리터럴이 repo(`gcal-event-ids.ts`)와 service(`gcal-sync.ts`)에 각자 있었다. 저장 계층
규약이므로 repo 가 정의하고 service 가 import 하도록 단일화(레이어 규칙상 방향은 이쪽뿐).

## 검증
- `npx tsc --noEmit` 0 에러 · `eslint` 0 경고 · 파일 크기 369/159줄(500 캡 이내)
- 신규 테스트 **18건** — 병합 규칙 5 · 읽기(고아 방지·backfill·DB 순단·DB 미설정) 4 ·
  쓰기(tombstone·미러 실패 격리) 6 · 배치 토글 3
- `scripts/check.sh` 초록 — **119 파일 1061 테스트**, 기존 gcal 전량 회귀 0

## 남은 일 / 미확정
- **마이그레이션 실행**: 배포 후 VPS `DATABASE_URL=... node scripts/db-migrate.mjs`(0003).
  실행 전에는 DB 경로가 실패하지만 **시트 폴백으로 정상 동작** → 배포·마이그레이션 순서 제약 없음.
- ⚠️ **라이브 왕복 미검증**: 실제 캘린더 연결 계정으로 등록→토글→삭제 왕복을 돌려보지 못했다
  (로컬에 `DATABASE_URL`·구글 토큰 없음). 단위 테스트는 병합·분기를 고정할 뿐 **구글 API 왕복을
  증명하지 않는다**(§0.8 — 검증 안 한 것을 검증한 것처럼 내놓지 않는다). 머지 전 카나리아 1명
  왕복 확인 필요.
- **셀·열 물리 제거는 범위 밖** — 시트 은퇴(Phase 4 #20).

## 롤백
PR revert 1건. 시트 미러가 계속 최신이었으므로 즉시 시트 정본으로 무손실 복귀. 테이블은
남지만 아무도 읽지 않아 무해.

## Log
- 2026-08-06 구현 완료(작업원D) — 고아 이벤트 방어(키 단위 DB 우선 병합) 설계·구현,
  withCellLock 제거로 다중 인스턴스 제약 해소, EXCLUDE_MARKER 단일화. PR 오픈(BBE-58 위 스택),
  머지는 58 이후 반장 판정. 라이브 왕복 미검증으로 남김.
