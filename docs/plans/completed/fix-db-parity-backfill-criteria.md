---
slug: fix-db-parity-backfill-criteria
status: completed
created: 2026-08-06
worktree: wt/fix-db-parity-backfill-criteria
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: `/admin/db-parity` 가 쓰는 `countUserSheet`(contracts·sales)의 유효 행 판정 기준을 백필 스크립트와 동일하게 맞추는 버그 수정.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: `lib/service/db-parity.ts`, `scripts/ops/backfill-sheet-rows.mjs`, `scripts/ops/a2-db-parity.mjs`(PR #724 자매 수정)
> - **읽고 나면 알 수 있는 것**: 무엇이 불일치했는지 / 어떻게 고쳤는지 / 어떻게 검증했는지
> - **관련 문서**: `docs/plans/active/db-migration-pilot.md` §3

# db-parity.ts countUserSheet — backfill 기준과 불일치 수정

## Intent (왜)
A2 db-parity 대조 작업 중 `lib/service/db-parity.ts`의 `countUserSheet`가 시트 "유효 행수"를
세는 기준이 실제 백필 스크립트(`scripts/ops/backfill-sheet-rows.mjs`)와 다르다는 게 발견됨.
- contracts: `C3:C`부터 그냥 순회 → 이미 한 번 고쳐진 헤더·예시행 유령계약 버그(2026-07-12)를 재현.
- sales: `E10:H349` 범위 전체 순회 → O1 파싱·10주×7일×4채널 stride 구조 무시, 각 주차 34행 블록 중
  실사용 28행 외 6행(주차구분/헤더)에 텍스트 있으면 유령 영업행으로 오세었음.
PR #724가 `scripts/ops/a2-db-parity.mjs`는 이미 고쳤지만 그 커밋 메시지에 "db-parity.ts 자체의
이 오차는 별건(admin 페이지도 영향받을 수 있음, 이 PR 범위 밖)"이라 명시 — 이 작업이 그 잔여.

## Acceptance Criteria (수용 기준)
- [x] `countUserSheet`의 contracts 판정이 `backfill-sheet-rows.mjs`와 동일(신형 tab firstDataRow=6·
      구형 tab firstDataRow=5, 그 이전 행 배제)
- [x] `countUserSheet`의 sales 판정이 `backfill-sheet-rows.mjs`와 동일(O1 파싱 성공 시에만·
      10주×7일×4채널 stride 유효 위치만 카운트)
- [x] `npm run check` 통과 (typecheck · lint · structural · tests · 파일크기) — 1012 unit + 25
      structural 전부 green, exit 0.
- [x] cohort=8(오래 파일럿인 기수) 실측 — 백필 dry-run 결과와 신규 로직의 sheetCount 가 일치
      (아래 Log 참고. contracts=44 로 재현 2회 모두 일치. sales 는 backfill 자체의 재시도 없는
      읽기 실패 때문에 실행마다 달라져 별도 follow-up 발급 — 원인 규명 후 신규 로직 합계 409 가
      두 backfill 실행의 성공분을 합치면 정확히 일치함을 확인)
- [ ] (후속, VPS 필요) 실제 `/admin/db-parity?cohort=8` 웹 페이지 dbCount 대조 — VPS SSH 완전장애로
      이번 세션에서는 CLI 대조로 대체(로컬 .env.local에 DATABASE_URL 없음)

## Context (참고)
- [[lib/service/db-parity.ts]]
- [[scripts/ops/backfill-sheet-rows.mjs]]
- [[scripts/ops/a2-db-parity.mjs]] (PR #724 — 자매 수정, 동일 판정을 이미 반영)
- [[docs/plans/active/db-migration-pilot.md]] §3

## Steps (점진적 공개)
1. `countUserSheet`의 contracts 루프를 backfill 과 동일한 `[tab, firstDataRow]` 쌍으로 교체.
2. sales 루프를 O1(`readCourseStart`) 파싱 성공 게이트 + stride 좌표 계산으로 교체.
3. check.sh 통과.
4. cohort=8 대상으로 로컬 CLI 대조(backfill dry-run vs 신규 로직) — VPS SSH 장애로 실제 admin
   페이지 라이브 검증은 보류, 사유·복구법 worklog에 기록.

## Log
- 2026-08-06 작업 시작 — 사용자 직접 요청(A2 db-parity 대조 중 발견), PR #724 자매 수정.
- 2026-08-06 구현 — contracts: `CONTRACT_TAB_ALIASES`(신형 `SHEET_RANGES.contractPayment.firstDataRow`=6
  SSOT 재사용 · 구형 하드코딩 5) 도입. sales: `readCourseStart(sid)`(`@/repo/sales`) 성공 게이트 +
  10주×7일×4채널 stride 좌표 계산으로 교체.
- 2026-08-06 검증 — check.sh green(exit 0, 1012 unit + 25 structural). VPS SSH 완전장애(worklog
  FM 보드 19:10 기준)로 admin 페이지 라이브 로그인 검증 불가 → 로컬 SA 크리덴셜(.env.local)로
  cohort=8(7개 시트) 대상 OLD vs NEW 대조 스크립트 실행(레포 밖 스크래치, 미커밋):
  contracts OLD=45→NEW=44(backfill dry-run 44 와 재현 2회 모두 일치). sales OLD=562→NEW=409.
  backfill dry-run 자체가 재시도 없는 읽기라 실행마다 결과가 달라짐(1회차 253 · 2회차 399, 매번
  다른 사용자의 O1/탭 읽기가 무작위 실패) — 두 실행의 성공한 사용자별 값을 합치면 정확히 409로
  NEW 로직과 일치함을 확인. **결론: NEW 로직이 정답, backfill 쪽 재시도 부재가 별건 버그.**
  후속 카드 발급(backfill-sheet-rows.mjs grid() 재시도 이식, a2-db-parity.mjs #725 와 동일 패턴).
  DB 카운트(dbCount) 대조는 로컬에 DATABASE_URL 이 없어 보류 — VPS 복구 후 재검증 권장.
