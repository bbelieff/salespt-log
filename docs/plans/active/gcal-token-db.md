> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 구글 캘린더 refresh token·설정을 레지스트리 시트 S/T열에서 Postgres
>   `gcal_tokens` 로 이전(BBE-58, R7 Phase 1 #9) — DB 정본 + 시트 폴백·미러.
> - **누가 읽나요**: 반장(FM), belie, BBE-62(이벤트ID 이전)를 이어받는 세션
> - **어떤 기능·작업과 연결?**: `lib/repo/gcal-token.ts`·`lib/repo/db/gcal-tokens.ts`·`migrations/0002_gcal_tokens.sql`
> - **읽고 나면 알 수 있는 것**: 암호화를 다시 해야 하나 / 캘린더가 끊기지 않는 근거 / 무엇이 남았나
> - **관련 문서**: `docs/decisions/0028-user-gcal-oauth-token.md`(암호화 정본) · `migrations/0001_users_cohorts.sql`(키 설계 근거) · BBE-62(후속)

# BBE-58 — gcal 토큰·설정 DB 이전 (R7 Phase 1 #9)

## belie 질문에 대한 답: 복호화·재암호화 **불필요**

`lib/repo/gcal-crypto.ts` 실측 결과다.
- 키는 `AUTH_SECRET` → HKDF-SHA256 으로 **매 호출 파생**한다(`deriveKey()`, 저장 안 함).
- 저장 포맷은 `v1:{iv}:{tag}:{ct}` — iv·tag 를 값 안에 담은 **자기완결 문자열**이다.
- 따라서 암호문은 **저장 위치(시트 셀 ↔ DB 컬럼)와 무관**하다. 이전 = 문자열 이동뿐이며,
  복호화·재암호화 단계가 없다 = 평문이 메모리·로그·스크립트 어디에도 등장하지 않는다.
- AUTH_SECRET 로테이션 시 전원 재연결이 필요한 성질(ADR-0028)도 그대로 유지된다.

## 설계 — 왜 이 형태인가

**키 = email (users.id FK 아님)**. 0001 마이그레이션 주석이 이미 권고한 방향이고, 실측으로
확인했다: `users` 테이블은 0001 로 **생성만** 됐고 읽기·쓰기 코드가 아직 없다(BBE-55/56 미착수)
= 운영 DB 에서 비어 있다. FK 를 걸면 gcal 저장이 전부 실패한다. 또 `users` 는 "등록(email ×
cohort)" 단위라 한 사람이 최대 3행을 갖고, 우선순위 행이 바뀌면(archived→아레나 승격)
surrogate id 연결이 끊긴다 — 캘린더 연동은 "사람" 단위 사실이라 email 이 옳은 키다.

**세 불변식** (`lib/repo/gcal-token.ts` 헤더에 동일 기재):
1. **행 존재 = 정본** — DB 행이 있으면 그 값이 진실(`token_enc=""` 인 "해제됨" 포함). 행이
   **없을 때만** 시트 폴백. 어기면 **연결 해제가 시트 값으로 되살아난다**(최대 위험, 전용 테스트).
2. **lazy backfill** — 시트 폴백이 값을 찾으면 DB 에 1회 심는다(`on conflict do nothing`).
   사용자가 캘린더 화면을 한 번 열면 자동 이전 — **비밀값을 훑는 배치 스크립트를 만들지 않는다.**
3. **DB 정본 + 시트 미러** — DB 쓰기 실패=throw, 시트 미러 실패=warn. 미러를 남기는 이유는
   **revert 안전**(§6.8): 이 PR 을 되돌려도 시트에 최신 값이 있어 캘린더가 끊기지 않는다.

`DATABASE_URL` 미설정(로컬·CI)은 전 경로가 **기존 시트 동작 그대로** 강등된다.

## 전환기 회귀 1건 — 발견·수정·박제

`saveGcalToken` 이 DB 행만 보고 "설정 없음 → 기본값" 을 판단하면, 아직 backfill 안 된
사용자가 재연결할 때 **시트에 있던 캘린더 선택이 primary 로 초기화**된다. 설정을 쓰기 전
`getGcalConnection`(DB→시트 폴백)으로 유효 설정을 먼저 확정하도록 고쳤고,
`tests/repo/gcal-token-db.test.ts` 의 "재연결 시 … 초기화되지 않는다" 케이스가 이를 고정한다.

## 검증

- `npx tsc --noEmit` 0 에러 · `eslint` 0 경고
- `tests/repo/gcal-token-db.test.ts` **15건 신규** + 기존 gcal 테스트 전량(gcal-token 5 ·
  gcal-crypto 7 · gcal-sync 10 · gcal-guard 4) **회귀 0**
- `scripts/check.sh` 전체 초록

## 남은 일

- **마이그레이션 실행**: 배포 후 VPS 에서 `DATABASE_URL=... node scripts/db-migrate.mjs`
  (0002 적용). 실행 전까지 `gcal_tokens` 가 없어 DB 경로가 실패하지만 **시트 폴백으로 정상
  동작**한다 — 즉 배포와 마이그레이션 사이에 순서 제약이 없다(무중단).
- **S/T열 물리 제거는 이 카드 범위 밖** — 시트 은퇴(R7 Phase 4 #20)에서. 그때까지 미러 유지.
- **BBE-62(이벤트ID 맵 이전)는 이 PR 머지 후 착수** — 토큰이 먼저 DB 로 옮겨져야 이벤트ID
  이전이 안전하다(중간 상태에서 캘린더 단절 방지, belie 지시).

## 롤백
PR revert 1건. 시트 미러가 계속 최신이었으므로 되돌리는 즉시 시트 정본으로 무손실 복귀.
`gcal_tokens` 테이블은 남지만 아무도 읽지 않아 무해(다음 재적용 시 그대로 재사용).

## Log
- 2026-08-06 구현 완료(작업원D) — 암호화 재작업 불요 실측 확인, 3 불변식 구현, 전환기 회귀
  1건 발견·수정·박제. PR 오픈, 머지는 개막 후 반장 판정.
