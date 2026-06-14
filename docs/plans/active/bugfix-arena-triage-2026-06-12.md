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

## P4 — [6] 실무/수납 드라이브 자동연결 무반응
```
세일즈PT — [P4] 실무수납 드라이브 자동연결 무반응 수정. 브랜치 fix/payment-drive-link. SoR: §0. 선행: P1(cohort).
[증상] 실무/수납 탭 드라이브 연결이 자동으로 찾다가 무반응으로 끝.
[원인(가설)] DriveLinkBar.runLink → /api/drive-link auto: ① 응답 타임아웃·에러 미표시로 pending 무한, ② isArena=/^A/.test(cohort)가 cohort=`5`(오저장)면 일반기수로 오판→아레나 폴더(16C 하위 `…_대표님 업체관리`) 못 찾음.
[수정] ① 타임아웃+실패 시 명확한 에러·재시도 UI(무반응 금지). ② 아레나/일반 폴더 해석을 cohort 일관값(P1) 기준으로 정정, 자동탐색 실패 시 수동 URL 입력 fallback 안내. ③ belie OAuth(ADMIN_DRIVE_REFRESH_TOKEN)로 탐색.
[수용] 아레나·일반 각각 자동연결 성공 또는 명확한 실패+수동 fallback. 무반응 없음. npm run check. PR. Cowork 검증불가.
```

## P5 — [5] 실무/수납 계약업체 필터
```
세일즈PT — [P5] 실무수납 계약업체 필터 실동작. 브랜치 feat/payment-contract-filter. SoR: §0.
[증상] 계약업체 필터 개발하기로 했는데 안 됨(#356 돋보기 검색은 하이라이트뿐, 실제 목록 필터 아님으로 추정).
[수정] payment 목록에서 돋보기 검색어로 **비매칭 계약카드를 실제로 숨기는 필터**(부분일치·공백/대소문자 무시), X로 초기화. 선택/저장 로직 불변. 필요 시 상태(이월/native·진행률) 필터 토글 추가 검토.
[수용] 검색어 입력 시 매칭 업체만 표시, 초기화 정상. npm run check. PR. Cowork 검증불가.
```

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

## Log
- 2026-06-12 트리아지: 공통 뿌리=cohort 저장 불일치+옛행 archived 누락. P0 클레임 무반응→P1 cohort 일관화→P2 그룹핑→P3 이월매출→P4 드라이브→P5 필터→P6 DnD→P7 위생 순.
