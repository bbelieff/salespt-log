---
slug: course-dates-db
status: active
created: 2026-08-08
worktree: ../wt/bbe57-course-dates-db
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 수강시작일·종강총회일(시트 O1/O2)의 정본을 Postgres users 로 이전하는 R7 Phase 1 — 읽기/쓰기 배선까지, 기본은 카나리아 OFF.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: lib/repo/sales.ts(readCourseStart/readGraduation), lib/repo/db/course-dates.ts(신규), lib/service/auth.ts(claimAccount), lib/repo/users-cache-migrate.ts
> - **읽고 나면 알 수 있는 것**: 왜 마이그레이션 파일이 없는가 / 왜 UPDATE-only 인가(BBE-55 자연키 변경과의 관계) / 카나리아 게이트를 어떻게 켜는가
> - **관련 문서**: docs/plans/active/sheet-retirement-r7.md, lib/repo/db/migrations/0001_users_cohorts.sql(BBE-54)

# course-dates-db (BBE-57)

## Intent (왜)
`lib/repo/sales.ts`의 `readCourseStart`/`readGraduation`이 매 호출마다 시트 O1/O2 를 직렬값(Sheets
serial number)으로 읽어 파싱한다 — D-day·주차 표시·모든 퍼널 통계 집계의 기준값. R7(Sheets 이탈) 다음
표면으로 이 값을 지목(BBE-64 로 `me.ts`·`sales.ts` 를 이미 파악한 연속 작업). Postgres `users` 테이블에
`course_start_iso`/`graduation_iso` 컬럼이 이미 있었으나(BBE-54, PR #722) **100% 미배선**이었다 — 이
작업이 최초의 읽기/쓰기 경로.

## 실측으로 뒤집힌 티켓의 전제 (§0.8 Gather)
1. **"DB 에 등가물이 없다"는 티켓 서술은 부정확** — `git show origin/master:lib/repo/db/migrations/0001_users_cohorts.sql`
   로 확인한 결과 `course_start_iso text not null default ''`/`graduation_iso` 컬럼이 이미 존재.
   `grep -rn "course_start_iso" lib/ app/`로 재확인 — 어떤 repo 함수도 SELECT/UPDATE 안 함(완전 미배선).
   → **새 마이그레이션 파일 불필요**. BBE-55 WIP(`0002_users_natural_key.sql`, 미머지)와의 번호 충돌
   자체가 발생하지 않는다.
2. **`users` 테이블은 현재 0행** — `lib/repo/db/registry.ts`(users 테이블에 INSERT/UPDATE 하는 유일한
   코드)는 `wt/bbe55-registry-dual-write`(branch feat/registry-dual-write, PR 미오픈)에만 존재, master
   에는 없다. 즉 이 PR 머지 시점엔 `writeCourseDatesToDb` 가 **항상 0 rows affected** — BBE-55 가 머지돼
   행이 생기기 시작하면 자동으로 살아나는 설계(아래 "쓰기 배선" 참조).
3. **`readCourseStart`/`readGraduation`의 30+ 콜사이트 전부가 spreadsheetId 만 가짐** — email/cohort 를
   가진 콜사이트는 0개(`grep -n "readCourseStart\|readGraduation"` 전체 확인). 그래서 DB 읽기는
   spreadsheet_id 로 조회할 수밖에 없다 — 그런데 spreadsheet_id 는 자연키가 아니다(부부·멀티계정
   공유, BBE-64 에서 실제 버그로 확인된 패턴). 수강기간은 **시트 1장의 물리 O1/O2 값**이라 그 시트를
   공유하는 모든 계정이 같은 값에 수렴하므로, 값 있는 아무 행이나(최신 갱신분) 골라도 안전 — 코스 시작일은
   프로필 통계(BBE-64)와 달리 "그 사람 것"이 아니라 "그 시트 것"이라 공유돼도 오염이 아니다.

## 설계 결정
- **쓰기 = UPDATE-only, INSERT 없음.** BBE-55 WIP(`lib/repo/db/registry.ts`, 미머지)가 이미
  `on conflict (email, cohort, name)` 로 자연키 변경을 전제하고 있다(마이그레이션 `0002_users_natural_key.sql`
  과 짝) — 내가 `ON CONFLICT (email,cohort)` 로 쓰면 그 마이그레이션이 머지되는 순간 제약 불일치로
  깨진다. UPDATE-only(`WHERE email=$1 AND cohort=$2`)는 어떤 unique 제약이 걸려 있든 무관하게 동작 —
  row 생성(BBE-55 소유)과 완전히 독립적인 레인을 유지한다.
- **읽기 게이트 = 전역 env(`COURSE_DATE_DB_READ=1`), 기본 OFF.** sheet_rows 레벨(daily-source.ts
  isDbReadPilot, 기수 allowlist)과 다른 모델 — 레지스트리는 기수 무관 전역 테이블이라 전역 스위치가
  맞다(BBE-56 이슈 텍스트와 동일 논리). `DATABASE_URL`(dbEnabled())이 이미 다른 파일럿 기능에 설정돼
  있어도 자동으로 켜지지 않는다 — "카나리아 필수" 지시를 문자 그대로 지킨 설계.
- **쓰기 게이트도 별도(`COURSE_DATE_DB_WRITE=1`), 읽기와 독립.** 적대적 리뷰(regression 렌즈, MEDIUM)
  지적 — `dbEnabled()` 만으로 쓰기가 켜지면 `DATABASE_URL`이 이미 배포환경에 설정돼 있어(다른 파일럿
  기능 때문에) 이 PR 머지 즉시 실제 UPDATE 가 발사된다. "오늘 무해함"이 `users` 테이블 0행이라는
  **우연**에 기대는 구조였다 — BBE-55 가 머지되면 이 PR 을 다시 보지 않고도 실데이터를 건드리기
  시작하는 셈. 쓰기도 명시적 opt-in 으로 독립 게이트해 "카나리아 필수"를 실제로 관철.
- **DB 읽기 실패는 throw 아니라 시트 폴백.** 적대적 리뷰(correctness 렌즈, HIGH) 지적 — 최초 구현은
  `readCourseDatesFromDb`에 에러 처리가 없어 커넥션 장애 시 시트 폴백 없이 그대로 throw, "DB 우선·
  실패 시 시트" 계약을 깨는 신뢰성 회귀였다. try/catch 로 감싸 실패 시 null 반환하도록 수정.
- **gradISO 빈값은 기존 값 보존(CASE WHEN).** 적대적 리뷰(correctness 렌즈, LOW) 지적 — 원래 SQL 은
  gradISO 빈 문자열을 그대로 덮어써 기존 종강일을 지울 수 있었다(오늘은 도달 불가 경로였지만 방어
  추가). cohort-pending.ts 의 보존형 upsert 패턴과 동일 취지.
- **2/53 시트 O1 파싱실패 케이스**: DB 에도 값이 없으므로(같은 이유로 backfill 도 실패) 시트 폴백이
  그대로 실행되고 기존과 동일하게 throw — 마스킹하지 않는다. 이 상황을 정확히 재현하는 회귀 테스트를
  포함(`sales-course-dates-db-first.test.ts`: "DB 미조회 상태에서 시트도 파싱 실패").
- **"2/53" 수치 자체는 이 PR 에서 재검증하지 않음** — `migrateRegistryCache()`(🔄 동기화 버튼)의
  `MigrateResult.failed[]` 가 정확히 이 정보(시트별 실패 사유)를 이미 수집한다. 버튼을 한 번 누르면
  최신 수치가 나온다 — 별도 스크립트 불필요(기존 메커니즘 재사용, YAGNI).

## 구현
| 파일 | 역할 |
|---|---|
| `lib/repo/db/course-dates.ts`(신규) | `readCourseDatesFromDb`(spreadsheet_id 조회) · `writeCourseDatesToDb`(UPDATE-only) · `courseDateDbReadEnabled`(전역 게이트) |
| `lib/repo/sales.ts` | `readCourseStart`/`readGraduation` = DB우선(게이트 ON 시)→시트폴백. 기존 파싱 로직은 `readCourseStartFromSheet`/`readGraduationFromSheet` 로 이름만 변경, 로직 불변 |
| `lib/service/auth.ts` | `claimAccount` — `fetchCachedLabels` 직후 best-effort `writeCourseDatesToDb` (try/catch, 실패해도 클레임 진행) |
| `lib/repo/users-cache-migrate.ts` | `migrateRegistryCache()` 루프에 동일 best-effort 쓰기 추가 — 기존 145행 백필 지점 재사용 |

## Acceptance Criteria
- [x] `COURSE_DATE_DB_READ` 미설정(오늘의 실배포 상태) = 시트 API 호출·응답값·에러 메시지 **완전 불변**
      (readCourseDatesFromDb 자체가 호출 안 됨 — 테스트로 고정)
- [x] `writeCourseDatesToDb` 실패가 claimAccount·migrateRegistryCache 의 기존 성공 경로를 절대 막지 않음
- [x] 2/53 파싱실패 시트 — 게이트 ON 이어도 여전히 동일한 에러로 throw(마스킹 없음)
- [x] `npm run check` 통과 (typecheck·lint·structural·tests·doc-drift·500줄 캡)
- [x] 적대적 리뷰(Agent 병렬 2렌즈) 완료 — HIGH 1(DB 읽기실패 시 throw)·MEDIUM 2(쓰기 게이트 부재,
      claimAccount 내 순서 landmine 주석)·LOW 2(gradISO 덮어쓰기, updated_at 정본성) 전부 수정/문서화
- [ ] PR 오픈(draft) — 머지는 반장 판정 대기

## Context (참고)
- [[lib/repo/db/migrations/0001_users_cohorts.sql]] — course_start_iso/graduation_iso 컬럼 출처(BBE-54)
- [[lib/repo/db/cohort-pending.ts]] — CASE WHEN 보존형 upsert 선례(다른 테이블, 참고만)
- BBE-55(`wt/bbe55-registry-dual-write`, feat/registry-dual-write) — users 행 생성 소유 트랙, 자연키
  변경 WIP. 이 PR 은 그 변경과 **독립**(UPDATE-only 설계) — 머지 순서 무관하게 안전.

## Log
- 2026-08-08 착수. §0.8 Gather 단계에서 티켓 전제 2건(DB 등가물 없음/새 컬럼 필요) 실측으로 반증 —
  마이그레이션 없이 배선만으로 완결. 구현·유닛테스트(4파일 32건) 완료, check.sh 초록.
