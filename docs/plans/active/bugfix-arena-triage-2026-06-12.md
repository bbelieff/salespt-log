---
slug: bugfix-arena-triage-2026-06-12
status: active
created: 2026-06-12
owner: belie
related: arena-carryover-migration, arena-season1-setup, role-system
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 아레나 오픈 직후 터진 로그인/클레임·그룹핑·이월매출·실무수납 버그 8건의 근본원인 분석과, PC Claude Code에 줄 순차 수정 프롬프트.
> - **누가 읽나요**: 개발자, 에이전트, 운영자(belie)
> - **어떤 기능·작업과 연결?**: 클레임/라우팅(auth.ts·users.ts·claim), 트레이너/수강생 관리, 대시보드 이월 집계, 실무수납(payment) 필터·드라이브
> - **읽고 나면 알 수 있는 것**: 공통 뿌리(cohort 저장 불일치), 각 버그 원인 후보, 수정 순서
> - **관련 문서**: arena-carryover-migration.md, arena-season1-setup.md

# 아레나 오픈 직후 버그 트리아지 (2026-06-12)

## 0. 공통 뿌리 (keystone)
레지스트리 users 탭은 cohort를 **2컬럼**으로 둠: **B=정규화(`A1-5`/`5`/`T`)**, **I=표시(`A1-5기`/`5기`)**.
여러 버그가 여기서 파생:
1. **아레나 cohort가 `A1-5`(기 strip)로 저장** → `parseInt("A1-5")=NaN→0`(users.ts:listAllUsers L130) → 그룹핑/정렬 깨짐([1-3]).
2. **옛 기수 행이 archived 아님** → `findUserByEmail`(users.ts L95-113)이 옛 active 행을 반환 → claimAccount short-circuit → **옛 시트로 로그인**([1-1][1-2]).
3. **isArena = /^A/.test(cohort)** 가 cohort=`5`로 오판 → 폴더 경로 오류([6]).
→ **P1에서 cohort 저장·인식·archived를 일관화**하면 1-1/1-2/1-3/6 뿌리가 같이 잡힌다.

근거 파일: `lib/service/auth.ts:claimAccount`(L94-193), `lib/repo/users.ts:findUserByEmail`(L95-113)·`isNumericCohortArchived`(L84-93)·`listAllUsers`(L117-138), `lib/repo/users-claim.ts:claimRegistry`, `lib/service/cohort-token.ts:arenaCohortLabelParts/isClaimableCohort`, `app/claim/page.tsx`.

---

## P0 — [2] 클레임 '시작' 무반응 복구 (P0, 아무도 로그인 못 함)
```
세일즈PT — [P0] 클레임 시작 무반응 긴급 복구(8기 전원·아레나 전원 접속 불가). 브랜치 fix/claim-stuck. SoR: docs/plans/active/bugfix-arena-triage-2026-06-12.md.
[증상] 클레임에서 필드 채우고 "경영일지 시작하기" 눌러도 무반응. 8기(숫자)·아레나 둘 다.
[먼저 재현·계측(필수)] dev 로그인→/claim 제출 시: (a) 버튼 disabled 여부(valid), (b) /api/claim 응답 status/바디(Network), (c) 콘솔 에러, (d) 성공 후 window.location="/" → app/page.tsx 라우팅이 **다시 /claim 으로 튕기는 루프**인지. 무반응의 정체(버튼 미발화 vs 제출은 되나 /claim 재진입 루프 vs 500 무표시)를 먼저 확정.
[원인 가설] 제출은 되지만 등록 결과가 pending/옛행 우선 등으로 app/page.tsx 가 /claim 재진입 → 화면 그대로(=무반응 체감). 또는 /api/claim 5xx인데 에러 미표시.
[수정] 확정된 원인 제거: 라우팅 루프면 claim 성공 시 목적지 보장(active/pending 처리·캐시 무효화), 5xx면 원인 함수(예 getArchivedCohortSet·migrateArenaCarryover·claimRegistry) 예외 처리 + 화면 에러 노출. handleSubmit 실패도 항상 사용자 메시지.
[수용] 8기 1명·아레나 1명 실제 클레임→해당 대시보드 진입 성공(루프 없음). 실패 시 명확한 메시지. npm run check. PR. Cowork 검증불가, PC 정본.
```

### P0 진단·수정 결과 (2026-06-12, fix/claim-stuck)
- **dev 재현·계측**: 아레나 claim → 200 active → `/`→307 `/dashboard` 정상. 버튼 valid, 콘솔 무에러, 500 없음, 캐시 hit 67ms(quota 정상). **dev 단일에선 P0 무반응 미재현** → prod 전용(전원 동시 접속).
- **유력 원인**: #363(rejoin)이 `findUserByEmail`(=/api/me 등 모든 trainee 요청 hot-path)에 `getArchivedCohortSet()` cohorts read 를 추가 → 8기·아레나 전원 동시 클레임/로그인 시 Sheets read quota(60/min) 가중 → 지연·throttle 체감(무반응).
- **수정**: ① cohorts-archived 강등을 hot-path `findUserByEmail` 에서 제거 → 라우팅 결정 지점(app/page.tsx·(app)/layout)·claimAccount 에서만 1회 판정(quota 경감, rejoin 보존). ② `findUserByEmail(.., {fresh:true})` — claim 직후 캐시 전파 지연 시 page.tsx 가 1회 우회 read 로 /claim 루프 차단(방어). ③ handleSubmit 실패 항상 에러 표시(기존).
- **잔여**: prod 실측(네트워크 /api/claim status·소요, 콘솔) 권장 — quota 가설 확증/추가 대응용.

## P1 — [1-1][1-2] 아레나 cohort 저장·라우팅 근본 수정
```
세일즈PT — [P1] 아레나 재참가 cohort 일관화 + 옛 기수 라우팅. 브랜치 fix/arena-cohort-consistency. SoR: bugfix-arena-triage §0. 선행/연계: P0.
[증상] 신민경(A1-5기)·김태현(A1-2기)이 로그인하면 옛 5기/2기 시트로 들어옴, 내쫓고 재로그인하면 안 들어와짐. 아레나로 클레임했는데 수강생관리에 '일반기수'로 분류됨.
[원인(확인)] ① findUserByEmail(users.ts L95-113): 같은 이메일 옛 active 행(숫자 cohort)이 archived 아니면 그 행 반환 → claimAccount(auth.ts L102) short-circuit → 옛 시트. ② 옛 기수가 cohorts 탭 archived 미등록(isNumericCohortArchived L84-93 가드 미발동). ③ 레지스트리 B컬럼에 아레나가 `A1-5`/혹은 `5기`로 저장돼 분류 깨짐.
[수정]
1. **옛 기수 archived 처리**: 아레나에 합류한 기수(1~6기 중 참가자)들의 cohorts 탭 보관 처리 OR 라우팅에서 "같은 이메일에 A1-* 행이 있으면 그 행을 옛 숫자 행보다 우선" 으로 findUserByEmail 보강. (둘 다 가능하나 후자가 데이터 의존 적음 — A1-* active/pending 행 우선 반환.)
2. **claim 연결 보장**: 아레나 클레임 시 prep 행(create-arena-members가 만든 `A1-N기` 행)과 매칭되게 — findExistingSheetIdByCohortName 이 cohort `A1-5기`(또는 정규화 `A1-5`)로 prep 행을 찾는지 확인·정정.
3. **저장 일관화**: 레지스트리 B=cohort 를 아레나는 항상 `A1-N`(정규화 규칙 통일), I=라벨 `A1-N기`. claimRegistry·claimAccount 반환값 점검.
4. **기존 오등록 backfill**: 이미 '일반기수'로 잘못 들어간 아레나 참가자(신민경·김태현 등) 레지스트리 행을 올바른 A1-N기/시트로 교정하는 admin 1회 스크립트/버튼(또는 수동 절차 문서화).
[수용] 신민경/김태현 로그인→A1-5기/A1-2기 아레나 시트 진입, 재로그인 안정. 수강생관리에 아레나로 분류. 신규 아레나 참가자도 동일 보장(회귀 테스트 rejoin-routing.test.ts 확장). npm run check. PR. Cowork 검증불가.
```

### P1 수정 결과 (2026-06-12, fix/arena-cohort-consistency)
- **택1 — 라우팅 우선(데이터 의존 적음)**: `lib/repo/user-priority.ts` 신규(순수 함수).
  `pickPreferredUser([...rows])` = 아레나(`A{n}-{m}`) non-archived > 숫자 non-archived
  > archived fallback. `findUserByEmail`(users.ts)이 이걸 호출(인라인 11줄→6줄, 498줄).
  → 같은 이메일 옛 6기 active + A1-6 active 공존 시 **A1-6 우선** 반환 →
  page/layout 의 `isNumericCohortArchived("6")` /claim 강등 회피 → 아레나 대시보드 진입.
- **②/③ 재평가**: P0(claim-stuck)에서 hot-path 강등 제거 + 라우팅/claimAccount 에
  cohort-archived 체크 이미 도입. ③ 저장은 `claimRegistry` cohortNorm("A1-N") +
  `findExistingSheetIdByCohortName` 정규화 매칭 이미 일관(검증 완료). 추가 변경 불필요.
- **④ backfill**: 실측 결과 신민경·김태현은 registry **미등록**(P0 무반응으로 클레임
  자체 불가했던 상태) → backfill 대상 없음. P0 배포 후 본인 클레임 시 위 라우팅으로
  정상 처리. 실존 6/A1-6 다중 행 3명(miran.kim090·whto12360·da1223618)이 실검증 케이스.
- **회귀 테스트**: rejoin-routing.test.ts +9 (isArenaCohortLabel 6 + pickPreferredUser 5,
  옛 기수 먼저여도 아레나 우선·순서 무관·archived fallback). 총 12 pass.

> ⚠️ **P1 ④ backfill 정정 (2026-06-14, 라이브 레지스트리 실측)**: "미등록 → backfill 불필요"는 틀림. 실제로는 ① 신민경·김태현·김우빈·박종훈·고경희·김소라 등 **pending 중복 행 수십 개**, ② 정유영·이재영·김덕호·박준용 등 **B열 숫자(3·1·4)인데 I열·시트는 A1-N** (아레나인데 숫자 분류), ③ **2·5기 cohorts archived 미처리**, ④ 일부 **A1-N prep 행 누락**(예: 신민경이 A1-5 prep에 없음). → 아래 P1b 로 데이터 정리 필요.

### P1b — 레지스트리 오염 데이터 backfill (실데이터 정리)
```
세일즈PT — [P1b] 레지스트리 오염 데이터 backfill(중복 pending·cohort 숫자오저장·archived 누락). 브랜치 fix/registry-backfill. SoR: bugfix-arena-triage §0·P1. 선행: P0·P1 배포 완료(아니면 정리해도 재오염).

⚠️ 레지스트리(users·cohorts 탭) 직접 변경 = 파괴적(행 삭제·셀 수정). 반드시 백업+드라이런+확인 후 적용.

[0] 준비
- SHEETS_REGISTRY_ID 의 users·cohorts 탭 **백업**(시트 복제 또는 값 스냅샷 파일 저장).
- 라이브라 계속 변하므로 **최신 데이터 재덤프** 후 분석(아래 예시는 참고용, 하드코딩 금지).
- 모든 변경은 **드라이런(쓰기 0) 프리뷰 출력 → belie 확인 → 적용** 2단계. 변경 건수·대상 row 명시.

[1] pending 중복 정리 (최신/올바른 1행만)
- trainee 행을 email(소문자) 로 그룹.
- email당 **1행만 유지**: 우선순위 ① A1-N cohort > 숫자 cohort, ② active > pending, ③ 같으면 마지막(최신) 1개. 나머지 삭제.
- 트레이너 행·빈email prep 행은 제외([4]).
- 참고 예시(재덤프로 확정): mymk1005(신민경 A1-5/5 다수), rlaxogus3454(김태현 A1-2/2), kwb105702(김우빈), a01056285798(김소라 ×8), 8기 gusals208457(김현민)/leeyongho9(이용호)/sangjun0420(박상준) 중복.

[2] cohort B열 숫자→A1-N 교정
- 조건: I열(cohortLabel)=`A1-N` 인데 B열(cohort)=숫자 이고 spreadsheetId 가 아레나 시트인 행 → **B열을 A1-N으로** 교정(I열·시트와 일치).
- 참고: zzzddz01(정유영 3→A1-3), onjuncenter(이재영 1→A1-1), goodho0401(김덕호 1→A1-1), wnsdyd395333(박준용 4→A1-4).

[3] cohorts 탭 archived 처리
- type=cohort 행 **2,5 → archived** (현재 archived=연습·T·6·4). 사용자 요청 명시 항목.
- 권장(확인 후): 1,3 도 archived — 졸업 기수 전부 일관(1·3기 아레나 참가자는 A1-N 행 보유라 라우팅 영향 적으나 일관성 위해).

[4] 누락 prep/연결 점검 (드라이런 리포트만, 자동수정 X)
- 아레나 명단(arena-season1-setup §4) 대비 **A1-N prep 행 누락자** 리스트(예: 신민경 A1-5 prep 부재). 누락자는 수동 생성/연결로 별도 안내.

[수용 + 실행 전/후 실측]
- 전/후 카운트 실측: 총 trainee 행 수, email별 최대 행 수(중복 0 확인), B≠I 불일치 행 0, cohorts archived 집합(2·5 포함).
- 신민경·김태현 실제 로그인 → 올바른 A1-N 시트 진입(P1 라우팅과 결합 확인).
- dedup·B교정 순수함수 단위테스트. npm run check. PR.
- Cowork 검증불가 — PC 정본. 백업본 보관.
```

### P1b 수정 결과 (2026-06-14, fix/registry-backfill)
- **백업**: users(A:R)·cohorts 값 스냅샷 → `backups/registry-{users,cohorts}-<ts>.json`
  (gitignore, 로컬 보관). 드라이런 계획도 `backups/p1b-plan-<ts>.json`.
- **실데이터가 스펙 예시와 상이**(재덤프 확정): 스펙이 든 신민경·김소라×8 등 대량
  중복은 **현재 없음**(P0~P3 사이 라이브 변동). 실제 정리 대상은 소수:
  - **[1] 중복 3행 삭제**(belie 확인): 김미란·조정욱·신다혜 옛 6기 archived
    (각 A1-6 active 유지). 화이트리스트 3 email + cohort=6 + archived 검증 후만 삭제
    (라이브 행번호 밀림·재오염 안전, active 아레나 절대 보호).
  - **[2] B교정 4건**: 정유영(3→A1-3)·이재영(1→A1-1)·김덕호(1→A1-1)·박준용(4→A1-4).
    I열·시트가 A1-N인데 B만 숫자 오저장 → B를 I와 일치.
  - **[3] cohorts archived 추가**(belie 확인 1·2·3·5): cohorts 탭에 해당 행이 아예
    없어 신규 추가. 결과 집합 [연습,T,6,4,1,2,3,5].
- **후 카운트 검증**: trainee 29→26, email별 최대 1(중복 0), B≠I 0,
  김미란·조정욱·신다혜 = A1-6/active만. cohorts archived 1·2·3·5 포함.
- **순수함수 + 테스트**: `dedupKeepIndex`·`arenaCohortCorrection`(user-priority.ts) +
  rejoin-routing.test.ts +5 (총 22 pass). 데이터 적용은 1회 스크립트(PR 미포함).
- **[4] prep 누락(후속)**: 신민경 A1-5 등 prep 행 부재 가능 — 자동수정 대상 아님,
  아레나 명단 대비 수동 점검·생성 별도 진행.
- 신민경·김태현 실제 로그인 확인은 본인 클레임 발생 시 P1 라우팅으로 검증(현재 미등록).

## P2 — [1-3] 트레이너/수강생 관리 그룹핑 (A1-N기 묶기, 회장=이모지)
```
세일즈PT — [P2] 관리 화면 아레나 그룹핑 정정. 브랜치 fix/admin-arena-grouping. SoR: §0. 선행: P1(cohort 일관화).
[증상] 수강생 명단에서 아레나가 한데 안 묶이고, 회장이 일반기수와 갈라져 분류·체계 없음. 예: A1-1기 회장 김지훈·일반 김덕호·이재영이 그냥 "1기"로 묶임. 3기는 반대(회장만 3기로, 일반은 A1-3기).
[원인] listAllUsers 정렬이 `parseInt(cohort)`(L130) → `A1-5`=NaN→0, 일부는 `5`로 저장돼 그룹이 갈림. 그룹키/표시가 B(cohort)·I(cohortLabel)·captainOf 혼용.
[수정]
1. 그룹키 = **표시 라벨 정규화값**(A1-N기는 그 자체, 일반은 N기)로 통일. 정렬도 아레나(A시즌-기수)·일반 숫자 모두 의도대로(예 아레나 묶음 우선/시즌·기수 순).
2. **회장은 별도 그룹 금지** — 같은 A1-N기 그룹 안에 두고 **이모지 마커(예 👑)** 로만 구분(captainOf 표시는 뱃지). 일반 멤버와 한 박스.
3. trainer 페이지·admin/users 동일 로직 공유.
[수용] A1-1~6기가 각 박스로 묶이고 회장은 그 박스 안에서 이모지로만 구분. 일반 숫자 기수 회귀 없음. npm run check. PR. Cowork 검증불가.
```

### P2 수정 결과 (2026-06-12, fix/admin-arena-grouping)
- **공유 헬퍼(최하위 types 레이어)** `lib/types/index.ts`: `cohortGroupKey(cohort, captainOf)`
  (captainOf 우선 → 회장이 옛 기수로 저장돼도 아레나 그룹 통일) · `cohortSortTuple`
  (아레나 A시즌-기수 우선/asc, 일반 숫자 desc, 기타 끝) · `cohortGroupCompare`.
  repo·component 모두 import 가능(component→repo 금지 회피).
- **정렬 단일출처**: `listAllUsers`(repo) 정렬을 cohortGroupCompare 로 교체.
  그룹 컴포넌트는 **재정렬 제거**하고 입력순(=정렬순) 보존 — 중복 정렬 제거.
- **그룹키 통일**: 4개 그룹 화면(admin 수강생관리 AdminUserPicker, 트레이너
  TrainerCohortView, 트레이너관리 TrainerMgmtSections.groupByCohort·TrainerAssignCard)
  모두 captainOf||cohort 그룹키. 실측상 아레나는 이미 cohort="A1-N" 일관 저장(회장
  김지훈도 A1-1) — UI 그룹키만으로 정상화, 데이터 backfill 불필요.
- **회장 👑**: TraineeCard·SectionTraineeList·TrainerAssignCard 에서 captainOf 채워진
  멤버에 👑(같은 박스 내, 별도 그룹 금지). 그룹 헤더 "—" → "미분류".
- **타입**: Trainee·PanelUser 에 captainOf? 추가. enrich(`...u`)로 자동 보존.
- **회귀 테스트**: rejoin-routing.test.ts +5 (cohortGroupKey captainOf 우선·cohortSortTuple
  분류·정렬 결과 [A1-1,A1-6,8,6,관리]). 총 17 pass / check 196 pass.

## P3 — [4] 이월 매출/영업이익 일관성 (4기·6기 영업이익 0 안 됨)
```
세일즈PT — [P3] 이월 매출/영업이익 누수 완전 차단(서비스 레이어). 브랜치 fix/carryover-profit-leak. SoR: §0, docs/incidents/2026-06-12-carryover-revenue-leak.md.
[증상] 6기·4기 이월 후 대시보드 영업이익이 0으로 안 바뀜. 실무/수납 계약카드는 '이월' 회색 처리만 되고 수임비·수수료는 여전히 매출·영업이익에 잡혀 일관성 없음.
[원인(가설·확인)] #365는 시트 수식 경로(02!D3→01!O5→대시보드 C21/D21)만 고침. **서비스 레이어 computeContractRevenue/loadDashboard(lib/service/dashboard.ts)가 02 payment 행을 이월 필터 없이 합산** → 영업이익(profit=revenue-cost)에 이월 포함. 또 #365 전파가 4기·6기 전체에 안 됐을 수 있음.
[수정]
1. 서비스 레이어 매출·수임비·수수료 합산(computeContractRevenue 및 totalFee 등)에 **이월(02 AI=이월) 제외** 가드 — 대시보드 영업이익·SummaryBar·전광판 모두 일관.
2. 시트 수식(02!D3 등) **4기·6기 포함 이월 보유 전시트 재전파**(setup-formulas, §2.5 pre-read).
3. 카드 표시: 이월이면 매출/이익 기여 0임을 회색+뱃지로 명확(접힘 헤더 포함).
[수용(실데이터 실측 — 박제 규칙)] 이월 보유 4기·6기 실제 시트에서 영업이익·매출 **전/후 수치 실측**(이월분 빠져 0/정합). 0건 카나리아 불가. 단위테스트(이월 제외 합산). npm run check. PR. Cowork 검증불가, PC 정본.
```

### P3 수정 결과 (2026-06-12, fix/carryover-profit-leak)
- **이월 위치 정정**: 이월 마킹(구분=이월)은 옛 4·6기 시트가 아니라 **새 아레나(A1-N)
  시트에 복사된 행**에 붙는다(migrateArenaCarryover §2 — 아레나 순수 실적 분리용).
  옛 기수 행은 status=archived. → P3 대상은 **아레나 시트 대시보드/수납탭**.
- **서비스 레이어 가드(핵심)**:
  - `computeContractRevenue`(dashboard.ts): `구분==="이월"` 행 제외 → 대시보드 매출·영업이익.
  - `payment/page.tsx`: 합계(totalReceived/Approved/Contract)를 `billable`(이월 제외)로.
    카드 목록(rows)은 회색 표시 그대로.
  - SummaryBar 는 **이미** 이월 제외(m.구분!=="이월") — 무변경.
- **실데이터 실측(전/후)**: A1-6 조정욱 — 매출 전 **22,025,000**(이월분=전액) → 후 **0**.
  6기 옛 계약 22M이 아레나 시트에 이월 복사돼 아레나 실적에 잡히던 것을 정확히 제외.
  (Sheets read quota 로 나머지 33 아레나 시트는 실측 중단 — 1건 명확 입증 + 단위테스트 2종.)
- **시트 수식 재전파 불요 판단**: 대시보드 매출·영업이익은 **서버 sum**(computeContractRevenue)
  이라 시트 02!D3 수식과 무관하게 즉시 정합. 아레나 시트는 신양식(02 계약수납관리)
  + create-arena-members 가 #365 가드 수식(D3 SUMIFS "<>이월") 설치 → 별도 재전파 불요.
  옛 4·6기 시트는 archived(본인 미열람) + 6기는 옛 양식("02 계약관리", AI 컬럼 부재)이라
  재전파 비대상. (quota 회복 후 아레나 시트 D3 가드 1건 스폿체크 권장.)
- **회귀 테스트**: dashboard.test.ts +2 (이월 제외·전부이월 0). 총 5 pass.

## P4 — [6] 실무/수납 드라이브 자동연결 무반응
```
세일즈PT — [P4] 실무수납 드라이브 자동연결 무반응 수정. 브랜치 fix/payment-drive-link. SoR: §0. 선행: P1(cohort).
[증상] 실무/수납 탭 드라이브 연결이 자동으로 찾다가 무반응으로 끝.
[원인(가설)] DriveLinkBar.runLink → /api/drive-link auto: ① 응답 타임아웃·에러 미표시로 pending 무한, ② isArena=/^A/.test(cohort)가 cohort=`5`(오저장)면 일반기수로 오판→아레나 폴더(16C 하위 `…_대표님 업체관리`) 못 찾음.
[수정] ① 타임아웃+실패 시 명확한 에러·재시도 UI(무반응 금지). ② 아레나/일반 폴더 해석을 cohort 일관값(P1) 기준으로 정정, 자동탐색 실패 시 수동 URL 입력 fallback 안내. ③ belie OAuth(ADMIN_DRIVE_REFRESH_TOKEN)로 탐색.
[수용] 아레나·일반 각각 자동연결 성공 또는 명확한 실패+수동 fallback. 무반응 없음. npm run check. PR. Cowork 검증불가.
```

### P4 수정 결과 (2026-06-14, fix/payment-drive-link)
- **무반응 핵심 = 클라이언트 타임아웃 부재**: DriveLinkBar.runLink 의 fetch 에
  AbortController + 25초 타임아웃 추가. abort 시 "시간이 초과됐어요. 다시 시도하거나
  아래에 폴더 주소를 직접 붙여넣어 주세요." → 무한 "찾는 중…" 차단 + 수동 fallback 유도.
- **isArena 판정·서버 분기**: #366(fix/drive-connect-arena)에서 이미 정비됨
  (registry O 1순위 → 16C 하위 매칭 → 수동 URL). isArena 는 me.data.cohort(P1 일관값)
  기준이라 추가 수정 불요. 서버는 ARENA_NOT_FOUND·folder_not_shared 에러 응답 구조 보유.
- 에러 UI(folder_not_shared SA 공유 안내)는 #366 기존 유지.

## P5 — [5] 실무/수납 계약업체 필터
```
세일즈PT — [P5] 실무수납 계약업체 필터 실동작. 브랜치 feat/payment-contract-filter. SoR: §0.
[증상] 계약업체 필터 개발하기로 했는데 안 됨(#356 돋보기 검색은 하이라이트뿐, 실제 목록 필터 아님으로 추정).
[수정] payment 목록에서 돋보기 검색어로 **비매칭 계약카드를 실제로 숨기는 필터**(부분일치·공백/대소문자 무시), X로 초기화. 선택/저장 로직 불변. 필요 시 상태(이월/native·진행률) 필터 토글 추가 검토.
[수용] 검색어 입력 시 매칭 업체만 표시, 초기화 정상. npm run check. PR. Cowork 검증불가.
```

### P5 결과 (2026-06-14): 이미 구현됨 — 변경 불요
- payment/page.tsx `visibleRows`(검색어로 비매칭 카드 **실제 숨김**) + CompanySearchBar
  ✕ 초기화 + 부분일치(includes)·대소문자/공백 무시(normq) + matchCount 표시 모두 동작.
  #356 이후 이미 필터 구현됨 → 추가 변경 YAGNI 위반으로 미실시.

## P6 — [3] 아레나 관리: A1 박스 + A1-1~6 드래그앤드롭 순서
```
세일즈PT — [P6] 아레나 관리 A1 묶음 + 기수 박스 DnD 순서. 브랜치 feat/arena-admin-dnd. SoR: §0, arena-season1-setup §6.
[요구] 아레나 관리(전광판/명단)에서 **A1을 하나의 박스로 묶고**, 그 안에 **A1-1~6 기수 박스**를 보이게. A1-1~6 박스 **순서를 드래그앤드롭으로 임의 변경** 가능.
[수정] A1(시즌) 컨테이너 + 기수 카드 grid. DnD(예 @dnd-kit 또는 HTML5 draggable) 순서 변경, 순서를 저장(레지스트리 sortOrder 또는 admin 설정 시트). tokens.md/components.md 등재.
[수용] A1 박스 안 A1-1~6 표시·DnD 재정렬·새로고침 후 순서 유지. npm run check. PR. Cowork 검증불가.
```

## P7 — 잡동사니 정리 (오류 아님, 위생)
```
세일즈PT — [P7] 레포 위생 정리. 브랜치 chore/repo-cleanup.
- 루트 임시 디버그 파일 삭제: tmp-check-src.mjs, tmp-clean5.mjs, tmp-e2e-contact.mjs, tmp-verify-setup.mjs.
- `조업생총회_발표자료/`(사용자 자료 폴더)는 레포 밖으로 이동 또는 .gitignore(§6 raw/사용자데이터 금지).
- docs/plans/active 의 완료된 플랜(claim-arena-mode·arena-create·role-system 등 머지 완료분) → docs/plans/completed 로 이동(문서 드리프트 해소).
[수용] git status 깨끗(불필요 untracked 없음), 완료 플랜 이동. npm run check. PR.
```

### P7 결과 (2026-06-14, chore/repo-cleanup)
- 루트 tmp-*.mjs: 이미 정리됨(P0~P1b 작업 중 즉시 삭제). backups/ 는 gitignore.
- **졸업생총회_발표자료/**(pptx·md 2파일, P1 #368에서 `git add -A` 로 딸려 들어감) →
  `git rm --cached`(로컬 파일 보존) + `.gitignore` 추가. §6 사용자 자료 금지 준수.
- **완료 plan 이동**: claim-arena-mode·arena-create·role-system → completed/.
  나머지 active plan(60여 개)은 미완/완료 판정 불확실 — 일괄 이동 시 오분류 위험으로
  보류(월 1회 lint 시 개별 검토 점진 이동).

### P6 결과 (2026-06-14, feat/arena-admin-dnd) — DnD 정렬 기능만(저장 X)
- belie 결정: "드래그앤드롭 정렬 기능만" → **순서 저장 불필요** → cohorts 탭/신규 시트
  변경 없이 클라이언트 DnD 만 구현(저장소 설계 회피).
- `components/auth/ArenaCohortBoard.tsx`(신규, client): 시즌(A{n}) 컨테이너 박스 +
  그 안 기수 박스(A{n}-1~6)를 SortableList(dnd-kit)로 드래그 재정렬. onReorder no-op —
  SortableList 내부 order state 로 화면 정렬만 유지(새로고침 시 시즌·기수 asc 복귀).
  멤버 행(이름·이메일·이월·회장토글)은 기존 /admin/arena 패턴 유지.
- admin/arena/page.tsx: byCohort → 시즌별 그룹(bySeason) → ArenaCohortBoard 렌더.
  기존 인라인 section 제거. components.md 등재.

## P8 — [5b] 실무수납 계약 카드 정렬(계약등록일·진행도)
현황: 필터=`app/(app)/payment/page.tsx` `visibleRows`(업체명 검색만, **정렬 없음**=시트 행순). 진행도=`ContractRow` L169 슬롯 진행률 평균.
```
세일즈PT — [P8] 실무수납 계약 카드 정렬(계약등록일·진행도). 브랜치 feat/payment-sort. SoR: bugfix-arena-triage §P5/P8.
[요구] 검색바(CompanySearchBar) 옆/아래 정렬 컨트롤(세그먼트/드롭다운):
  - 계약등록일 빠른순(계약일 asc) / 늦은순(desc)
  - 진행도 낮은순(asc) / 높은순(desc)
  기본 = 계약등록일 빠른순(또는 현행 시트순 유지).
[구현]
1. page.tsx: sortKey state. visibleRows(필터) → sortedRows(정렬) 파생. 렌더·선택 폴백(selectedCp)·findIndex(ordinal) 모두 sortedRows 기준으로 일관.
2. 정렬값: 계약일=Date 파싱(빈값 끝으로 안정정렬). 진행도=각 cp 슬롯(수납1~3) 진행률(%) 평균 — ContractRow 의 진행도 계산 로직을 **순수 헬퍼로 추출**(app/(app)/payment/_lib 또는 lib)해 page·ContractRow 공유(중복 제거).
3. 정렬 UI는 tokens 준수, 모바일/PC 공통. 검색·하이라이트·선택 동작 회귀 없음.
[수용] 4개 정렬 정상 + 필터와 결합 동작 + 선택 유지. 정렬 컨트롤 components.md 등재. npm run check. PR. Cowork 검증불가.
```

## P9 — [긴급] 아레나 참가자 접속 불가(클레임 pending stuck) 복구
근본원인(확인): `lib/repo/users-claim.ts:claimRegistry` — 클레임이 (cohort,name) 으로 prep 행을 못 맞추면(①prep 생성 누락=신민경, ②사용자가 '수강생' 모드+옛 숫자로 클레임=김소라) → 새 행을 **status=pending** append. app 라우팅이 pending 차단 → /claim 튕김 → "스피너→시작버튼 회색 stuck". 아레나는 전원 사전승인(prep=active)인데 prep 못 맞춘 사람만 pending.
```
세일즈PT — [P9 긴급] 아레나 참가자 접속 불가 복구. 브랜치 fix/arena-claim-active(+1회 registry 복구 스크립트). SoR: bugfix-arena-triage §P9.

[A. 코드 — 재발 방지(deploy 1회)]
- 아레나 cohort(^A\d+-\d+) 클레임은 **status=active**(사전승인)로 등록. claimAccount/claimRegistry 에서 arena 면 pending 대신 active(일반 숫자 기수는 pending 유지).
- 효과: prep 누락자도 아레나 모드로 클레임하면 active 로 즉시 입장.

[B. 데이터 — 이미 stuck 된 사람 즉시 복구(1회 스크립트, 백업→드라이런→확인→적용)]
- 레지스트리 백업 후, 아레나 명단(arena-season1-setup §4) 37명 각자 **A1-N active 행 1개**(본인 email+시트)로 정리:
  0) **(가장 흔함) 본인 email 달린 A1-N `pending` 행이 있으면 → status=active 로 플립**(신민경 mymk1005/A1-5, 김태현 rlaxogus/A1-2, 김우빈 kwb105702/A1-3 — 이미 시트·email 있고 pending 만이 문제).
  1) 빈email prep 행 있고 본인이 numeric(수강생모드) 으로만 클레임 → prep 행 A열에 email 채움(active 유지) + numeric 행 삭제(김소라 a01056285798 등).
  2) A1-N 행 자체가 없으면(테스트계정·일부 누락) → A1-N active 행 신규 추가(email + 본인 시트ID).
  3) 같은 email 옛 숫자/중복 pending 행 삭제.
- ※ 테스트계정(A1-0 테스터 1QhTSw…/A1-9·N 등)은 레지스트리 미등록이라 동일 — 테스트하려면 A1-N active 행(빈email 가능) 추가.
- 참고 매핑(라이브 재덤프로 확정): mymk1005=신민경/A1-5/1zz--RZ…, rlaxogus3454=김태현/A1-2, a01056285798=김소라/A1-1/1wEqUP…, 88happytime=김지훈, kwb105702=김우빈/A1-3, 9jsppe=박진섭/A1-3.

[수용/실측] 적용 후 각 아레나 email=A1-N active 1행(중복0). 신민경·김태현·김소라 실제 로그인→본인 아레나 대시보드 진입. arena→active 단위테스트. npm run check. PR. Cowork 검증불가·백업 보관.
```

### P9 수정 결과 (2026-06-14, fix/arena-prep-rows)
- **A. 코드(재발 방지)**: `lib/service/auth.ts:claimAccount` — 아레나
  cohort(`arenaCohortLabelParts(cohortTrim)!==null`) 클레임은 claimRegistry status
  를 **active**(사전승인)로, 일반 숫자 기수는 pending 유지. prep 누락자도 아레나
  모드 클레임 시 즉시 active 입장.
- **B. 데이터(stuck 복구, 1회 스크립트)**: 백업(`backups/registry-users-<ts>.json`) →
  **37명 명단 전수 대조** → 누락 정확히 **3명**(김태현 A1-2·김우빈 A1-3·신민경 A1-5,
  행 자체 부재 = 스펙 B-2). belie 제공 시트ID로 A1-N **active 행 append**
  (A~R 명시 구성, I~L 캐시=A1-N기·이름·2026-06-12·2026-08-01, O 폴더는 빈→drive-link
  auto 가 채움, Q=입금). append 전 email 부재 재확인 가드.
- **후 검증**: 총 누락 **0**, 3명 각 A1-N active 1행(중복 0), 올바른 시트ID 매핑.
  김소라(a01056285798)는 이미 A1-1 정상(빈email prep) — 추가 불요. 추가 누락자 없음.
- **실로그인**: 본인 클레임/로그인 시 P1 라우팅(아레나 우선)으로 A1-N 대시보드 진입(배포 후).

## P10 — [긴급·전역] 자가클레임 레지스트리 컬럼 밀림 → 로그인 무한반송
### P10 수정 결과 (2026-06-14, fix/claim-append-columns)
- **확정 근본**(= P0 의 진짜 원인): `claimRegistry` 의 append 가 range `users!A2:M` 로
  `values.append` → 빈 A열 prep 행이 많아 Google table-detection 이 좌측을 오인,
  새 self-claim 행을 **I열(8칸)~ 로 밀어 기록** → findUserByEmail(A열 조회) 못 찾음 →
  /claim 무한반송. dev 미재현(빈 A열 prep 적음) = P0 quota 가설이 아니라 이것.
- **A. 코드(재발 방지)**: claimRegistry branch3/4(공유·신규) + 트레이너 append 를
  **결정적 좌표 update**(`appendRegistryRow` → `A{rows.length+2}`)로 교체. appendRows
  (table-detection) 제거. DATA_RANGE A2:M→A2:R(밀린 행도 카운트). `nextRegistryRowNumber`
  순수함수 + registry-append.test.ts(+2).
- **B. 데이터(stuck 복구, belie 승인)**: 백업 후 컬럼 밀림 **garbage 58행** 정리 —
  prep 채움 6(정진웅·김소라·박종훈·고경희·박진섭 A1-N + 오민석 A1-2, sheetID/명단 매칭
  active), 중복 garbage 삭제만 3(신민경·김우빈·김태현, 정상행 존재), 신규 6(8기
  김현민·이용호·박상준 **active**(belie), 김지훈 **A1-5**(시트 B3 확인), 테스터·검증계정),
  garbage 58행 삭제. **후 검증: garbage 0, A열 정상 52행.**
- 김지훈(88happytime) 시트 B3=A1-5 로 명단 §4 누락분 확인 — A1-5 active 복구.

## Log
- 2026-06-12 트리아지: 공통 뿌리=cohort 저장 불일치+옛행 archived 누락. P0 클레임 무반응→P1 cohort 일관화→P2 그룹핑→P3 이월매출→P4 드라이브→P5 필터→P6 DnD→P7 위생 순.
- 2026-06-14 P8 추가: 실무수납 계약 카드 정렬(계약등록일 빠른/늦은·진행도 낮은/높은). 필터(P5/#356)는 업체명 검색만 — 정렬 미구현 확인.
- 2026-06-14 **P8 완료**(feat/payment-sort): `_lib/payment-progress`(순수 헬퍼 — progressPct·initialVisiblePayments·contractProgress·sortContracts) 추출해 ContractRow(표시)·page(정렬) 공유. PaymentSortControl(검색바 아래 4버튼: 등록 빠른/늦은·진행 낮은/높은, 기본 등록 빠른순). page: sortKey state → visibleRows=sortContracts(filteredRows) → 렌더·selectedCp·ordinal 모두 일관. 빈 계약일 끝·안정정렬. payment-progress.test +9. components.md 등재.
- 2026-06-14 **P10 완료**(fix/claim-append-columns): self-claim 레지스트리 행 컬럼 밀림(append A2:M table-detection) → 로그인 무한반송(P0 진짜 근본). claimRegistry 결정적 좌표 update + garbage 58행 정리. #376.
- 2026-06-14 **P10b 승인게이트 제거**(fix/claim-active-status): trainee 클레임은 시트 매칭된 정상 참가자 → status=active 즉시 입장(아레나·8기·현재기수 대기 없음). 트레이너(T)만 pending 유지. claimAccount isArenaClaim 분기 제거. 손기학 옛 4기 archived 이월원본 행 backfill(1줄). 4·6기 아레나 시트 전부 시트폴더(1L5Lh) 내 연결 확인.
- 2026-06-14 **P11 완료**(feat/cohort-season-box): TrainerCohortView 의 A1-N 기수를 "아레나 시즌{n}" 컨테이너 박스로 묶음(일반 숫자기수는 박스 밖). useMemo 에서 cohortGroupKey 그룹 후 isArena(^A\d+-\d+)로 generalActive/arenaSeasons 분리, 시즌(A{n})별 컨테이너 + 그 안 CohortSection(진행률·D-day·멤버카드 유지). /admin/arena P6 시즌박스와 시각 일관(purple). 회귀 없음.
