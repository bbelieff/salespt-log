---
slug: cohort-create-db-insert
status: active
created: 2026-08-10
owner: 데탑 C작업원C(260809) — belie 지시("같은 원칙. 구현까지 하고 머지 보류")
related: sheet-retirement-r7(#21), decisions/0030-db-ssot-supersede-0002, BBE-69
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 기수 생성(Drive 복사·폴더생성·재시도큐)을 DB insert 1건으로 대체하는
>   BBE-70(R7-#21)의 설계 + 구현. **머지는 BBE-69(시트 미러 폐기) 완료 후.**
> - **누가 읽나요**: belie, 반장(머지 판정), 후속 세션(BBE-69 완료 후 이 PR 승계)
> - **어떤 기능·작업과 연결?**: `docs/plans/active/sheet-retirement-r7.md` Phase 4 #21 —
>   선행 = `5·7·20`(스키마·읽기flip·미러폐기=BBE-69). `app/api/admin/create-cohort-members`
> - **읽고 나면 알 수 있는 것**: 왜 지금 머지하면 안 되는지 / 무엇을 스코프에서 뺐는지 /
>   기존 admin 화면이 어떻게 바뀌는지(안 바뀜 — 응답 계약 유지)
> - **관련 문서**: `sheet-retirement-r7.md` §69-71 · ADR-0030 §2·§3 · `docs/plans/completed/export-xlsx-csv.md`(같은 원칙 선례)

## 0. 왜 지금 구현하고 머지는 보류하는가

belie 지시: "BBE-70 — 같은 원칙[BBE-71 과]. 구현까지 하고 머지 보류. 기수 생성을 Drive 복사·
폴더생성·재시도큐 → DB insert 1건으로. 선행은 BBE-69 다."

로드맵 실측(`sheet-retirement-r7.md:143`): `| 21 | 기수 생성 = DB insert 1건 | 5·7·20 | M |`
— 선행은 정확히는 `5·7·20`(스키마·이중기록·읽기flip·BBE-69=미러폐기) 세 가지지만, **20(BBE-69)
이 마지막이자 가장 무거운 관문**(googleapis 완전 제거)이라 belie 지시의 "선행은 BBE-69"와
실질적으로 일치한다 — 반박 시도(§0.5): 5·7 이 아직 안 끝났어도 이 PR **구현 자체**는 막히지
않는다(새 코드가 기존 시트 코드를 안 건드림), 오직 **머지**(=이 라우트가 실제로 트래픽을
받는 것)만 20 이후로 미루면 된다. 그래서 belie 의 단순화가 맞다 — 이견 없음.

**설계 근거(로드맵 §69-71)**: "기수 생성 = Drive 파일복사 + 폴더생성 + 레지스트리 쓰기 +
O1/O2 기록 → DB insert 1건으로 붕괴. `cohort_pending_creates` 재시도 큐도 존재 이유 소멸
(Drive copy 실패 대비였음)." — BBE-69 가 googleapis 를 완전히 제거하면, 애초에 복제할 개인
시트가 없으므로 Drive 복사·폴더매칭·O1/O2 시트 기록·복사실패 재시도 큐 전부 무의미해진다.

**실측**: `lib/repo/db/migrations/0001_users_cohorts.sql`(BBE-54)·`0002_users_natural_key.sql`
(BBE-55) 가 이미 `cohorts.season_start_iso`·`users.course_start_iso/graduation_iso` 컬럼을
만들어뒀다 — 로드맵 §71 이 우려했던 "O1/O2 DB 컬럼 없음" 문제는 **이미 해소됨**(신규
마이그레이션 불필요). `lib/repo/db/registry.ts` 의 `upsertUserRow`/`upsertCohortRow` 도
BBE-55 dual-write 용으로 이미 존재 — 이번 작업은 새 쓰기 메커니즘을 만드는 게 아니라, 그
메커니즘을 **fire-and-forget 미러가 아닌 1차 동기 쓰기**로 승격하고, Drive/Sheets 경로를
들어내는 것.

## 1. MVP 스코프 — `create-cohort-members` 만, `create-arena-members` 는 제외

**자율 결정(§0.7, 2026-08-10)**: 일반 기수 생성 라우트(`app/api/admin/create-cohort-members
/route.ts`)만 이번 PR 에서 교체한다. 아레나 생성(`app/api/admin/create-arena-members
/route.ts`, `createFolder` 로 회사 폴더까지 만드는 별도 흐름)은 **구조는 동일하지만 폴더
2종(개인+회사) 처리가 얽혀 diff 가 두 배로 커진다** — 이번 PR 로 패턴을 확립한 뒤 후속 카드로
분리. 되돌리기 쉬움(아레나 라우트는 전혀 안 건드림 — 기존 동작 그대로).

**응답 계약은 그대로 유지**(요청 필드도 그대로 받되 Drive 전용 필드는 무시) — 프런트
(`components/auth/CohortCreateModal.tsx`)를 한 줄도 안 고친다. 근거: `dates[]`(O1/O2 리포트)·
`pending[]`(재시도 대기)는 화면이 `.length` 로 카운트만 보여주는데, 새 흐름은 둘 다 **항상
빈 배열**이 정답이다(DB 쓰기는 "템플릿 잔재가 남는" 실패 모드 자체가 없고, 복사 실패도 없어
재시도 대상이 안 생긴다) — 빈 배열은 버그가 아니라 그 기능이 필요 없어진 것의 정확한 표현.
`created[].sheetId` 는 화면이 읽지 않는 필드(실측 — Explore 조사)라 안전하게 생략.

`app/api/admin/retry-cohort-creates`(재시도 큐 처리)·`components/auth/
CohortPendingRetryButton.tsx` 는 **건드리지 않는다** — 신규 생성이 더는 큐에 안 쌓이므로
`pendingCount` 는 자연히 0 이 되고 버튼은 조건부 렌더(`pendingCount<=0 && !result → null`)로
스스로 숨는다. 굳이 지워서 "이미 큐에 있던 옛 pending 작업"의 재시도 경로까지 함께
없앨 이유가 없다(YAGNI 반대방향 — 안전한 하위호환을 공짜로 얻는데 지울 이유 없음).
`lib/repo/db/cohort-pending.ts`(테이블 자체)도 미접촉 — 테이블 드롭은 별도 마이그레이션
결정이라 스코프 밖.

## 2. 구현

### 레이어
```
lib/repo/db/registry.ts      — findUserByCohortName 추가(읽기, 기존 upsert 옆)
lib/service/cohort-create-db.ts — 신규. 순수 함수 decideMemberDbAction(멱등 판정, googleapis 의존 0)
app/api/admin/create-cohort-members/route.ts — 교체. Drive/Sheets 호출 전부 제거,
                                                upsertCohortRow/upsertUserRow 직접(동기) 호출
```
`parseCohortToken`·`isValidISODate`·`computeGraduationISO`(기존 순수 함수)는 그대로 재사용 —
토큰 파싱·날짜 계산 로직은 스토리지 계층과 무관해 안 바뀐다.

### 동작
1. 토큰 파싱(`parseCohortToken`) → 실패 시 400(기존과 동일)
2. `courseStartISO` 형식 검증(기존과 동일) → 있으면 `computeGraduationISO` 로 종강일 계산
3. `upsertCohortCells`(label, {type, season_start_iso?}) — **부분** upsert(전체 행 아님) —
   기존 기수의 status/note 를 실수로 덮어쓰지 않는다(전체 upsert 였다면 재제출마다
   status="active" 로 되돌아가는 클로버링 버그가 생김, `upsertCohortRow` 대신 이걸 쓰는 이유)
4. 멤버별: `findUserByCohortName(cohort, name)` 로 기존 행 존재 확인
   - 있으면 skip(멱등 — 재제출해도 중복 생성 없음)
   - 없으면 `upsertUserRow({email:"", cohort, name, role:"trainee", status:"active",
     cohortLabel: display, nameLabel: name, courseStartISO, graduationISO, ...나머지 빈값})`
     — email 빈값 = 기존 prep-row 와 동일한 "self-claim 대기" 의미 유지(claim 플로우는
     DB 읽기 flip(BBE-56/57)이 이미 처리하므로 이 PR 은 claim 쪽을 안 건드려도 그대로 동작)
5. `dbEnabled()` 가 false 면 즉시 503 — 이 라우트는 **폴백이 없다**(ADR-0030 §2 표 그대로:
   R7-#21 이후 신규 기수는 "애초에 시트가 없다" — 시트로 되돌아갈 개념 자체가 성립하지 않음)

### 제거된 것
Drive copy(`copyTemplateSheet`/`copyWithRetry`)·폴더 매칭(`findFolderContainingName`)·
레지스트리 시트 prep-row 쓰기(`addTraineePrepRow`)·O1/O2 시트 기록(`writeCourseDates`)·
재시도 큐 적재(`enqueueCohortCreate`)·아레나 명단 시트 append(`appendArenaRoster`, 아레나는
이번 스코프 밖이라 애초에 미호출)·`mode:"link"`(기존 시트 연동 — 시트가 없는 세상엔 의미 없음,
요청에 와도 무시).

## 3. 수용 기준
- [x] `findUserByCohortName` 유닛테스트(빈 결과·매칭 결과)
- [x] `decideMemberDbAction` 순수 함수 유닛테스트(이름없음→fail·기존행→skip·신규→create)
- [x] 라우트 통합테스트(인증·토큰 검증·멤버 상한 100·dbEnabled=false→503·정상 생성 응답 계약)
- [x] check.sh 초록
- [ ] **머지는 BBE-69 완료 후** — 그 전까지 이 PR 은 오픈 상태로 대기(반장 직렬 큐에 "보류"로 표시)
- [ ] BBE-69 머지 후: 이 브랜치를 최신 master 위로 리베이스 → check.sh 재통과 → §6.8 완주

## 4. 남은 위험 / 후속 결정 필요
- 아레나(`create-arena-members`) 는 후속 카드 — 이번 PR 이 패턴을 확립한 뒤 같은 방식 적용.
- `cohort_pending_creates` 테이블·`retry-cohort-creates` 라우트는 신규 생성이 더 이상 채우지
  않지만 물리적으로는 남는다 — BBE-69 완료 후 잔존 pending 이 0건임을 확인하면 별도 정리
  카드로 제거 검토(이번 스코프 밖).
- `mode:"link"`(기존 시트 URL 연동) 제거는 "이미 시트를 만들어둔 기수를 뒤늦게 앱에 연결"하는
  드문 운영 시나리오를 없앤다 — BBE-69 이후엔 애초에 시트가 없으므로 이 시나리오 자체가
  사라지는 게 맞다고 판단(자율결정, revert 가능).

## Log
- **2026-08-10 착수(데탑 C작업원C(260809))**: belie 직접 지시. 설계 확정 → 구현 → 테스트 →
  check.sh 초록 → PR 오픈(머지 보류 명시). 상세는 워크로그.
