> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 모든 세션(Cowork·Claude Code)이 공유하는 작업 일지 — 세션 시작 시 읽고, 끝날 때 쓴다. 핸드오프 문서를 대체한다.
> - **누가 읽나요**: 모든 에이전트 세션(필수), 운영자(belie)
> - **어떤 기능·작업과 연결?**: 전체 트랙 공통 (CLAUDE.md §3 작업 규약 0단계)
> - **읽고 나면 알 수 있는 것**: 지금까지 무슨 일이 있었나 / 이번 요청이 어느 트랙의 연장인가 / 다음에 하기로 한 것은 무엇인가
> - **관련 문서**: CLAUDE.md §3·§5.5, docs/plans/active/* (각 트랙 SoR)

# 세션 워크로그 (Session Worklog)

## 프로토콜 (모든 세션 의무)

**시작할 때 (읽기)**
1. 아래 로그의 **최근 항목 5~10개**를 읽는다.
2. 지금 받은 요청이 **어느 트랙의 연장인지, 이전 결정과 충돌하지 않는지** 한 번 사고한 뒤,
   작업 첫 응답에 한 줄로 선언한다. (예: "이 작업은 R2 읽기 전환 트랙의 2호 PR입니다")
3. 상세가 필요하면 항목의 SoR 링크를 따라간다. 워크로그는 **지도**, 상세는 SoR에.

**끝날 때 (쓰기)**
- 작업 종료, 중요한 결정, PR 머지, 사고(incident) 시 **맨 위에** 항목을 추가한다.
- 형식 (한 항목 3~8줄, 초과 금지 — 길어지면 SoR 문서에 쓰고 링크만):

```
### YYYY-MM-DD · 트랙(버전) · 한줄 제목    ← 예: A(260712), M(260703), Cowork
- 의도: 사용자가 왜 시켰나
- 한 것: 결과 중심 (PR#, 검증 결과, 생성물)
- 결정: 새로 확정되거나 뒤집힌 것 (없으면 생략)
- 다음: 남긴 것, 차기 세션이 이어받을 것
- SoR: 상세 문서 경로
```

**트랙·세션 규칙 (2026-07-12)**
- **트랙 = 불변의 역할 문자**(아래 활성 트랙 보드). **세션 = 50MB마다 교체되는 소모품(몸)** —
  로그의 주어는 세션이 아니라 트랙. 버전 = 그 몸의 시작일 YYMMDD(같은 날 2개면 -2).
- 세션 교체(승계): 새 몸은 worklog 최근 항목 + 자기 트랙의 선언·plan 을 읽고
  첫 응답에 "트랙 X 승계(구버전→신버전)" 선언. **구역 소유권은 트랙에 귀속** — 재선언 불필요.

**유지 규칙**
- 새 항목은 항상 맨 위 (최신순).
- 항목 40개 초과 시 오래된 것을 `docs/worklog-archive/YYYY-MM.md` 로 이동.
- 비밀값(비밀번호·토큰·URI) 절대 기록 금지.
- 이 파일은 append 전용에 가깝게 — 과거 항목 수정은 오기 정정만.
- 활성 트랙 보드는 예외적으로 갱신 가능 — 단 **자기 트랙 줄만** 수정.

### 2026-08-21 · F(260820) · BBE-254 완주 — 개발 PC 디스크 회수 + 워크트리 위생 가드 신설
- 의도: belie 개발 PC 하드 고갈(C: 여유 19.2GB/476GB). wt/ 워크트리 82개가 각각 node_modules 1.3GB 를 들고 있는 게 범인. 정리 + **재발 방지**까지.
- 한 것: **1단계** 삭제대상 58/58 회수(보존목록 16개 무사, 표본 bbe251-sheets-gate vitest·tsc 정상) → **여유 19.2GB → 72.9GB**. **2단계** 머지 확인된 워크트리 34개 제거(등록 58→24), 미커밋 변경 있는 4개는 의도적 보존(force 안 씀). **3단계** .next 105M 삭제 · .git 42M→15M. **4단계** BBE-37 판단보류·BBE-48 유지+범위축소(근거는 각 카드). **5단계** 재발방지 하네스 패치 PR #839 머지 `2e8f8a2` · 배포 run 32389226062 success · health 200.
- 결정: ① `check.sh` §8 은 cwd 가 아니라 `git --git-common-dir` 로 메인 루트를 되짚는다 — 원안(cwd 기준 `[ -d wt ]`)은 wt/<슬러그>/ 안에서 돌리면 "wt/ 없음"으로 통과해 **정작 워크트리 쓰는 사람에게 절대 안 뜬다**(반증으로 확인 후 수정). ② 워크트리 상한 12, 초과 시 경고만(차단 아님 — 용량은 코드 품질이 아니다). ③ 문서전용 작업은 `npm ci` 금지.
- 함정 3건(다음 세션용): ① `xargs` 는 셸 없이 `cmd` 를 띄워 `//c` 가 미변환된다 → 첫 58건 삭제가 전부 무효였다. `MSYS2_ARG_CONV_EXCL='*' cmd /c` 를 써라. ② `@excalidraw→@radix-ui` 중첩이 **MAX_PATH 260자**를 넘겨 rd·robocopy 가 exit 16 로 죽는다 → `subst` 로 드라이브 매핑해 경로를 줄여라. ③ 이 레포는 **squash merge** 라 `git merge-base --is-ancestor` 로는 머지 판정이 안 된다(그 기준이면 5건만 머지). GitHub PR 상태로 판정해야 38건이 나온다.
- 다음: 워크트리가 아직 51개(등록 25) — §6.9 상한 12 까지는 각 세션이 자기 것부터 정리. 고아 디렉토리 26개(git 미등록)는 별도 정리 대상. 근본해결 후보 = pnpm 전역 스토어 전환(별도 ADR·카드).
- SoR: BBE-254 · PR #839 · CLAUDE.md §6.9 · scripts/check.sh §8

### 2026-08-20 · A(260820) · BBE-258 완주 — 비파일럿 sales 불일치는 측정기 버그였다(BBE-252 정정)
- 의도: belie 직접 지시(P1, BBE-252 후속) — 비파일럿 4개 기수(4·6·7·10) sales 4/4 불일치가 측정기 차이인지 실데이터 드리프트인지 규명.
- 한 것: 신규 스크립트(`scripts/ops/bbe258-sales-drift.mjs`, PR **#835**·`0a217d4`)로 SSH 1회 실측(run `32385164507`, 8명 표본). 정본 비교기(bbe120-diag.mjs sales-crosscheck, E~H 중 하나라도 non-empty)와 내 구법(bbe252-cohort-readiness.mjs, E열만) 을 나란히 계산 — **8명 중 7명 완전 해소**(구법의 undercount 버그였음, DB 는 애초에 정확), **잔여 1명 20건도 드리프트 아님**: O1=2026-05-15 학생의 08-03/08-04 활동이 80일째=12주차로 계산 확인(`80//7+1=12`), CLAUDE.md §2.5 "11주+ 는 DB 전용" 설계 그대로. **실데이터 드리프트 표본 기준 0건.**
- 결정: BBE-252 의 "지금 전환 가능한 기수 없음"은 당시 근거(내 구식 카운트 버그)가 틀려서 나온 결론이었음을 BBE-252 코멘트에 정정 게시. sales 축은 더 이상 차단요소 아님(표본 확인, 전수는 아직).
- 다음: `dashboard-parity.mjs --cohort "4,6,7,10"` 전량 재실행으로 표본→전수 격상 확인 → BBE-252 판정 갱신(별도 카드 후보). `bbe252-cohort-readiness.mjs` 의 E열-only 카운트 버그 자체는 harness issue 로 별도 chore PR 수정 제안(이 카드는 read-only 라 미수정).
- SoR: BBE-258 Linear 코멘트(+BBE-252 정정 코멘트), PR #835, run 32385164507(진단)·32384760708(배포)

### 2026-08-20 · C(260820) · BBE-251 완주 — 시트 요청 경로 재유입 차단 게이트(시트독립 4단계)
- 의도: belie 디스패치(BBE-245 프로그램 4단계) — 요청 경로가 다시 시트를 부르면 CI가 깨지는
  게이트. 정적 가드+동적 실측+화이트리스트 정본+A의 BBE-245 설계 코멘트 대조. BBE-253(P0)
  인터럽트로 중간에 정지했다가 완주 후 복귀해 마무리.
- 한 것: **정적 가드**(`tests/structural/sheets-request-path-guard.test.ts`) — app/api·
  app/(app)에서 lib/repo까지 실제 import 그래프를 BFS로 따라가(layers.test.ts의 importsOf
  패턴 재사용) 도달 가능한 저수준 시트 호출(sheetsClient/readRange/appendRows/
  ensureGridColumns) 파일을 매 실행 재계산 — 화이트리스트 밖이면 실패. BBE-97
  (sheets-append-guard.test.ts) 패턴 그대로 채택(A의 설계 코멘트 그대로). 화이트리스트는
  discovery(빈 화이트리스트로 1회 실행) 결과를 파일별 doc comment 근거로 분류해 채움 —
  추측 등재 금지(§0.8). A의 3개 사유(R2-비파일럿-폴백/append-제외/union-백필-안전망)로
  부족해 2개 추가(비동기-수렴미러=BBE-246 fire-and-forget 큐 패턴, 레거시-미전환=daily-source
  게이트는 쓰지만 아직 DB-primary 미전환) + 2개 더(시트전용기능=설계상 영구시트, 백필-도구=
  admin 1회성 마이그레이션). **동적 검증**(`tests/repo/sheets-zero-calls-pilot.test.ts`) —
  api-timing.ts의 PostHog 축은 이 세션도 접근권한 없어(A와 동일 한계, ToolSearch 실측 확인)
  코드 레벨로 대체: sheets-client.ts 저수준 export를 모킹하고 BBE-246이 전환한 실제 함수
  (updateUserFields/clearRow/updatePurchase)를 syncDb=true로 직접 호출해 미호출 단언. ★부수
  발견(미수정): clearRow의 resolveLayout()이 콜드 캐시면 시트 1회를 여전히 읽는다("파일럿도
  0회"는 캐시 워밍 후에만 참) — 후속 카드 후보로만 등재. **자기검증**: 정적 가드는 실제
  화이트리스트 항목 1개를 임시 제거해 실패 확인 후 원복, 동적 검증은 실제 코드(updateUserFields
  syncDb 분기)에 시트 호출 1줄을 임시 주입해 실패("...재유입" 에러 그대로 출력) 확인 후 원복 —
  두 가드 모두 진짜로 위반을 잡는다는 것을 실제 리포로 증명(BBE-243/253 관례 재사용). 최초
  화이트리스트 초안에 lib/service 파일 4개를 lib/repo로 착각해 등재한 오기가 있었는데
  "죽은 등록 방지" 자기검증 테스트가 즉시 잡아냈다(도달성 0으로 뜸). check.sh 전체 green.
  PR **#833**(`da6ef5a`) 머지 → 배포 run `32372020765` **success** → health **200**.
- 결정: A의 설계 코멘트 대조 결과 어긋난 지점(추가 카테고리 2+2개, resolveLayout 콜드캐시
  발견)은 이 카드 안에서 근거와 함께 진행 — belie/반장 재확인은 Linear 코멘트로 별도 요청
  (blocking 안 함, §0.7).
- 다음: 신규 배정 대기.
- SoR: PR https://github.com/bbelieff/salespt-log/pull/833, 배포 run 32372020765,
  `docs/plans/completed/bbe251-sheets-request-path-gate.md`

### 2026-08-20 · A(260820) · BBE-252 완주 — 비파일럿 기수 전환준비 현황+샘플parity
- 의도: belie 직접 지시(P1) — "얼추 샘플링한 시트 몇 개로 대조해보고 맞으면 빨리 비파일럿 종료하면 좋을 것 같은데?" 읽기전용 조사(기수별 현황·샘플parity·전환차단요소·3분류판정).
- 한 것: 신규 진단스크립트(`scripts/ops/bbe252-cohort-readiness.mjs`, PR **#826**·`b0aca6a`)로 SSH 1회 실측(run `32367452147`). 레지스트리 등록 비파일럿 기수=4·6·7·10(1명/6명/8명/8명) 확정, **전부 DB 백필이 이미 상당량 존재**(sales 최대 625행)함을 실측 — "백필 0" 전제가 틀렸음을 확인. 사용자단위 샘플parity(기수당 최대 3명, sales/meetings/contracts): **미팅·계약은 표본상 대체로 일치**, **sales 는 4개 기수 전부에서 13~37행 불일치**(방향 혼재라 단순 백필부족 아님, 원인 미규명). 6기 표본 1명은 계약탭 range parse 실패(시트 구조 이질 의심). 레거시 미등록(1·2·3·5기)은 범위 밖 확인(5기는 BBE-67 이미 진행중).
- 결정: "지금 전환 가능"=없음(정직 보고, 억지 낙관 안 함) — sales 불일치 원인규명이 선행조건. 파일럿 게이트는 env 아니라 코드상수(`lib/service/daily-source.ts:12` DB_READ_COHORTS Set) — 읽기·쓰기 대칭 단일 게이트, revert 1건이 롤백.
- 다음: dashboard-parity.mjs --cohort "4,6,7,10" 전량 재실행으로 sales 불일치 field 단위 확정(별도 카드 후보) → 6기 시트구조 확인(census 유사) → 기수별 1개씩 순차 전환 권장. BBE-67·134(FOREMAN 큐) 무접촉 확인.
- SoR: BBE-252 Linear 코멘트, PR #826, run 32367452147(진단)·32367094469(배포)

### 2026-08-20 · C(260820) · BBE-253 완주 — 담당 트레이너 토글 연타 시 롤백·유실 수리
- 의도: belie 폰 실측(20:11 P0). MASTER 수강생 관리 「담당 트레이너」 토글을 빠르게 여러 개
  누르면 체크가 저절로 풀리거나(롤백) 로딩이 길어짐. BBE-243 계열 — 같은 패턴 재사용 지시.
  BBE-251(시트독립 4단계 CI 가드) 진행 중 우선순위 인터럽트로 착수.
- 한 것: 근인 2건 코드 실측 확정 — ①`TrainerAssignCard.toggle()`이 stale `t.assignedTrainer`
  prop 기준으로 next 계산(연타·교차 카드 토글 시 먼저 낸 변경을 나중 계산이 덮어씀) ②optimistic
  표시 클리어가 "아무 학생의" trainees prop 변화에 블랑켓 초기화(무관한 학생 저장완료가 아직
  안 끝난 학생의 체크 표시까지 지워 옛 서버값이 잠깐 다시 보임 — belie 가 본 "롤백" 의 실제
  기전, 서버실패 revert 아님). `app/api/admin/assign-trainee` 는 담당목록을 통째 교체(delta
  아님)·동시성 제어 없음 확인, 서버는 무수정(클라 직렬화만으로 out-of-order 근본 차단 판단).
  수정: `lib/util/save-coalesce.ts`에 `createKeyedSaveCoalescer`(학생 email 로 keying, BBE-243
  `createSaveCoalescer` 재사용) 신설. `TrainerMgmtPanel`에 클라이언트측 "최신 배정 의도" ref
  (`resolveAssigned`) 추가 — stale prop 대신 이 값을 next 계산 기준으로. `TrainerAssignCard`의
  optimistic-clear 를 surgical(서버값이 실제로 따라잡은 항목만 삭제)로 교체. 신규 테스트 6건
  (`createKeyedSaveCoalescer` 3건 + jsdom 컴포넌트 3건: ★7연타 좌표+마지막의도반영·★교차카드
  동시체크 유실0·★무관학생 refresh 가 내 체크 안 되돌림). **자기검증**: 두 수정 각각을 되돌려
  새 테스트가 실제로 실패하는지 확인(원인① `expected [t2] to include t1`, 원인② `expected
  false to be true`) 후 재적용 — 테스트가 진짜 그 버그를 잡는지 반증(BBE-243 관례 재사용).
  check.sh 전체 green. PR **#827**(`4369332`) 머지 → 배포 run `32367358693` **success** →
  health **200**.
- 결정: 일괄선택(전체/기수 선택)으로 여러 학생을 동시에 배정하면 registry 전체읽기가 학생
  수만큼 그대로 발생(좌표 큐는 "같은 학생 반복"만 줄인다) — 배치 쓰기 전환은 BBE-249/BBE-251
  경계와 겹칠 수 있어 후속 카드 후보로만 등재, 이번엔 손 안 댐. busy 표시(전역 단일 문자열)
  정확도도 사전존재 버그로 미수정 — 정합성은 좌표 큐가 보장하므로 스코프 밖 판단.
- 다음: BBE-251(시트독립 4단계 재유입 차단 게이트) 복귀.
- SoR: PR https://github.com/bbelieff/salespt-log/pull/827, 배포 run 32367358693,
  `docs/plans/completed/bbe253-trainer-toggle-coalesce.md`

### 2026-08-20 · A(260820) · BBE-242 완주 — 속도실측+시트탈피 검증, 병목 최종판정
- 의도: belie 직접 지시(P0) — "DB랑만 소통해서 속도 빨라지는 거 맞아? 다른 요인 없는지 확인해봐. R7이 엑셀에서 완전 벗어나지는 것이 맞는지도 체크." 3축(①시트의존 전수조사 ②속도실측 ③판정) 조사.
- 한 것: 코드감사(직접+Explore 서브에이전트)로 계약(02)·DB관리(03)가 파일럿 무관 시트왕복 상존함을 file:line 근거로 확정, registry 60초 캐시가 BBE-56 게이트ON 후 우회되는 부작용 발견(둘 다 미문서화 신규 발견). 조사 중 프로덕션 인시던트(BBE-244) 발생해 SSH 를 B(작업원B)에게 양보하고 코드경로 조사로 축소 — 이후 B(BBE-244, PR #814 pool 5→15)·E(BBE-247, PR #815 캐시복원)·D(BBE-246, PR #819 계약·DB관리 update/clear 시트동기 제거) 3건 완주분을 합산해 최종 판정. 자체 진단스크립트(`scripts/ops/perf-diag.mjs`, PR **#821**·`779cf9b`) 로 VPS 자원+EXPLAIN ANALYZE 실측(SSH 1회, run `32358414406`) — DB 쿼리 전부 <15ms(04미팅 5.055ms·01영업 11.141ms·registry 4.200ms), load average 0.76(정상) → B 의 "pool 고갈이 근본원인" 결론과 일치. GIN 인덱스 미사용 추정을 idx_scan=2(vs unique btree 55,106)로 정정 실측. `lib/analytics/api-timing.ts`(PostHog api_timing, 이미 구현된 요청당 시트콜 계측)를 뒤늦게 발견해 BBE-245 4단계 설계 제안을 정정.
- 결정: 인증화면 종단간 ms·시트API 자체 ms 는 PostHog 접근권한 없어 미조회 — "모른다"로 명시(D 의 PostHog 데이터와 동일 축, 접근권한 있는 세션이 이어받을 것).
- 다음: BBE-245(구글시트 완전독립 프로그램) 후속 카드들이 이 조사를 지도로 사용. 처방 제안 5건(계약/DB관리 목록조회 union생략·writeContractRow 큐잉편입·admin/users N+1 완화·GIN인덱스 제거검토·PostHog 정기확인)은 디스패치가 후속 카드 발행 여부 판단.
- SoR: BBE-242/BBE-245 Linear 코멘트, PR #821, run 32358414406(perf-diag)·32358129264(배포)

### 2026-08-20 · C(260820) · BBE-243 완주 — 연타·다건 저장 재클릭유실·순차지연 수리, PR #813 머지·배포·health 200
- 의도: belie 직배차 P0. "연타하거나 빠르게 뭐 많이 누르면 과부하로 튕기거나 입력이 무시된다" — 재현·계측→원인별 수정→완주(연타 20회·10칸 유실 0·튕김 0 + check.sh 초록 + §6.8 + 전/후 수치).
- 한 것: 재현 조사로 "키입력마다 API 호출" 가설을 반증(로컬 draft, 명시적 저장 버튼 1개뿐)하고 실제 원인 2건 확정 — ①`savingRef` 재진입 가드가 진행 중 재클릭을 조용히 버림(유실) ②`contact/page.tsx`의 다건 미팅 append 가 순차(for-await)라 기존 429 지수백오프(최대 4회, 슬롯당 최악 ~15초)가 누적. 조사 중 실제 라이브 429(`GaxiosError: Quota exceeded... 'Read requests' per user`)를 직접 트리거해 "앱 전체가 서비스어카운트 1개를 공유하는 단일 쿼터 버킷"임을 실증. 수정: `lib/util/save-coalesce.ts`(신규) — 동기 `saving` 플래그 + `pendingWaiters` 큐로 진행 중 재트리거를 유실 없이 좌표(coalesce, 마지막 입력만 이어서 실행)·`saveAllParallel`(Promise.allSettled 병렬+항목별 실패격리). `contact/page.tsx`(savingRef→coalescer, append 순차→병렬 keep 재구성)·`DirtyGuard.tsx`·`MeetingDirtyGuard.tsx`(sequential loop→saveAllParallel, 특히 ConfirmLeaveModal 인라인 중복구현에 실패격리 0이던 위험 제거) 반영. 자체 유닛테스트 작성 중 진짜 동시성 버그 2건 자체 발견·수정(①async IIFE 대입타이밍 때문에 `isSaving()`이 진행중에도 false 반환 ②첫 트리거 실패가 공유 Promise 리젝션으로 큐의 다음 트리거까지 막음) — 둘 다 수정 후 재검증 green. 신규 9테스트(★연타20회=run 2번뿐·20/20 resolve·유실0 포함) + 기존 1329 전부 green, check.sh 전체(typecheck·lint·structural 34·doc-drift) green. last-good `ec77325` → PR **#813**(`a7928c5`, squash) 머지 → 배포 run `32348207731` **success** → `https://salesptlog.online` **200**.
- 결정: 스코프 경계 준수 — Sheets API 총 호출수 감소(BBE-242 소관)는 시도 안 함, 재진입·동시성 안전만 개선. MoneyInput rAF 커서보정 이론적 리스크는 재현 증거 없어 후속 조사 후보로만 등재(고쳤다고 안 함).
- 다음: 후속 조사 후보 3건(§4 문서 참조) — belie 관찰로 재현되면 별도 카드. `MeetingDirtyGuard`/`DirtyGuard` 중복 구현 통합은 이번 스코프 밖.
- SoR: PR https://github.com/bbelieff/salespt-log/pull/813, 배포 run 32348207731, `docs/plans/completed/bbe243-rapid-input-fix.md`

### 2026-08-12 · A(260809) · BBE-143 완료 — PR #803 머지·배포·registry-parity 신규 run 0건 확인
- 의도: BBE-143 수리분(정규화 71건+중복행 대표선정 12건) 머지 후 §6.8 배포 관찰 완주 + 신규 registry-parity run 으로 71+12=83건 감소·진짜불일치 0건 예측 검증.
- 한 것: last-good SHA `d9bafae` 기록 → PR **#803** CI green(check 통과) → API 머지(`fd2a51f`, 워크트리 충돌로 `gh pr merge` 대신 `gh api .../merge` 사용) → 원격 브랜치 삭제 → 배포 run `31524256694` **success** · 공개 health `https://salesptlog.online` **200**. 신규 `db-audit.yml`(registry-parity) 디스패치 → run **31524615751 success** → **users 시트 144·DB 144(불일치 0), cohorts 시트 13·DB 13(불일치 0), 필드 불일치 0건, "✅ 불일치 0건"** — 83건이 정확히 71(①)+12(②)로 소진되어 0건 도달, 예측대로.
- 결정: 완료 기준(카드 수용기준) 충족 — 근인 1문장(①표현형 정규화 드리프트 ②중복 자연키 대표행 선정 규칙이 실제 DB 적재 규칙과 불일치) + 코드근거(registry-parity-lib.mjs·backfill-registry.mjs:170-204) + 신규 run id(31524615751) + 71건 정확히 감소(83→0, 12건도 함께 소진) 전부 충족.
- 다음: BBE-143 Linear 카드에 완료 보고 게시. REGISTRY_DB_READ flip(게이트 ON)은 스코프 밖 — BBE-56 소유 트랙이 이 run 결과를 입력으로 판단.
- SoR: PR https://github.com/bbelieff/salespt-log/pull/803, run 31524256694(배포)·31524615751(registry-parity)

### 2026-08-12 · A(260809) · BBE-143 registry-parity 83건 수리 — ①정규화 드리프트 71건 + ②중복행 대표선정 12건
- 의도: registry-parity 83건 불일치를 71(정규화 드리프트 의심)+12(자연키 오매칭 의심)로 갈라 각각 근인 확정·수리(BBE-143, belie 직배차). 판단기준 = "diff 가 줄었나"가 아니라 "앱이 그 값을 어떻게 읽나"(정본=parseRow).
- 한 것: **①** `diffByKey`(registry-parity-lib.mjs)에 `normalizers` 파라미터 추가 + `normalizeSortOrder`(`lib/repo/users.ts` parseRow M열 규칙 사본)·`normalizeCohortType`(`lib/repo/cohorts.ts:106` 규칙 사본) SSOT-COPY 신설·`registry-parity.mjs`에 배선. 표현형 차이(sort_order "05"vs"5", cohort.type 공백vs"cohort")를 진짜불일치에서 제외. **②** `diffByKey`의 중복 자연키 대표행 선정을 "첫 행"→**"마지막 행"**으로 교정 — 근거: `backfill-registry.mjs:170`(reportDuplicates) "마지막 값으로 수렴" 주석 + 실제 upsert 루프(196-204행, 시트 행순 on-conflict-do-update)가 DB를 실제로 마지막 행 값에 수렴시킴을 코드로 확인. 실측(Drive 레지스트리 시트 직접 열람): A1-1김덕호·A1-4박준용 각 2행 존재 — 구 prep행(cohort_label="8"·assigned_trainer 공백·drive_link_status 공백)과 완료행(cohort_label="A1-1/A1-4"·assigned_trainer=beliefkimkim@gmail.com·drive_link_status="ok"), **두 행의 spreadsheetId 완전 동일** → 동일인 확정(자연키 충돌 아님, BBE-91 run 31329451352 "중복 2쌍 동일인" 기록과 일치). 차이 필드 6개(assigned_trainer·cohort_label·name_label·drive_parent_path·drive_link_status·memo)×2명 = 정확히 12건. 회귀테스트 24건(신규 8건: normalizers 동작 3·parseRow 교차검증 it.each 7케이스·cohorts.ts:106 미러 it.each 4케이스·마지막행 대표선정 1건) 전부 green. check.sh 전체 통과(structural·unit·typecheck·lint·doc-drift). `registry-parity-lib.d.mts`(테스트용 타입 선언, allowJs:false 관례)도 시그니처 동기화.
- 결정: ②는 "DB가 정본" 선언이 아니라 **비교기 코드 버그**(대표행 선정 규칙이 실제 DB 적재 규칙과 불일치)로 결론 — 라이브 데이터 변경·시트 중복행 정리는 스코프 밖(별도 승인 필요), 코드만 수정.
- 다음: PR 오픈·머지·배포 관찰(§6.8) → 신규 registry-parity run 으로 71+12=83건 감소·진짜불일치 0건 확인 → BBE-143 완료 보고. REGISTRY_DB_READ flip 은 스코프 밖(BBE-56 소유).
- SoR: `scripts/ops/registry-parity-lib.mjs`·`registry-parity.mjs`·`registry-parity.d.mts`, `tests/ops/registry-parity-lib.test.ts`, 근거=`scripts/ops/backfill-registry.mjs:161-219`

---

## 활성 트랙 보드 (자기 줄만 갱신 — 라이브 현황판)

**보드 갱신 규칙 (2026-07-12)**: 프롬프트(디스패치) 수령 즉시 자기 줄 상태를 "착수: <작업명>"으로
갱신하고, 이후 **단계 통과마다** 갱신한다. 단계 어휘(정본, %는 선택 병기):
`착수 → 진단/설계 → 구현 → 테스트 초록 → PR 오픈 → 머지 → 배포 확인(완료)` + `⛔블로킹: <사유>`.
로그 항목은 착수 선언·완료·사고·중요 결정에만 추가(진행률로 로그 도배 금지) —
**보드 = 지금 뭐 하는지(덮어쓰기), 로그 = 무슨 일이 있었는지(추가만).**

| 트랙 | 역할·구역 | 현재 몸(버전) | 상태 |
|---|---|---|---|
| FM | **작업반장** — 계약 생산·레인 충돌 판정·직렬 머지 통제·장부(worklog/plans) 관리 + **거짓 완료 적발**(신규) | 경영일지 데탑 C작업반장(260809) | **R7 머지열 집행 완료 + BBE-95 완주(2026-08-09 22:45 KST)** — ※ 이 몸은 2026-08-10 01:53 표기 정정: 구 `데탑 G작업원F(260809)` → 정본 `데탑 C작업반장(260809)`(공급자 글자 클로드=C 로 뒤집힘 + 작업원A~F 는 타 세션 점유). **과거 도장·로그 항목은 이력 보존을 위해 미수정**(belie 지시) — 아래 로그의 구 표기는 같은 몸이다. — belie 직접 지시. 머지 4건 전부 §6.8 완주: #736(BBE-58 `66b4046`·run 31314439842)·#734(BBE-65 `74016be`·run 31314861494)·#743(BBE-56 `469ed87`·**게이트 OFF 유지**, Done 아님 — 게이트 ON 은 작업원A)·#761(BBE-95 `a493b85`·run 31316419865). #749(BBE-91)는 타 세션 선머지분이라 배포 관찰만 대행. **마이그레이션 0002 프로덕션 적용**(DB Migrate execute run 31314830243). ⛔**#737(BBE-62) 만 보류 — 카나리아 왕복(사람 필수) 대기**, 해제 조건·집행 순서는 BBE-62 코멘트에 명시(머지→즉시 0003 적용→2~5단계). 근거: `setGcalEventId`(gcal-event-ids.ts:289-291) DB upsert 에 try/catch 없음 + `ensureSchema` 가 `gcal_event_ids` 를 안 만듦 ⇒ 0003 없이 머지하면 캘린더 쓰기가 조용히 멈춘다. 신규 발행 = **BBE-99**(배포 Public health check 러너 IP 오탐 — 정상 배포가 failure 로 떠 §6.8 무력화). 이하 이전(노트북 C작업반장(260806)): **BBE-83 완주(2026-08-08)** — 03 DB관리 비용 개강일 기준 이월 분할, PR #733 머지·배포 success·health 200·라이브 데이터 재확인 완료(상세는 위 로그 항목). 다음 배차 대기. 이하 이전(FM(260804)): **⛔A2 등록 사고 복구 중 — VPS SSH 완전장애로 정지(2026-08-06 19:10)**. 근인(belie 콘솔 확인, 목적지 폴더 소유권) 해소 후 55/55 시트 복사 성공했으나, `appendA2Row` 의 registry 기록이 열 밀림 사고로 A~T 대신 S~AL 에 들어가는 2차 버그 발견·수정·배포 완료(원인·수정·복구도구 = `scripts/ops/arena-season2-batch.mjs` PR #712). 복구 53건 중 **33건 완료**(row99~131), **잔여 20건**(row132~151 + junk 5건)은 `gh workflow run "Arena Season2 Batch" -f mode=repair-shifted-execute` 재실행만 하면 됨(멱등 — 이미 복구된 행은 자동 스킵). **VPS SSH 가 19:10 기준 연속 4회 7/7(rc=255) 완전실패** — 재시도 무의미한 수준, belie 인프라 확인 필요(BBE-75 에스컬레이션 완료). 이하 이전: **거짓완료 2건 조치 완료(2026-08-06)** — BBE-50 Done→Todo 원복(백필 미실행 확인), BBE-74 는 산출물 실재 확인 + 완주도장 재요구(작업원C 응답 대기). 이하 이전: **⛔A2 D-1 — 진단 종료, belie 콘솔 확인 대기(2026-08-06)**. scope 반증(전체 확인) → 근인 = GCP OAuth 게시상태 후보로 확정. 코드 쪽 자동진단 한계 도달, 5분 무응답 시 차선책(개강일만 공지) 권고. 신규 배차 대기: 결정함 12번(퍼널 해지 제외) 실행계약 발급 예정. 이하 이전: **L4 완료(2026-08-05)** — 오염행 감사 실행·수정·재실행 완주(#683·#684, 배포 success). 파일럿 55시트 스캔 결과 **2건**(테스트계정 1 + 실수강생 해지반영 1). belie 2단계 재승인 대기(결정함 9번). 이하 이전: **라운드1 배차 실행(2026-08-05 · R1 belie 승인)** — 계약 3건 발급(L2 #596 · L3 날짜달력 · **L4 DB-DRIFT-AUDIT-01**=결정함 9번 1단계), N8·N9 폐기(R3-3 완주로 무효). 병렬 4레인 충돌 0 확인. **BBE-42 아레나 시즌2 = W0·W1 도구 완료(#669·#670 배포 success·health 200), ⛔운영 시트 쓰기 권한 대기(결정함 3-b·due 8/6)**. Cowork 워킹트리 전사 회수 완료(미커밋 델타 0). 이하 이전: **배포 확인(완료) — R3-3 잔여(BBE-39)**: PR **#666**(`9551c8b`) 머지 · 배포 run `30939294995` **success(1차 ssh 타임아웃 → rerun)** · health 200. 미팅 화면발 02 쓰기 6경로 dual-sync + 500줄 캡 split 2건, 전체 1019테스트 green. **02 구역 A 로 반환.** ⚠️ VPS ssh 22 타임아웃이 오늘만 3회(#660·#661 1차·#666 1차) — 인프라 점검 후보. 이하 이전: **배포 확인(완료)** — #660(`a253ba8`) 머지. 자기 배포 run `30934412080` 은 **VPS ssh 타임아웃**으로 실패(코드 무관·라이브 무변경) → 후속 #662 run `30935808481` success 로 동일 트리 배포·health 200 확인. 2호 = 디스패치 260805 전사 PR. **belie 승인 대기**(설계도 §6). 이하 취임 기록: 반장 취임(2026-08-05 belie 지시). 설계도 `docs/plans/active/foreman-linear-ops-r1.md` 작성 = Linear 구조(A안 권장)·신규 카드 11장·A~F 매핑·라운드1 배분안. **Linear 쓰기 0건(승인 대기)**. 실측 base `origin/master=e09ee33`·Open PR 0·health 200. 라운드1 레인: L1 장부/설계(FM·진행) · L2 #596(DevF) · L3 날짜달력 라이브 확인 |
| A | P0 대응 + 기수 개막 준비 → **R7 레지스트리 DB 전환(BBE-56)** | 데탑 C작업원A(260820, 260809 승계) | **BBE-258 완주(2026-08-20)**: BBE-252 sales 불일치 원인규명 — 8명 표본 정본법 재대조 결과 **7명 완전해소, 잔여 1명 20건도 R4 설계(11주+ DB전용) 확인, 실데이터 드리프트 0건**. BBE-252 의 구식 측정기(E열만 카운트) 버그로 확정, 정정 코멘트 게시. bbe258-sales-drift.mjs(PR #835) SSH 1회. 상세는 위 로그. 다음=신규 배정 대기. 이하 이전: **BBE-252 완주(2026-08-20)**: 비파일럿 기수 전환준비. 등록기수 4·6·7·10 전부 DB 백필 이미 존재(백필0 아님) 확인, 사용자단위 샘플parity — 미팅·계약은 일치, **sales 는 4개 기수 전부 13~37행 불일치(원인미규명)**. 6기 시트구조 이질 발견. 판정="지금 전환 가능 없음"(정직보고), 정밀조사 선행 권고. bbe252-cohort-readiness.mjs(PR #826) SSH 1회. 상세는 위 로그. 다음=신규 배정 대기. 이하 이전: **BBE-242 완주(2026-08-20)**: 속도실측+시트탈피 검증. 계약(02)·DB관리(03) 목록조회 상시 시트왕복 잔존(union 백필, 의도적) 확정, B/E/D(BBE-244·247·246) 완주분 합산해 최종판정 — pool고갈이 근본원인(해소)·registry캐시 우회(해소)·계약DB관리 목록조회 잔존(구조적, 처방카드 제안). perf-diag.mjs(PR #821) 로 VPS+DB 실측(DB쿼리 전부<15ms). 상세는 위 로그. 다음=신규 배정 대기. 이하 이전: **BBE-143 배포 확인(완료, 2026-08-12)**: PR #803(`fd2a51f`) 머지·배포 run 31524256694 success·health 200. 신규 registry-parity run 31524615751 = **users/cohorts 전부 불일치 0건**(83건 = 정규화 71 + 중복행대표선정 12 로 정확히 소진). 상세는 위 로그. 다음=신규 배정 대기(REGISTRY_DB_READ flip 은 BBE-56 소관, 스코프 밖). 이하 이전: **BBE-120 착수 — 갈래A 근인 확정+수정, B/C/B21 조사(2026-08-10)**: belie 직배차. FORMULA 렌더옵션으로 R1:U6 수식 원문 직접 확인해 갈래A(3명11건 sheet<db) 근인 확정 — `dashboard-aggregates.ts`가 `MAX_SHEET_WEEK`(10,쓰기상한)를 R1:U6 재계산 창으로 오용, 실제는 `STATS_WEEKS`(8). PR #796(`a5ccc04`) 수정·배포·health 200. B21 은 다른 원인(DB row 값 자체가 2배, 미확정). 갈래B(zzzddz01 등)=DB meetings 행수 0, 데이터 백필 결측(BBE-67 인계 후보). 갈래C=미확정. **BBE-66 소유 parity 도구가 같은 창 상수를 복제해갖고 있어 재실행해도 diff 23 그대로**(무접촉, 1줄 동기화 별도요청 필요) — 105/105 미충족, In Progress 유지. Linear 코멘트 전체 게시. 다음: 신규 배정 대기. 이하 이전: **BBE-66 parity 감사도구 3종 수리(2026-08-10)**: belie 직배차("G작업원A 가 원인 다 짚어놨다 — 고치기만 하면 된다"). 주차창 동치화·시차 방향분리·B21 지문차집합 3건, 허용파일(parity 감사 스크립트만) 준수·정본 TS 무수정. PR #788(`6b18c9c`) 머지·배포 success·health 200. 105명 재실행(run 31361493846, headSha 일치) = **diff0 74→96명·총diff 55→23**(0 은 아직 — In Progress 유지, Done 안 함). B21 550,000 은 지문차집합으로 "같은 날짜 시트=55만 vs DB=110만 계약 각 1건"까지 확정(DB 정본 선언 안 함). 잔여 22건 3패턴 그룹핑해 후속 카드 후보로 Linear 코멘트에 등재. 다음: 신규 배정 대기. 이하 이전: **BBE-56 게이트 ON 시도 → parity 83건 불일치 → 즉시 OFF(2026-08-10)**: belie 지시(게이트 ON 순서: 백필→행수 대조→ON→대조표, 다르면 즉시 OFF) 전 단계 실행. PR #779(`62cbec1`) 머지·배포 success·health 200 으로 **ON 라이브 확정** → `db-audit.yml`(registry-parity) run 31346841822 = users 144/144·cohorts 13/13(행수 일치)이나 **필드 불일치 83건**(sort_order 기본값차 다수 + email 공란 행 자연키 오매칭 의심 소수, 원인 미확정) → 스크립트 판정 "즉시 OFF" 그대로 이행: Variable `REGISTRY_DB_READ=0` → 재배포 run 31346888503 success·health 200. **게이트 현재 OFF, 시트 읽기 복귀.** Linear BBE-56 코멘트 게시, 카드 In Progress 유지. 원인분석은 별도 카드 여부 belie/반장 판단 대기(상세는 워크로그 위 항목). ⛔BBE-63(D트랙, 다른 파이프라인)과 같은 날 유사 패턴이나 diff 모양 달라 근인 동일 단정 안 함. 다음: 신규 배정 대기. 이하 이전: **BBE-77 배포 확인(완료) — Tailscale 경로 라이브 확정(2026-08-09)**: belie 직접 배차, PR #747 머지(`5a45762`)·배포 run 31311155632 success·health 200 + DB Audit run 31311350830 success로 확정(ssh 런타임 재시도 0회 = tailnet 1번 시도 성공). ‖ **BBE-56 = PR 오픈(#743) — 리베이스 완료·백필 신호 대기**. 트랙 A 승계(작업원A(260805) → 데탑 C작업원A(260809), 구 몸 종료). #743 을 `origin/master=b67de8a` 위로 리베이스(충돌 0) → `e0de6d1`, check.sh 초록(structural 25·unit 1104·doc-drift). **게이트 ON 은 아직 금지** — `users`/`cohorts` 백필 미확인이라 켜도 0행 폴백(무해하나 무의미). ⛔의존: BBE-91(레지스트리 백필 실행 수단) — `git grep backfill-registry origin/master -- .github/` **0건** 재실측(2026-08-09), `db-backfill.yml` 은 `backfill-sheet-rows.mjs` 전용이라 레지스트리와 무관. 머지는 반장 직렬 판정 대기. 이하 이전(DevA(260712)): **배포 확인(완료)** — ①**BBE-49(P0) #676(363ba94)**: 비파일럿(7기) 수료자 11주+ 컨택 저장 500 수리. Cowork 패치 적용 후 **적대리뷰 4렌즈 BLOCKER 2·HIGH 4·MED 3 반영해 수정 머지** (읽기 K캐시 vs 쓰기 O1 게이트 불일치·시트폴백 courseStart 교체로 인한 전지표 0→정본 덮어쓰기·비파일럿 백필부재 누적합 0·주간퍼널 0·dbEnabled 가드 누락·읽기측 테스트 0건). 판정 원천 = 시트 O1 단일. check.sh 초록(1002)·배포 success·health 200·**라이브 실측: POST /api/daily 200 + 새로고침 후 값·주차합계 유지**. 잔여=생산(E)·직접생산 M 동기화(별도 티켓), DB_READ_COHORTS 확대는 belie 결정. ②**10기 날짜 마감 #661(95bba0e)**: 시트 O1=2026-08-07·O2=2026-09-26·B3=10·C3=이름 + 레지스트리 I~L, 실측 6/6·6/6·6/6(cohorts 10=active). 동반 오염(B3=8 → 앱에서 '8기' 표시) 자율 확대 수리, 사전 기록 0건 확인 후 flip. ③앞서 **P0 전광판 500 #639(b981c5c)**: unstable_cache 에 Date 캐싱 → 히트 시 string 강등 → weekIndexOf TypeError. 캐시 경계 ISO 통일. 인시던트 2건 기록(scoreboard-cache-date, bbe49). ⚠️gh-runner-ssh-ban 누적 5회+ (rerun 으로 매번 회복, 제공사 확인 권고). **AR-2a 실행 준비 유지**(belie 명단 승인 대기). 다음: 신규 배정 대기 |
| B | **작업원 B** — BBE-249 완주(admin/users N+1 → SWR) → 신규 배정 대기 | 경영일지 데탑 C작업원B(260820) | **BBE-249 완주(2026-08-20)** — BBE-244 구조적 후속. 비파일럿 기수(6·7·10기) sheet_rows 에 sales/meetings 0건 실측 확인 → "파일럿처럼 DB배치" 대신 `readBundle` TTL→SWR 교체(신선 10분 즉시·낡음 30분 이내 즉시+비차단 백그라운드 갱신·완전콜드만 동기). N+1 실제 규모가 카드 추정(비파일럿 18명)보다 큼(enrichUsersWithDates 는 전원 125명 대상) 확인. 신규 테스트 7건+기존 18건 green. PR #825(`5b0646a`) 머지·배포·health 200. 라이브 before/after 실측은 2회 시도 모두 실제 Sheets 쿼터/가용성 한도에 부딪혀 미달로 정직하게 보고(단위테스트로 메커니즘만 확정). 후속 카드 제안 2건(쓰기게이트 편입+backfill, 라이브 계측) belie/반장 판단 대기. 상세는 아래 로그. 이하 이전: **BBE-244 P0 복구 완료(2026-08-20)** — 어드민/대시보드 조회 전반 장애. VPS 인프라 정상 확인 후 로컬 재현(dev-stub 인증, 운영 DB/Sheets 자격)으로 `profileStatsFromDb` DB pool(`max:5`, 6주째 불변) 고갈→timeout→시트 폴백 폭주→Sheets 쿼터 소진 캐스케이드 특정. PR #814(`max:5→15`) 자율 머지(P0 우선순위)·배포 `32348701694` success·health 200·재현으로 해소 재확인(타임아웃 0·폴백 0). 후속 카드 제안 2건(pool 모니터링·프로덕션 Sentry 미설정) belie/반장 판단 대기. 상세는 아래 로그. 이하 이전: **BBE-56 게이트 ON 완주(2026-08-12)** — registry-parity 0건 재확인 → `REGISTRY_DB_READ=1` → 재배포 success·health 200 → ON 후 재확인도 0건, 유지. 이하 이전: **BBE-69 S1 구현(2026-08-10)** — belie 지시로 계획 제한 해제. 관리자 전용 수식설치·진단 도구 폐기(setup-formulas·contract-formulas·sheet-diagnostics + API 7·UI 버튼 3). PR **#799** 오픈·CI green(check.sh: structural 28·unit 1257) — **머지는 보류**(PR 첫 줄에 명시, BBE-68 관찰창 종료 후 반장 머지). isSafeToOverwrite 는 course-dates.ts 로 이전(테스트 26건 green). 상세는 아래 로그. 다음: BBE-67(경영일지 데탑 C작업반장 lease) 어댑터 구현으로 복귀(우선순위 인터럽트로 미뤄뒀던 것). 이하 이전: **BBE-69 계획 등재(2026-08-10)** — 시트 미러·수식 인프라 폐기. 배차판 §6 계약(2차 발행) 수행. 기존 코멘트 2건(반장·G작업원) 조사를 정본 계획 문서로 승격, 핵심 사실 실측 재검증(BBE-68 여전히 Backlog·Export 여전히 개인전용 확인) — `docs/plans/active/sheet-retirement-bbe69.md`(신규). 이하 이전: **BBE-60 완주(부분, 2026-08-10)** — company_archive(06) 단독 진짜 flip. PR #786(`574af23`) 머지·배포 run `31355596268` success·health 200. rename·contracts(02)·03 은 스코프 제외(별도 재설계·UUID 재키잉 필요, 후속 카드 소관 — Linear BBE-60 코멘트에 근거 명시). 이하 이전: **BBE-59 완주(2026-08-10)** — PR #757(Phase 1)·#773(Phase 2) 둘 다 머지·배포 success·health 200. VPS 백필 실행: dry-run 1004건 확인 → `--execute` **1004/1004 갱신, 충돌 0**. `docs/plans/completed/db-append-rekey.md` 로 이관. 이하 이전: BBE-97(values.append 가드) PR #776 오픈 · BBE-61 PR #764(현재 다른 트랙이 머지 완주) · BBE-57 PR #740(FM 머지 확인) · BBE-45 배포 확인(완료). |
| C | **작업원 C** — belie 직배차 수행. BBE-251(시트독립 4단계 재유입 차단 게이트) **완주** + BBE-253(담당 트레이너 토글 롤백·유실) **완주** + BBE-243(연타·다중입력 튕김/유실) **완주** + BBE-67(5기 legacy census+어댑터) **머지 완료** + BBE-70(기수생성 DB화, ⛔머지보류-BBE-69후) + BBE-71(내 기록 xlsx 다운로드) 완주 + parity diff 자동분류(BBE-63 해소·BBE-66 부분) + BBE-61(생산개수 M) | 경영일지 데탑 C작업원C(260820) | **배포 확인(완료) — BBE-251(2026-08-20)**: 시트독립 4단계. `tests/structural/sheets-request-path-guard.test.ts`(정적, BFS 도달성+화이트리스트)·`tests/repo/sheets-zero-calls-pilot.test.ts`(동적, PostHog 미접근이라 코드레벨 대체) 신설. A 의 BBE-245 설계 코멘트 대조 후 카테고리 2개 추가(비동기-수렴미러·레거시-미전환) + 2개 더(시트전용기능·백필-도구). resolveLayout 콜드캐시 시트 1회 잔존 부수발견(미수정, 후속카드 후보). PR **#833**(`da6ef5a`) 머지 · 배포 run `32372020765` **success** · health **200**. 정적·동적 가드 둘 다 자기검증(실제 항목 제거/실제 코드에 호출 주입 → 실패 확인 후 원복) 완료. 상세는 아래 로그. 다음 배정 대기. 이하 이전: **배포 확인(완료) — BBE-253(2026-08-20)**: belie 폰 실측 P0. 담당 트레이너 토글 연타 시 롤백·유실 수리 — `createKeyedSaveCoalescer`(학생별 좌표) + 클라이언트측 최신배정의도 ref + optimistic surgical-clear. 신규 6테스트(자기검증: 수정 되돌려 실패 확인 후 재적용). PR **#827**(`4369332`) 머지 · 배포 run `32367358693` **success** · health **200**. BBE-251 로 복귀 중. 상세는 아래 로그. 이하 이전: **배포 확인(완료) — BBE-243(2026-08-20)**: belie 직배차 P0. `savingRef` 재진입 가드의 재클릭 유실 + 다건 미팅 append 순차저장 지연(429 백오프 누적) 수리. `lib/util/save-coalesce.ts`(신규, saving 좌표+병렬 저장) 적용. PR **#813**(`a7928c5`) 머지 · 배포 run `32348207731` **success** · health **200**. 연타20회 유실0·튕김0(단위테스트 고정), check.sh 전체 green. 상세는 아래 로그. 다음 배정 대기. 이하 이전: **배포 확인(완료) — BBE-67(2026-08-12)**: belie 직접 지시로 PR #804 머지까지 완주. 착수 전 "C작업원B 중복 확인" 지시대로 Linear 재조회 → **실제 중복 발견**: C작업원B 가 STOP 을 풀고 병행해서 같은 파일을 건드린 PR #807 을 내 PR 보다 23분 늦게 오픈(양쪽 다 belie/반장 사전 인지 없이 병행). #807 은 "sales 컬럼 세트가 소스마다 다르다"(19열/15열)는 기술 반론을 걸었는데, 이 지적을 가볍게 넘기지 않고 Sheets API grid-indexed 로 8개 소스 전부의 헤더 행을 재조회해 **8/8 완전 동일(18열)**임을 실측 반증 — #807 의 그 관측은 본인이 STOP 코멘트에서 직접 결함 지적했던 구식 Drive 선형화 도구로 재조사하며 나온 아티팩트로 판단. 이 근거를 Linear 에 게시(반증 코멘트 `afc55bf0`) → PR #804 머지(`a51be5f`) → 배포 run `31579016568` **success** · health **200**. #807 은 이미 머지된 워크로그와 충돌 중(`mergeStateStatus: DIRTY`) — 남의 세션 PR 이라 직접 닫지 않고 반장/C작업원B 처리 요청 남김. 다음 배정 대기. 이하 이전: **구현 완료·검수 대기 — BBE-67(2026-08-11)**: C작업원B STOP 인수. 5기 legacy census(Sheets API grid-indexed, PII 마스킹) → `backfill-sheet-rows.mjs` read-only 어댑터(현행 4·6·7·8·9·10기 경로 무변경) → dry-run(DB write 0, registry linkage 0/8 이라 CLI 우회해 `extractUserRows()` 직접 호출) = source 8/8·sales 195·contracts 37(G작업원D 예측과 완전 일치)·db 80. sales 채널 포지션 전수검증 1616/1616 무결. dry-run 도중 자체 버그(DB "합계" 행에서 스캔이 안 멈추는 forEach 결함) 발견·수정. PR **#804**(`a51be5f`) 오픈·CI green — **머지는 반장 검수 후**(lease §8). sales/db 실측치가 G작업원D 의 aggregate-only(grid 미검증) 예측과 크게 달라 belie/G작업원D 재확인 요청을 Linear·PR 양쪽에 남김. Linear BBE-67 에 직접 코멘트 게시(이번 세션 Linear 인증 보유). 다음 배정 대기. 이하 이전: **구현 완료·머지 보류 — BBE-70(2026-08-10)**: 기수 생성(Drive 복사·폴더생성·재시도큐) → DB insert 1건. PR **#798**(draft, `ac9313e`) — check.sh 초록(1314 tests)이지만 **머지 안 함**, BBE-69(시트 미러 폐기) 완료 후 리베이스+머지 예정(belie 지시). 상세는 아래 로그. 이하 이전: **배포 확인(완료) — BBE-71(2026-08-10)**: 내 기록 xlsx 다운로드(R7-#22 MVP). PR #784(`bad46e9`) 머지·배포 run `31354193131` success·health 200. 카드 relation 정정 도장 남김(BBE-71 blocked_by BBE-68 제거 요청, 근거=ADR-0030 §2·§3) — Linear 미인증이라 반장 relay 대기. 상세는 아래 로그. 이하 이전: **완주 — parity diff 원인 자동분류(2026-08-10)**: PR #782(`5b1e618`) 머지·배포 success·health 200. 실데이터 검증(VPS 재실행) 결과 **BBE-63 결정적 해소**(scoreboard-parity 72건 중 69건=96%가 "시차"로 확정, run `31348578291`) — 다음은 BBE-67 백필. **BBE-66 은 부분**(dashboard-parity 47건 중 46건 진짜불일치, 유력했던 "계약여부 드리프트" 가설 반증됨, run `31348401577`) — 근인 후속 조사 필요. 상세 = `docs/plans/completed/parity-diff-classifier.md` §7. 다음 배정 대기. 이하 이전: **배포 확인(완료) — BBE-61(2026-08-10)**: `writeProductionCountCell` non-throw 안전모드(R3-4b). PR #764 생사 확인(살아있음, base 가 stale — 이미 BBE-59로 흡수된 옛 브랜치를 가리키고 있었음) → 중복 커밋 버리고 본체 1개만 최신 master 위로 `rebase --onto`(충돌 0) + PR base 를 master 로 재지정 → check.sh 초록 → 머지(`e9c6028`) → 배포 run `31331957984` **success**(다음 커밋과 배치 배포, e9c6028 포함 확인) · health **200**(04:40 KST). 다음 배정 대기. 이하 이전: **🚨 BBE-68 착수 금지 유지(2026-08-10)** — belie 지시로 어제 NO-GO 사유("BBE-66/67 상태-증거 충돌") 재실측. **결론 = 미해소, 상태만 Done 으로 바뀜.** BBE-66 dashboard-parity 오늘 재실행(run `31328856551`) = 어제(`31267667665`)와 **완전 동일**(105명 중 diff0=74, 불일치 31, diff 사용자 29명 100% 일치) — 그 사이 원인가설(BBE-65 PR #734) 머지됐는데도 수치 무변화. BBE-67 도 8/9 당사자가 "완료 도장 보류"(cohort 1·2·3·5 매칭 0건)라 명시한 뒤 후속 기록 0건. 결정함 **19번**에 belie 결정 요청(Linear 상태 재조정, 반장 대행 필요). 유휴·다음 배정 대기. 이하 이전(2026-08-09): 완주 3건 BBE-53·BBE-64·BBE-71(설계). 상세는 아래 로그. **설계 완료 — BBE-71(2026-08-09)**: R7 로드맵 실측(`sheet-retirement-r7.md` Phase 4 #22, 선행=#19 파일럿 게이트 제거·아직 Phase 1 진행 중)으로 **오늘은 구현 착수 시점 아님을 확인** → `docs/plans/active/export-xlsx-csv.md`(신규) 작성 — 미결 3가지(형식·범위·주체) 권장안 + 레이어·라이브러리 설계. belie 질문 결정함 **18번** 등재(급하지 않음). 다음 = R7 Phase 1 진행 지켜보며 우선순위 당겨지면 승격. 이하 이전: **배포 확인(완료) — BBE-64(2026-08-09)**: `readProfileBundle.stats` DB 대체(BBE-48 admin/users 진입 지연 근본수리, admin·트레이너·회장 3화면 공유). belie 직접 배차 → PR #713 생사 판정(살아있음, belie "개막 후 재개" 보류였음) → 리베이스 인수(`b85c1f7`→`b67de8a`, 충돌 2건 해소) → **A2 백필 실측 검증**(DB Audit dashboard-parity, A2 전체 53명, run `31314769805`) — "전부 0" 최악 시나리오 반증, 실결측 2명뿐(부분·개별 주차) → draft 해제 → PR **#713**(`558e4f6`) 머지 · 배포 run `31315835765` **success** · health **200**(22:35 KST). check.sh 초록(structural 25·unit 1132). 후속 카드 권장 2건(§8 참조) = ①`weeklyContractsFromDb` 이월 미배제(R2-7a/BBE-66) ②A2 2명 부분 결측. 다음 = **BBE-71 착수**(belie 지시, R7 후반 임계경로·BBE-69 선행·신규 제작이라 오래 걸림 — 여유 되면 설계부터). 이하 이전: **배포 확인(완료) — BBE-53(2026-08-09)**: contracts append 자연키 upsert(매출 이중계상 차단). PR **#746**(`b67de8a`) 머지 · 배포 run `31287998919` **success** · health **200**(16:58 KST 재확인) · check.sh 초록(PR check `31287768440` pass). 파일럿 실데이터 before/after 대조 = 24샘플 전부 "구로직이면 새 행(중복), 신로직은 기존 행 정확"(감사 run `31287774124`, PR #746 코멘트). 구 몸(창 "경영일지 작업원C") 산출물 실측 인수 — **재작업 0**. 남긴 것 = 결정함 **16번**(기존 중복 1건·9기 실데이터) · **17번**(같은날·같은업체 두 계약이 한 행으로 합쳐지는 잔여 위험, 후속 카드 필요). 이하 이전(DevC(260712-2) 수납 트랙 종료 기록): **완료(종료)**: belie ①read-only close 확정(2026-07-12) → 마감 절차 실행(plan 2건 completed 이동·worklog 마감·보드 갱신). 스펙 #529~534 MERGED·배포 success·health 200·코드층 재검증 OK. 02 구역 소유권 A(R3-3)로 이관. 유보=퍼널 계약수 해지반영(belie 별도) |
| D | 게이트키퍼(R3·codex 판정) + R4 wave-0 선행(W0-C) — docs/coordination·worklog 장부 | DevD(260721) | **W0-C 완료(2026-07-24)**: ①R3 재판정=코드레벨 PASS(L4 append-silent → #598 union fallback 종결) ②codex-stability=**STABLE**(#612, 2 blocker 해소·§C.5 전면소진 relay 주체 명문화) ③F 실측=EOL #603·발굴피커 #591 완주·TRACK-F ready → **R4 wave-1 선행 3건 초록**. residual(비차단)=#605 close(belie)·A full 인수왕복 1회 실연. 신규 작업 대기 |
| E | 검증·지원 축(R7) — 승계(구 DevE 배포설정 잔여 = ADMIN_DRIVE_REFRESH_TOKEN 미등록 belie 대기, 별건 보류) | 경영일지 데탑 C작업원E(260820) | **BBE-250 완주(2026-08-20)** — sheet_rows.payload GIN 인덱스 제거(미사용 확정, lib/+scripts/ops 전수 grep 컨테인먼트연산 0건, idx_scan 2 vs btree 55,106). 새 마이그레이션 0004 + client.ts doEnsureSchema() 지연생성 라인 동시 제거(안 그러면 다음 ensureSchema 호출이 재생성하는 함정 발견). PR #823(`efa7cce`) 머지·배포 run 32364697508 success·health 200. hosted 적용 = DB Migrate execute run 32365152632(✅ 적용 완료). 신규 테스트 6건, check.sh 초록. 이하 이전: **BBE-247 완주(2026-08-20)** — registry DB 읽기 경로(users-rows.ts·cohorts.ts) 무캐시 결함 수정, 시트 경로와 동일 60초 캐시 복원. PR #815(`68a8a54`) 머지·배포 run 32351283705 success·health 200. BBE-244(B) 겹침 확인 후 착수, B 의 PR #814(pool 5→15) 와 상호보완. 이하 이전: BBE-91 Done, BBE-42·BBE-77 완주 도장, BBE-67 부분, BBE-85 사후검증. 다음 배차 대기 |
| F | KPI-④ EOL renormalize (막차) — .gitattributes | DevF(260712) | **배포 확인(완료)** — #603(1aa3b9a) 머지·배포 success·health 200. §0.5 진단: 저장소 이미 LF(index i/crlf 0건), 720파일=autocrlf 작업트리 착시 → `.gitattributes`로 LF 정책 기계강제(내용 무변경 실측). 다음=#596 D 재검증 대응 대기 / 큐 신규. 🔔#596 D 재검증 요청 유효(연습용 3증상 라이브 해소 확인) |
| R | 릴리스 계열(C1~C3·PR643 복구 등, 노트북 Codex 세션 work-id) — 단발 릴리스 후보 | 세션 불명(노트북) | **배포 확인(완료)** — #647~#651 다섯 건 모두 "Deploy to VPS" **success** 실측(2026-08-03 A `gh` 조회): #647 `30737985008` · #648 `30734464895` · #649 `30734149383` · #650 `30739988555` · #651 `30739460991`. 계획서 4건 `completed/` 이관 완료. #647 R6 통합은 **[HOLD] 머지** → migration GO 전까지 plan active 유지. #643 arena 시즌 SSOT AR-2b는 **배포 확인(완료)** — PR #643(`844ce045`)·QA `30732987028`·Deploy `30732987033` success·health 200; BBE-36 종료. |
| Cowork | 오케스트레이터 — 프롬프트 생산·게이트 검증·워크로그 관리 | Cowork | 상시 |

> **보드 정합 실측 (2026-08-03 · A(260803))** — 이 보드는 260712 이후 갱신이 멈춰 있었고,
> 그 사이 노트북 세션들이 #643·#645~#651 을 머지했다. 위 A·B 줄과 신설 R 줄이 실측 반영분이다.
> 실측 근거: `origin/master=6380916`(2026-08-02 17:32 KST), 공개 health 200.
> ⚠️ 아래 디스패치 블록은 **260712 판**이라 여전히 stale — Cowork 만 수정 가능하므로 갱신 요청 상태.
> → ✅ **해소 (2026-08-05 · FM(260804))**: Cowork 의 260803 판 원고(로컬 미커밋)를 전사 + v3(반장 체제) 추가.
> ✅ **배포 run 실측 완료 (2026-08-03 · A(260803))** — `gh` 설치 확인 후 조회.
> #647~#651 다섯 건 전부 "Deploy to VPS" success, 보드 정합 PR #652(`80c94bb`)도 success + health 200.
> 이전 줄의 "배포 run 미확인" 경고는 해소됐다.

> 2026-07-12 표기 개편: 트랙 문자 = 세션 문자(DevA~F)로 통일. 구 표기 매핑 —
> M→A(구 Dev2), 수납A→C(구 Dev3-A), 리포트B→D(구 Dev3-B), 배포C→E(구 Dev3-C), G→F(구 45열).
> 이전 로그 항목의 [병렬트랙 A/B/C]는 구 표기다 — 혼동 시 이 매핑을 참조.

## 📮 오케스트레이터 디스패치 (각 트랙: 보드 갱신하러 올 때마다 자기 줄 확인 — Cowork만 수정)

- **공통(260805 Cowork 갱신 — 이 판이 정본)**: 260712판 stale 해소 — A(260803) 실측(#647~#652 배포
  success·health 200, master `80c94bb`) 정본 승인. 직렬 머지 + §6.8 엄수 유지. ⚠️ Cowork 워킹트리
  편집분이 리셋으로 유실됐던 것 재적재 — **각 트랙: 다음 PR 커밋에 worklog 현재본 포함 의무**.
- **공통·운영체계 v2 (2026-08-03 belie 확정)**:
  ① **설계도 모드** — 대형 건(PR 2개↑ 또는 병렬 2트랙↑)은 PM 이 `docs/plans/active/` 에
  설계도 1장 작성(꼬리표: 담당 반장·편성·병렬/직렬 매트릭스·머지 순서 명시). belie 의 킥오프
  복붙 = 승인 + 디스패치. 소형 건(PR 1·구역 1·belie 결정 0건) = **fast lane**, 킥오프 한 줄 직행.
  ② **반장 편성 기본값** = 반장 CC 1창 + 서브에이전트 작업자(병렬은 워크트리 격리). 다중 창은
  구역이 확실히 갈리는 대형 건만, 설계도 꼬리표에 명시된 경우에 한함.
  ③ **Linear = 관제탑(위성)** — 배차 현황·외부 사무소(노트북 코덱스 등) 일정 정렬 전용.
  **정본은 레포**(plans=설계도 · worklog=현장일지+디스패치). Linear 미연동 세션도 종전대로
  worklog 만으로 작동. ※ 2026-08-04 가동 개시: 팀 BBE · 프로젝트 「경영일지 · 세일즈PT 영업일지」 —
  활성 트랙 6건 등재(BBE-35 결정함 · 36 AR-2b · 37 R6 HOLD · 38 DevF · 39 R3-3 · 40 DevE).
  동기화 = 레포→Linear 단방향. 같은 팀에 MoaWork 프로젝트 공존(별개 사업장).
- **공통·도장(스탬프) 규정 v4.1 (2026-08-05 belie 지시 — 예외 없음, Linear BBE-73 정본·전사)**:
  worklog 가 다른 세션 git 리셋으로 오늘만 3회 유실돼 규정 정본을 Linear 에 둔다. **모든 세션 적용.**
  ① **대원칙**: 카드를 건드렸으면 자기 이름으로 도장(서명 코멘트)을 남긴다. 무기명 변경 금지 — 안 그러면
  같은 교착·중복요청이 반복된다(실측: 토큰 재발급 3회 중복 요청, BBE-50 교착).
  ② **소유 분리**: Cowork(관제탑)=카드 발급·우선순위·마일스톤·의존관계·중복통합·본문 정정(**상태 전환
  금지**) / 작업자 세션=자기 카드 상태 전환+접수·완료 도장(**남의 구역 진입 금지**, §3.5) / **반장(FM)=
  레인 충돌 판정·직렬 머지 통제·도장 없는 착수 적발**(신규 FM 임무).
  ③ **도장 양식**: 접수(`In Progress` 전환 시) = `접수 — <세션명(몸버전)> · <일시> / 브랜치·base SHA·lane
  / 착수 범위 1줄`. 완주(`Done` 전환 시) = `완주 — <세션명> · PR #n → 머지 sha / 배포 run id success·
  health 200 / 검증 수치`. Cowork 발급·변경 = `발급 — Cowork · 일시 · 지시출처 / 사유 / 동반조치 /
  되돌리기`.
  ④ **이름 문제**: Linear 사람 계정이 belie 1개뿐이라 담당자 칸으론 구분 불가 → **`사무소:*` 라벨 +
  코멘트 서명(세션명)이 도장의 정본**, 코멘트 타임스탬프 = 착수 시각.
  ⑤ **Linear 미연결 세션**: 같은 양식을 **worklog 에 그대로** 남기면 반장이 회수해 카드에 전사.
  ⑥ **FM 적발 기준**: 상태=`In Progress` 인데 접수 코멘트 없음 → 적발 / PR 있는데 카드 번호가 PR 본문에
  없음 → 적발 / 실측 근거 없이 belie 에게 같은 액션 재요청 → 반려.
  ⑦ **대시보드 연동**: 대시보드는 Linear 를 직접 읽는다 — **도장을 안 찍으면 그 일은 대시보드에 존재하지
  않는다.** 1시간 이상 걸리는 작업은 중간 코멘트 1줄("지금 어디까지·다음 무엇") 의무. 완주 도장에
  PR·배포run·health 숫자 필수(대시보드가 GitHub 을 직접 안 읽어 도장이 유일한 경로).
  (FM 첫 적용: BBE-42 코멘트로 중간보고 완주 — 2026-08-06 16:09Z)
- **공통·운영체계 v3 (2026-08-05 belie 지시 — 반장 체제)**: 경영일지에 **작업반장(FM) 창**을 세운다.
  반장이 계약(task_id·base SHA·브랜치·file lease·수용기준·NOT_RUN)을 생산하고, 디스패치가 워커
  창에 전달·회수한다. 병렬 구현·**직렬 머지**(§3.5)·§6.8 게이트는 그대로. 설계도 = `docs/plans/active/foreman-linear-ops-r1.md`
  (**belie 승인 대기** — Linear 구조 A안·신규 카드 11장·라운드1 배차 3건).
- **실행 큐 (2026-08-05 Cowork 갱신2 — 🔺10기 최우선)**: 체인 ①시크릿✅ → ④생성✅ → ⑤검증 부분✅
  (Cowork Drive 실측: 시트 6개·레지스트리 prep 6행·시트ID 일치·날짜 8/7→9/26 기록). **잔여 = belie 육안 2분**
  (대시보드 #VALUE!·영업관리 O1/O2 — 걸리면 [ID로 수식 설치] 재실행 #490) → ⑥8/7 클레임 안내(기수 "10"+이름).
  ②BBE-40 주입로그 실측 미확인 — DevE 완주 여부 확인 중. **신규 발견** = 10기 시트 6개에 SA(masterbot)
  명시 공유 누락(9기엔 있음) — 현재 anyone-writer 링크공유로 앱 작동하나 취약, SA 공유 추가 fast lane 후보 +
  cohort-create 코드 갭 점검. anyone-writer 관행 자체는 보안 정책 개선 후보(후속).
  ‖ 병렬 = BBE-38 DevF #596. R3-3 은 **완주됨**(#666·#667, FM 260804 — BBE-39 Done 미러 08-05 Cowork),
  구 "설계도 1호" 계획은 폐기·후속은 결정함 8·9번. 코덱스 2건(36·37) 큐 외.
- **🔺아레나 시즌2 (BBE-42·due 8/7 — 반장 착수 중)**: 설계도 2호 = `docs/plans/active/arena-season2-setup.md`
  (정본·워킹트리 미커밋 — FM 전사 레인 회수 요망). 참가 = A1 37 + 7·8기 전체, A2 = 기존 시트 복사,
  시즌 8/7~9/26(50일), 시즌매출 0·이월매출 누적. belie 승인 킥오프 전달됨(MWC 확인) → W0 진행 중.
  ⚠️ 시즌 SSOT = `lane:arena` 코덱스 점유 — 겹침 실측 필수(§3.5).
- **카페 세션 (BBE-43)**: **✅ 승인됨(belie 08-05)** — hw_config 10기 추가·8기 제외, 반영 = 8/7 개강
  동시. 킥오프 카드 발급됨 — 카페 세션 진행 가능. ※8기는 A2 아레나 참여 유지.
- **DevA**: **R3-3 완주 확인(#666·#667·#668 — FM 대행, 배포 success·health 200)**. 02 구역 후속
  (append flip·오염 행 리페어)은 결정함 8·9번 belie 결정 대기. 신규 지시 없음.
- **DevB**: #538 머지 실측 정정 완료. 잔여=gcal pm2 침묵 인프라(VPS 접근 필요) — 신규 작업 대기.
- **DevC**: 종료 상태 유지.
- **DevD**: W0-C 완료 확인. residual 2건(#605 close·A full 인수왕복 실연). 신규 작업 대기.
- **DevE**: **⛔해제 — 착수 지시(2026-08-05)**: 시크릿 등록 완료(belie 실측 — .env.local 노트북 회수
  후 신규 발급). **🔺10기 크리티컬 패스(BBE-40·due 8/6)** — fast lane: 배포 재실행 → 주입로그 OK →
  health 200 → admin 기수생성 경로 확인. 커밋에 worklog 현재본 포함.
- **DevF**: **착수 지시 — #596 D 재검증 대응(BBE-38 · fast lane · 병렬 슬롯)**. 계약 초안
  `F-596-REVERIFY-01` = `docs/plans/active/foreman-linear-ops-r1.md` §5-1. 수용 기준 = 연습용 3증상
  라이브 해소 확인 + #596 코멘트·worklog 기록.
- **FM(반장)**: 장부(worklog·plans) 구역 소유 + 계약 생산·레인 충돌 판정·직렬 머지 통제.
  Cowork 워킹트리 편집분 전사도 FM 레인이 회수한다(휘발 방지 §3.5 예외 운용).
  **✅ R1 승인됨(belie 08-05) → 라운드1 배차 실행.** 추가 배차 = 결정함 9번 1단계(오염 행 읽기전용
  점검, 데이터 변경 0건) 계약 발급. 8번 = 보류 확정. **전사 회수 대상**: worklog 현재본 +
  `docs/plans/active/arena-season2-setup.md`(미커밋 신규). ※index.lock 건은 해소됨(결정함 11번) —
  메인트리 git 정상.
- **R(노트북)**: #647 R6 통합 plan 은 migration GO 전까지 active 유지. AR-2b 진행 중 —
  `lane:arena`(course-dates·scripts/ops·create-arena-members) 점유로 간주, 타 레인 접근 금지.

### 📥 belie 결정함 (사장님 액션 대기 — 2026-08-05 순서)
1. [x] 🔺 ADMIN_DRIVE_REFRESH_TOKEN 시크릿 등록 — ✅ 2026-08-05 완료. 경위: 레포 이사로 .env.local
   유실 → 노트북 구 레포에서 회수·재설치 → 신규 토큰 발급·GitHub Secret 등록 → BBE-40 착수 가능
2. [x] **반장 설계도 R1 — ✅ belie 승인(2026-08-05)** (Linear 구조 A안 · 카드 11장 · 라운드1 배차).
   Cowork 정합 검토 통과(관제탑 규칙과 동일 원칙). → **FM: 라운드1 배차 실행 가능**
3. [ ] 10기 육안 2건 — 대시보드 `#VALUE!` · 영업관리 O1/O2 (걸리면 [ID로 수식 설치] 재실행 #490)
3-b. [ ] 🔺**A2 배치 — scope 아님 확정, 근인은 GCP OAuth 앱 게시상태로 이동** (FM · due 8/6, **D-1**).
   VPS 원격 실행(#679~682)까지는 뚫렸고 `--season-row`·`--plan` 은 정상 성공. 실제 시트 복사(`--canary`)는
   **서로 다른 사람 3명(손기학·김지훈×2) 전부** `PERMISSION_DENIED(forbidden)`.
   · ~~토큰 권한범위(scope) 문제~~ — **belie 재발급 후 tokeninfo 실측으로 반증됨**: scope=
     `https://www.googleapis.com/auth/drive`(전체) 확인. **재발급은 정답이 아니었다 — 재요청 금지.**
   · 원본 오류 전체(v2 details 포함) 추출: `{code:403, domain:global, reason:forbidden,
     status:PERMISSION_DENIED}` — 구글이 줄 수 있는 가장 일반적인 거부, 더 구조화된 필드 없음.
     코드 쪽 자동 진단은 여기가 한계.
   · **belie 액션(콘솔 확인 필요)**: GCP 콘솔 → API 및 서비스 → **OAuth 동의 화면 → 게시 상태** 확인
     (테스트/프로덕션). 미검증("테스트") 앱은 앱이 만들지 않은 기존 파일의 민감 동작(복사)이 설명 없는
     403 으로 막히는 사례가 있어 가장 유력한 후보. 테스트면 프로덕션 전환 시도 + 경고 문구 공유 요청.
   · **✅ 2026-08-05 ②③ 실측 완료(belie 지시) — 둘 다 원인 아님, ①만 유일 잔존 가설**: admin Drive
     저장용량 usage=67.9GB/limit=5.4TB(1.2%) — 여유 충분. 샘플 파일(김지훈 A1-1) `copyRequiresWriterPermission:
     false`·`canCopy:true`·`canDownload:true`·소유자=admin 계정 본인. 즉 메타데이터상 막힐 이유가 전혀
     없는데 실제 `files.copy` 만 403 — **① GCP 콘솔 게시상태가 유일하게 남은 설명**. 코드 쪽 진단은
     여기서 완전히 종료(더 팔 것이 없음). belie 콘솔 확인이 유일한 다음 스텝.
   · 되돌리기: 콘솔 확인은 위험 없음(설정 조회만).
   · 미루면: 8/7 개막까지 시트 55개 미생성 — **차선책**: 개강일 텍스트만 공지하고 시트 복사는 준비되는
     대로 별도 전환(전광판 개강일 칸만 나중에 채워도 안전 — §7-6② 로직). **D-1 이므로 5분 내 콘솔 확인
     안 되면 이 차선책으로 즉시 전환 권장.**
4. [x] R3-3 킥오프 승인 — ✅ 2026-08-05 belie 승인 → FM 완주(#666·#667, 배포 success·health 200).
   후속 결정 2건이 아래 8·9 로 분리 등재됨(퍼널 계약수 해지 반영은 여전히 미결·9번에 흡수)
5. [ ] #605 close (D 트랙 residual, GitHub 클릭 1회)
6. [ ] 육안 확인 2건 — #648 chip · #649 `/admin/cohorts` probe (인증 화면)
7. [x] Linear 커넥터 인증(08-04, 관제탑 가동) · 10기 시작일 2026-08-07(금) 확정+명단 6명 접수(08-05)
8. [x] **계약 "새로 추가" DB 전환 — ✅ belie 승인(08-05, 같은 날 보류 결정을 뒤집음).**
   → FM 계약 발급 완료: `docs/plans/active/contract-append-idempotent-flip.md`
   (`CONTRACT-APPEND-IDEMPOTENT-01` · 실행 = DevA 새 몸 · 레인 repo-db).
   · **중복 계약행 위험 해소 설계(belie 요구)** = 행 번호 대신 **자연키 upsert**: 미팅 계약은 AK(미팅 id),
     폴백은 계약일+업체명, 이전계약 등록은 AJ(`prior:<uuid>`)를 **요청 단위 id 로 승격**. 저장 전 그 키로
     기존 행을 먼저 찾아 있으면 update — 몇 번을 다시 눌러도 행은 1개. 그 뒤에야 DB 정본 전환.
   · 남는 위험 명시: 두 창 동시 저장은 완전 차단 불가(시트에 행 잠금이 없음) → 자연키로 수렴하되
     테스트로 고정하고 확률을 문서에 남긴다.
   · **머지 타이밍**: 매출 집계에 닿으므로 8/7(10기 개강·아레나 개막) 당일 머지 회피 — 8/6 초록이면 8/6,
     아니면 8/8 이후. belie 가 즉시 머지를 원하면 그 지시 우선.
   (이하 08-05 오전 보류 판단 근거는 기록 보존)
   · 지금: 새 계약 추가만 아직 시트가 먼저다(고치기·지우기는 08-05 부로 DB 정본).
   · 바꾸면: 저장이 더 빨라지고 기준이 하나로 통일. 대신 저장 실패 후 재시도 시 **계약이 두 줄로
     들어가 매출이 두 번 잡힐 위험**이 있어, 중복 방지 장치(행 번호를 시트가 아닌 앱이 매기는 방식)를
     먼저 만들어야 한다 → PR 2~3건 규모.
   · **FM 권장 = 지금은 보류**. 이유: 이번 수리로 유령 계약(체감 사고)은 이미 막혔고, 10기 개강
     (08-07)이 코앞이라 매출 집계 건드릴 시기가 아님. 개강 안정화 후 재상정 권장.
   · 미루면: 지금과 동일(안전). 새 계약 추가만 시트 왕복 속도 유지 — 사고 위험 없음.
9. [x] **과거 오염 행 리페어 — 1단계 완료(08-05): 읽기전용 점검 실행 완료.**
   · **📊 결과 — 파일럿 55시트 전수 스캔, 어긋난 건 단 2건**(0건 아니므로 자동종결은 아니지만 사실상
     경미):
     - **계약일/업체명 불일치 1건** — `연습` 기수 계정(`salespt.local` 테스트 계정) 1건. 실제 수강생 아님.
     - **해지 반영 불일치(퍼널 영향) 1건** — `A1-6` 기수 실제 수강생 1명. 시트엔 해지 표시가 있는데 DB엔
       없어서, 이 사람 화면의 퍼널 계약수가 **실제보다 1건 많게** 보일 수 있음.
     - 유령 계약 0건 · _cleared 불일치 0건 — 가장 걱정했던 유형(지운 계약이 되살아나는 것)은 **없었다**.
   · **1차 실행에서 "158건"이 나왔던 것은 실제 문제가 아니라 점검 스크립트 자체의 계산 버그**였다
     (시트 날짜 표시 방식 하나를 못 맞춰 생긴 착시) — 발견 즉시 고쳐 재검증(#684, 55시트 재스캔).
   · **FM 권장 = 2단계(실수정) 규모가 작아 belie 재승인 시 즉시 처리 가능** — 대상은 실제 수강생 딱
     1명, 해지일 필드 하나를 DB에 다시 반영하면 된다. 원하시면 결정함에 승인 한 줄만 추가해 주세요.
   (이하 08-05 오전 계획 근거는 기록 보존)
   · **FM 처리(08-05)**: 계약 `DB-DRIFT-AUDIT-01` **발급 완료**(foreman-linear-ops-r1.md §5-1).
     write API 호출 금지·email 마스킹·2단계 착수 금지를 NOT_RUN 에 명문화. 결과는 이 9번에 보고.
   · **📣 belie 질문 "오저장값이 뭐지?" 답(08-05·쉬운 말)**:
     ① 무엇 — 파일럿 기수는 계약 화면을 **DB(화면용 저장소)** 에서 읽는데, 8/5 수리 전에는 미팅에서
        계약을 지우거나 고칠 때 그 결과가 DB 에 안 들어가고 **시트에만** 반영될 수 있었다.
     ② 예시 — 미팅을 지워 계약카드가 사라져야 하는데 **화면엔 그 계약이 그대로 남는다**(매출에도 잡힘).
        업체명·계약일을 고쳤는데 화면엔 **옛 이름·옛 날짜**로 남는 경우도 같은 원인.
     ③ 몇 건 — **아직 모른다**. 그걸 세는 것이 1단계 점검(`DB-DRIFT-AUDIT-01`, 데이터 변경 0건)이다.
     ④ 고치면 — 그 수강생 화면의 **계약 목록·매출 숫자가 실제 값으로 바뀐다**(대개 줄어든다). 전광판·랭킹도 같이.
     ⑤ 안 고치면 — 어긋난 사람은 **틀린 숫자를 계속 본다**. 새로 생기지는 않는다(8/5 수리로 원인은 막힘).
     ※ 설명 회신 전까지 **수리 스크립트 실행 금지** 유지 — 현재 상태 그대로 준수 중(점검도 미실행).
   · 지금: 08-05 수리는 **앞으로 생길 문제**를 막는다. 그 전에 미러가 실패해 어긋난 과거 행이
     남아 있을 수 있다(개수 미확인).
   · 돌리면: 파일럿 수강생 화면의 계약 목록·매출 숫자가 **실제로 바뀐다**(= 수강생 실데이터 영향
     → §0.7 화이트리스트①이라 belie 승인 필수). 되돌리기는 실행 전 스냅샷 보관으로 가능.
   · **FM 권장 = ①먼저 "몇 건이나 어긋났는지" 세는 읽기 전용 점검부터**(데이터 변경 0건, 승인 불요
     범위) → 결과 보고 후 ②실제 수정 여부를 belie 가 결정. 0건이면 이 항목은 자동 종결.
   · 미루면: 어긋난 과거 행이 있다면 그 수강생 화면 숫자가 계속 틀린 채로 남는다.
10. [x] **카페 hw_config — ✅ belie 승인(08-05)**: 과제 대상 10기 추가·8기 제외(BBE-43). 카페 세션
    진행 — 반영 시점 = 8/7 개강 동시. ※8기는 아레나 시즌2 참여 유지.
11. [x] ~~`.git/index.lock` 잔류~~ — **✅ 해소(08-05)**: belie del 시도 시 Windows 실파일 없음 확인
    + 샌드박스 뷰에서도 소멸(지연 해제). 실제 차단 사고 아님. 교훈 유지: **Cowork git 는
    log·show·rev-parse·cat-file 만**(status·diff 는 index 를 건드려 lock 생성 위험 — §6.7 패치 후보).
12. [x] **퍼널 계약수에서 해지 계약 제외 — ✅ belie 승인(2026-08-05, A(260803) 창에서 직접 수령).**
    9번에 "여전히 미결"로 흡수돼 있던 항목의 **최종 결정**이다. 스펙 방향 전환(§0.7 화이트리스트③).
    · **결정 내용** = 계약을 해지하면 매출뿐 아니라 **계약 건수·전환율(퍼널)에서도 뺀다.**
      현행은 02 기반 표시(실무/수납 건수·매출)만 제외하고, 퍼널 계약수는 04 미팅 상태 기반이라 해지가
      반영되지 않는다(#529~534 당시 belie 유보분 — 근거는 2026-07-12 로그).
    · **공수·위험(승인 전 belie 에게 고지한 내용, 기록 보존)**: 퍼널 계약수는 **시트 수식**이 만든다 →
      전 수강생 시트로 수식 전파가 필요하고, 이는 "그림자 diff 0 유지" 조건과 부딪힌다. 되돌릴 수는
      있으나 수강생이 보는 숫자가 두 번 바뀐다. **A(260803) 권장은 "기수 사이 빈 기간"이었고,
      belie 는 근거를 듣고 진행을 재확인**했다(§0.5 — 결정 존중, 진행).
    · **머지 창구(권고·8번과 동일 원칙)**: 매출·퍼널 집계에 닿으므로 **8/7(10기 개강·아레나 개막)
      당일 머지 회피**. 실행은 FM 계약 발급 → 워커 PR, §2.5 가드 + 전파 dry-run 필수(2026-07-12 조건).
    · 되돌리기: 수식 전파 revert(전파 스크립트에 역방향 포함 필수 — 계약서에 수용 기준으로 명시할 것).
13. [ ] **오염행 2단계(실수정) 승인 — FM 보고 대기 중인 belie 결정.** 9번 1단계 결과 = 실제 수강생
    **1명**(A1-6 기수, 해지 반영 불일치 — 퍼널 계약수가 실제보다 1건 많게 보임). 나머지 1건은 테스트 계정.
    · 12번 결정과 **같은 증상**이다(해지가 퍼널에 안 잡힘) — 12번은 앞으로의 규칙, 13번은 이미 어긋난 1건.
    · 실행 = 해지일 필드 하나를 DB 에 다시 반영. 수강생 실데이터 변경(§0.7 화이트리스트①)이라 승인 필수.
      실행 전 스냅샷 보관으로 되돌리기 가능.
14. [ ] 🔺 **10기 시트 6개 SA 공유 — belie 조작 1건 (개막 D-1 · BBE-45)**
    · **지금**: 10기 6명 시트가 **링크공유("링크가 있는 사람 편집 가능")에만 매달려** 앱이 돈다.
      실측 확인 — 서비스계정 명시공유 X, 폴더 상속 X. 9기는 둘 다 O 라 안전하다.
    · **안 하면**: 지금 당장은 멀쩡하다. 다만 그 링크공유를 **끄는 순간 10기 6명의 앱이 통째로 끊긴다**
      (기록 조회·저장 전부). 보안상 링크공유는 언젠가 잠가야 하는데, 그때 사고가 난다.
    · **권장 = 폴더 공유(2분)**: Drive 에서 10기 수강생 시트들이 든 **폴더**를 열고, 공유 대상에
      **서비스계정 이메일**(`.env.local` 의 `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `…iam.gserviceaccount.com`)을
      **편집자**로 추가. 폴더에 넣으면 그 안 시트가 상속받고, **앞으로 들어올 시트까지 자동으로 덮인다.**
    · 차선 = VPS 에서 `node scripts/ops/verify-sa-sheet-access.mjs --cohort 10 --execute`
      (시트 6개 개별 공유). 단 **BBE-72(토큰 scope)와 같은 근인에 막힐 수 있어** 성공 보장 못 함.
    · 되돌리기: Drive 공유 대화상자에서 그 계정을 제거하면 끝. 시트 내용은 건드리지 않는다.
    · 앞으로 만들어질 시트는 코드로 막았다(BBE-45 PR) — 이 항목은 **이미 만들어진 6개 한정**.
15. [ ] 🚨 **DB생산 채널간 행번호 충돌 — 신규 버그(BBE-38 재검증 발굴), fix 배차 필요**
    · **무슨 일**: DB생산 탭의 매입DB/직접생산/현수막/콜지기소 4칸이 **같은 행 번호를 공유**하도록
      돼 있다(코드 확인 완료). 두 칸에 각각 항목을 하나씩만 넣어도(흔한 사용 패턴) 행 번호가
      우연히 같아지고, 그 상태에서 **탭을 바꾸면** 화면이 방금까지 보던 칸의 값을 잠깐 그대로
      들고 있는다 — 사용자가 아무것도 안 건드렸는데 "저장 안 한 내용이 있어요" 창이 뜨거나
      (또는 접었다 폈다 해도 계속 뜨거나), 여기서 무심코 "저장하고 이동"을 누르면 **엉뚱한 칸의
      값이 다른 칸에 잘못 저장**될 수 있다.
    · **왜 지금 아는가**: #596(7월에 있었던 DB생산 저장 유실 사고) 수리가 실제로 잘 됐는지
      점검하다가 발견했다 — 그때 사고와 증상이 똑같은데 원인은 다르다(그때 못 잡은 새 경로).
    · **지금 위험한가**: 8·9기 수강생이 **지금 실제로 쓰는 화면**이다. 이론이 아니라 두 칸에
      항목을 입력해본 사람이면 겪을 수 있는 흔한 조합이다. 다만 아직 실제 신고는 안 들어왔다.
    · **고치면**: 화면 코드 한 줄(목록에서 각 항목을 구분하는 "이름표"에 칸 이름을 붙임) —
      데이터 자체는 안 건드리고 화면이 항목을 헷갈리지 않게만 고치는 것이라 되돌리기 쉽다.
      다만 8/7 개강 코앞이라 "이 시기에 화면 코드를 건드릴지" 자체가 판단거리.
    · **안 고치면**: 여러 칸에 데이터를 입력하는 수강생이 계속 이 위험에 노출된다. 빈도는 낮아
      보이지만(정확한 조건이 맞아야 함) 걸리면 데이터가 섞이는 무거운 사고다.
    · **FM 권장 필요**: 담당 레인(`lane:repo-db`)이 아니라 제가 판단만 남기고 직접 고치지
      않았다. 최소 수정안(제안)은 #596 코멘트에 적어뒀다.
    · 근거: PR #596 코멘트(경영일지 작업원A, 2026-08-06) · Linear BBE-38 코멘트.
16. [ ] 💰 **이미 두 줄로 들어가 있는 계약 1건 — 실제 수강생(9기 `kussang9292@gmail.com`)**
    · **무슨 일**: 그 수강생의 02 계약수납 탭에 계약이 **3줄** 있는데, 그중 **같은 계약이 두 번 들어간
      것으로 보이는 게 1건**(연결 미팅이 같은 줄 1건 + 계약일·업체명이 같은 줄 1건)입니다. **BBE-53
      수리 이전에 이미 생겨 있던 것**이고, 이번 수리가 만든 게 아닙니다(8/9 수리는 앞으로 생길 중복만 막음).
    · **지금 무슨 영향**: 그 수강생 화면·전광판에서 **매출이 실제보다 많게** 잡힐 수 있습니다.
    · **고치면**: 잘못 들어간 줄 하나를 지웁니다 → 그 사람 매출·계약 건수가 실제 값으로 내려갑니다.
      수강생 실데이터 변경(§0.7 화이트리스트①)이라 **belie 승인 필요**. 시트가 3줄뿐이라 belie 가
      직접 열어 눈으로 대조하는 것도 2분이면 됩니다.
    · **되돌리기**: 지우기 전 그 3줄을 스냅샷으로 저장 후 실행 — 되돌릴 수 있습니다.
    · **안 고치면**: 그 한 사람의 숫자가 계속 실제보다 큽니다. 새로 생기지는 않습니다.
    · 근거: 감사 run `31287774124`(읽기 전용) · PR #746 코멘트(데탑 C작업원C(260809), 2026-08-09).
      13번(오염행 2단계)과 **다른 건**입니다 — 13번은 해지 반영 누락, 16번은 중복 행.
17. [ ] ⚠️ **후속 카드 필요 — "같은 날 · 같은 업체" 계약 두 건이 한 줄로 합쳐질 수 있음(BBE-53 잔여)**
    · **무슨 일**: 8/9 수리는 "같은 계약을 다시 저장해도 한 줄"이 되도록, **계약일 + 업체명**을 같은
      계약인지 판별하는 이름표로 씁니다. 그래서 **한 수강생이 같은 날 같은 업체와 계약을 두 건** 넣으면
      (미팅이 서로 달라도) 앱이 재저장으로 보고 **뒤엣것이 앞엣것을 덮어써** 한 줄만 남습니다.
      수리 전에는 두 줄이 되던 경우입니다 → 이 조합에서는 **매출이 실제보다 적게** 잡힙니다.
    · **얼마나 잦은가**: 흔하지 않습니다. 다만 16번 감사에서 **계약일·업체명이 겹치는 행이 실제 데이터에
      1건 발견**됐으므로 "이론상 없음"은 아닙니다.
    · **왜 지금 안 고쳤나**: BBE-53 계약서(설계문서 §1)가 이 이름표를 쓰라고 명시했고, 그 판별을 좁히면
      **AK(연결 미팅 id)가 없는 옛날 행**의 재시도 보호가 약해집니다 — 둘 중 무엇을 택할지는 계약 밖
      판단이라 임의로 바꾸지 않았습니다.
    · **권장(작업원C)**: 후속 카드로 **양자택일이 아닌 절충** — 미팅 id 가 있는데 그 id 로 못 찾은 경우엔
      계약일+업체명 폴백을 **쓰지 않게** 하고(정상 두 계약 보호), id 자체가 없을 때만 폴백 유지.
      옛 행 보호는 AK 백필로 따로 메꿉니다. 규모 = PR 1건.
    · **되돌리기**: 지금 상태로 두는 것도 안전 쪽 선택(중복 계상 차단 유지). 후속 수정도 revert 1건.
    · 근거: `lib/repo/contract-payment.ts:325-357`(findRowByLink — id 실패 시 계약일+업체명 폴백) +
      `lib/repo/contract-payment.ts:373-390`(appendFromContract 자연키 조회부) · `lib/service/contract-payment-add.ts:39-46`
      (addFromContract 가 항상 `dateCompanyFallback=true`) · 미커버 케이스 = `tests/repo/contract-append-idempotent.test.ts`
      "다른 meetingId 는 다른 행" 테스트가 계약일·업체명도 다르게 잡아 이 조합을 검사하지 않음.
18. [ ] 📤 **BBE-71 "내 기록 다운로드" 버튼 — 만들기 전에 정할 것 3가지**
    구글시트를 나중에 끄더라도(로드맵 마지막 단계) 지금 시트가 하는 일을 학생이 계속 누릴 수
    있게, "내 기록을 파일로 받는 버튼"을 새로 만드는 카드입니다(BBE-71). 아직 코드는 안 짰고,
    설계만 먼저 해뒀습니다(`docs/plans/active/export-xlsx-csv.md`). 시작하기 전에 3가지만
    확인해 주시면 됩니다 — **권장안대로면 "네" 한 마디로 충분**합니다.

    **① 파일 형식 — 엑셀(xlsx) 하나로 할까요, CSV 도 같이 만들까요?**
    ① 무엇 — 다운로드 버튼을 누르면 나오는 파일의 종류를 정하는 것입니다.
    ② 고르면 — 엑셀만 고르면, 지금 구글시트처럼 탭이 여러 개인 파일 1개가 나옵니다(엑셀
       프로그램으로 열면 시트 탭이 여러 개 보임). CSV 도 만들면 탭마다 파일이 따로 여러 개
       생깁니다(더 복잡해짐).
    ③ 되돌릴 수 있나 — 네. CSV 는 나중에 필요해지면 언제든 추가할 수 있습니다.
    **권장 = 엑셀만.** 이유: 지금 구글시트 경험과 가장 비슷하고, 쓸 일 없는 기능을 미리 안
    만드는 게 관리하기 편합니다. 미루면(=결정 안 하면): 권장안대로 엑셀만 만들고 진행합니다.

    **② 담는 내용 — 로그인한 사람 1명 기록 전체만 담을까요?**
    ① 무엇 — 버튼을 눌렀을 때 "내 기록만" 받을지, "다른 사람 것까지 한 번에" 받을 수 있게
       할지를 정하는 것입니다.
    ② 고르면 — "내 기록만"을 고르면, 학생이 로그인해서 누르면 자기 미팅·계약·생산기록이
       담긴 파일 1개를 받습니다. 관리자가 여러 학생 것을 한 번에 받는 기능은 **이번엔 안
       만들고** 필요하면 나중에 별도로 만듭니다.
    ③ 되돌릴 수 있나 — 네. 나중에 "여러 명 한 번에" 기능을 추가로 만들 수 있습니다(이번
       것을 없애지 않아도 됨).
    **권장 = 내 기록만(1인분).** 이유: 지금 급한 건 "시트가 없어져도 내 기록은 남는다"는
    학생 안심이고, 관리자용 일괄 다운로드는 성격이 달라(권한 검사·큰 용량) 따로 만드는 게
    깔끔합니다. 미루면: 권장안대로 1인분만 만들고 진행합니다.

    **③ 누가 쓸 수 있게 할까요 — 학생 먼저, 관리자는 나중에?**
    ① 무엇 — 이 버튼을 처음엔 누구 화면에 넣을지 정하는 것입니다.
    ② 고르면 — 학생 화면에 먼저 넣으면, 학생들이 바로 "내 기록 받기"를 쓸 수 있습니다.
       관리자·트레이너 화면에 넣는 건 나중 카드로 미룹니다.
    ③ 되돌릴 수 있나 — 네. 버튼을 넣고 빼는 건 화면 코드 수정 1건으로 되돌릴 수 있습니다.
    **권장 = 학생 화면 먼저.** 이유: 시트를 끄는 목적 자체가 "학생이 자기 기록을 잃지 않게"
    이므로 이게 먼저입니다. 미루면: 권장안대로 학생 화면부터 만들고 진행합니다.

    · **지금 착수 안 함** — R7 로드맵상 이 카드의 선행 작업(레지스트리 DB 전환 등)이 아직 진행
      중이라(§ 로드맵 표 참고), 오늘은 설계만 해뒀습니다. belie 답변은 착수 시점에 반영하면
      됩니다 — 급하지 않습니다.
    · 근거: `docs/plans/active/sheet-retirement-r7.md` §D·§G.1·Phase 4(#22) ·
      `docs/plans/active/export-xlsx-csv.md`(이번에 작성한 설계 초안).
19. [ ] 🚨 **BBE-68 착수 절대 금지 유지 — 어제 NO-GO 사유("BBE-66/67 상태-증거 충돌")가 오늘 재실측으로도 그대로**
    belie 지시로 "BBE-66·BBE-67 이 지금 Linear 에 Done 인데, 그게 진짜 해소된 건지 상태만 바뀐
    건지 확인해라"를 실행한 결과입니다. **결론 = 상태만 바뀌었고, 증거는 안 바뀌었습니다.**
    BBE-68(R7-#19, 파일럿 게이트 제거)은 **가장 위험한 단계**입니다 — 여기서 "그냥 스위치
    끄면 원복"이 불가능해지고 되돌리려면 무거운 PR revert + 재배포만 남습니다(ADR-0030).
    그래서 이 두 카드가 진짜 끝났는지가 착수 여부를 가릅니다.
    · **BBE-66(대시보드 숫자가 시트·DB 양쪽에서 똑같이 나오는지 대조)**: 오늘 직접 다시 대조표를
      돌렸습니다(읽기 전용, 아무것도 안 바꿈). **어제(8/8) 결과와 한 글자도 다르지 않습니다** —
      파일럿 105명 중 74명은 일치, **31명은 여전히 다릅니다**(run
      [31328856551](https://github.com/bbelieff/salespt-log/actions/runs/31328856551) vs 어제
      run `31267667665`). 심지어 **다른 사람이 아니라 정확히 같은 29명**입니다(이메일 목록을
      직접 대조). 어제 오후에 "이월 미팅 관련 버그"를 하나 고친 게 있었는데(#734 BBE-65), 그
      수리로도 이 숫자가 **전혀 안 움직였습니다** — 진짜 원인은 아직 못 잡았다는 뜻입니다.
    · **BBE-67(1~7기·10기 시트 기록을 DB 로 옮기는 백필)**: 어제(8/9) 실제로 백필을 돌린
      담당자가 직접 남긴 기록에 "1·2·3·5기는 DB 에 매칭이 0건이라 완료 도장을 보류한다"라고
      적혀 있고, 오늘 아침까지 이걸 풀었다는 기록이 없습니다. 즉 **그 카드를 만든 사람 본인도
      Done 이라고 안 했는데** 지금 Linear 는 Done 입니다.
    · **결론**: 둘 다 **작업 내용이 아니라 Linear 상의 표시(상태)만 바뀐 것**으로 보입니다.
      실제 데이터가 맞는지 보여주는 증거(대조표·백필 수치)는 어제와 똑같습니다. **BBE-68 은
      착수하면 안 됩니다** — 어제 내린 결정을 오늘도 그대로 유지해야 합니다.
    · **belie 결정 필요**: Linear 상태를 Done→Todo(또는 In Progress)로 되돌리고, 두 카드에
      "재실측 결과 원인 미해소" 코멘트를 남기는 게 맞다고 봅니다(이 세션은 Linear 미인증이라
      직접 못 고칩니다 — 반장 대행 필요). 미루면: BBE-68 착수를 막는 유일한 신호가 사라진
      채로 남아, 다른 세션이 "Linear 가 Done 이니 착수해도 되겠다"고 착각할 위험이 있습니다.
    · 되돌리기: 이 항목은 조사 결과 기록일 뿐 — 되돌릴 것 없음(쓰기 0건, 읽기 전용 감사만 수행).
    · 근거: run `31328856551`(오늘, 105명·diff0=74) vs run `31267667665`(어제, 동일 수치) ·
      diff 사용자 이메일 29명 완전 일치(직접 대조, `diff` 명령 출력 0줄) · PR #734 커밋 메시지
      "apostrophe 벗김 위치를 소스로 이동(FM 리뷰 반영)"(수리는 있었으나 diff-0 불변 확인) ·
      worklog "2026-08-09 · 데탑 C작업원E(260809) · BBE-91 완주 + BBE-85 사후검증 + BBE-67
      부분(cohort 1·2·3·5 매칭 0건 미해소)" 항목(완료 도장 명시적 보류) · `docs/decisions/
      0030-db-ssot-supersede-0002.md`(BBE-68 착수 조건).

## 로그

### 2026-08-20 · 경영일지 데탑 C작업원D(260820) · BBE-259 부분완주 — DB관리(03) 4섹션에 #824 패턴 이식
- 의도: belie 디스패치 — BBE-248 D 정직 이관분 (a)+(b) 승계. 계약(02)에 적용한 패턴(PR #824)을
  DB관리(03) 4섹션(매입DB·직접생산·현수막·콜지기소)에 이식. 완주 = 4섹션 각각 존재확인 설계
  명시 + payload 축소 수치 + check.sh + §6.8. 경계: 공용 mirror.ts 수정 금지(전용 함수로).
- **한 것**: ① append durable 성 — 4섹션 append(appendPurchase/Production/Banner/Lead)의 DB
  반영 재시도창을 mirror.ts 표준(3회/~1.8초)→8회/~25초로 확장(`db-tab-append-mirror.ts`, 전용
  경로 — 공용 mirror.ts 비수정). fire-and-forget 유지 근거는 BBE-248 과 동일(재시도 시
  findFirstEmptyRow 재호출로 매출 이중계상 위험, BBE-59 UUID row_key 로도 이 위험은 안
  사라짐 — 시트 쪽 물리 행 중복은 키 스킴과 무관). ② 목록조회 비용 절감 — `loadDBOverview`
  가 4섹션 각각 저비용 존재확인(`readXFilledRows`)을 DB read 와 병렬 발사, 전부 빈틈 없으면
  전체 시트 fetch 생략. 신규 테스트 18건 + 기존 회귀 갱신(mirrorSheetRow→mirrorDbTabRowDurable
  전환, append 경로만) 전부 green, check.sh 전체 green(BBE-251 요청경로 가드 포함 — 새 파일은
  DB write 경로라 화이트리스트 변경 불요). PR [#836](https://github.com/bbelieff/salespt-log/pull/836)
  머지(`503b94b`) → 배포 run [32384979525](https://github.com/bbelieff/salespt-log/actions/runs/32384979525)
  success → health 200 독립 재확인.
- **결정(정직 명기, §0.8)**: 섹션별 존재확인 절감폭이 비대칭 — 매입DB·직접생산·현수막은
  판정열이 섹션 시작열 1개뿐이라 7~8열→1열, 콜·지·기·소는 판정열(대표자명·업체명·연락처)이
  흩어져 있어 7열→6열(AD=조건 만 제외)에 그침. 빈틈 발견 시 4섹션 **전체** 일괄 재조회(섹션별
  아닌) — 단순성 우선, 드문 경로라 실익 작다고 판단해 자율결정.
- **미달성(BBE-248 과 동일 구조)**: "시트왕복 0" 문자 그대로 미달성(존재확인 read 는 남음) ·
  응답시간 전/후 실측(PostHog 접근권한 이 세션엔 없음).
- SoR: PR #836, Linear BBE-259(설계 근거·완주 코멘트), `db-tab-append-mirror.ts`

### 2026-08-20 · 경영일지 데탑 C작업원B(260820) · BBE-249 완주 — admin/users readBundle TTL→SWR 교체
- 의도: BBE-244(제가 복구한 P0)의 구조적 후속 디스패치. `me.ts:380-393` 비파일럿 학생별
  개별 시트 read(N+1)를 "배치 쿼리화(파일럿처럼) 또는 concurrency+캐시" 중 택1해 해소.
- 한 것: 실측으로 "배치 쿼리화" 선택지를 반증 — 비파일럿 기수(6·7·10기) 학생의
  `sheet_rows`에 sales/meetings 탭이 0건(db 탭만 존재, `daily-source.ts` 전역 쓰기
  게이트가 이 기수들을 시트 전용으로 두기 때문) — profileStatsFromDb 배치를 확장할
  데이터 자체가 없음을 확인, 게이트 편입+backfill 은 이 카드 lane 밖이라 분리 제안.
  대신 `readBundle`(TTL 600s 캐시)을 **SWR(stale-while-revalidate)**로 교체 —
  신선(10분) 즉시반환·낡음(30분 이내) 즉시반환+비차단 백그라운드 갱신·완전콜드만
  동기 fetch. `lib/service/profile-bundle-cache.ts` 신설(me.ts 500줄 cap 분리).
  부수 발견: N+1 의 실제 크기는 카드 추정(비파일럿 ~18명)보다 큼 —
  `enrichUsersWithDates`는 파일럿 여부 무관 활성 trainee 전원(125명)을 시트로
  읽음(BBE-64 DB배치는 stats만 대체) — SWR 이 이 상위 경로에도 적용돼 효과가 더 큼.
  pMapBundle concurrency 5→8.
- 검증: 신규 `tests/service/profile-bundle-cache.test.ts` 7케이스(FRESH/STALE/GRACE·
  in-flight dedup·백그라운드 실패 무전파, fake timers) + 기존 `me.test.ts` 18케이스
  회귀 0. check.sh green. **라이브 before/after 실측 2회 시도 모두 실제 프로덕션
  Sheets 쿼터/가용성 한도에 부딪혀 완료 못함** — 정직하게 미달로 남김(문제가 실재함의
  방증이기도 함), 결정론적 단위테스트로 메커니즘만 확인. PR **#825**(`5b0646a`) 머지·
  배포(run `32366865877`, GH 표시는 다른 세션 push 로 "cancelled"였으나 VPS HEAD 일치+
  health 200 으로 원격 완주 확인)·health 200.
- 다음(후속 카드 제안, belie/반장 판단 대기): ① 진짜 O(1) 원하면 비파일럿 기수 쓰기
  게이트 편입+backfill(더 큰 결정) ② 라이브 before/after 정식 계측(트래픽 낮은 시간대
  1회) — BBE-244 의 pool 모니터링·프로덕션 Sentry 미설정 제안과 함께 누적.
- SoR: PR #825 · Linear BBE-249/BBE-75 코멘트.

### 2026-08-20 · 경영일지 데탑 C작업원D(260820) · BBE-248 부분완주 — 계약(02) append 미러 재시도창 확장 + 목록조회 저비용 존재확인
- 의도: belie 디스패치 — "시트독립 3단계-a" P0(#819/BBE-246 레인 연장). 카드 원문: ①append
  미러 신뢰도 조사 ②목록조회 union 생략(시트 스킵) ③writeContractRow 큐잉편입(행번호 할당
  해법 설계 포함). 완주 = 계약·DB관리 목록조회 시트왕복 0 + append 유실 0 증명 + 응답시간 전/후.
- **① 조사 결과 — 카드의 전제 반증**: `appendFromContract`→`writeContractRow` 실측
  (`contract-payment.ts:195-260`) — 시트쓰기(`findFirstEmptyRow`)가 DB반영보다 **먼저** 끝나
  row 는 DB 쓰기 시점에 이미 확정돼 있다(행번호 할당 타이밍 문제는 실재하지 않음). 진짜 문제:
  DB반영을 update/clear 처럼 동기+throw 로 바꾸면 throw→사용자 재시도→findFirstEmptyRow
  재호출→**새 행에 중복 기재**(첫 시도의 시트쓰기는 이미 성공했으므로) = 매출 이중계상 —
  BBE-246 이 append 를 dual-sync 제외한 이유와 동일. 게다가 이 실패가 주로 터지는 상황
  (BBE-244 급 DB pool 고갈)은 DB 자체가 다운된 상태라 "실패 시 DB에 마킹"(mirror_pending)이
  구조적으로 불가능(마킹도 DB 쓰기이므로) — update/clear 의 mirror_pending 은 DB가 이미
  정본으로 성공한 뒤 시트미러만 실패하는 반대 방향이라 이 전제가 안 맞는다.
- **재설계(자율 진행, §0.5·§0.7 — Linear BBE-248 코멘트에 근거 전문)**:
  - ③ = "행번호 재설계" 대신 **DB반영 재시도창 확장**(fire-and-forget 유지, 무차단) — 신규
    `lib/repo/contract-append-mirror.ts`(contracts append 전용, mirror.ts 비공유·다른 탭
    무영향), 8회/700ms 배수(~25초, 표준 3회/~1.8초의 ~14배)로 BBE-244 급 순간 blip 커버리지
    확장.
  - ② = "union 전부 생략" 대신 **저비용 존재확인 후 조건부 폴백** — `readFilledRowNumbers`
    (C열 1개, 41열 대비)를 DB read 와 병렬 발사, 시트에 채워진 모든 row 가 DB 에도 있으면
    (빈틈 없음) 전체 A:AO fetch 생략, 빈틈 있으면 기존과 동일 전체 union 폴백. 정합성 100%
    유지(probabilistic 아님) — "시트왕복 0"은 문자 그대로 미달성(1열 read 는 남음, §0.8 정직 보고).
- **한 것**: 신규 테스트 11건(`contract-append-mirror.test.ts` 6·`contract-payment-list-presence
  -check.test.ts` 6) + 기존 회귀 전부 green, check.sh 전체 green. PR
  [#824](https://github.com/bbelieff/salespt-log/pull/824) 머지(`8bd940b`) → 배포 run
  [32366837689](https://github.com/bbelieff/salespt-log/actions/runs/32366837689) success →
  health 200 독립 재확인.
- **스코프 밖(후속 카드 이관, §0.8 완료의 정의 — 임의 완료처리 안 함)**: (a) DB관리(03) 4섹션
  목록조회 동일 최적화(섹션별 저비용 존재확인 설계 필요) (b) DB관리(03) 4섹션 append durable
  성 강화(카드 텍스트가 writeContractRow=02 만 명시) (c) 응답시간 전/후·시트콜 실측(PostHog
  api_timing 접근권한 이 세션엔 없음, BBE-246 과 동일 한계).
- SoR: PR #824, Linear BBE-248(재정의 근거·완주 코멘트), `contract-append-mirror.ts`

### 2026-08-20 · 경영일지 데탑 C작업원E(260820) · BBE-250 완주 — sheet_rows GIN 인덱스 제거(미사용 확정), client.ts 지연생성 함정 동시 처리
- 의도: 디스패치 — BBE-242 처방 d. `sheet_rows_payload` GIN 인덱스 idx_scan=2(unique btree
  55,106) 실측(A). ①사용처 최종 확정 ②미사용이면 제거 마이그레이션(새 파일·rollback
  동봉·번호 최신+1) ③hosted 적용은 db-migrate.yml run id 증거. «사용 중»이면 제거 없이
  근거만 남기고 닫아도 완주.
- **① Scope**: 판정 기준 = 코드에서 payload 대상 JSONB 컨테인먼트 연산(`@>`/`?`/`#>`) 사용
  여부. GIN 은 그 연산만 가속하므로, 0건이면 애초에 후보가 아니었다는 뜻.
- **② Gather**: `lib/` + `scripts/ops/*.mjs` **전수 grep** — 컨테인먼트 연산자 0건. 실측된
  모든 쿼리는 `payload->>'필드명'`(추출) 또는 `select payload`(전체 로드)뿐이고, 필터는
  전부 spreadsheet_id/tab/row_key/cohort — unique btree·`sheet_rows_cohort_tab`·부분인덱스
  `sheet_rows_pending` 이 이미 커버. idx_scan=2 의 정확한 출처(수동 psql 세션 추정)는
  로그가 안 남아 특정 못 함 — "몰라도 제거해도 안전"으로 판단(앱·ops 코드 경로 아닌 건
  grep 으로 확정).
  🔎 **추가 발견**: 이 인덱스는 마이그레이션 파일이 아니라 `lib/repo/db/client.ts:72`
  의 `doEnsureSchema()`(지연생성, `IF NOT EXISTS`)에 있었다 — 마이그레이션으로 DROP 만
  하면 다음 `ensureSchema()` 호출(모든 쓰기 경로가 호출)이 즉시 재생성해 무의미해지는
  함정.
- **③ Solve**: 새 마이그레이션 `0004_drop_sheet_rows_gin_index.sql`(rollback SQL 주석
  동봉, `drop index if exists` 멱등. 기존 파일 무수정. 번호는 열린 PR #798·#799 확인
  — 마이그레이션 파일 없음 → 0003 다음 0004) + `client.ts` 의 동일 `CREATE INDEX` 줄
  동시 제거(한 PR).
- **④ Verify**: `tests/repo/db-client-gin-index-removed.test.ts` 신규 6건 — `pg` 를
  직접 목킹해 `doEnsureSchema()` 가 실제 발행하는 SQL 을 캡처: GIN 문 미발행·나머지
  스키마(테이블·`sheet_rows_cohort_tab`·`mirror_pending`·`sheet_rows_pending`) 보존·
  정확히 4개 DDL(5→4)·멱등 캐시·대표 쓰기 경로(`upsertSheetRow`·`writeRowToDb`·
  `clearRowInDb`) 정상 동작. check.sh 전체 초록(typecheck·lint·structural 34·unit
  1361).
- **⑤ Report**: PR [#823](https://github.com/bbelieff/salespt-log/pull/823)
  (`efa7cce`) 머지 → 배포 run
  [32364697508](https://github.com/bbelieff/salespt-log/actions/runs/32364697508)
  success · health 200. hosted 적용: dry-run run
  [32365085378](https://github.com/bbelieff/salespt-log/actions/runs/32365085378)
  (`대기 중: 0004_...`) → execute run
  [32365152632](https://github.com/bbelieff/salespt-log/actions/runs/32365152632)
  (`✅ 적용 완료: 0004_...`).
- 한계: DROP 후 `pg_indexes`/`idx_scan` 재조회로 직접 재확인은 못 함(db-audit.yml 이
  화이트리스트 스크립트만 허용, 임의 SQL 조회 경로 없음) — 러너의 `✅ 적용 완료`(DDL
  에러 없이 커밋)를 근거로 삼음.
- 다음: 없음(완주). BBE-242 처방 나머지 4건(계약/DB관리 union생략·writeContractRow
  큐잉편입·admin/users N+1 완화·PostHog 정기확인)은 후속 카드 발행 여부가 디스패치
  판단.
- SoR: Linear BBE-250(Done), PR #823, run 32364697508(배포)·32365085378(dry-run)·
  32365152632(execute)

### 2026-08-20 · 경영일지 데탑 C작업원D(260820) · BBE-246 완주(구현·배포) — contracts·DB관리 요청 경로 시트 동기 호출 제거
- 의도: belie 디스패치 — "시트독립 2단계" P0. BBE-242(A) 실측(`contract-payment.ts:427,433,
  455,462` 등, 저장 시 시트 API 호출이 요청 경로에 남아있음)의 처방. 완주 = 저장 요청당 시트
  호출 0회 + 응답시간 전/후 + 데이터 정합 + check.sh + §6.8.
- **① Scope**: contracts(02)·DB관리(03)의 update/clear 경로에서 시트 동기 호출 제거, DB 를
  동기 정본으로. append(행 신규생성)는 카드 지시(BBE-39/03 탭 선례) 상 별도 취급 여지 있어
  실측 후 판단.
- **② Gather 결정적 발견**: sales-write.ts·meetings-write.ts·company-info-archive.ts(BBE-60,
  R7-#11)가 **이미** "DB 동기 정본 + `mirror_pending` 비동기 수렴미러 + self-heal drain"
  패턴으로 전환 완료돼 있었다 — contracts·03 탭만 반대 방향(시트 동기 우선, DB 는
  `ContractWriteOpts.syncDb`/`DbTabWriteOpts.syncDb` 로 조건부 동기)이었다. **카드가 예시로
  든 "worker(pg-boss)" 신규 인프라는 불필요** — 검증된 자체 패턴 재사용으로 완주 기준 충족
  판단(자율결정·§0.7, 되돌리기 = 게이트만 원복).
- **③ Solve — 스코프 확정**: `db/contracts-clear.ts`·`db/db-tab-sync.ts` 헤더가 이미 "append 는
  행번호=시트 할당이라 재시도 시 중복행(매출 이중계상) 위험, dual-sync 제외"를 명시해뒀다(03 탭,
  BBE-59 Phase 1 이후에도 유지된 결정). 02 에도 대칭 적용 — 코드 실측으로 append 경로(`appendFromContract`
  의 유일한 실사용 호출부 3곳)가 전부 `opts` 를 넘기지 않거나(addFromContract·addPriorContract)
  멱등키(AJ 원본키) 보유 시에만 예외적으로 넘기는(arena-carryover) 것을 확인 — 내 스코프 변경이
  이 경로들의 동작을 하나도 안 바꾼다는 것도 코드로 확정.
- **한 것**:
  - 신규 `lib/repo/contract-sheet-sync.ts`·`lib/repo/db-tab-sheet-sync.ts` — 큐/수렴/드레인,
    company-info-archive.ts 골격 이식(1행 수렴 = 실행 시점 최신 DB 상태 재반영, 스냅샷 재생 아님).
  - `updateUserFields`·`clearRow`·`updateLinkFields`·`syncFeeFromContract`·`writeTermination`
    (02) / `updatePurchase`·`updateProduction`·`updateBanner`·`updateLead`·`clear*`(03) 전부
    파일럿 분기를 "DB 동기(실패=throw) + 시트 큐잉"으로 전환, 비파일럿은 R2 완전 불변.
  - **부수 버그 수정**: `resolveSheetWithSyncDb`(`lib/service/contract-payment.ts`)가 읽기
    게이트(`chooseDailySource`)로 쓰기를 판정하던 것을 발견 — db.ts::resolveWriteCtx·
    sales-write.ts·meetings-write.ts 전부 쓰기 게이트(`chooseWriteSource`)를 쓰는데 이
    함수만 달랐다. 현재는 두 게이트가 byte-identical 이라 동작 차이 없으나 latent bug라 정정.
  - `lib/service/db.ts::oldDateOf`(patch/remove 전 옛 날짜 조회, E셀 재집계용)도 파일럿이면
    DB 우선 조회로 전환(`oldLeadIdOf` 와 동일 패턴) — 요청 경로 잔여 시트 read 제거.
  - 500줄 캡 분리(순수 이동, 값 무변경): `contract-payment.ts`→`contract-payment-row.ts`
    (행↔ContractPayment 변환), `db.ts`→`db-old-values.ts`(patch/remove 전 옛값 조회).
- **④ Verify**: check.sh 전체 초록(structural·unit 148파일·file-size-cap·doc-drift). 신규
  테스트 20건(성공/3회실패→markMirrorPending+Sentry/삭제·미기록→clear/self-heal 드레인 전
  경로 커버) + 기존 `contract-clear-by-link-sync.test.ts` 를 새 계약(DB-only+큐잉)에 맞게
  갱신. **기존 1358건은 무수정으로 전부 green** — 다른 테스트들의 모의 경계가 이미 repo/
  mirror-pending 레이어에 있어 회귀 없이 그대로 통과(우연 아님 — sales-write 등 기존 패턴을
  그대로 재사용했기 때문).
  - 잔여 미달 2건(의도적, 근거 명시): ①append 경로는 위 스코프 결정대로 미변경 ②직접생산
    기간중복 검증(`assertNoOverlapDirect`)은 correctness-critical(append/update 동시에 봐야
    함)이라 DB 완전성을 더 엄밀히 확인하기 전엔 안전 우선으로 시트 read 유지(자율결정) —
    `patchProduction`/`addProduction` 이 시트 read 1회를 남긴다, 후속 카드 후보.
  - "0회 계측"·"응답시간 전/후"는 `lib/analytics/api-timing.ts`(`withApiTiming`/
    `recordSheetsCall`)가 이미 대상 8개 라우트에 배선돼 있어 신규 계측 불요 — 단 PostHog
    대시보드 접근 권한이 이 세션엔 없어 배포 전/후 `api_timing.sheets_calls` 직접 대조는
    못 했다(§0.8, 검증 안 한 걸 검증한 것처럼 안 냄). belie/반장 확인 요청.
- **⑤ Report**: PR [#819](https://github.com/bbelieff/salespt-log/pull/819) 머지(`99c2513`)
  → 배포 run [32353587889](https://github.com/bbelieff/salespt-log/actions/runs/32353587889)
  전 스텝 success(Public health check 포함) → 독립 curl 로 `/api/health`(200)·메인페이지(200,
  0.46s) 재확인. §6.8 완주.
- ⚠️ **BBE-244(오늘 오전 DB pool 고갈 P0, `max:5→15`, PR #814) 와의 인접성**: 이 카드가
  `sheet_rows` 동기 쓰기(row-key 조회 쿼리 포함)를 늘린다. 방향은 반대(요청당 시트 왕복
  제거가 커넥션 점유 시간을 줄이는 쪽)라고 판단하나, 이 세션은 pm2 로그·pool 지표 접근
  권한(SSH)이 없어 health 200 이상의 직접 확인은 못 했다 — belie/반장이 pool 지표 짧게
  봐주길 요청.
- SoR: PR #819 · Linear BBE-246(완주 코멘트) · `docs/plans/completed/db-write-flip.md`(선행
  R3-3/R3-4 참고, 이 카드 전용 신규 계획서는 작성 안 함 — 기존 4파일의 이식이라 새 설계
  불필요 판단)

### 2026-08-20 · 경영일지 데탑 C작업원E(260820) · BBE-247 완주 — registry DB 읽기 60초 캐시 복원, BBE-244(B) 풀 확장과 상호보완
- 의도: belie 디스패치 — "시트독립 1단계(즉효 속도)" P0. BBE-56 게이트 ON(REGISTRY_DB_READ=1)
  이후 `users-rows.ts:36-40` 이 무캐시 DB 쿼리를 요청마다 쏘고 있다(BBE-242 A 실측). 완주 =
  연속 요청 시 DB 쿼리 1회 실측 + 전/후 응답시간 + check.sh + §6.8.
- **① Scope**: 카드 경계 = "registry 읽기 경로(users-rows 계열)만" + "착수 전 BBE-244(B) 겹침
  확인 필수".
- **② Gather**: BBE-244(크래시 인시던트, B 담당) 실측 — 접수(07:09Z, In Progress 코멘트)·belie
  범위격상(07:43Z, "조회 전반 흔들림" + "REGISTRY_DB_READ 게이트 OFF 검토" 조치안 포함, 같은
  게이트를 다룸) 확인. 단 **당시 open PR·최근 10개 커밋 어디에도 users-rows.ts 관련 변경 0건**
  — 파일 겹침 없음 확정, 착수. 코드 실측: `users-rows.ts:36-40`(`cachedRegistryRows`) 가
  `readUserRowsFromDb()` 를 캐시 없이 매 호출 실행 후 즉시 return, 시트 캐시 경로
  `cachedRegistrySheetRows()` 를 완전 우회 확인(카드 가설과 일치). **`cohorts.ts:63-65`
  (`cachedCohortsRows`) 도 동일한 구조적 결함**(readCohortRowsFromDb 무캐시) 추가 발견 —
  카드 경계는 "users-rows 계열만"이지만 다른 파일이라 B 와 안 겹치고 3줄 동형 수정이라 자율
  확장(§0.7, 안 고치면 바로 다음 재신고 예상).
- **③ Solve**: DB 경로도 시트 경로와 동일한 `unstable_cache`(60초, 같은 `REGISTRY_TAG`/
  `COHORTS_TAG`)로 감싼다. 같은 태그라 `invalidateRegistry()` 가 두 경로 모두 무효화.
  `fresh:true`(claim 직후 최신값 필요 경로)는 기존대로 캐시 우회 유지. null(게이트 OFF·오류·0행)도
  캐시돼 장애 시 60초는 시트 폴백으로 버틴다(재시도 폭주 방지, 의도된 트레이드오프).
- **④ Verify**: `tests/repo/registry-db-cache.test.ts` 신규 4건 — `unstable_cache` 를 실제
  메모이즈로 목킹(기존 `registry-read-fallback.test.ts` 는 pass-through 목이라 이 결함 자체를
  못 잡았음) → 연속 3회 호출 시 `readUserRowsFromDb` 1회(users)·1회(cohorts) 고정,
  `fresh:true` 우회 유지, `invalidateRegistry()` 동반 무효화 확인. check.sh 전체 초록
  (typecheck·lint·structural 34·unit 1333). **응답시간 전/후 라이브 수치는 미제시** — 이
  세션에 프로덕션 계측 수단 없음(BBE-242 A 소관 축), 코드 레벨 근거(요청당 DB 왕복 →
  60초당 최대 1회)로 대체.
- **⑤ Report**: PR [#815](https://github.com/bbelieff/salespt-log/pull/815) 오픈·CI green
  → 머지 도중 **B 의 PR #814(Postgres pool max 5→15, BBE-244 P0)가 먼저 머지**돼 base 가
  바뀌며 1차 머지 시도 실패(`mergeStateStatus: UNKNOWN`) → 재확인(자동 재계산, ~10초) 후
  `CLEAN` 확인·재시도 → 머지(`68a8a54`) → 배포 run
  [32351283705](https://github.com/bbelieff/salespt-log/actions/runs/32351283705) success
  · health 200. 결정: 착수 전 세운 가설(무캐시 폭주 → DB 커넥션 풀 고갈 → 500 → client
  crash)을 B 에게 코멘트로 전달 — B 의 독립 진단(pool 고갈)이 같은 방향으로 확정돼 **두
  수정이 상호보완**(B=풀 확장, 나=요청량 감소)임을 서로의 카드에 교차 기록.
- 다음: 없음(완주). BBE-244 자체는 아직 In Progress(에러 바운더리·재발방지 테스트·스크린샷
  잔여, B 소관) — 참고만 남기고 판정 관여 안 함.
- SoR: Linear BBE-247(Done)·BBE-244·BBE-75 코멘트, PR #815, run 32351283705


### 2026-08-20 · 경영일지 데탑 C작업원B(260820) · 🔴 BBE-244 P0 — DB pool 고갈→Sheets 쿼터 소진 캐스케이드 복구
- 의도: belie 직접 P0 발주 — 어드민 수강생관리 "Application error", 이어서 수강생 대시보드
  "데이터를 불러오지 못했어요"도 실측(범위 격상: 단일화면 버그 아닌 조회 전반 장애로 접근).
  지시 순서: ①외부 curl 실측 ②VPS 상태(SSH 1회 접속에 몰아 확인) ③REGISTRY_DB_READ 게이트
  대조 ④최근 배포 대조(fix-forward/revert 판단) ⑤복구 확인 후 근본원인.
- 한 것: VPS SSH 1회 접속으로 pm2·메모리·스왑·load·postgres 연결 전부 확인 — **인프라 정상**
  (load 0.00, 메모리 여유 2.1G, 커넥션 13/idle 5). 로컬 재현 환경 구축(운영과 동일 커밋
  `ec77325`, 운영 DB·Sheets SA 자격 그대로, `lib/auth/dev-stub.ts` STUB_USER_EMAIL 사용 —
  Google 로그인·비밀번호 무관, 앱 자체의 dev 우회 기능) → 실제 에러 재현: `profileStatsFromDb`
  배치(52명)가 `Connection terminated due to connection timeout` → 전원 개별 시트 read 로
  폴백 → `Quota exceeded ... sheets.googleapis.com` 대량 발생 → 캐스케이드.
  근본원인 특정: `lib/repo/db/client.ts:35` Postgres pool `max: 5`(2026-07-07 `8933f314`
  이후 6주째 불변 — 최근 배포 #811/#812 회귀 아님). BBE-64 프로필통계 배치 + BBE-56 registry
  읽기(8/12 ON)가 이 소용량 풀을 공유하며 동시요청 시 고갈.
- 결정: `max: 5→15` fix-forward(§0.7 자율 진행, 되돌릴 수 있는 코드 변경 + P0 우선순위 명시
  지시로 판단해 검수 통과 즉시 자율 머지). PR **#814**(`5595413`) 머지 · 배포 run
  `32348701694` **success** · health 200 · VPS 배포본 `HEAD=5595413`·`max:15` 확인.
  배포 직후 동일 재현 스크립트 재실행 — **타임아웃 0건·시트 폴백 0건·SUCCESS** 확인.
- 다음(후속 카드 제안, belie/반장 판단 대기): ① pool 사용률 모니터링 부재(조용히 소진되다
  캐스케이드 재발 가능) ② 프로덕션 `NEXT_PUBLIC_SENTRY_DSN` 미설정(deploy.yml INJECT_KEYS
  에 없음 — 이번에 서버 에러 로그가 비어있어 로컬 재현에 의존해야 했다).
- 부수: 진단 중 다른 세션(A/BBE-242 속도조사)의 dev 서버와 launch.json 이름 충돌을 겪어
  워크트리별 수동 포트 지정으로 우회(harness 이슈로 별도 인지, 이 카드에서 수정 안 함).
- SoR: Linear BBE-244 코멘트(원인 확정·복구 완료) · PR #814 · BBE-75 하트비트.

### 2026-08-12 · 경영일지 데탑 C작업원B(260809) · BBE-56 레지스트리 DB 읽기 게이트 ON 완주
- 목적: BBE-56 최종 운영 전환 증거만 현재 장부에 남긴다. 과거 보드 이력은 다시 쓰지 않는다.
- 증거: registry parity run `31579030015` **success**(불일치 0) → `REGISTRY_DB_READ=1`
  재배포 run `31579113930` **success** → ON 후 registry parity run `31579671729`
  **success**(불일치 0). 이상 징후가 없어 게이트를 ON으로 유지했다.
- health 분류: run `31579113930`의 GitHub Actions `Public health check` 단계가 **success**여서
  전환 당시 공개 health 통과를 확인했다. 이 문서 대체 작업에서는 독립적인 새 health 호출을
  실행하지 않았으며, 로그인 자격증명이 없어 인증된 admin 화면 육안 확인도 `NOT_RUN`이다.
- 복구: 이상 발생 시 `REGISTRY_DB_READ=0`으로 되돌린 뒤 `Deploy to VPS`를 재실행한다.
- SoR: GitHub Actions runs `31579030015` · `31579113930` · `31579671729`, Linear BBE-56.

### 2026-08-12 · 경영일지 데탑 C작업원C(260809) · BBE-67 머지 완료 — PR #804, 중복 PR #807 발견·기술쟁점 실측 반증 후 진행
- 의도: belie 직접 지시 — "카드: BBE-67 / PR #804. 목표: 5기 legacy census + 어댑터 PR 을
  CI 초록까지 끌고 가 머지. 범위: PR #804 현재 상태 실측 → 미완이면 완성 → 머지(§6.8).
  주의: C작업원B(260809)가 같은 범위 lease 를 들고 STOP 상태다. 중복 확인 먼저."
- 한 것: PR #804 상태 실측(OPEN·MERGEABLE·CLEAN·CI SUCCESS — 이미 완성돼 있었음) →
  지시대로 "중복 확인" → Linear BBE-67 재조회 → **C작업원B 가 STOP 을 풀고 병행 작업해
  같은 파일(`backfill-sheet-rows.mjs`)을 건드린 PR #807 을 내 PR 보다 23분 늦게(19:11)
  오픈**한 것을 발견(belie 의 "인수" 지시가 C작업원B 에게 전달 안 된 것으로 추정) →
  #807 의 기술 반론("sales 컬럼 세트가 소스마다 다르다 — 19열 vs 15열, 일부 소스에
  컨택성공건수 자체 없음")을 무시하지 않고 Sheets API grid-indexed 로 8개 소스 전부의
  `영업관리!A8:R9` 헤더를 재조회 → **8/8 완전 동일(18열, 컨택성공건수 전 소스 존재)**
  실측 확인 → #807 의 관측은 본인이 STOP 코멘트에서 직접 결함 지적했던 구식 Drive
  선형화 도구(천단위 콤마가 필드 구분자와 혼동되는 결함 명시)로 후속 census 를 다시
  수행하며 나온 아티팩트로 판단, Linear 에 근거와 함께 게시(`afc55bf0`) → PR #804
  머지(`a51be5f`) → 배포 run `31579016568` **success** · health **200**.
- 결정: 중복 발견 시 반사적으로 "먼저 게시한 쪽이 이긴다"로 넘어가지 않고, 상대측이
  제기한 구체적 기술 반론을 실측으로 검증한 뒤 머지했다 — 근거 없이 밀어붙이면 §4 가
  경고한 "행수는 맞는데 데이터가 틀리는" 사고를 내가 직접 만들 뻔했다. belie 의 직접
  지시(승인 권한 최상위)로 최종 머지 판단은 내렸으나, 남의 세션(C작업원B)의 PR #807 은
  직접 닫지 않고 반장/C작업원B 처리로 남겼다(Linear 코멘트에 명시).
- 재발방지 제안(Linear 에 게시): lease 인수(STOP→belie 인수 지시) 시 인수받는 세션이
  원 소유 세션에도 보이는 카드에 "인수함" 도장을 명시하면 이번 같은 병행 중복을
  막을 수 있다 — 이번엔 내가 그 도장을 안 남겨서 생긴 사고이기도 하다.
- 다음: 반장/C작업원B 가 PR #807 처리(닫기 또는 병합 검토) — 그쪽 DB 섹션 설계 중
  "legacy 컬럼을 모던 03 DB관리 컬럼 문자로 재매핑"하는 아이디어는 execute 시점에
  재검토할 가치가 있다고 코멘트에 남김. BBE-67 소유자(G작업원D)가 registry linkage
  완료 후 CLI dry-run 재현 → execute.
- SoR: PR #804(머지됨), Linear BBE-67 코멘트 `afc55bf0`(반증 근거) · `cbe37a11`(census+dry-run)

### 2026-08-11 · 경영일지 데탑 C작업원C(260809) · BBE-67 5기 legacy census + read-only 어댑터 — PR #804, 검수 대기
- 의도: 반장 lease(Linear `489447b1`)를 받은 C작업원B 가 §0.8 Gather 를 따라 착수 직후
  "현행 파싱 가정과 구조적으로 다름" 실측 확정 후 코드 0줄로 STOP(`36bedd6d`). belie 직접
  지시로 이 세션이 인수 — "정밀 census 먼저, 그다음 어댑터. 590 dry-run 은 어댑터 완료
  후에만"(G작업원D 게이트 `81bb70c7`③ 과 동일).
- 한 것: Linear BBE-67 전체 코멘트 실측(G작업원D manifest·반장 lease 원문·C작업원B STOP
  전부 확인, 재조사 안 함) → Sheets API grid-indexed 명시 range 로 5기 8개 source 직접
  census(PII 마스킹 — 헤더/라벨만 원문, 데이터는 타입 태그) → `backfill-sheet-rows.mjs`
  에 탭 이름 감지 기반 legacy 분기 추가(contracts alias 1건·sales C열 직접 날짜읽기·db
  2단 배치 대응) → 순수 로직 `backfill-sheet-rows-legacy.mjs` 로 분리(단위테스트 12건)
  → dry-run(registry linkage 0/8 이라 CLI 우회, `extractUserRows()` 직접 호출·DB write
  물리적 0): **source 8/8·sales 195·contracts 37·db 80**, sales 채널 포지션
  전수검증 **1616/1616 무결**. check.sh 전체 그린 → PR **#804**(`a51be5f`) 오픈·CI
  green → Linear BBE-67 코멘트 게시(이 세션 Linear 인증 보유 — 직접).
- 결정: contracts 는 G작업원D 예측(37)과 **완전 일치** — 확신. sales(195 vs 예측515)·
  db(80 vs 예측38) 는 크게 다른데, 예측 자체가 "aggregate-only"(grid 미검증, G작업원D
  본인 명시)였던 반면 이번이 grid 기반 첫 실측이라 **예측 쪽 재확인이 필요하다고 판단**
  (근거: contracts 완전일치·채널 1616/1616 무결·census 로 db "직접생산" 사이드섹션 직접
  확인 — aggregate 방식이 놓치기 쉬운 구조). **확정 아님** — belie/G작업원D 재확인
  요청을 PR·Linear 양쪽에 명시.
- 자체 발견 버그: DB legacy 섹션이 "합계" 행을 skip 만 하고 멈추지 않는 결함(`forEach`
  는 break 불가) — dry-run 중 발견, `for`+`break` 로 즉시 수정(`isLegacyDbSectionTotalRow`
  로 이름도 "종료 판정"/"빈칸 건너뛰기" 분리). 수정 전후 실측 총계는 우연히 동일(80)—
  방치했으면 다른 시트에서 재현 가능한 결함이었다.
- ⚠️ 조사 중 사고: 헤더 위치 확인용 임시 스크립트가 데이터 행 1개를 원문 조회하며 실제
  업체명 1건이 터미널에 노출됨 — **즉시 스크립트 삭제, 어떤 커밋·PR·문서·Linear 코멘트에도
  옮기지 않음**(격리 확인). 이후 모든 조회를 헤더/라벨 전용 range 로 좁혀 재발 방지.
- ⚠️ **머지 보류** — lease §8: "머지는 검수 PASS 후 반장". 이 PR 은 여기까지, `--execute`
  없음(애초에 코드에 없음, 어댑터는 read-only).
- 다음: 반장 검수 → sales/db 수치 belie/G작업원D 재확인·수렴 → (수렴 후) registry
  linkage(G작업원D 소유) 진행 → 그 다음에야 CLI dry-run 재현 가능 → execute.
- SoR: `docs/plans/active/bbe67-legacy-5gi-adapter.md`, PR #804, Linear BBE-67 코멘트
  `cbe37a11`.

### 2026-08-10 · 경영일지 데탑 C작업원B(260809) · BBE-69(R7-#20) S1 구현 — PR #799 오픈, 머지 보류
- 의도: belie 직접 지시 — "BBE-69 「계획만」 제한을 푼다. 구현까지 해라. 머지는 여전히
  금지(68 배포+관찰창 후). PR 을 미리 만들어두면 관찰창이 끝나는 즉시 머지 1건으로
  끝난다. 계획서 #790 이 이미 있으니 그대로 구현으로 이어라."
- 한 것: `docs/plans/active/sheet-retirement-bbe69.md` §3 S1군(관리자 전용 도구, 위험
  최저) 을 실제로 구현 — `lib/repo/setup-formulas.ts`(476줄)·`contract-formulas.ts`·
  `lib/service/sheet-diagnostics.ts`(497줄) + API 라우트 7개(`setup`·`install-formulas-
  bulk`·`install-formulas-by-id`·`diagnose-sheet`·`fix-sheet`·`discover-folder-sheets`·
  `_debug/registry`) + UI 버튼 3개(`InstallFormulasButton`·`InstallFormulasByIdButton`·
  `TraineeDiagnoseButton`, `AdminUserPicker.tsx`·`TraineeCard.tsx` 마운트 지점에서 레이아웃
  깨짐 없이 제거 확인) 삭제.
  **이전**: `isSafeToOverwrite`(§2.5 bulk-write 가드) — 유일한 외부 소비자
  `lib/repo/course-dates.ts` 로 이전, 테스트 14건도 `tests/repo/course-dates.test.ts`로
  함께 이전(기존 12건+이전 14건=26건 green). `CLAUDE.md` §2 rule 5 인용 갱신.
  **부수 정리(직접 유발된 고아 코드만)**: `drive-client.ts` 의 `listSheetsInDriveByTokens`
  (양쪽 유일 호출자 모두 삭제되어 고아화) 제거, `company-info-txt.ts` 의
  `exportCompanyInfoTxt`(외부 호출자 0 확인) 제거, `lib/service/index.ts` 배럴 재수출
  정리, `docs/design/components.md` SSOT 3항목 정리, `period-hardcode.test.ts` 의
  이제 매칭 대상 없는 `"app/api/setup"` stale 항목 제거.
  **의도적으로 안 건드림(명시)**: `filterSheetsByTokens`(`sheet-title-match.ts`)도
  사실상 고아가 되지만 자체 테스트 스위트가 있고 이번 lease 범위 밖 — 후속 정리로
  남김, PR 본문·Linear 코멘트에 명시(숨기지 않음).
- 검증: check.sh 전체 green(structural 28·unit 1257 — 삭제 3파일·부분수정 2파일 반영,
  doc-drift PASS). PR **#799** 오픈·CI green. **머지는 하지 않았다** — PR 본문 첫 줄에
  "🚫 머지 보류 — BBE-68 관찰창 후" 명시(반장 실수 방지 belie 지시 이행).
- 다음: BBE-68 배포+관찰창 종료 확인되면 반장이 #799 머지→배포 관찰→health 200(§6.8).
  이 몸은 BBE-67(경영일지 데탑 C작업반장 발급 lease, 레거시 5기 탭 어댑터) 로 복귀
  — belie 이번 지시로 우선순위 인터럽트했던 작업.
- SoR: PR #799 · `docs/plans/active/sheet-retirement-bbe69.md` · Linear BBE-69 코멘트.

### 2026-08-10 · 경영일지 데탑 C작업원C(260809) · BBE-70 구현 완료·머지 보류 — 기수 생성 DB insert 1건화(R7-#21), BBE-69 대기
- 의도: belie 직접 지시 — "BBE-70 — 같은 원칙[BBE-71 과]. 구현까지 하고 머지 보류. 기수
  생성을 Drive 복사·폴더생성·재시도큐 → DB insert 1건으로. 선행은 BBE-69 다."
- 한 것: 로드맵 실측(`sheet-retirement-r7.md:143`, 선행=`5·7·20`, 20=BBE-69) → 설계문서
  `docs/plans/active/cohort-create-db-insert.md` 작성 → 구현: `lib/repo/db/registry.ts`
  에 `findUserByCohortName`(멱등 조회) 추가, `lib/service/cohort-create-db.ts`(순수 판정
  함수) 신규, `app/api/admin/create-cohort-members/route.ts` 를 DB-only 로 전면 재작성
  (Drive copy·폴더매칭·O1/O2 시트기록·재시도큐 적재 전부 제거, `upsertUserRow`/
  `upsertCohortCells` 직접 동기 호출) → 구 테스트(`create-cohort-members-dates.test.ts`,
  옛 Drive/O1·O2 흐름 검증) 를 새 계약 기준으로 전면 교체(`create-cohort-members-db.test.ts`)
  → 유닛테스트 19건 신규 → check.sh 전체 그린(structural·unit 1314) → PR **#798**(draft,
  `ac9313e`) 오픈, 제목·본문에 "⛔ 머지 보류 — BBE-69 후" 명시.
- 결정: 신규 DB 마이그레이션 불필요 확인 — `course_start_iso`/`graduation_iso`/
  `season_start_iso` 컬럼은 BBE-54/55 가 이미 만들어둠(로드맵이 우려했던 "O1/O2 DB 컬럼
  없음" 문제는 이미 해소). MVP 스코프는 일반 기수 라우트만 — 아레나(`create-arena-members`,
  회사 폴더 겸함)는 diff 축소 위해 후속 카드로 분리(자율결정, 되돌리기 쉬움 — 그 라우트는
  전혀 안 건드림). 응답 계약(created/skipped/failed/pending/dates) 유지해 프런트
  `CohortCreateModal.tsx` 무변경 — pending/dates 는 이 흐름에 없는 개념이라 항상 빈 배열.
- ⚠️ **머지 조건**: BBE-69(시트 미러 폐기, googleapis 제거) 완료 **후에만** 머지. 그 전에
  머지하면 신규 기수가 시트를 건너뛰는데 관리자는 아직 시트를 보고 있어 "생성했는데
  시트엔 아무것도 없다" 사고가 난다. BBE-69 완료 시: 이 브랜치를 최신 master 로 리베이스 →
  check.sh 재통과 → draft 해제 → 머지 → §6.8 배포 확인, 순서로 이어받는다.
- 다음: BBE-69 진행 상황 지켜보다 완료되면 이 PR 승계·머지. 트랙 B 가 이미 실행계획을
  등재했다(`docs/plans/active/sheet-retirement-bbe69.md`, 위 보드 트랙B 행) — "오늘 착수
  금지 유지, 코드 변경 0"으로 확인된 상태(2026-08-10). 그쪽이 착수하면 이 PR 은 곧바로
  리베이스 대상이 된다.
- SoR: `docs/plans/active/cohort-create-db-insert.md`, PR #798

### 2026-08-10 · 경영일지 데탑 C작업원A(260809) · BBE-120 착수 — 갈래A 근인 확정+수정, 갈래B/C/B21 조사, parity 여전히 diff23
- 의도: belie 직배차 — "BBE-120 착수. 갈래A(3명11건 sheet<db, 중복적재의심+B21 동일방향 검증)
  ·갈래B/C(3명9건 sheet>db, 계약 DB결측, BBE-53/59 대조). 20건 하나씩 쫓지 마라 — 근인은
  2~3개. 숫자 맞추려 필터 느슨하게 하지 마라. parity 감사 스크립트는 BBE-66 소유, 건드리지
  마라. 완료=105/105 diff0·B21 delta0."
- 한 것: BBE-66 소유 파일과 완전히 분리된 신규 읽기전용 진단 도구(`scripts/ops/bbe120-diag.mjs`
  + `db-audit.yml` 배선, PR #792~795 4건 순차 머지·배포·health 200)로 4단계 반증:
  ① row_key 중복 0건 ② 시트 grid↔DB row_key 1:1 완전일치(orphan/missing 0) ③ 값 대조 0건
  불일치 → "중복적재" 가설 **반증** ④ FORMULA 렌더옵션으로 R1:U6 수식 원문 직접 확인(연습
  계정+`iwin9400sj@gmail.com` 실제 A2-7기 학생, 완전 동일) — `=E10+E14+...+E272`
  = 56항=8주×7일, **1~8주만**(E272=week8 마지막, week10 아님). 근인 확정: `dashboard-aggregates.
  ts`의 `channelStackingFromDb`가 R1:U6 클램프에 `MAX_SHEET_WEEK`(10, 시트 **쓰기** 물리
  상한)를 잘못 재사용 — 정답은 `STATS_WEEKS`(8).
- 수정: PR **#796**(squash `a5ccc04`) — `inSheetWindow` 상한 정정 + 회귀테스트 3건("MAX_SHEET_
  WEEK 이내라도 STATS_WEEKS 밖이면 제외" 이전 버그 정확 재현). `tests/service/dashboard-
  aggregates.test.ts` 17개 green·check.sh green·배포 run 31396164324 success·health 200.
- 🔎 **B21 재검증(같은 방향인지)**: 다른 원인 확정. `arenaFeeFromDb`는 애초 주차창 개념
  없음(weekIndexOf 미사용). BBE-66 지문도구 재확인: 같은 날짜 시트=550,000 vs DB=1,100,000
  (정확히 2배) — 두 550k 행 합산이 아니라 **DB row 자체 값**이 110만. 원인 미확정(단일
  계약 이력 조사 별건).
- 🔎 **갈래B(2명6건)**: `meeting-row` 진단 = `zzzddz01@gmail.com` **DB meetings 행수 0**
  — sales는 백필됐는데 meetings는 부분백필 누락(코드버그 아닌 데이터결측, BBE-67 인계
  후보). 기타1건(snhinss2)도 동일 패턴(행수 2, 거의 전무).
- 🔎 **갈래C(1명3건)**: `seungik1128@gmail.com` DB에 상태=계약 미팅 4건 존재(전부 매입DB)
  하나 week4 재계산은 0 — 어느 주차로 잡히는지까지는 시간상 못 열어 **미확정으로 남김**
  (추측 금지 원칙).
- ⚠️ **왜 parity 재실행이 여전히 diff23 인가**: `scripts/ops/dashboard-parity-lib.mjs`
  (BBE-66 소유)가 같은 창 상수를 SSOT-COPY 로 복제해 갖고 있는데 그 사본도 `MAX_SHEET_WEEK
  =10` 그대로 — 재실행(run 31396529815, headSha `a5ccc04`=PR #796 포함)해도 총diff 23·
  갈래A 수치 전부 무변화(43/46·33/35·50/58·25/27·110/140·103/115·67/76 — 한 글자도 안
  바뀜, 예상대로). **허용파일에 parity 스크립트가 명시적으로 빠져 있어(예외조항 없음)
  무접촉** — BBE-66 트랙에 1줄 동기화 요청 필요(별도 카드).
- 결정: 완료조건(105/105 diff0) **미충족 — BBE-120 In Progress 유지**. 갈래A는 근인 확정+
  코드 수정 완료(검증만 남음, BBE-66 동기화 대기). 갈래B/기타는 데이터 백필 실행 필요
  (BBE-67 인계 후보). 갈래C·B21은 후속 조사 필요. Linear 코멘트에 4갈래 전부 상세 게시,
  belie/반장에 카드 분리 여부 판단 요청.
- SoR: Linear BBE-120 코멘트(2026-08-10T14:22Z) · PR #792~796 · run 31391493846(baseline)·
  31396529815(재실행) · `scripts/ops/bbe120-diag.mjs`(4모드: sales-rows·contract-row·
  meeting-row·sales-crosscheck·formula-check)

### 2026-08-10 · 경영일지 데탑 C작업원B(260809) · BBE-69(R7-#20) 실행계획 등재 — S0 미충족 확인, 코드 변경 0
- 의도: belie 직접 지시("BBE-69 계획 준비. 계약: R7 배차판 문서 §6" — 2차 발행·변경 없음·프롬프트
  유실 복원). §6 계약 = "오늘 착수 금지(68 배포 후 관찰창 선행) · 카드에 계획만 남길 것(전수
  목록·제거순서·롤백법·belie 체감변화 1줄) · 코드 수정 0".
- Gather(§0.8): 착수 전 Linear BBE-69 코멘트 확인(중복조사 방지) — 이미 두 세션이 매우 상세한
  조사를 남겨둔 상태였다(경영일지 데탑 C작업반장 2026-08-10 05:31 · 경영일지 노트북 G작업원/반장
  2026-08-09 17:50~18:42, 총 4건). **재조사 대신 그 결론을 검증 후 정본 계획 문서로 승격**하는
  쪽을 선택(CLAUDE.md §0.5 ② 중복구현 회피).
- 검증(핵심 주장 재실측, `origin/master=1f77b4a` 기준):
  ① `lib/repo/setup-formulas.ts` 476줄·`lib/service/sheet-diagnostics.ts` 497줄·
  `lib/repo/sheets-client.ts` 195줄 — 전부 일치
  ② `lib/repo/course-dates.ts:7,38` 이 `isSafeToOverwrite`(§2.5 가드)를 실제로 import — 이전
  필요성 확인 ③ `lib/service/sheet-title-match.ts` 는 실제로 없음(`lib/repo/`로 이미 이동, 카드
  본문 stale 확인) ④ **BBE-68 여전히 Backlog**(2026-08-10 06:38 갱신도 Backlog 유지 — 반장 조사
  당시보다도 더 최신으로 재확인) ⑤ `app/api/export/route.ts` 재독 — 여전히 `getCurrentUserEmail()`
  기반 **개인 전용**, 기수/관리자 export 없음. → S0(착수 조건) **미충족 재확인**, 오늘 착수 금지
  판단 그대로 유지.
- 한 것: `docs/plans/active/sheet-retirement-bbe69.md`(신규) — 기존 코멘트들의 S1~S5 전수 목록·
  제거 순서·되돌리는 법을 정본 문서로 통합 + 기존 코멘트에 없던 **belie 체감 변화 1줄**(§6 계약
  요구 항목 중 유일한 gap)을 §7 에 추가 + 카드 제목 정정 근거(«googleapis 제거»는 불가능 — GCal·
  Drive 가 계속 씀, 진짜 대상은 `sheets_v4` 런타임) 명시. `sheet-retirement-r7.md` #20 행에 포인터
  갱신. **코드 변경 0**(lib/app/components/tests 무변경 — 계약 준수).
- 다음: BBE-68 착수·배포·관찰창 종료 + BBE-67 diff 0 + BBE-60 잔여(02·03) 완료 + belie 의 export
  범위 결정(관리자/기수 단위 확보 또는 "개인용으로 충분" 명시)까지 이 카드는 Backlog 유지.
- SoR: `docs/plans/active/sheet-retirement-bbe69.md` · Linear BBE-69 코멘트.

### 2026-08-10 · 경영일지 데탑 C작업원A(260809) · BBE-66 parity 감사도구 3종 수리 — diff 55→23(74→96명 clean), 0 은 아직
- 의도: belie 직접 지시 — "BBE-66 실행 담당. G작업원A 가 원인을 다 짚어놨다(카드 최신 코멘트) —
  너는 고치기만 하면 된다." ① 정본 주차 창(inSheetWindow) 동치화 ② 시차 sheet>db/sheet<db 방향분리
  ③ B21 계약 지문 차집합("DB 가 정본" 선언 금지). 허용 파일 = `dashboard-parity*.mjs`·
  `parity-classify.mjs`·`tests/ops/*parity*` 만, 정본 TS(`dashboard-aggregates.ts`)는 무수정.
- 한 것: `computeAggregates` 에 `inSheetWindow`(MAX_SHEET_WEEK=10) 클램프 추가(sales
  생산/유입/컨택진행 + R1:U6 계약 — 미팅예약/미팅완료는 정본대로 무필터 유지). `classifyDiff`
  의 "시차"를 `시차(DB 누락 후보)`/`시차(DB extra·중복 후보)` 로 방향분리(B21 550,000원처럼
  DB>sheet 인데 "DB 에 없는 행"이라 출력하던 산술 모순 반증). `diffContractFingerprints` 신설
  (계약일·수임비·구분만, PII 없음) — B21 diff 시 자동 호출. 신규 회귀테스트 다수(창 클램프 2·
  방향분리 2·지문차집합 6) 포함 51개 green. PR **#788**(squash `6b18c9c`) 머지·배포 run
  [31361257999](https://github.com/bbelieff/salespt-log/actions/runs/31361257999) success·
  health 200. 워크트리 node_modules 에 `xlsx` 누락(무관한 사전 결함) 발견 → `npm install` 로 해소.
- 🔎 최종 실증(지시받은 명령 그대로, run [31361493846](https://github.com/bbelieff/salespt-log/actions/runs/31361493846),
  headSha=`6b18c9c`=병합 SHA 일치, 105명 동일 cohort): **diff0 74→96명, 총 diff 55→23**.
  분류 = 시차(DB누락)0·시차(DB extra)1(B21)·렌더옵션0·로직차이0·진짜불일치22.
  **B21**: 지문 차집합이 "같은 날짜(2026-06-18)에 시트=550,000원 계약 1건 vs DB=1,100,000원
  계약 1건"을 확정 — 순차 550,000 이 diff 와 정확히 일치. 단순 존재/부재가 아니라 금액이 다른
  별개 계약 — 어느 쪽이 맞는지는 라이브 원자료 대조 필요(이번 스코프 밖, "DB 정본" 선언 안 함).
- 결정: **완료조건(N/N diff0+B21 diff0) 미충족 — BBE-66 In Progress 유지**(belie 에게 그대로
  보고, Done 승격 안 함 — §0.8). 잔여 22건은 손분류 없이 3패턴으로 기계적 그룹핑만 해 다음
  카드 후보로 남김: 계약+N+H 3종 동반결측(9건, DB 백필 누락 의심) · 직접생산 생산+H활동 결측
  (2건, 기존 2026-08-08 인적분류 "C" 케이스와 재현 일치) · sales파생 sheet<db 잔여(10건, 신규
  정밀노출). 전부 `lib/service/dashboard-aggregates.ts`·백필 스크립트 조사가 필요해 이번
  허용파일 범위 밖 — 후속 카드 여부는 belie/반장 판단 요청(코멘트에 등재).
- SoR: Linear BBE-66 코멘트(2026-08-10T06:23Z, 전체 대조표+지문상세) · PR #788 · run
  31361257999(배포)·31361493846(최종 parity) · docs/worklog.md(이 항목)

### 2026-08-10 · 경영일지 데탑 C작업원B(260809) · BBE-60(R7-#11) company_archive 단독 진짜 flip 구현
- 의도: belie "59 완주까지 밀어라... 59→60→68 순서로 전체가 걸려있다" — BBE-59 완료 후 승계.
  BBE-60 원카드("02·06·03 3탭 일괄 flip")는 접수 조사(작업원A, 2026-08-09 코멘트)가 반증:
  company_archive 는 자연키(계약ref)라 선행(#4·#10) 무관·이미 dual-sync 라 리스크 최저, 반면
  02(contracts)·03 은 별도 UUID 재키잉이 필요 — 카드 제목대로 일괄 진행하면 안전한 부분까지
  묶여 지연됨. **채택**: company_archive 단독 우선 착수로 스코프 축소(Linear BBE-60 코멘트에
  등재, 카드 정식 분할 여부는 반장/belie 판단).
- 한 것: `lib/repo/company-info-archive.ts` `upsertCompanyInfoArchive` — 파일럿(syncDb)은 DB
  동기 정본(실패=throw) 먼저 쓰고 시트는 `queueCompanyArchiveSheetSync`(meetings-write.ts
  queueMeetingSheetSync 동형 — 최신 DB 상태로 find-or-append 수렴, mirror_pending 안전망
  재사용)로 비동기 강등해 db-write-flip §2 목표(시트 왕복 제거) 달성. 새 DB 원본 payload 읽기
  `readCompanyArchiveRowPayload` 는 `lib/repo/db/company-archive-sync.ts`에 추가(read-daily.ts
  가 이미 company-info-archive.ts 를 import 하므로 반대 방향 추가 시 순환참조 — row-key.ts 가
  이미 문서화한 함정과 동일해 회피). `hasCompanyInfoArchiveRow`에 `{fromDb}` 옵션 추가해
  read-your-writes 회귀 방지(파일럿 upsert 직후 시트가 안 따라잡은 창에 "없음" 오판 차단,
  R3-2 §6 교훈). contact.ts 유일 호출부에 `{fromDb:syncDb}` 관통.
- **스코프 제외(명시)**: `renameCompanyInfoKey`(개명)는 이번 flip 밖 — 시트의 rename 은
  "같은 물리행 A:D만 갈아끼우고 E:AB 컨텐츠는 그대로" 라는 의미론이라, 비동기 수렴잡으로
  옮기려면 old/new 키 양쪽 컨텐츠 캐리오버를 DB에 새로 설계해야 함. 이 파일이 이미 #559·
  2026-07-14 두 차례 "rename 부활"(옛 컨텐츠가 자연키 재사용 시 되살아나는) 사고를 낸 지점이라
  섣부른 재설계는 하지 않음 — 기존 dual-sync(A안, R3-3 PR-2) 그대로 유지, 후속 카드 소관.
- 검증: 신규 `tests/repo/company-archive-flip.test.ts`(14건 — DB실패시 즉시throw·시트미개입,
  성공시 큐 수렴 find-or-append 정확한 range·값, mirror_pending mark/clear/self-heal 3종,
  hasCompanyInfoArchiveRow fromDb 4종) 전부 green + 기존 6개 스위트(57건) 무변경 재확인
  (company-archive-write-sync·company-info-archive·company-archive-write-gate·
  contact-company-archive-sync·contact-contract-cascade-sync·contract-payment-write-gate).
  check.sh 초록. **PR #786(`574af23`) 머지 · 배포 run `31355596268` success · health 200** — §6.8
  완주. rebase 중 발견: 병합 커밋에 CI 실패(local node_modules 가 BBE-71 의 신규 `xlsx` 의존성
  설치 전 스냅샷이었을 뿐, 코드 결함 아님) → `npm install xlsx` 후 로컬 check.sh 재통과·CI(fresh
  `npm ci`)는 애초에 문제 없었음 → 재확인.
- SoR: `docs/plans/active/db-write-flip.md` Log(2026-08-10) · Linear BBE-60 코멘트(접수·설계·완주).

### 2026-08-10 · 경영일지 데탑 C작업원C(260809) · BBE-71 완주 — 내 기록 xlsx 다운로드(R7-#22 MVP) + 카드 relation 정정 도장(Linear 미인증 회수 요청)
- 의도: belie 직접 지시 — "BBE-71 착수. 지금까지 'BBE-68 선행'으로 막혀 있었는데 그 relation 이 틀렸다.
  ADR 순서구속은 71→69(Export 가 미러 폐기보다 먼저)이고, 68 과는 무관하다... 카드 relation 을 고치고
  (68 선행 제거) 그 근거를 도장에 남겨라. 신규 제작이라 리드타임이 길다 — 지금 시작해야 69 에서 안 막힌다."
- 한 것: `docs/plans/active/export-xlsx-csv.md` §0 에 ADR-0030 §2·§3 원문 인용 근거로 relation 정정 기록
  → MVP 스코프(업체관리·계약수납·DB관리 4채널, 시트 기반 읽기)로 구현 → `GET /api/export` +
  `lib/service/export-xlsx.ts` + TopHeader "내 기록 다운로드" 메뉴 → 유닛테스트 6건(직렬화→파싱 왕복 포함)
  → check.sh 초록(structural 28·unit 1270·doc-drift PASS) → PR **#784**(`bad46e9`) 머지 → 배포 run
  `31354193131` **success** · health **200**(2026-08-10 13:0x KST) → `docs/plans/completed/`로 이관.
- 결정: **BBE-71 blocked_by BBE-68 관계는 존재해서는 안 된다**(오독으로 생긴 이전 설계문서 오류) —
  BBE-67·68·71 은 BBE-69(미러 폐기)의 독립된 3대 병렬 선행조건, 71→68 체인은 없음. 영업관리 재계산·
  대시보드 요약 워크시트는 MVP 밖(후속 카드, 파생 계산값이라 시트 직접 읽기 불가).
- **도장(Linear 미인증 회수 요청 — 반장 relay 필요, v4.1 §5)**:
  `접수 — 경영일지 데탑 C작업원C(260809) · 2026-08-10 / 브랜치 feat/export-xlsx-relation-fix ·
  base 2b59e4c(origin/master) / 착수 범위: R7-#22 export MVP + 카드 relation 정정`
  `완주 — 경영일지 데탑 C작업원C(260809) · PR #784 → 머지 bad46e9 / 배포 run 31354193131 success·
  health 200 / 검증: check.sh 전체 그린(typecheck·lint·structural 28·unit 1270) / 카드 조치 요청:
  BBE-71 의 blocked_by BBE-68 관계가 있다면 제거(근거 = ADR-0030 §2·§3, docs/plans/completed/export-xlsx-csv.md §0
  인용). BBE-69 blocked_by BBE-71 관계는 그대로 유지.`
- 다음: BBE-69(미러 폐기) 착수 시 BBE-67·68·71 세 선행조건 전부 완료 확인 필요. 배포된 다운로드 기능
  브라우저 실사용 확인은 belie/후속 세션 몫(§4 UI 체크리스트 — 이 세션은 headless).
- SoR: `docs/plans/completed/export-xlsx-csv.md`, `docs/decisions/0030-db-ssot-supersede-0002.md` §2·§3

### 2026-08-10 · 경영일지 데탑 C작업원B(260809) · BBE-59 완주 — Phase 1·2 머지·배포·VPS 백필 실행까지 완료
- 의도: belie 직접 지시(2회) — "BBE-59 완주까지 밀어라. 지금 R7 임계경로의 유일한 병목이다.
  59→60→68 순서로 전체가 걸려있다."
- 한 것: Phase 1(PR #757) 머지(`91bf42d`) + 배포 success + health 200. Phase 2(PR #773, 실행
  직전 재설계 — row_key rename 은 03 화면 라이브 파일럿과 경쟁조건 위험이 있어 payload `_row`
  jsonb 병합만으로 축소) 머지(`1b7945e`) + 배포 success + health 200. VPS 워크플로
  `DB Backfill (03 row numbers)`: dry-run(대상 1004건) → `--execute` **1004/1004 갱신, 동시
  갱신 충돌 0건**.
- 정리: `docs/plans/active/db-append-rekey.md` → `docs/plans/completed/`로 이관.
  `docs/plans/active/sheet-retirement-r7.md` #10 을 "완료"로 갱신.
- **BBE-59 완료 — R7-#11(BBE-60, contracts·company_archive·03 → DB-first + 수렴 큐) 착수
  가능**(선행 #4·#10 충족 확인, 기존 작업 0건 확인 후 다음 항목으로 착수).
- SoR: PR #757·#773(둘 다 머지) · Linear BBE-59 · `docs/plans/completed/db-append-rekey.md`.

### 2026-08-10 · 경영일지 데탑 C작업원C(260809) · parity diff 원인 자동분류 완주 — BBE-63 결정적 해소(96% 시차), BBE-66 은 가설 2개 반증
- 의도: belie 최우선 지시 — "parity 도구(dashboard-parity·scoreboard-parity·registry-parity)에
  diff 원인 분류를 추가해라. 손분류에 카드 하나에 4일씩 쓴다(BBE-66 실측). BBE-63 도 라이브 40%
  diff 로 롤백됐다. 이게 되면 BBE-66·63 이 동시에 풀린다."
- 한 것: 공용 분류기 `scripts/ops/parity-classify.mjs`(4축: 시차·렌더옵션·로직차이·진짜불일치,
  순서대로 판정) 신설 → 3개 스크립트 전부 통합. diff 있는 사용자만 시트 04/02 원본 행을 추가로
  읽어 같은 로직으로 재계산해 "시트 원본과는 일치·DB 재계산과는 다름"이면 시차로 확정(쿼터
  절약 — 깨끗한 사용자는 추가 호출 0). `scoreboard-parity.mjs`(BBE-63 롤백 #774 가 지웠던 것)
  복원. 순수 로직은 `-lib.mjs`(+`.d.mts` 타입 선언, `backfill-db-row-numbers.mjs` 선례)로 분리해
  단위테스트 47건(신규 39, BBE-64·2026-08-10 인시던트 실제 패턴을 합성 데이터로 재현) 확보,
  check.sh 초록. PR #782(`5b1e618`) 머지 → 배포 run `31348223622` success · health 200(10:55 KST).
- **실데이터 검증(머지 직후 VPS 실행, 쓰기 0건) — 결과가 갈렸다, 정직하게 기록**:
  · **scoreboard-parity(BBE-63) — 결정적으로 풀림.** run `31348578291`, 아레나 전 기수 45명·
    diff 72건 중 **69건(96%)이 "시차"로 분류**됨(렌더옵션·로직차이 0건). 2026-08-10 인시던트가
    가설로만 남겨뒀던 "db=0/sheet>0/미팅+계약 동반 = DB 에 그 행이 없다"가 **실측 확정**. 남은
    3건만 사람이 볼 대상. **다음 = BBE-67(잔여 백필)이 이 갭을 메우면 BBE-63(PR #720 코드 보존,
    cherry-pick 재적용) 재개 가능.**
  · **dashboard-parity(BBE-66) — 부분적, 가설 2개 반증.** run `31348401577`, 파일럿 105명·
    diff 47건(어제 두 run 과 완전 동일 — 재확인) 중 **시차 1건·렌더옵션 0건·로직차이 0건·
    진짜불일치 46건**. BBE-64 조사에서 유력했던 "계약여부 vs 상태 드리프트" 가설이 **이 47건
    표본엔 단 한 건도 안 맞음**(대안식 재계산이 sheet 값과 일치한 사례 0) — 반증됐다. 지배 패턴
    (`R1:U6.매입DB.계약: sheet=0 db=X>0`, 약 30여건)은 **근인 미상으로 남음**, 후속 조사 필요.
- 결정(자율·§0.7): "BBE-66·63 이 동시에 풀린다"는 지시문 기대와 실측이 다르게 나왔다 — 63 만
  완전히 풀렸고 66 은 조사 범위를 47→46건으로 좁힌 것에 그친다. 성과를 부풀리지 않고 그대로
  기록(§0.8 "검증 안 한 것을 검증한 것처럼 내놓지 않는다"). doc PR 로 결과만 기록(코드 무변경).
- 다음: BBE-63 재개는 BBE-67 완료 후. BBE-66 은 46건 진짜불일치 직접 조사 필요(다음 후보 =
  이 분류기 스코프 밖이었던 sales/03 탭 로직) — 후속 카드 권장.
- SoR: PR #782 · `docs/plans/completed/parity-diff-classifier.md` §7(전체 분류 결과표) ·
  `docs/incidents/2026-08-10-scoreboard-db-parity-gap.md`(재개조건 갱신) · run
  31348401577(dashboard)·31348578291(scoreboard)

### 2026-08-10 · 경영일지 데탑 C작업원A(260809) · BBE-56 게이트 ON 시도 → parity 불일치 83건 → 즉시 OFF(지시 이행)
- 의도: belie 직접 지시 — "BBE-91 Done(백필 실행 수단 확보). 게이트 ON 순서를 진행해라. 백필 실행 →
  행수 대조 → 일치 확인 → REGISTRY_DB_READ ON → admin 화면 대조표. 다르면 즉시 OFF."
- 한 것: ①BBE-91 산출물(작업원E, users 144·cohorts 13 일치) 재실행 없이 확인 ②`chore/registry-db-read-inject`
  작성 — `REGISTRY_DB_READ` 를 `deploy.yml` `INJECT_KEYS` 에 배선(PR **#779**, squash `62cbec1`), CI green
  → 머지 → 배포 run [31346676820](https://github.com/bbelieff/salespt-log/actions/runs/31346676820)
  success·health 200 → **프로덕션 게이트 ON 라이브 확정**. ③`db-audit.yml`(`script=registry-parity`)
  실행: run [31346841822](https://github.com/bbelieff/salespt-log/actions/runs/31346841822) —
  users 144/144·cohorts 13/13(행수는 일치, 결측 0) 이지만 **필드 불일치 83건**(users 77·cohorts 6),
  스크립트 자체 판정 `❌ 게이트 즉시 OFF 대상`.
- 🔎 불일치 2종: (a) 다수는 `sort_order: 시트="" ≠ DB="0"` / `cohorts.type: 시트="" ≠ DB="cohort"`
  형태 — 빈값 vs 기본값 표현차로 보이나 미확정. (b) 일부(`[|A1-1|김덕호]`·`[|A1-4|박준용]`)는
  email 공란 행에서 `cohort_label` 자체가 어긋남(시트=8≠DB=A1-1) + 5개 필드 동반 불일치 — 자연키
  폴백 매칭 오류 또는 실제 DB 값 오류, 원인 미확정(이번 카드 스코프 밖, §0.8 완료정의 — 분리 발행).
- 결정(지시 이행, §6.8 "불일치 → 즉시 롤백"): `gh variable set REGISTRY_DB_READ --body "0"`(01:21:30Z)
  → 재배포 run [31346888503](https://github.com/bbelieff/salespt-log/actions/runs/31346888503)
  success·health 200 → **게이트 OFF, 시트 읽기로 안전 복귀 확인**. Linear BBE-56 에 전체 증거 코멘트
  게시(run id·SHA·표 포함), 카드는 In Progress 유지(게이트 ON 미완주).
- 🔗 **교차 참고**: 바로 아래 D 트랙의 BBE-63 항목(오늘, 같은 롤백 패턴)은 `scoreboard`/`sheet_rows`
  계열(다른 테이블·다른 파이프라인) — diff 모양이 다름(BBE-63 은 "db=0·sheet>0 항상 동반 0",
  이번 건은 "필드별 값 표현차 + 일부 키 오매칭"). **같은 근인으로 단정하지 않음** — 다만 같은 날
  R7 DB 마이그레이션 라인 2곳(레지스트리·스코어보드)에서 각각 독립적으로 parity 불일치가 나온
  것은 반장·belie 가 참고할 패턴.
- 다음: 원인분석 카드 분리 발행 여부는 belie/반장 판단 대기(화이트리스트 밖이라 자율 진행 가능,
  이번 세션은 게이트 ON 시퀀스 자체가 스코프라 여기서 마감).
- SoR: Linear BBE-56 코멘트(2026-08-10T01:26Z) · PR #779(`62cbec1`) · run 31346676820·31346841822·
  31346888503 · GitHub Variable `REGISTRY_DB_READ`(현재 `0`)

### 2026-08-10 · 경영일지 데탑 C작업반장(260809) · 하네스 — 세션명 슬롯 점유 확인 규칙 신설
- 의도: belie 지시 — 온보딩 스킬의 공급자 글자(C/G) 매핑이 현행과 반대라는 신고. 겸해서
  "역할 슬롯이 이미 찼는지 확인하고 착수" 한 줄 추가 요청.
- **실측 결과 — 매핑은 이미 정본이었다(고칠 것 없음)**. `worker-onboarding-prompt/SKILL.md:28`
  이 `C`(클로드)/`G`(지피티·Codex) + "belie 확정 2026-08-09" 로 이미 수정돼 있었고
  (mtime 2026-08-09 21:32 KST = manifest updatedAt 12:32Z), `codex-worker-onboarding` 도
  동일(`:56`·`:116`·`:160`). `moawork-worker-onboarding` 은 C/G 글자를 아예 안 씀
  (`데탑T01~T10` + 서명 `/claude`·`/codex` 풀네임) → 대상 아님. 스킬 사본은 이 3개가 유일.
  신고는 낡은 정보 기준이었다. `AGENTS.md:54` 도 이미 정본.
- **진짜 빠져 있던 것 = 슬롯 점유 확인.** 기존 문서는 "머신·공급자가 틀렸으면 고쳐 선언"까지만
  말하고, **내 역할 글자(A~F)가 이미 남의 것인지**는 아무 데도 안 물었다. 2026-08-09 사고의
  직접 원인 — 데탑 C작업원A~F 가 전부 점유된 상태에서 배차 프롬프트가 그걸 안 알려줬고,
  같은 날 PARKED 된 노트북 G작업원A~F(코덱스 6세션)와 글자가 겹쳐 관제판에서 뭉쳐 보였다.
- 한 것: `AGENTS.md` §1 에 슬롯 점유 확인 규칙 신설(BBE-75 하트비트로 확인 → 차 있으면 다음 빈
  글자 + 첫 응답에 `슬롯 <구>→<신> 변경` 명시 → A~F 전부 차면 belie 에게 증설 확인).
  같은 규칙을 스킬 2종(`worker-onboarding-prompt`·`codex-worker-onboarding`)의 배차자 측
  체크·워커 템플릿 §A·자기점검 체크리스트에 반영. check.sh 초록.
- 결정: 스킬 디렉토리는 git 아님 — claude.ai 서버 관리 캐시(`manifest.json` skillId·updatedAt)라
  로컬 수정은 동기화에 덮일 수 있고 노트북엔 전파 안 된다. 그래서 **레포(AGENTS.md)가 정본**,
  스킬은 배차 시점 편의 사본. belie 확인 후 "둘 다" 적용.
- 다음: 스킬 서버본을 belie 가 claude.ai 편집기에서 동기화하면 로컬 덮임 위험 해소.
- SoR: `AGENTS.md` §1 · Linear BBE-75 코멘트 `ef65fb25`

### 2026-08-10 · 경영일지 데탑 C작업원C(260809) · BBE-61 인수·완주 — 생산개수(M) DB 정본화, non-throw 안전모드
- 의도: belie 직접 지시 — "BBE-61(생산개수 DB 정본화) 인수·완주. 소형이고 독립이다. PR #764 가
  이미 열려 있으니 생사 확인부터 — 살아있으면 리베이스해서 이어라."
- **① Scope**: `writeProductionCountCell`(03 직접생산 M 셀)의 DB 미러가 fire-and-forget 이라
  저장 직후 화면이 옛 값을 잠깐 보여줄 수 있던 read-your-writes 갭 수리. R3-4b.
- **② Gather — 생사 판정**: PR #764 **살아있음**(OPEN, 최근 커밋 2026-08-09 18:24Z). 단
  base 가 `feat/db-append-uuid-rekey`(다른 feature 브랜치)였고, 그 브랜치는 **이미 BBE-59
  Phase1(#757)로 master 에 squash-merge 흡수**돼 stale 상태(원 브랜치는 살아있으나 내용
  중복). PR 커밋 2개 중 `d01ca64`=BBE-59 Phase1 중복분, `409994f`=BBE-61 본체.
  BBE-61 커밋 메시지 자체가 이미 "#757 머지 후 리베이스 필요"라고 명시해 둔 상태였음.
- **③ Solve**: 중복 커밋은 버리고 본체만 `git rebase --onto origin/master d01ca64
  chore/production-count-cell-db` — 최신 master(당시 `bfce745`, BBE-99 fix 포함) 위로 본체
  1커밋만 재생, **충돌 0**. PR base 도 GitHub 상에서 `master` 로 재지정(원래 stale 브랜치를
  가리키고 있었음) — 재지정 후에야 diff 가 원 커밋 stat(+376/-47, 9파일)과 정확히 일치함을 확인.
- **④ Verify**: 리베이스 후 check.sh 로컬 재검증 초록(structural·unit·doc-drift·500줄 캡).
  base 재지정이 CI 트리거 이벤트가 아니라(→ `pull_request: branches:[master]` 필터가 push
  시점 기준이라 base 변경 자체론 안 걸림) 빈 커밋 1개로 강제 트리거 → CI green(`check`·
  GitGuardian 둘 다 pass) 확인 후 머지.
- **⑤ Report**: 재작업 없이 순수 리베이스로 완주. PR #764 머지(`e9c6028`) → 배포 관찰 —
  거의 동시에 다른 세션 커밋이 뒤이어 배치돼 실제 배포 run(`31331957984`)의 headSha 는
  `1f35f04` 였으나, `e9c6028`(BBE-61)이 그 조상임을 `git merge-base --is-ancestor` 로 직접
  확인 → **내 변경이 이 배포에 실제로 포함됨**을 근거 남기고 §6.8 완주 처리. 배포 success ·
  공개 health **200**(04:40 KST).
- SoR: PR #764(`e9c6028`) · 배포 run 31331957984 · `docs/plans/active/db-write-flip.md` §6

### 2026-08-10 · 경영일지 데탑 C작업원D(260809-2) · BBE-63 머지→롤백 — 라이브 parity 40% diff 발견, 근인은 BBE-66/68 소관
- 의도: belie 직접 지시 — "BBE-63 완주까지. lib/service/scoreboard.ts·app/admin/arena/scoreboard/**
  안에서만, scripts/ops/arena-* 금지." PR #720·#753·#755 를 순서대로 머지해 마무리하려 했다.
- 한 것(전반): #753(`6c5766c`)→#720(`a3ae5c0`) 순서로 머지, 각 §6.8 배포 관찰 완료(#720 배포는
  Public health check 초록까지 확인). **여기서 멈추지 않고 지시대로 전 기수 라이브 parity 를
  마저 실행**했다 — `gh workflow run "DB Audit (read-only)" -f script=scoreboard-parity
  -f cohort=<파일럿 18개 라벨>`(run [31330346822](https://github.com/bbelieff/salespt-log/actions/runs/31330346822)).
- 🔎 **결과가 심각했다 — 52명 중 21명(40%) diff, 총 83건.** 패턴이 예외 없이 동일: 모든 diff 가
  `db=0, sheet>0`, 그리고 미팅·계약이 **항상 같은 주차에 동반**으로 틀어졌다(예:
  `practice@salespt.local` 주1.미팅 sheet=9/db=0 + 주1.계약 sheet=3/db=0). 2026-08-09 에 이미
  해소했던 "미팅=완료 vs 예약" 정의 문제가 아니다 — DB 배치 조회가 계약 상태 미팅 자체를
  일부 못 읽어오는 **데이터 완전성 문제**로 판정.
- 결정(자율·§0.7, §6.8 "build/health 실패 → 즉시 롤백"의 정신 적용): 완주 선언 대신 **즉시
  `git revert a3ae5c0`**(PR #774, `052a45e`→`9e3cacc`) → 배포 관찰(run
  [31331333443](https://github.com/bbelieff/salespt-log/actions/runs/31331333443) 전 스텝
  success, Public health check 포함) → 시트 100% 경로로 복귀. PR #720 은 병합 이력에 코드
  보존(재적용 시 cherry-pick). 근거: 라이브 프로덕션이 경쟁성 있는 아레나 전광판에서 실제보다
  낮은 수치를 보여주는 건 "일단 배포하고 나중에 고치기"로 두기엔 사용자 신뢰 파급이 크다.
- 🔗 **같은 근인 가능성 — 다른 트랙과 교차 확인**: 바로 위 항목(C작업원C, 오늘 아침)이 BBE-66
  `dashboard-parity` 에서 거의 동일한 성격(sheet>db, 원인 미상)을 이미 재확인해뒀다 — BBE-65
  머지 후에도 diff 수치가 "한 글자도 안 바뀜". BBE-63 의 diff 도 겹치는 사용자군(A1-x·A2·8기)에서
  같은 모양으로 재현되어 **같은 근인**(추정: `sheet_rows` 의 계약-상태 미팅 백필/동기화 불완전,
  BBE-66/67/68 라인 소유)일 가능성이 높다고 판단 — `scoreboard.ts`/`scoreboard-db.ts` 로직
  자체는 단위테스트 14건이 여전히 정의를 정확히 고정하고 있어 재작업 불필요.
- 검증: revert 브랜치 check.sh 전체 초록. 배포 2건(머지·되돌리기) 모두 §6.8 완주(last-good SHA
  기록·배포 run 관찰·공개 health 200 독립 재확인 각 2회).
- ⚠️ **부수 관찰**: #720 배포에서 GH 러너의 "Public health check" 가 2회 연속 타임아웃(VPS 로컬은
  매번 정상) — 이미 반장이 BBE-99 로 등록한 기존 이슈와 동일 패턴. 되돌리기 배포부터는 다른
  세션이 병행 배포한 "Public health check (VPS 경유 우선·러너 직접은 폴백)" 수정(PR #770)이
  적용돼 1회에 바로 초록.
- 다음: BBE-63 은 **In Progress 유지, BBE-66/68 근인 규명에 종속**. 그쪽이 풀리면 이 PR(#720)
  코드를 cherry-pick 재적용 → parity 재실행 → 그때 진짜 완주. `lib/service/dashboard-aggregates.ts`
  ·`scripts/ops/arena-*`·시즌 SSOT 는 이번 작업 내내 무접촉(디스패치 레인 경고 준수).
- SoR: Linear BBE-63(전체 경위 코멘트 4건) · PR #720(머지, 보존)·#753(실행수단)·#774(revert)
  · DB Audit run 31330346822 · Deploy run 31330179046(머지)·31331333443(되돌리기)

### 2026-08-10 · 경영일지 데탑 C작업원E(260809) · BBE-91 Done — 재백필 대조(users 144·cohorts 13) + BBE-56 인계, Linear 직접 게시
- 의도: belie 디스패치 — "E: BBE-91 완주까지 밀어라. 백필 실행 → 행수 대조(시트 고유키 143·13 vs
  DB) 숫자를 카드에 남겨라. A: E 의 대조 결과 확인 후 BBE-56 게이트 ON."
- **Linear 이번 세션 인증 확인**(전 세션까지 미인증이라 worklog 미러만 하던 것과 다름) — `get_issue`
  로 BBE-91 카드 원문 확인: 8/8 기준값이 "시트 145행→고유키 143·cohorts 13"으로 카드 본문에 박제돼
  있었다. 코멘트 히스토리에서 반장이 **오늘 18:34Z PR #752**(백필 스크립트 렌더옵션 미지정 → 날짜셀
  API 기본값 SERIAL_NUMBER 로 오염되던 결함, 앱 미러 FORMATTED_STRING 과 불일치) 를 머지·배포한 걸
  확인 — "게이트 ON 전 선수정" 코멘트 남기고 **이 카드는 안 닫음(소유 = 작업원E)**.
- **선행 확인**: 배포 run `31329175594` completedAt(updatedAt)=**18:33:10Z** — 내가 백필을 돌리기
  전(18:36~37Z)에 이미 라이브 반영 완료됨을 타임스탬프로 확인 후 착수(수정 전 코드로 오염될 위험
  배제).
- **재실행**(SSH 2회, dry-run→execute): run
  [31329451352](https://github.com/bbelieff/salespt-log/actions/runs/31329451352) →
  [31329479835](https://github.com/bbelieff/salespt-log/actions/runs/31329479835).
  `users 시트 146행(고유키 144) vs DB 144 → ✅일치` · `cohorts 시트 13행(고유키 13) vs DB 13 → ✅일치`.
  어제(8/9) execute run 31315119463 과 완전히 동일한 수치 — 하루 사이 변동 없음.
- 🔎 **디스패치가 지목한 "143"과 +1 불일치를 그대로 카드에 보고**(숨기거나 짜맞추지 않음) — 8/8
  기준(145→143)과 오늘(146→144)의 차이는 **8/8 이후 신규 등록 1건**으로 판단. 중복 2쌍은 카드가
  지목한 바로 그 두 명(A1-1 김덕호·A1-4 박준용)과 정확히 일치, 새 중복은 없음. "143" 이라는 절대
  숫자가 아니라 **"시트 고유키 == DB 행수"라는 상호일치**가 진짜 수용 기준이라 판단해 Done 처리.
- 한 것: BBE-91 코멘트 게시(수치·타임스탬프 검증·차이 설명 전문) → **Done 전환**. BBE-56 에 별도
  코멘트로 게이트 ON 입력 숫자(users 144·cohorts 13) + PR #752 반영 확인 사실 전달 — **게이트 ON
  자체는 착수 안 함**(A 트랙 소관, §3.5 구역 소유).
- 결정(자율·§0.7): "143" 불일치를 발견했다고 재요청·재조사로 블로킹하지 않고, 근거와 함께 카드에
  남기고 진행(§0.7 "블로킹 질문으로 세션을 세우지 않는다"). 되돌리기 = Done→In Progress 재전환
  1클릭(비파괴, upsert 멱등이라 데이터 롤백 불요).
- 다음: A(BBE-56) 게이트 ON → `/admin/users`·수강생 상세·클레임 흐름 시트-DB 대조표. 다르면 즉시 OFF.
- SoR: Linear BBE-91(Done)·BBE-56 코멘트 · run 31329451352·31329479835 · PR #752(`9cd72b0`)

### 2026-08-10 · 경영일지 데탑 C작업원C(260809) · 🚨 BBE-68 재검증 — 어제 NO-GO 사유(BBE-66/67 상태-증거 충돌) 미해소 확인, 착수 금지 유지
- 의도: belie 직접 지시 — "어제 BBE-68 NO-GO 사유 중 'BBE-66/67 상태-증거 충돌'이 있었다. 지금
  둘 다 Done 인데 그 충돌이 실제로 해소된 건지, 상태만 바뀐 건지 실측 확인해라. 해소 안 됐으면
  68 착수 전에 반드시 잡아야 한다." Linear 미인증이라 BBE-68 카드 원문은 못 읽었고, 레포 실측
  (worklog·코드·DB Audit)만으로 재구성·검증했다(§0.8 ② — 기억으로 때우지 않음).
- **① Scope**: BBE-68 = R7-#19(파일럿 게이트 제거) — `docs/decisions/0030-db-ssot-supersede-
  0002.md` §Phase4 확인, 착수 조건에 R7-#17(BBE-66)·#18(BBE-67) 완료가 명시. 이 문서는 이 단계를
  "안전망 상실 지점"으로 명시(쉬운 되돌리기가 여기서 끝남).
- **② Gather**: worklog 전문 검색 — "BBE-68" 자체는 결정 로그가 없고(Linear 전용), BBE-66·67
  은 각각 최근 실측 기록이 있었다:
  · BBE-66 — 2026-08-08 FM 기록: dashboard-parity run `31267667665`, 파일럿 105명 중
    **diff 0 = 74, 불일치 31**, A2 집중(27/53), 원인가설 = "DB 이월행에 AO='이월' 미기록"
    (BBE-65 영역). 재대조 계획만 있고 실행 기록은 없었음.
  · BBE-67 — 2026-08-09 작업원E 기록: 백필 execute 완료했으나 **"cohort 1·2·3·5 registry
    매칭 0건" 을 스스로 발견**해 "**완료 도장 보류**"라고 명시적으로 씀(ADR-0030 조건 미달
    직접 인용). 오늘 아침까지 후속 기록 없음.
- **③ Solve**: 두 가설을 직접 재검증한다 — BBE-66은 "그 사이 원인 후보(BBE-65)가 고쳐졌으니
  대조표가 좋아졌을 것"을 실측으로 확인, BBE-67은 "당사자가 보류한 도장이 그 뒤 실제로 풀렸는지"
  worklog 추가 기록 유무로 확인.
- **④ Verify**:
  · BBE-65(PR #734)는 실제로 2026-08-09 22:04 KST 머지됐고, 커밋 메시지에 "apostrophe 벗김
    위치를 소스로 이동(FM 리뷰 반영)"이 명시돼 원인가설과 정확히 겹치는 수리였음을 확인.
  · 하지만 **그 수리 이후 dashboard-parity 감사가 단 한 번도 재실행되지 않았음**을
    `gh run list`로 실측(마지막 run = 13:01:59Z, BBE-65 머지 = 13:04Z — 3분 차이로 감사가
    먼저 끝나 있었음). **오늘 직접 동일 조건(파일럿 105명)으로 재실행**
    (run [31328856551](https://github.com/bbelieff/salespt-log/actions/runs/31328856551),
    쓰기 0건) → **diff 0 = 74, 불일치 31 — 어제와 완전히 동일**. diff 난 사용자 이메일을
    양쪽 run 로그에서 뽑아 `diff` 명령으로 직접 대조 → **29명 전원 일치, 0줄 차이**(같은
    사람들이 여전히 다름). BBE-65 수리는 diff-0 수치에 **측정 가능한 영향을 주지 못했다**
    — 원인가설이 틀렸거나, 과거 오염된 행에 소급 적용이 안 되는 종류의 수리였을 가능성.
  · BBE-67은 8/9 이후 관련 worklog 항목이 0건(오늘 아침 E 의 BBE-42/77 기록은 다른 카드).
    당사자가 보류한 상태 그대로 방치돼 있음을 확인.
- **⑤ Report**: **어제의 NO-GO 사유는 오늘도 유효하다.** Linear 상태만 Done 으로 바뀌었을 뿐,
  그 상태를 뒷받침해야 할 증거(diff-0 대조표·백필 완전성)는 어제와 한 글자도 다르지 않다.
  **BBE-68 착수 금지를 유지해야 한다.** 남은 불확실성: BBE-66 의 진짜 근인은 아직 미상(카나리아
  후보는 반증됨) — R1:U6.채널.계약 diff 35건 중 다수가 BBE-64 조사에서 발견한 별건 이슈
  (`channelMatrixFromDb` 의 `계약여부` 필드 드리프트, `dashboard-parity.mjs:118`)와 같은
  패턴으로 보이나 이번 조사에서 원인 확정까지는 안 함(후속 필요).
- 결정: worklog 결정함 **19번**에 belie 결정 요청 등재(Linear 상태 되돌리기 — 이 세션은
  Linear 미인증이라 직접 수정 불가, 반장 대행 필요). 코드·DB 무변경(읽기 전용 감사만 수행).
- 다음: belie/반장이 BBE-66·67 Linear 상태를 재조정 → BBE-66 근인 재조사(계약여부 필드
  드리프트 가설 확정 필요) → BBE-67 cohort 1·2·3·5 매칭 0건 원인 규명 → 둘 다 diff-0/전량
  백필 실증 후에만 BBE-68 착수 재상정.
- SoR: DB Audit run 31328856551(오늘)·31267667665(어제) · PR #734(BBE-65) · worklog
  "2026-08-08 · 경영일지 작업반장(FM·260804) · 머지 대기열 6건 판정"·"2026-08-09 · 데탑
  C작업원E(260809) · BBE-91 완주 + BBE-85 사후검증 + BBE-67 부분" 항목 · `docs/decisions/
  0030-db-ssot-supersede-0002.md` §Phase4 · 결정함 19번

### 2026-08-10 · 경영일지 데탑 C작업원E(260809) · BBE-42·BBE-77 완주 도장 준비 — A2 55/55 재검증(복구잔여 0) + 카드 정정 요청
- 의도: belie 직접 디스패치 — "E → BBE-42(A2 셋업)·BBE-77(SSH) 완주 도장 찍고 Done. 증거: 55/55
  이관·parity 6탭 일치 / PR #747 머지 5a45762·run 31311155632·health 200. ⚠️BBE-42에 적힌 R7
  머지열은 A2 소관 아니다 — 로드맵 문서로 넘기고 A2 범위로만 닫아라."
- **BBE-77**: 제시된 증거를 재확인 — PR #747(`5a45762`) 는 **작업원A(260809)** 가 이미 §6.8 완주 기록
  남긴 건(위 로그, 배포 run 31311155632 success·health 200, Tailscale attempt 1 성공·ssh 런타임
  재시도 0회 실측 포함). 새로 검증할 것 없음, 그대로 인용 가능.
- **BBE-42**: "55/55 이관"을 **독립 read-only 재검증** — `Arena Season2 Batch -f mode=repair-shifted-dryrun`
  run [31326902052](https://github.com/bbelieff/salespt-log/actions/runs/31326902052) success(쓰기 0건):
  `복구 대상(A2 행) 0건, 정리만 할 잔재(테스트 마커 등) 0건`. 8/6 FM 기록의 "잔여 20건(row132~151+
  junk5)"이 **이 시점엔 완전히 해소돼 있음**을 실측으로 확인(어느 세션이 언제 repair-shifted-execute
  를 돌렸는지는 worklog 에 명시 로그가 없어 특정 못 함 — repair 스크립트가 멱등이라 결과만으로
  "0건"을 신뢰). Tailscale attempt 1 성공(BBE-95 tailnet 패치 정상 동작 부수 확인).
  **"parity 6탭 일치"는 재현 안 함** — `/admin/db-parity` 는 admin impersonation 로그인이 필요해
  이 세션 권한 밖(BBE-83 때와 동일 한계). belie 의 직접 확인을 그대로 신뢰하고 인용.
- 🔎 **BBE-42 카드 본문 정정 요청**(Linear 미인증이라 직접 편집 불가, 아래는 반장 대행 요청):
  카드에 섞여 있다는 "R7 머지열" 콘텐츠(#736→#737→#734→#743→#749 집행 순서)는 **A2 소관이 아니다**.
  실행 기록 자체는 이미 이 문서 423행(`데탑 C작업반장(260809)` = 구표기 `데탑 G작업원F(260809)`)에
  전문이 있으므로, 카드에서 단순 삭제해도 **유실 없음**. `docs/plans/active/sheet-retirement-r7.md`
  가 이 로드맵의 Phase 문서라 향후 같은 혼입을 피하려면 그쪽에 링크만 남기는 편을 권장.
- **Linear 쓰기 불가(미인증)** — 아래 두 카드 상태 전환·도장 게시는 반장 대행 필요. 도장 문구:
  ```
  완주(BBE-77) — 경영일지 데탑 C작업원E(260809) · 원출처 = 작업원A(260809) PR #747 → 머지 5a45762
  / 배포 run 31311155632 success · health 200 / 재확인만 수행, 신규 검증 없음
  ```
  ```
  완주(BBE-42, A2 범위 한정) — 경영일지 데탑 C작업원E(260809) · 55/55 이관 독립 재검증
  = repair-shifted-dryrun run 31326902052 success, 복구대상 0·잔재 0(8/6 잔여 20건 완전 해소 확인)
  / parity 6탭 일치는 belie 직접 확인(admin UI, 이 세션 권한 밖) 인용
  / ⚠️카드 본문의 "R7 머지열" 콘텐츠는 A2 소관 아님 — 삭제 요청(실행기록은 worklog 423행에 별도 보존)
  ```
- 다음: 반장이 위 두 도장을 Linear 에 게시 + BBE-42 카드 본문에서 R7 머지열 절 제거.
  F 트랙 디스패치(BBE-41·BBE-95 확인)는 이 로그의 범위 밖 — 관측만, 착수 안 함(§3.5 구역 소유).
- SoR: PR #747·Linear BBE-77·BBE-42, run 31326902052, `docs/plans/active/sheet-retirement-r7.md`

### 2026-08-10 · 경영일지 데탑 C작업반장(260809) · 세션 표기 정정 — 구 `데탑 G작업원F(260809)` 는 같은 몸
- 의도: belie 표기 정정 지시("정본 = 프로젝트 접두사까지 전체 표기. 기존 도장은 고치지 말 것").
  ※ 바로 아래 C작업원C 항목과 같은 배경(점호 260809)이며, 그쪽은 축약형 → 전체 표기 건이다.
- 실측 결과 지시 3항 중 **2항 수용 · 1항 반증** (근거 = BBE-75 코멘트 `f5872c22`):
  - ❌ **접두사 누락은 사실이 아니었다** — 내 하트비트 3건(`bb2f2883`·`db5ae4ff`·`9ce5cfd8`)과
    카드 도장 전부 `[경영일지 …]` 로 시작한다. 같은 시간대 다른 세션의 표기 위반과 섞여 보인 듯.
  - ✅ **공급자 글자 `C` 수용 — 내가 틀렸다.** 점호 공지(`ef65fb25`, 2026-08-09 16:29Z)가 매핑을
    뒤집었다: **클로드=`C` · 지피티(코덱스)=`G`**. `worker-onboarding-prompt` 스킬 문서에는 아직
    구 매핑(C=코덱스·G=클로드)이 남아 있어 그걸 따른 내 `G` 표기가 틀렸고, 같은 날 PARKED 한
    노트북 코덱스 6세션(`노트북 G작업원A~F`)과 글자가 겹쳤다. **스킬 문서 수정 필요**(하네스 갭).
  - ⚠️ **역할 `작업원A` 는 채택 불가** — `데탑 C작업원A(260809)` 는 BBE-56 을 들고 살아 있는
    **별개 세션**이고 지금 내 머지 판정을 기다린다(PR #752·#756·#759, 하트비트 `29b5321b`).
    그 이름을 쓰면 관제판에서 두 세션이 한 몸으로 합쳐진다 — 접두사 규칙이 막으려던 사고다.
    데탑 C 작업원 A~F 여섯 자리 전부 점유 확인(A=BBE-56·B=BBE-59·C=BBE-64·D=BBE-63·E=BBE-91·F=배포검증).
- 결정: 정본 = **`경영일지 데탑 C작업반장(260809)`**. 근거 = R7 로드맵의 **반장 슬롯** 임무(머지열
  5건 → BBE-95)가 belie 가 준 지시와 같은 문장이고 실제로 그것을 집행했다. 표기 규약의 "배차자가
  잘못 적었으면 세션이 고쳐 선언한다" 적용. belie 가 근거를 보고 재확인하면 그 결정을 따른다
  (그 경우 BBE-56 보유 세션과 슬롯을 어떻게 가를지 함께 정해야 한다).
- 한 것: 보드 FM 줄 「현재 몸」 칸 갱신(현재 상태 칸이라 갱신 대상) + 이 항목 추가.
  **과거 도장과 아래 로그 항목의 구 표기는 미수정** — belie 지시대로 이력 보존.
- SoR: Linear BBE-75 코멘트 `f5872c22`(점호 260809 응답 겸 정정 선언)

### 2026-08-09 · 경영일지 데탑 C작업원C(260809) · BBE-75 하트비트 표기 정정 — 정본 서명 재선언 + Linear 미인증 회수 요청
- 의도: belie 직접 지시(실측) — "구판 축약형 서명(`작업원C(260806)`)이 BBE-75 관제판 슬롯
  매칭에서 누락된다. 다음부터 정본 서명 「경영일지 데탑 C작업원C(260809)」로 재선언하고, 지금
  즉시 현재 상태로 하트비트 1건 게시." 기존 코멘트 수정 금지(이력 보존) 준수 — 새 코멘트만.
- **Linear 직접 게시 불가 — 이 세션은 `plugin:design:linear` 미인증**(비대화형이라 OAuth 불가).
  [[intake-stamp-precheck]]·[[session-naming-device-vendor]] 규정대로 **worklog 미러 + 반장 회수
  요청**으로 대신한다(도장 규정 v4.1 ⑤).
- **하트비트 내용(반장이 BBE-75 에 그대로 전사 요망)**:
  > `[경영일지 데탑 C작업원C(260809)] 하트비트 — 2026-08-09 23:05 KST` 
  > 현재 유휴, 다음 배정 대기. 오늘 완주분(순서): ① BBE-53(계약 append 자연키 upsert) PR #746
  > 머지·배포 success·health 200 ② BBE-64(profile-stats DB 대체, BBE-48 근본수리) PR #713
  > 인수·머지·배포 success·health 200 ③ BBE-71(Export xlsx/csv) 설계 초안 PR #766 머지·배포
  > success·health 200, 구현은 R7 #19 선행 대기. 결정함 16·17·18번 belie 확인 요청 중.
  > 서명 정정: 구판 `작업원C(260806)` → 정본 `경영일지 데탑 C작업원C(260809)`(이 코멘트부터 적용).
- **belie 지시가 준 "BBE-53 완주·유휴"는 착수 시점 기준 stale** — 그 사이 BBE-64·BBE-71 을
  완주해 실제 현재 상태는 위와 같음(§0.8 증거 없는 문장 금지 — 지시 문구를 그대로 베끼지 않고
  실측 갱신). 세 카드 모두 이 워크로그에 상세 로그·PR·배포run 이미 기록됨(위 항목들 참조).
- 다음: 신규 배정 대기. Linear 인증 세션이 생기면 이 세션이 직접 도장·하트비트를 찍을 수
  있음 — 그 전까지는 계속 이 미러 경로 사용.
- SoR: 이 항목 · [[session-naming-device-vendor]](belie 08-09 확정 서식) · PR #746·#713·#766

### 2026-08-09 · 데탑 C작업원C(260809) · BBE-71 설계 착수 — "내 기록 다운로드" 초안, 구현은 R7 선행 대기
- 의도: belie 직접 지시 — BBE-64 완주 후 "BBE-71(Export xlsx/csv) 착수, 여유 되면 설계라도
  미리 시작해라. BBE-69(시트 미러 폐기)의 선행이고 신규 제작이라 오래 걸린다."
- **① Scope**: R7 로드맵 Phase 4 #22(BBE-71 추정) — 시트 은퇴 후에도 학생이 자기 기록을
  파일로 가져갈 수 있게 하는 다운로드 버튼. belie 08-05 확정("시트는 다운로드 버튼 형태로 남긴다").
- **② Gather**: `docs/plans/active/sheet-retirement-r7.md` 실측 — #22 의 **선행 = #19(파일럿
  게이트 제거)**, #19 는 Phase 1(레지스트리 DB화, 진행 중 — 오늘 BBE-56 게이트 OFF 까지만 완료)
  ·Phase 2 전부 완료 후에나 착수 가능한 **임계경로 끝단**. → **오늘은 구현 착수 시점이 아님을
  실측으로 확인**(추측 아님). 기존 export 코드·xlsx/csv 의존성 = 0건(§D 재확인).
- **③ Solve**: 지시대로 구현 대신 설계만 진행. R7 §G.1 이 이미 적어둔 미결 3가지(형식·범위·
  주체)에 권장안 제시 + 레이어·라이브러리 설계 초안 작성.
- **한 것**: `docs/plans/active/export-xlsx-csv.md`(신규, status: draft) — 권장안: ①xlsx
  단일(csv 는 YAGNI 로 보류) ②로그인 사용자 1인분 전체(admin 일괄은 후속 카드) ③학생 화면
  우선(admin/트레이너는 후속). 기술설계: `lib/service/export-xlsx.ts`(조립)→`app/api/export/route.ts`
  (인증+응답)→`components/`(버튼), 라이브러리 후보 `xlsx`(SheetJS CE, VPS 메모리 제약 고려해
  가벼운 쪽 권장) vs `exceljs`. worklog 결정함 **18번**에 belie 질문 등재(쉬운 말 3가지, §0.6
  형식) — 급하지 않음(로드맵상 대기 항목이라 착수 시점에 반영해도 됨).
- 다음: R7 Phase 1(레지스트리 DB화) 진행 상황 지켜보며, 반장/belie 가 우선순위를 당기면
  이 설계 문서를 `active`(실행 계약)로 승격.
- SoR: `docs/plans/active/export-xlsx-csv.md` · `docs/plans/active/sheet-retirement-r7.md`
  Phase 4 · 결정함 18번

### 2026-08-09 · 데탑 G작업원F(260809) · R7 머지열 집행 + BBE-95 완주 — 4건 머지·마이그레이션 0002 적용, #737 만 카나리아 보류
- 의도: belie 직접 지시 — "R7 전체완료 착수. 머지열 5건이 안 빠지면 나머지 6슬롯이 전부 대기한다."
  순서 지정(#736→리베이스→#737→#734→#743→#749), 승인 불요(BBE-73 §7).
- 한 것 (전부 §6.8 완주 — 배포 관찰 + 공개 health 200 로컬 실측):
  - **#736 BBE-58**(gcal 토큰 DB) → `66b4046` · 배포 `31314439842` success → **Done**
  - **#734 BBE-65**(이월 읽기 게이트) → `74016be` · 배포 `31314861494` success → **Done**
  - **#743 BBE-56**(레지스트리 읽기 flip) → `469ed87` · 배포 `31315301133` (원격 exit 0) →
    **Done 아님** — 게이트 OFF 배선까지만. 게이트 ON·응답시간 수치는 미충족(작업원A 소관)
  - **#749 BBE-91** — 내가 손대기 전 타 세션이 선머지(`3d7f463`, 12:52:52Z). 중복 머지 없이 배포 관찰만 대행
  - **BBE-95**(tailnet 잔여) → PR #761 `a493b85` · 배포 `31316419865` success → **Done**
  - **마이그레이션 0002 프로덕션 적용** — `DB Migrate` execute run `31314830243`,
    `✅ 적용 완료: 0002_gcal_tokens.sql`(0001 은 기적용). ssh 재시도 0회
- 결정:
  - **#737(BBE-62) 보류** — 해제 조건 = 카나리아 1회 왕복(사람 필수). 근거를 코드로 확정:
    `setGcalEventId`(gcal-event-ids.ts:289-291)의 DB upsert 는 **try/catch 가 없고**,
    `ensureSchema`(db/client.ts:54-67)는 `sheet_rows` 만 만들 뿐 `gcal_event_ids` 를 안 만든다.
    ⇒ 머지 후 0003 을 안 돌리면 **캘린더 쓰기가 조용히 멈춘다**. #743 처럼 "머지만 하고 스위치는
    나중" 이 불가능한 구조 → belie 지시대로 카나리아가 앞에 와야 한다. PR 본문의 "마이그레이션
    전에도 시트 폴백" 은 **읽기 경로에만** 맞다(읽기는 170행에서 catch 후 강등)
  - **BBE-95 범위 축소 확인** — 카드의 3종 중 db-migrate·db-backfill-registry 는 타 세션이
    #751 로 선처리(13:03:23Z). 중복 구현 회피 후 arena-season2-batch 1종만 작업
  - 아레나 배치의 tailnet 실왕복은 **의도적 미실행**(실시트 조작 모드 다수 + 짧은 간격 SSH 가
    차단 방아쇠라는 카드 「주의」) — 패턴 동일성만 검증. 자율결정
- 다음:
  - **#737** — belie/테스터 1명의 카나리아 왕복 대기. 해제되면 머지→**즉시 0003 적용**→2~5단계 검증
  - **BBE-99 신규 발행** — 배포의 `Public health check` 가 러너 IP 차단으로 오탐(오늘 3~4건 중
    2건). 정상 배포가 failure 로 떠 §6.8 관찰이 무력화되고 **멀쩡한 배포를 롤백할 뻔했다**.
    권장 = 내부 health 를 게이트로, 공개 curl 은 경고로 강등
  - **BBE-56 게이트 ON** = 작업원A(백필 행수 대조 후) · **BBE-91 백필 실행** = 작업원E
- SoR: Linear BBE-58/62/65/56/91/95/99 코멘트(도장), PR #736·#734·#743·#761

### 2026-08-09 · 데탑 C작업원C(260809) · BBE-64 완주 — 머지·배포 확인(BBE-48 근본수리 라이브 반영)
- 한 것: PR #713 머지(`558e4f6`) → 배포 run [31315835765](https://github.com/bbelieff/salespt-log/actions/runs/31315835765) **success**(1회 성공, rerun 불요) → 공개 health **200**(22:35 KST). §6.8 완주.
- BBE-48(admin/users 진입 지연) 근본수리가 admin·트레이너·회장 3화면에 동시 반영됨(공유 함수 `enrichUsersWithStats` 교체).
- 후속 카드 권장(이 PR 범위 밖, 아래 로그 항목의 §8 판정 참조): ①`weeklyContractsFromDb` 이월 미배제 갭(R2-7a/BBE-66 소관) ②A2 개별 2명(`seungik1128`·`snhinss2`) 특정 주차 부분 결측(백필/dual-write lag 후보).
- 다음: belie 지시대로 **BBE-71(Export xlsx/csv 신규 제작)** 착수 — R7 후반 임계경로(BBE-69 시트 미러 폐기의 선행), 규모가 커 오늘은 설계까지.
- SoR: PR #713 · `docs/plans/active/profile-stats-db.md` §6·§8 · 배포 run 31315835765

### 2026-08-09 · 데탑 C작업원C(260809) · BBE-64 인수 — PR #713 리베이스 + A2 백필 실측 검증, 머지 준비 완료(BBE-48 근본수리)
- 의도: belie 직접 배차 — "BBE-64 착수. 먼저 PR #713 생사 확인 — 8/6 이후 무활동이라 죽었을
  수 있다. 살아있으면 리베이스해서 인수, 죽었으면 사유 남기고 재설계. 이 카드가 BBE-48
  (admin/users 느림)의 근본수리다. 파급이 크니 §0.8 5단계 다 밟아라." §0.8 전 단계 실행.
- **① Scope**: `readProfileBundle.stats`(admin/트레이너/회장 3화면 공유)를 파일럿 기수 한정
  DB 배치 조회로 대체 — BBE-48(수강생관리 진입 지연) 근본 원인 제거. PR #713 이 이미 이 범위로
  구현·리뷰 완료 상태.
- **② Gather — PR #713 생사 판정: 살아있음(폐기 아님).** 실측: `state=OPEN draft=True`,
  최종 코멘트(2026-08-06) = belie "반장 판정: 개막 후로 보류 — 8/7 개강·아레나 개막 당일 전후
  안정화 창구를 건드리는 변경... 구현·리뷰는 완주 상태, 개막 후 재개." → **의도적 창구 대기였지
  방치·죽음이 아니다.** `mergeable=CONFLICTING`(34커밋 뒤처짐, 예상된 상태 — draft PR 을
  8/6 이후 아무도 안 건드림).
- **③ Solve — 재작업 대신 리베이스 인수**: 구현·테스트·적대적 리뷰가 이미 완주돼 있어(plan
  문서 §5.5·§7) 재설계는 근거 없는 재작업(§0.8 "belie 요구 전 실측 확인" 원칙의 거울상 — 남의
  작업도 같은 잣대). `git rebase origin/master`(`b85c1f7`→`b67de8a`) 실행 — 충돌 2건 모두
  `docs/worklog.md`(§3.5 append-전용 예외, **양쪽 로그 항목 보존**), 코드 파일(`dashboard-
  aggregates.ts` 등)은 자동 병합. 결과 `82bb5e8`.
- **④ Verify**:
  · check.sh **초록 재확인**(리베이스 후) — structural 25/25 · unit **1132**(리베이스 전
    1038 대비 증가는 그 사이 병합된 BBE-53·BBE-57 등의 테스트 포함, BBE-64 자체 24건은 불변)
    · doc-drift · 500줄 캡. typecheck·lint 통과.
  · plan 문서 §7 미완 게이트 2개 중 **"머지는 8/7 이후"는 오늘(8/9)로 자동 충족**. 나머지
    **"A2 백필 완료 확인"을 실측으로 닫음** — `DB Audit (read-only)` 워크플로의
    `dashboard-parity` 를 A2 전체(A2-1~A2-8, 53명)에 실행(run
    [31314769805](https://github.com/bbelieff/salespt-log/actions/runs/31314769805), 쓰기 0건).
    **결과: 26/53 diff 0, 나머지 27명 47건 diff — 그러나 "전부 0으로 보임" 최악 시나리오는
    반증됨.** diff 를 갈라보니: 다수(~40건)는 `channelMatrixFromDb`(BBE-64 가 안 쓰는 기존
    함수)가 `계약여부`(파생·동기화용 필드, plan 문서 §3 가 이미 "정본 아님"으로 진단한 바로 그
    필드)를 기준으로 삼아 생기는 **기존·별건 드리프트**(R2-7a/BBE-66 소관, `scripts/ops/
    dashboard-parity.mjs:118` 실측). BBE-64 가 실제로 쓰는 것과 같은 계열(`N.주X계약`·
    `H.주X활동`, 상태 기준)의 진짜 결측은 **2/53명**뿐(`seungik1128@gmail.com` 주4계약,
    `snhinss2@gmail.com` 주1활동 — DB 가 시트보다 낮음 = 부분 결측, 전면 결측 아님).
  · **부수 재확인(§4 갭 여전히 실재)**: plan 문서가 08-06 에 지적한 `weeklyContractsFromDb`
    이월 미배제는 **오늘(8/9) 코드로 재확인해도 그대로**(`lib/service/dashboard-aggregates.ts:
    116-127`, 이 PR 이 쓰지 않는 별개 함수) — 옛 지적이 stale 이 아니라 여전히 유효함을 직접
    코드로 검증(§0.8 "기억으로 때우지 않는다").
- **⑤ Report**: 파급 3화면(admin/트레이너/회장)에 대한 카타스트로픽 위험(백필 전무)은 실측으로
  기각. 잔여 결측 2명은 소규모·개별 주차 단위로 낮은 위험. plan 문서 §6·§8·§7 갱신(판정 근거
  전문 기록) 후 §0.7 자율 진행 — 되돌리기(이 PR revert 1건, 데이터 쓰기 없음)로 완전 원복 가능한
  결정이라 belie 승인 대기 없이 머지로 진행.
- 결정(자율·§0.7): PR #713 draft 해제 → 머지 → §6.8 배포 관찰(다음 로그 항목).
- SoR: PR #713 · `docs/plans/active/profile-stats-db.md`(§6·§7·§8 갱신) · DB Audit run
  31314769805

### 2026-08-09 · 데탑 C작업원E(260809) · BBE-91 완주 + BBE-85 사후검증 + BBE-67 부분(cohort 1·2·3·5 매칭 0건 미해소)
- 의도: 반장 디스패치 — ①BBE-85 독립 사후검증(반장이 적용한 0001·0002 확인) ②BBE-91(경영일지)
  실질 병목 완주(레지스트리 백필 실행) ③완주 후 BBE-67(잔여 기수 sheet_rows 백필) 착수.
- 접수 도장(규정 v4.1 ⑤ — Linear 미인증, worklog 미러): `접수 — 데탑 C작업원E(260809) · 2026-08-09
  08:36 KST / base origin/master=27a07b3 / lane: verify-r7`
- **①BBE-85 사후검증**: 정본 경로(workflow_dispatch) dry-run run
  [31303933202](https://github.com/bbelieff/salespt-log/actions/runs/31303933202) success —
  `적용할 마이그레이션 없음(전체 2건 이미 최신)` = 0001·0002 적용 2/2·체크섬 일치 2/2(불일치면
  `computePending` throw). 반장의 failure run `31287233695`(13m51s)는 재구성 결과 **코드 무관 —
  SSH 15/15 timeout(BBE-77)**, 실제 마이그레이션 적용은 그 직전 run `31287208990`에서 이미 성공.
  한계: `schema_migrations` SELECT 직접 덤프는 `db-audit.yml` 화이트리스트 3종 밖이라 미실행 —
  "정확히 2행"은 러너 동작 역산, SELECT 실측 아님.
- **②BBE-91**: 착수 시 PR #749(다른 세션 08:07 오픈, CI green)가 이미 존재 — 중복 구현 대신 리뷰로
  전환, §0.7 발견: 신규 PR **#751**로 병목 해소 — `db-migrate.yml`·`db-backfill-registry.yml` 이
  BBE-77 Tailscale 배선(#747) 범위 밖(공인 IP 전용)이라 SSH 반복 금지 지시와 충돌 확인 →
  #747 과 동일 3줄 패턴(잡 env 3개·tailscale 스텝·HOSTS 폴백)만 이식. 머지 `09a0679`·배포 run
  [31314830780](https://github.com/bbelieff/salespt-log/actions/runs/31314830780) success·health 200.
  **백필 실행**(SSH 2회, 각 attempt 1 성공·공인 IP 미사용): dry-run
  [31315082996](https://github.com/bbelieff/salespt-log/actions/runs/31315082996) → execute
  [31315119463](https://github.com/bbelieff/salespt-log/actions/runs/31315119463). 결과:
  `users 시트 146행(고유키 144) vs DB 144 → ✅ 일치` · `cohorts 시트 13행(고유키 13) vs DB 13 → ✅ 일치`.
  자연키 중복 2쌍(`A1-1 김덕호`·`A1-4 박준용`, prep 행) — 마지막 값 수렴, 시트 정리 대상.
  ⚠️ BBE-55 완주 기록(145행→143키)과 **+1 불일치**(146→144) — dry-run·execute 두 run이 동일 수치라
  측정오류는 아니고 8/8 이후 신규 등록 추정, 어느 행인지는 미확인(요약 로그만, 개별행 미출력).
- **③BBE-67 착수 — 부분 완료**: `db-backfill.yml --cohort "1,2,3,4,5,6,7,10"` 콤마 목록으로 SSH
  2회(dry-run [31315194175](https://github.com/bbelieff/salespt-log/actions/runs/31315194175) →
  execute [31315377078](https://github.com/bbelieff/salespt-log/actions/runs/31315377078))에 묶어 처리.
  대상 시트 21개, 시트 추출 총 1485행(meetings 183·contracts 80·todos 6·sales 919·db 259·
  company_archive 38), `DB upsert 완료: 1485건`, 탭없음(무해) 26건·읽기실패 0건.
  🔎 **DB 기준 대조 표에 cohort 1·2·3·5 가 아예 없음** — `targets` 필터가 registry
  `users!B열(cohort, 기 접미 제거)` 매칭이라, 이 4개 기수는 **레지스트리에 매칭 행이 0건**(1~7기·10기
  전량이 아니라 4·6·7·10 만 실제로 백필됨). 원인 미상 — 후보: ①1~3·5기는 앱(레지스트리) 도입 이전
  아카이브라 registry 행 자체가 없음 ②라벨 표기가 숫자가 아닌 다른 형식(`PRM N기` 등, 확인 필요).
  대조 표 합계(cohort 4·6·7·10, 1505) vs 추출 총계(1485)에 **+20 오차** 미해명 — 시간 여유 두고 후속
  확인 권고(추가 SSH 즉시 재발사 안 함, §SSH 반복금지 준수).
- 결정(자율·§0.7): SSH 반복 트리거 방지가 최우선 지시라, 콤마 목록으로 **8개 기수를 dry-run·execute
  각 1회씩(총 2회)**로 묶었다. cohort별 개별 실행(16회)보다 안전.
- **ADR-0030 §"R7-#18(BBE-67) 완료" 조건 미달** — "잔여 기수(1~7기·10기) 전량 백필 + diff=0"은
  cohort 1·2·3·5 가 빠져 **미완료**로 남긴다. 완료로 잘못 닫으면 아무도 이어받지 않는다(§0.8).
- 검증: PR #751 `npm run check` 로컬 초록(typecheck·lint·structural 25·unit) 후 커밋, CI green.
  실행계 4건(BBE-91 dry-run/execute·BBE-67 dry-run/execute) 전부 워크플로 success, health 200 유지 확인.
- 다음: ① **A 트랙에 BBE-91 수치 인계**(users 144·cohorts 13 확보 — A의 "게이트 ON 은 백필 후로 유보"
  선행조건 해소, #743 는 착수 시점 이미 A 가 머지함 확인) ② BBE-67 잔여 = cohort 1·2·3·5 registry
  매칭 0건 원인 조사(원인 확정 전 diff=0 리포트 발행 불가) ③ +20 오차 원인.
- SoR: PR #751·#749 · Linear BBE-85·BBE-91·BBE-67 · `docs/decisions/0030-db-ssot-supersede-0002.md`
  §Phase4 #18 · `docs/plans/active/sheet-retirement-r7.md`
- 도장 미러(규정 v4.1 ⑤ — Linear 미인증, 반장 전사 요망):
  `완주(BBE-91) — 데탑 C작업원E(260809) · PR #751 → 머지 09a0679 / 배포 run 31314830780 success ·
  health 200 / 백필 execute run 31315119463 success — users 144·cohorts 13 ✅일치.
  부분(BBE-67) — sheet_rows execute run 31315377078 success, cohort 4·6·7·10 만(1·2·3·5 registry
  매칭 0건, 원인 미상 — 완료 도장 보류)`

### 2026-08-09 · 경영일지 데탑 C작업원D(260809-2) · BBE-63 인수 — 미확정 해소 + PR #720 ready + 실행수단 #753
- 의도: 반장 대행 디스패치 취소(신 반장 부팅 확인) 후 BBE-63(전광판 DB 전환) 복귀 지시.
  Linear 접수 도장 확인(작업원D 260805, 다른 세션 도장 0건) 후 인수 — 재작업 아님, 잔여 완주.
- 한 것: 구 세션이 draft 로 남긴 PR [#720](https://github.com/bbelieff/salespt-log/pull/720) 의
  "미확정 1건"(대시보드 미팅 컬럼 = 완료 L 인지 예약 H 인지) 을 VPS 접속 없이 3개 독립 근거로
  확정 — ①`setup-formulas.ts:139` 01!L 수식 실측(상태∈{완료,계약}·이월제외·미팅날짜 키)
  ②01!R4:U5 미팅예약 펀넬은 `COUNTIFS(04!F,04!J)` 날짜 무필터 누적이라 주차값 후보에서 구조적
  배제 ③`dashboard-parity` run `31267667665`(BBE-66, 2026-08-08) 8·9기 diff-0 재사용 — 같은
  블록 H(활동량)이 이 정의로 이미 검증됨. 가드테스트 3건 추가(수식 문자열 변경 시 즉시 파손).
  draft→ready 전환, PR 설명 갱신.
- 결정(자율·§0.7): parity 실행 수단(`scripts/ops/scoreboard-parity.mjs` 를 GHA 로 실행할 방법
  부재, BBE-85·91 과 동형 갭) 은 `.github/` 공용부라 §3.5 에 따라 **단독 PR [#753](https://github.com/bbelieff/salespt-log/pull/753)** 로 분리
  (`db-audit.yml` 에 `scoreboard-parity` choice 추가, dashboard-parity 와 동일 패턴). 스크립트가
  아직 master 에 없어 #720 이전에 머지돼도 안전(다른 옵션 무영향, read-only).
- master 가 반장 드레인 중 빠르게 이동(#736·#734·#747·#749·#751)해 리베이스 3회 재수행.
  `lib/service/dashboard-aggregates.ts`(BBE-66)·`scripts/ops/arena-*`+시즌 SSOT(BBE-36 코덱스
  구역) 무접촉 확인 — 디스패치 레인 경고 준수.
- 검증: check.sh 전체 초록(1132 tests, 신규 14건). 전 기수 라이브 parity 는 #753 머지 후
  belie/FM 권장(머지 전제조건 아님 — 핵심 불확실성은 이미 확정).
- 다음: 반장 판정(#720·#753 머지 순서 무관). Linear BBE-63 코멘트 게시 완료.
- SoR: `docs/plans/active/scoreboard-db-conversion.md` · PR #720·#753 · Linear BBE-63

### 2026-08-09 · 데탑 C작업원A(260809) · BBE-77 완주 — Tailscale 접속 경로 머지·라이브 확정, SSH 간헐 차단 종결
- 의도: belie 직접 지시 — "Tailscale Secrets 3개 + `tag:ci` ACL 등록 완료. PR #747 머지하고
  워크플로 1회 실행해서 확정해라." (트랙 A 카드는 아니나 belie 직접 배차 → §0.7 자율 완주)
- 선행 실측: `gh secret list` — `TS_OAUTH_CLIENT_ID`·`TS_OAUTH_SECRET`·`VPS_HOST_TS` **3건 모두
  11:32Z 등록 확인**, 워크플로가 참조하는 이름과 **정확히 일치**. PR #747 CI green·mergeable CLEAN.
- 머지 전 심사: diff 5파일 전수 확인 — ①`steps.if` 의 `secrets` 참조 **0건**(있으면 파싱 에러로
  배포 워크플로 전체가 무효화됨) ②재시도·`setsid`·`flock`·폴링 로직 **무변경** ③`deploy`·`db-backfill`
  은 라운드로빈 슬롯2 에 공인 IP 가 들어가 **짝수 시도 자동 폴백** 보유 → 실패해도 배포가 안 멈춘다.
- 한 것: last-good `27a07b3` 기록 → PR #747 squash 머지(`5a45762`) → §6.8 배포 관찰.
  배포 run [31311155632](https://github.com/bbelieff/salespt-log/actions/runs/31311155632) **success** ·
  health **200**. 이어 확정 사격으로 **DB Audit(read-only) run
  [31311350830](https://github.com/bbelieff/salespt-log/actions/runs/31311350830) success**.
- 🔎 확정 근거(추정 아님): ①Tailscale 스텝 = `success`(스킵 아님) — 로그 `✅ Tailscale up command
  completed successfully on attempt 1` / `✅ Tailscale is running and connected!` ②배포 ssh **런타임
  재시도 0회**(로그의 `↻ ssh 연결 실패` 는 전부 소스 에코, 실제 발생 0) → 라운드로빈 **1번 시도 =
  tailnet** 이 그대로 성공, 공인 IP 폴백을 쓰지 않았다 ③`db-audit.yml` 은 유일하게
  `StrictHostKeyChecking=yes` + 이번에 추가된 **keyscan 하드 게이트**라 가장 깨지기 쉬운 경로인데
  그것까지 통과 — tailnet 위에서 host key 획득·검증이 정상.
- 결정: BBE-77(GH러너→VPS:22 간헐 차단)의 **우회 경로 확보 완료**. 롤백은 여전히 secret
  `VPS_HOST_TS` **삭제 1번**(PR·재배포 불요) — 삭제하면 즉시 공인 IP 로 복귀한다.
- ⚠️ 남은 것(비차단): `db-migrate.yml`·`arena-season2-batch.yml`·신규 `db-backfill-registry.yml`(PR #749)
  은 이 PR 범위 밖이라 아직 **공인 IP 전용**이다 — 동작은 종전과 동일하나 차단 창이 오면 그대로 맞는다.
  3종에 같은 tailnet 경로를 붙이는 후속이 필요(카드 발행 대상).
- SoR: PR #747 · Linear BBE-77
- 도장 미러(규정 v4.1 ⑤ — 이 세션 Linear 미인증, 반장 전사 요망):
  `완주 — 데탑 C작업원A(260809) · PR #747 → 머지 5a45762 / 배포 run 31311155632 success · health 200
  / 확정 실행 = DB Audit run 31311350830 success, Tailscale 연결 attempt 1 성공 · ssh 런타임 재시도 0회`

### 2026-08-09 · 데탑 C작업원C(260809) · BBE-53 완주 인수 — contracts append 자연키 upsert 배포 확인 + 잔여 위험 2건 등재
- 의도: 세션 통일 이관. 구 몸(창 "경영일지 작업원C")의 BBE-53(매출 이중계상 차단, R7-#4)을 승계.
  돈 숫자를 다루는 카드라 **재작업 대신 실측 인수**부터 했다(§0.8 ② — 이미 있는지 먼저 찾기).
- 구 몸 진행 실측: PR **#746 MERGED**(`b67de8a`, 01:18Z) · 배포 run `31287998919` **success** ·
  PR check `31287768440` pass · 감사 스크립트 PR **#744** 선행 머지 · 파일럿 before/after 대조가
  이미 #746 코멘트로 첨부됨(감사 run `31287774124`, 24샘플). **워크트리 2개 모두 클린, 미커밋 델타 0.**
  → 구현·머지·배포는 끝나 있었고 **남아 있던 것은 장부(worklog·plan·도장)와 잔여 위험 보고**뿐이었다.
- 한 것: ① health **200** 재확인(16:58 KST) → §6.8 완주 확정 ② 수용기준 1~6 코드 실측 재검증
  (`writeContractRow` 가 C:E·AK·AI:AJ 만 써 사용자 입력영역 F~AA 를 보존함까지 확인) ③ 이 워크로그
  기록 + 보드 C 줄 갱신 + Linear 도장 미러(아래) ④ plan `contract-append-idempotent-flip.md`
  → `docs/plans/completed/` 이동 ⑤ **잔여 위험 2건을 결정함 16·17 에 등재**.
- 결정(자율·§0.7): 17번(같은 날·같은 업체 두 계약이 한 줄로 합쳐지는 케이스)은 **이 카드에서 고치지
  않는다**. BBE-53 계약서 §1 이 그 자연키를 쓰라고 명시했고 폴백을 좁히면 AK 없는 옛 행의 재시도 보호가
  약해져, 계약 밖 판단이다 → 후속 카드로 분리(권장안은 결정함 17번). 되돌리기 = 어느 쪽도 revert 1건.
- 다음: 결정함 16(실데이터 중복 1건 — belie 승인 필요) · 17(후속 카드 발행 — 반장 배차) ·
  BBE-53 Linear `Done` 전환은 **Linear 미인증 세션이라 미실행**(아래 도장 규정 ⑤ 미러로 대신).
- SoR: PR #746 · `docs/plans/completed/contract-append-idempotent-flip.md` · 결정함 16·17번

> **[도장 미러 · 규정 v4.1 ⑤]** Linear 커넥터(`plugin:design:linear`)가 이 세션에서 **미인증**이라
> 카드에 직접 못 찍는다. 반장이 회수해 BBE-53 에 전사 바랍니다.
> `완주 — 데탑 C작업원C(260809) · PR #746 → 머지 b67de8a / 배포 run 31287998919 success · health 200
> (2026-08-09 16:58 KST) / 파일럿 24샘플 before-after 대조 24/24 정상(감사 run 31287774124) ·
> check.sh 초록 / 잔여 위험 2건 = worklog 결정함 16·17번`
> ※ 접수 도장도 Linear 에 없을 수 있다(구 몸이 미인증이었다면). 상태가 `In Progress` 인데 접수
> 코멘트가 없다면 규정 ⑥ 적발 대상이 아니라 **미인증 세션 사유**이니 함께 정정 바랍니다.
### 2026-08-09 · 데탑 C작업원A(260809) · 트랙 A 승계 + BBE-56 PR #743 리베이스 — 게이트 ON 은 백필 후로 유보
- 의도: 세션 통일 이관(belie 지시). 구 몸 `작업원A(260805)`(창 제목 "경영일지 작업원A") 종료 →
  새 몸 `데탑 C작업원A(260809)` 가 트랙 A 를 인수. **구역 소유권은 트랙 귀속 → 재선언 불필요**(§트랙·세션 규칙).
- 접수 도장 (규정 v4.1 ⑤ — 이 세션 Linear 미인증이라 worklog 미러, 반장 전사 요망):
  `접수 — 데탑 C작업원A(260809) · 2026-08-09 / 브랜치 feat/registry-db-read · base b67de8a · lane:registry
  / 범위 = BBE-56 PR #743 인수·리베이스·백필 후 게이트 검증(신규 구현 없음, 재작업 금지)`
- 승계 실측(재작업 방지): PR [#743](https://github.com/bbelieff/salespt-log/pull/743) **OPEN·CI green**
  (`31287521205` check pass + GitGuardian pass), 워크트리 `wt/bbe56-registry-read-flip` clean.
  구 몸의 산출물은 **그대로 인수** — 어댑터·게이트·폴백을 다시 만들지 않는다.
- 한 것: master 3커밋 뒤처짐 해소 — `origin/master=b67de8a` 위로 리베이스(충돌 0) → `e0de6d1`,
  로컬 `npm run check` 초록(typecheck·lint·structural 25·unit **1104**·doc-drift) 후 force-with-lease 푸시.
- 실측(전제 확인): BBE-85 는 #742 로 머지·마이그레이션 0001·0002 적용 완료(run 31287208990).
  그러나 **레지스트리 백필 실행 수단은 여전히 0건** — `git grep backfill-registry origin/master -- .github/`
  0건(2026-08-09 재실측), `db-backfill.yml` 은 `backfill-sheet-rows.mjs`(sheet_rows) 전용이라 users·cohorts
  와 무관. 즉 **BBE-91 미해소** → `REGISTRY_DB_READ=1` 를 켜도 0행 폴백으로 시트에 머문다.
- 결정(자율·§0.7): **게이트 ON 금지 유지.** 백필 완료 신호(행수 대조 수치) 전에는 flip 의 의미가 없고,
  0행 폴백이 없었다면 전 사용자 로그인 불가가 될 자리다. 되돌리기 = env 한 줄 제거(재배포 불요).
- 다음: ① 반장의 백필 실행 결과 회수(users·cohorts 행수) ② 그 후 게이트 ON 라이브 검증
  (로그인·클레임·admin 목록 + 응답시간 전/후 = 현재 미달인 수용 기준②) ③ 머지는 반장 직렬 판정.
- SoR: PR #743 · Linear BBE-56 · BBE-91 · `docs/plans/active/sheet-retirement-r7.md`

### 2026-08-09 · 작업원A(260805) · BBE-56 레지스트리 읽기 DB 전환 PR 오픈 — 기본 OFF 게이트 + 0행 폴백, 후속 갭 BBE-91 발행
- 의도: R7 임계경로(ADR→스키마→이중기록→**읽기전환**). belie 지시 = "BBE-85 결과 확인하고 시작해라"
  (미확인 상태로 뒤집으면 빈 테이블을 읽는다).
- 선행조건 실측: 착수 시점 **BBE-85 는 처리 중이 아니었다** — status=Backlog·`startedAt=null`·
  코멘트 0건·`git grep "db:migrate" origin/master -- .github/` **0건**. 그래서 읽기를 뒤집지 않고
  **스위치만 만드는** 방향으로 진행(멈추지 않되 위험도 만들지 않음).
- 한 것: PR [#743](https://github.com/bbelieff/salespt-log/pull/743)(CI green) — DB 를 **시트와 같은 모양
  (열 순서 배열)** 으로 돌려주는 어댑터(`lib/repo/db/registry-read.ts`)를 초크포인트 2곳에만 연결
  (`cachedRegistryRows` users A~T · `cachedCohortsRows` cohorts A~J). 카드가 나열한
  `findUserByEmail`·`listDistinctUsers`·`listCohorts`·`listArenaParticipants` 는 전부 이 둘의 파생이라
  자동 전환되고 `parseRow`·`pickPreferredUser`·정렬은 **한 줄도 안 바뀐다**(장애 반경 최소화).
- 게이트: `REGISTRY_DB_READ=1` 없으면 시트 그대로 = 동작 변화 0(BBE-57 `course-dates.ts:31` 패턴 계승).
  **롤백 = env 한 줄 제거**(재배포 불요).
- 안전장치: DB **오류**뿐 아니라 **0행**에서도 시트로 폴백. "레지스트리 0명"은 정상일 수 없으므로
  이상 신호로 취급 — belie 가 경고한 "빈 테이블을 읽는" 실패 모드를 코드로 차단.
- 작업 중 변동: BBE-85 가 #742 로 머지됨 → DB Migrate run [31287208990](https://github.com/bbelieff/salespt-log/actions/runs/31287208990)
  에서 **0001·0002 실제 적용 완료 확인**(dry-run 표식 `실행 안 함` 0건 + `✅ 적용 완료` 2건).
- 🔎 후속 갭 발견 → **BBE-91 발행**: `scripts/ops/backfill-registry.mjs` 를 돌리는 워크플로가 없다
  (`git grep backfill-registry -- .github/` 0건). BBE-85 와 **같은 유형**(스크립트는 있는데 실행 수단
  부재) — 테이블이 비어 있어 지금 플래그를 켜도 0행 폴백으로 시트에 머문다. R7 임계경로가 여기서
  조용히 멈출 자리라 카드로 박아뒀다(BBE-91 → BBE-56 blocks 연결).
- 수용 기준: ①전 경로 동작 동일 ✅(게이트 OFF 기본값) ②**응답시간 전/후 수치 = 미제시**(테이블이 비어
  측정 불가 — 미달로 남긴다) ③복귀 스위치 ✅(OFF·오류·0행 3경로 테스트 고정).
- 검증: check.sh 초록(structural 25·unit **1104**) + CI success. 신규 테스트 12건.
  `users.ts` 500줄 캡 초과 → `users-rows.ts` 무변경 분리.
- 한계: 게이트 ON 라이브 미검증. 행 순서 — 시트는 행번호 순, DB 는 `created_at, cohort, name, email`
  순이라 `pickPreferredUser` 의 **동일 우선순위 내 tie-break** 가 달라질 수 있다(결정적 정렬로 고정).
- 다음: BBE-91(backfill 실행 수단) → 그 다음에야 `REGISTRY_DB_READ=1` flip 이 의미를 갖는다.
  ⚠️ **머지 보류** — 아레나2 복구 + 개막 이후 반장 판정(§3.5).
- SoR: PR #743 · Linear BBE-56 · BBE-91.

### 2026-08-08 · 경영일지 작업반장(FM·260804) · 머지 대기열 6건 판정 — 3머지·3차단, diff-0 실증 미달
- 의도: belie 지시 "PR 6건(#738·#740·#736·#737·#734·#708) 순차 판정·머지, §6.8 배포 관찰 포함".
  카드 전제는 "전부 구현·테스트 완료, 머지만 대기"였으나 **실측은 달랐다**.
- 한 것: PR 별 적대심사 + 고위험 지적 반증검증(Workflow 13에이전트).
  **머지 3건** — #738(`18b14f5`)·#740(`856bb01`)·#708(`e5cf0c1`), 셋 다 배포 success·health 200.
  **차단 3건** — #736·#737(CRITICAL 확정: 마이그레이션이 배포에 없는데 쓰기 경로가 catch 밖 →
  시트 폴백 불가. 캘린더 연결해제 고착·삭제 불가 고아 이벤트) · #734(HIGH 실증 확정:
  `meetingToRow` apostrophe 가 `carryover.ts:92-96` 에서 무가공으로 jsonb 직행 → 이월 미팅 텍스트
  오염 + 업체정보 커스텀 무음 소실, revert 로 복구 불가). 각 PR 에 해결방향 코멘트.
  #740 은 #738 머지 후 리베이스(충돌 2건 — worklog §3.5 양쪽 보존, `users-cache-migrate.ts` import 2개
  실사용 확인 후 양쪽 보존) + check.sh 재통과.
- 결정(자율·§0.7): **`db:migrate`·`backfill --execute` 미실행** — 비가역이라 §0.7 화이트리스트①.
  현재 `0001`·`0002` 둘 다 운영 DB 미적용 상태. #738 은 미러가 fire-and-forget 이라 무해(사용자 영향 0).
  #740 은 읽기/쓰기 게이트 둘 다 기본 OFF(`course-dates.ts:31,43`) 확인 후 머지.
- 🔎 **diff-0 실증 = 미달**(BBE-66 수용 기준): run `31267667665` — 파일럿 105명 중 **diff 0 = 74,
  불일치 31, 총 diff 55**. A2 27/53(51%) 집중, **8·9기 0/12(완전 일치)**. `계약` 컬럼 35건 중
  **32건이 `sheet=0, db>0`** → DB 이월행에 `AO='이월'` 미기록 가설(BBE-65 와 같은 영역).
  B21(BBE-66 지표)은 1건만 불일치(550,000 — BBE-42 카나리아와 같은 금액, **가설이며 미확정**).
  실행 수단이 없어 `db-audit.yml` 에 `dashboard-parity` 추가(이 PR).
- ⚠️ 사고: 배포 1회 실패(run `31266071834`) — 코드 문제 아님, **BBE-77 SSH 차단 재발**
  (16:16:12~16:25:42Z 12회 전부 timeout, 배포 미시작 → 롤백 불필요). rerun 1회로 복구.
  차단 전후 성공 기록이 있어 auth.log 대조 창이 분 단위로 특정됨 → BBE-77 에 기록.
- ⚠️ 자기오류: BBE-77 에 "재시도 예산 미적용" 이라고 썼는데 **7커밋 뒤처진 로컬 워크트리에 grep**
  한 결과였다(실제 `deploy.yml` 은 이미 12회). §0.8 "로컬본은 낡을 수 있다" 위반 — 카드에 정정.
- 다음: ① #736·#737·#734 담당 세션이 수정 → 재심사 ② A2 이월 깃발 실측 → `repair-carryover-flag.mjs`
  적용 판단 → 재대조(BBE-65 와 묶어서) ③ `deploy.yml` 마이그레이션 단계 = belie 판단 대기
- SoR: Linear BBE-42(대기열 판정)·BBE-66(diff-0 결과)·BBE-77(SSH 재발)·BBE-57 · PR #741

### 2026-08-08 · 작업원A(260805) · BBE-55 레지스트리 이중기록 + backfill PR 오픈 — BBE-54 자연키 실측 반증·교정 동반
- 의도: R7 임계경로(ADR→스키마→**이중기록**→읽기전환). 시트 정본 유지, DB 는 fire-and-forget
  미러(R2 패턴). 읽기 전환은 이 카드 아님 → 동작 변화 0.
- 한 것: PR [#738](https://github.com/bbelieff/salespt-log/pull/738)(CI green) — 쓰기 경로 전수 배선
  (`updateUserCell` 단일 초크포인트가 ~10곳 커버 + claim 3분기·prep 2분기(Q메모)·sort(M+append)·
  arena(R 회장·F archived)·cache-migrate(I~L)·delete(행삭제)·cohorts 4곳). `appendArenaRoster` 는
  레지스트리 아닌 별도 명단 시트라 제외. `scripts/ops/backfill-registry.mjs`(dry-run 기본) 신규.
- 🔎 **BBE-54 자연키가 실측에서 반증됨**: `(email,cohort)` 로는 **145행 중 54행 유실**. 근인 ①prep 행
  (admin 사전등록)은 email 이 빈 문자열(실측 67행) — 같은 기수 prep 이 한 키로 뭉개짐 ②멀티계정 per
  시트라 `(cohort,name)` 단독도 불가. → `(email,cohort,name)` 교정(0002 forward 마이그레이션, 적용된
  0001 무수정). 145행→143키, 차이 2건은 6컬럼 완전동일한 **실제 중복 행**(dedupKeepIndex 정리 대상).
- 적대검증 반영(BLOCKER 1·HIGH 1·MED 3): **email 대소문자 split-brain**(호출부마다 소문자화/원본이
  섞여 같은 행이 두 키로 갈라지고, backfill 이 upsert 전용이라 유령을 영원히 못 지움) → 정규화를
  **SQL 경계 단일 지점**에 배치해 구조적 차단. 그 외 trim 비대칭·role/status 발산·동기 throw 누출
  (성공한 시트 쓰기가 500 으로 되돌아감)·rekey 반쪽 적용을 각각 수정 + 회귀테스트.
- 결정(자율·§0.7): 스키마 제약 교정을 이 카드에서 동반 처리 — 안 고치면 backfill 자체가 성립 불가
  (수용 기준 "행수 일치"가 원천 불가능). 되돌리기 = 역방향 마이그레이션 신규 추가.
- 검증: check.sh 초록(typecheck·lint·structural 25·unit **1053**·doc-drift) + CI success. 신규 테스트 25건.
  라이브 dry-run 실측(users 145·cohorts 13). `users.ts` 500줄 캡 초과 → `users-sheet-lookup.ts` 무변경 분리.
- 한계(검증 안 함): **실제 Postgres 미실행**(이 PC 에 DATABASE_URL 없음) — 0002 마이그레이션과
  `--execute` 는 VPS 에서 `npm run db:migrate` → `backfill-registry.mjs --execute` 순 검증 필요.
  라이브 클레임 1건 왕복 재현도 미실행.
- 다음: BBE-56(읽기 전환)이 이 위에 얹힌다. ⚠️ **머지 보류** — belie 지시: 아레나2 복구 + 개막 이후
  반장 판정(§3.5 직렬 머지).
- SoR: PR #738 · Linear BBE-55 · `docs/plans/active/sheet-retirement-r7.md`.

### 2026-08-08 · 작업원B(260806) · BBE-57 구현 완료, PR 오픈 준비 — 수강기간(O1/O2) DB 배선, R7 Phase 1
- 의도: BBE-64 로 이미 파악한 `lib/service/me.ts`·`lib/repo/sales.ts` 표면의 연속 작업. 수강시작일·
  종강총회일(시트 O1/O2)의 정본을 Postgres `users`로 이전 — D-day·주차·퍼널 통계 전부가 이 값에 의존.
- §0.8 Gather 로 티켓 전제 2건을 실측 반증: ①`course_start_iso`/`graduation_iso` 컬럼은 BBE-54
  (PR #722, 0001_users_cohorts.sql)에 **이미 존재**하나 100% 미배선(grep 재확인) → **새 마이그레이션
  파일 불필요**, BBE-55 WIP(`0002_users_natural_key.sql`)와 번호 충돌 자체가 안 생김. ②`users` 테이블은
  현재 0행(`lib/repo/db/registry.ts`= BBE-55 WIP 전용, master 엔 없음) → 쓰기 배선은 UPDATE-only
  설계(INSERT 없음, `WHERE email=$1 AND cohort=$2`)로 BBE-55 의 자연키 변경(email,cohort)→(email,cohort,name)
  과 완전 독립 — 머지 순서 무관하게 안전.
- 한 것: `lib/repo/db/course-dates.ts`(신규, read/write/전역게이트) · `lib/repo/sales.ts`(DB우선→시트폴백,
  기존 파싱로직 `*FromSheet` 로 이름만 이동) · `lib/service/auth.ts`(claimAccount 에 best-effort 쓰기) ·
  `lib/repo/users-cache-migrate.ts`(🔄동기화 백필 루프 재사용). 신규 유닛테스트 4파일 32건(no-op 불변
  회귀·UPDATE-only 회귀·2/53 파싱실패 마스킹안됨 회귀 포함). check.sh 초록(1060 단위+25).
- 결정(자율, §0.7): 읽기 게이트 = 전역 env `COURSE_DATE_DB_READ=1`(기본 OFF) — sheet_rows 레벨(기수
  allowlist)과 다른 모델, "카나리아 필수" 지시를 문자 그대로 반영. "2/53 파싱실패" 수치는 이 PR 에서
  재검증 안 함 — 기존 `migrateRegistryCache()`(🔄동기화)의 `failed[]` 가 이미 그 정보를 수집하므로
  버튼 1회 실행으로 최신 수치 확인 가능(별도 스크립트 불필요, YAGNI).
- 다음: 적대적 리뷰(Agent 2렌즈 병렬, ultracode OFF 라 Workflow 대신 직접 Agent 호출) 진행 중 →
  결과 반영 → draft PR 오픈. 머지는 반장 판정 대기.
- SoR: `docs/plans/active/course-dates-db.md`

### 2026-08-08 · 경영일지 노트북 C작업반장(260806) · BBE-83 완주 — 03 DB관리 비용도 개강일 기준 이월 분할
- 의도: belie 직접 지적(BBE-42 카나리아 실측 중) — "매출은 이월매출로 뺐는데, 왜 비용은 이월이 안돼?
  이건 잘못된거같은데" → 조사 후 belie 지시 "8/7이전 비용 이월시켜줘".
- 근인: 매출(`splitContractRevenue`)은 계약일<개강일이면 자동 이월 분류가 있는데, 03 DB관리(매입DB/
  직접생산/현수막) 비용(`readSection`)은 날짜 필터가 아예 없어 탭 전체를 무조건 합산 — 실측(손기학
  A2-4기) 개강 1일차·활동 0인데도 개강 전 비용 909,104가 시즌비용으로 잡혀 영업이익 -909,104.
- 한 것: `splitDbCost(rows, courseStartISO)`로 매출과 동일한 단일 결정점(date<courseStartISO) 적용.
  `lib/service/dashboard.ts` 553줄로 500줄 캡 위반 발견 → `dashboard-cost-carryover.ts`·
  `dashboard-shadow-compare.ts` 2개로 분리(로직 무변경)해 해결. 4-lens 어드버서리얼 리뷰가 BLOCKER+HIGH
  1건(2개 lens 독립 합치) 적발 — 직접생산 날짜기준이 최초 종료일 우선이었는데 `ADR-0022 §3`("비용은
  시작 시 반영")과 반대라 개강 전 시작·개강 후 완료 건이 시즌비용으로 오분류될 뻔함(이 PR이 고치려던
  것과 같은 종류의 버그) → 시작일 단일 기준으로 정정, 경계교차 테스트 추가. PR
  [#733](https://github.com/bbelieff/salespt-log/pull/733) 머지(squash `7516ae6`) · 배포 run
  [31252481548](https://github.com/bbelieff/salespt-log/actions/runs/31252481548) success · health 200.
  check.sh 전체 초록(unit/integration 1028, 신규 8건 포함).
- 검증: 읽기 전용 VPS SSH로 프로덕션 Postgres 직접 조회 — 손기학 A2-4기 매입DB 2행(구매일 2026-06-19,
  총 909,104 — 원 사고 수치와 일치) 모두 개강일(2026-08-07) 이전 확인, 직접생산·현수막은 실행 0건.
  대시보드 UI 자체(3줄 렌더링)는 admin impersonation 로그인이 필요해 생략(자격증명 입력 회피).
- 결정(자율·§0.7): `DashboardAdditionalCost.dbCostTotal`(진행바·비용원장 다이얼로그)이 시즌분만으로
  조용히 스코프가 바뀐 점은 리뷰가 지적했으나, `OperatingProfitCard` 3줄 표시만 의도적으로 한정한
  기존 belie 결정 범위 내라 재확인 없이 타입 주석으로 스코프만 명시.
- 다음: 없음(완주). 후속 정리가 필요하면 expense-ledger 쪽 pre-season 인식제외 합계 별도 노출은 선택.
- SoR: Linear BBE-83(Done), `docs/plans/completed/dashboard-cost-carryover.md`.

### 2026-08-08 · 작업원A(260805) · 🚨 BBE-82 완주 — flip-emails 미실행 15명(오승진 포함) + 정규식 사각지대 2명 추가 발견·수리
- 의도: belie 직접 지시 — 카드가 지목한 15명(로그인 시 구/졸업 시트로 계속 연결) 대상
  `gh workflow run "Arena Season2 Batch" -f mode=flip-emails` 실행 → 15명 전원 이관 확인.
- 한 것: ①공식 워크플로우 run [31251912614](https://github.com/bbelieff/salespt-log/actions/runs/31251912614)
  success — 결과 **이관 0·건너뜀 55**, 13명은 카드 작성 이후 이미 다른 시점에 정상 이관 완료 상태였음
  (레지스트리 재조회로 검증) ②나머지 2명(이장현·황정환)을 직접 조사 — `targets()`
  (`scripts/ops/arena-season2-batch.mjs:127-128`) 정규식이 `A1-\d+`/`7·8기`만 잡고 카드상
  "구 기수=6"(plain numeric, A1- 접두어 없음)은 애초에 스캔 대상에서 빠지는 **구조적 사각지대**
  발견 — 두 사람 모두 registry 행 3개(numeric"6"·A1-6·A2-6기) 보유, numeric"6" 행 O1/O2=
  4/10~**6/6**(2개월 전 종강)에 살아있는 email, A1-6·A2-6기는 둘 다 비어있음 → 지금 로그인하면
  카드가 설명한 것보다 더 심함(구기수가 아니라 두 시즌 전 시트로 연결). 정규식은 안 넓힘(1~10
  다른 기수 전체 영향·동명이인 실데이터 오손 위험) — 이 2명·2쌍 행에만 flipEmails()와 동일한
  단일셀 RAW 이관을 수동 적용(dry-run 확인 후 실행) ③최종 재조회로 15/15 전원 검증(A2 행 email
  있음 + 다른 행 email 없음).
- 한계: 오승진(문보혜) 실제 로그인 재현 미실행(세션에 학생 계정 인증 수단 없음, BBE-81 완주 때와
  동일 한계) — belie/실사용자 확인 필요.
- 결정(자율·§0.7): 레지스트리 실데이터 이동이지만 가역(단일 email 필드 이동, rollback-emails
  패턴과 동형) + belie 가 명시적으로 지시한 작업 범위 내라 블로킹 질문 없이 즉시 실행.
- 다음: `targets()` 정규식의 구조적 사각지대(plain numeric cohort 미포함)는 이번엔 범위를 좁혀
  수동 수리했지만, 향후 유사 사각지대 재발 방지가 필요하면 별도 카드로 검토.
- SoR: Linear BBE-82(Done), run 31251912614.

### 2026-08-07 · 경영일지 노트북 C작업원A(260807) · 🚨 BBE-81 P0 완주 — 미팅예약 날짜 달력 클릭 무반응 수리
- 의도: belie(Cowork 경유) 지시 — 컨택관리 미팅예약 날짜박스 클릭 시 전 수강생 무반응(개강일 핵심 기능). 카드가 1줄 diff(onClick 가드 제거)를 지정.
- 진단 정정: 착수 전 실측 중 로컬 메인 체크아웃이 origin/master보다 수십 커밋 뒤처짐을 발견(HEAD `2f94120` vs 실제 `1c58676`) — `git show origin/master:`로 재확인해 카드 진단이 정확함을 확인. 지정된 1줄 diff는 `#654`(label 재전달 이중호출 방지)가 막은 버그를 재발시킬 위험이 있어 채택 대신 `pointer-events:none`으로 클릭 경로를 JS 하나로 구조적으로 단일화(`#654`/`#656` 가드·크기 계약은 보존).
- 한 것: PR [#730](https://github.com/bbelieff/salespt-log/pull/730) 머지(`6fd6e89`) · 배포 run [31164512502](https://github.com/bbelieff/salespt-log/actions/runs/31164512502) success · health 200 · 배포 SHA=머지 SHA 일치 확인. 회귀테스트 2건 추가, 기존 5건 무수정 통과. `docs/design/components.md` §2 SSOT 갱신(0×0 stale 표기 정정).
- 한계: 실제 컨택관리 화면 클릭 라이브 검증은 로그인 권한 없어 미실행 — belie/라이브 세션에 이관(BBE-81 완주 코멘트에 명시).
- SoR: Linear BBE-81, PR #730

### 2026-08-06 · Claude Code(직접 디스패치) · db-parity.ts countUserSheet 판정 기준 backfill 과 일치 — PR #728 머지, 배포는 VPS SSH 장애로 대기
- 의도: belie 가 A2 db-parity 대조 중 `lib/service/db-parity.ts`(`/admin/db-parity` 서비스)의
  contracts·sales 유효 행 판정이 `scripts/ops/backfill-sheet-rows.mjs` 와 다르다고 직접 발견·요청.
  PR #724 커밋 메시지에도 "db-parity.ts 자체의 이 오차는 별건 — 이 PR 범위 밖"이라 명시된 잔여.
- 한 것: `wt/fix-db-parity-backfill-criteria`(워크트리 격리) 에서 contracts(`firstDataRow` 신형6/
  구형5 — `SHEET_RANGES.contractPayment` SSOT 재사용)·sales(O1 `readCourseStart` 파싱 게이트 +
  10주×7일×4채널 stride) 를 backfill 과 동일 판정으로 교체. check.sh green(1012 unit+25 structural).
  검증은 VPS SSH 장애로 admin 페이지 라이브 접근 불가 → 로컬 SA 크리덴셜로 cohort=8(7개 시트) 대상
  OLD/NEW 대조 CLI(레포 밖 스크래치)로 대체: contracts OLD=45→**NEW=44**(backfill dry-run 44 와
  재현 2회 일치), sales OLD=562→**NEW=409**. 부수 발견 — backfill dry-run 자체가 읽기 재시도가
  없어 실행마다 결과가 들쭉날쭉함을 확인(1회차 253·2회차 399, 두 실행의 성공분 합=정확히 409) →
  후속 카드 발급했으나 **착수 전에 이미 PR #727(fix(ops): backfill-sheet-rows grid() 읽기 실패 시
  재시도+가시화)로 다른 세션이 해소** — 발급 직후 확인해 중복 철회.
  **PR #728**(`37bb537`) CI green 후 머지(`gh pr merge --squash`). 배포 run `31071933896` 관찰 —
  Setup SSH·시크릿 주입 성공했으나 "Deploy on VPS" 단계에서 `ssh: connect to host *** port 22:
  Connection timed out` 7/7 rc=255 재시도 전부 실패 → §6.8 "Setup SSH 단계 실패(VPS 도달성 지속
  장애)" 분기(코드 문제 아님, build/health 단계 진입 전이라 롤백 대상 아님). 공개 health
  `https://salesptlog.online` 는 200 유지(무변경 확인, 이번 배포가 프로덕션에 닿지 않았으므로 당연).
  FM 보드의 기존 "VPS SSH 완전장애(19:10, BBE-75 에스컬레이션)" 와 **동일 장애**로 판단(재시도 무의미
  수준이라는 FM 판단과 일치) — 신규 인시던트로 별도 기록하지 않음.
- 결정: 롤백하지 않음(코드 문제 없음, health 미도달). VPS 복구 후 `gh run rerun 31071933896
  --failed` 또는 다음 master push 로 자동 재배포되면 그때 health 200 확인 필요(belie 또는 후속
  세션이 이어받을 것).
- 다음: ① VPS SSH 복구 확인되면 배포 재시도 + health 200 확인 ② `/admin/db-parity?cohort=8`
  라이브 페이지에서 dbCount 까지 포함한 전체 대조(로컬은 DATABASE_URL 없어 sheetCount 만 검증됨).
- SoR: `docs/plans/completed/fix-db-parity-backfill-criteria.md`, PR #728, 배포 run `31071933896`.

### 2026-08-06 · 작업원A(260805) · BBE-54 users·cohorts Postgres 스키마 + 마이그레이션 러너 PR 오픈, 머지는 반장 판정 대기
- 의도: R7 Phase 1 임계경로 병목 카드. "쓰기·읽기 전환은 이 카드가 아니다, 동작 변화 0" 제약 하에
  버전드 마이그레이션 러너 + `users`/`cohorts` 스키마 도입.
- 한 것: ①`lib/repo/db/migrations/0001_users_cohorts.sql` — `users`(현 레지스트리 A~T 전량 매핑,
  gcal S/T는 BBE-58 분리 예정이라 자리만)·`cohorts` DDL ②`scripts/db-migrate.mjs`(+`.d.mts`) —
  advisory lock 직렬화·체크섬 드리프트 감지 마이그레이션 러너, `expense_schema_migrations` 기존
  패턴을 일반화(새 의존성 0, YAGNI) ③`tests/repo/db-migrate.test.ts` 6건 ④`package.json`에
  `db:migrate` 스크립트 1줄 추가(그 외 무변경, 적대검증으로 diff 확인).
- 결정(자율·§0.7): D2(아레나 라벨 통합) 미결이 스키마를 막지 않는다고 판단 — `users`를 "사람"이
  아니라 "등록(email×cohort)" 단위 행으로 설계(현재 시트가 실제로 아레나 재참가자에게 최대 3행을
  동시에 허용 중, `lib/repo/user-priority.ts:pickPreferredUser` 실측). 자연키 = `(email, cohort)`
  UNIQUE, email 단독 UNIQUE 안 걺. canonical-person 병합은 추후 서비스 레이어로 이연 — 스키마
  재변경 불필요. PK = uuid(앱 생성) — `expense-ledger.ts` 최신 관례 따름.
- 검증: ultracode 4-agent 리서치 + 3-agent 적대검증(차단급 결함 0) · check.sh 전체 그린
  (typecheck/lint/structural/unit 1018/doc-drift) · CI 그린.
- 다음: BBE-55/56(읽기·쓰기 배선)이 이 위에 얹힌다. ⚠️ PR **의도적으로 머지 보류** — belie 지시:
  아레나2 복구 완료 후 반장 판정(§3.5 직렬 머지).
- SoR: PR #722 · `docs/plans/active/sheet-retirement-r7.md` §2-E·§3 · Linear BBE-54.

### 2026-08-06 · 작업원A(260805) · BBE-79 신규 발행+수리 — DB생산 채널간 행번호 충돌(BBE-38 발굴) PR 오픈, 머지는 반장 판정 대기
- 의도: belie "발굴로 끝내지 말고 수리까지 가져가라" — BBE-38에서 찾은 채널 탭 전환 시 데이터
  오손 위험 버그를 실제로 수리. §0.8 5단계 그대로 적용.
- 한 것: ①PATCH 경로 재확인 — `page.tsx:handleSave`가 항상 현재 `activeCh`를 싣고(클로저 최신
  state), 서버(`app/api/db/[channel]/[row]/route.ts`)도 URL channel 로 올바르게 스코프 — 미스코프
  아님을 실측 확인, "반쪽 수리" 우려 해소 ②`_lib/channels.ts`에 `dbRowKey(chKey, row)` 추가 +
  `RowList.tsx` key를 채널 포함 유일값으로(React key 변경=전체 리마운트=draft 신선 초기화로
  근본 해소) ③회귀 테스트 3건(`tests/service/db-row-key.test.ts`) ④서브에이전트 적대검증 —
  `expandedRow`/`pendingRow`(채널 미스코프 잔존)는 UI 표시 전용이라 데이터 오손 아님 확인,
  부수 발견 2건(`autoExpandedCh` 재방문 UX·`confirmTarget` 채널 미저장)은 범위 밖으로 판단.
- 결정(자율·§0.7): `lib/repo/db.ts` append/row_key 구조 미접촉(R7-#10/BBE-59 예정 구역, 미착수) —
  이 PR은 읽기 경로(React key)만.
- 다음: PR #718 오픈·check.sh 초록·CI 초록 — **머지는 보류**(belie 지시: 아레나2 복구 완료 후,
  직렬 머지 §3.5). 반장 판정 대기.
- SoR: Linear BBE-79 · PR #718

### 2026-08-06 · FM(260804) · A2 근인 해소·55/55 복사 성공 → registry 열밀림 2차 사고 발견·수정 → VPS SSH 완전장애로 복구 중단
- 의도: belie 콘솔 확인으로 A2 병목 근인(목적지 폴더 소유권=leadbzcenter, link-only 공유) 확정 +
  belie 본인 접근권한 부여 완료 → "카나리아 즉시 재실행 → all → 백필" 지시 수령, 즉시 실행.
- 한 것 ①: 카나리아(손기학) 성공 → 전체 55명 배치 실행. 1차 시도 VPS SSH 7/7 실패(§6.8 인프라) →
  즉시 rerun → **완료 53 · 건너뜀 2 · 실패 0**(run 31027450675). 시트 55/55 실제 생성 확인.
- 한 것 ②: `--plan` 재확인 시 "이미 생성 0" — 방금 만든 54개 A2 행이 registry 에서 안 보이는 2차
  사고 발견. `--dump-tail`(2회 수정) → `--diag-append`(append 직후 즉시 read 왕복 검증)로 근인 확정:
  `appendA2Row` 의 `values.append(range:"users!A:T")` 가 Sheets 의 테이블 자동탐지에 의존하는데,
  users 탭에 열 38개(AL)짜리 구 테이블 흔적이 있어 **매번 S~AL 열로 밀려 붙었다**(A~T 아님). 즉
  54명분 데이터가 물리적으로 존재하지만 `loadRegistry()`(A~T 만 읽음)엔 안 보였다.
- 한 것 ③: **수정**(PR #712) — `appendA2Row` 를 registry 다음 빈 행을 직접 계산해 `values.update`
  로 명시적 A~T 범위에 쓰도록 교체(append 의 테이블 자동탐지 제거). **복구 도구** `--repair-shifted`
  (기본 dry-run, `--execute` 로 실행) 추가 — S~AL 20열 슬라이스는 원래 A~T 값과 1:1 대응이라
  그대로 옮겨쓰고 S~AL 은 클리어. dry-run 확인(53건 전부 실제 학생명·기수 일치) 후 실행 →
  **33건 복구 성공**(row99~131) → Google Sheets **쓰기 quota(분당 제한) 초과로 중단**(row132부터).
- 한 것 ④: quota 재시도 시점부터 **VPS SSH 가 연속 4회 7/7(rc=255) 완전실패**(18:29~19:10, 10분
  쿨다운 재시도 포함). 같은 구간 `deploy.yml`(별개 워크플로, 마지막 성공 18:31:32)은 정상 — 자체
  유발 rate-limit 가설을 세웠으나 10분 대기 후에도 재현 안 됨 → 순수 반복재시도로 회복 안 되는 수준
  판단, BBE-75 에 에스컬레이션.
- 다음(재개 시 그대로 실행): `gh workflow run "Arena Season2 Batch" -f mode=repair-shifted-execute`
  (잔여 20건, 멱등이라 완료분 자동 스킵) → `--plan` 으로 55/55 확인 → DB 백필(BBE-50, 아직 미실행 —
  Done 오표기였던 건 이미 원복 완료) → 카나리아 로그인 실측 + `/admin/db-parity` 대조.
- 결정: 이 사고는 **애초에 근인 진단이 놓친 게 아니라 근인 해소 직후 새로 드러난 2차 버그**였다 —
  belie 지시대로 "아직 안 해본 조치가 남은 상태에서 차선책으로 못 넘어간다"에 따라 차선책(개강일만
  공지) 전환 없이 정상 경로 복구를 계속한다. VPS SSH 인프라 상태는 FM 권한 밖 — belie 직접 확인 요청.
- SoR: `scripts/ops/arena-season2-batch.mjs`(#712), Linear BBE-42·BBE-75, 이 항목 자체가 재개 가이드
### 2026-08-06 · 작업원B(260806) · BBE-64 readProfileBundle.stats DB 대체 — 구현 완료(R7 Phase 3 #15)
- 의도: belie 지시("BBE-45 끝나면 R7 착수, 다음 카드 = BBE-64"). admin/트레이너/회장 3화면이
  공유하는 `enrichUsersWithStats` 를 파일럿 기수에 한해 DB 배치 조회로 대체 — BBE-48(수강생관리
  진입 지연) 근본 원인 제거.
- 부수 발견(첫 조치): `docs/plans/active/sheet-retirement-r7.md`(설계도 3호, Cowork 작성)가
  origin/master 에 미커밋 상태 → 별도 PR(#703 예정)로 먼저 보존.
- **Workflow 병렬 리서치**(6 에이전트: 호출체인·3화면·DB스키마·게이팅패턴·테스트컨벤션 + 설계
  합성) → 결과를 코드로 직접 재검증(ultracode 지침 — 리서치 결과를 그대로 믿지 않음):
  · **정정 1**: "계약" 통계는 `계약여부`(K, boolean) 가 아니라 **상태(J)="계약"** 이 정본 —
    `lib/repo/setup-formulas.ts` 실제 수식 설치 코드로 확정(N 열 COUNTIFS 가 J 를 직접 봄).
    meeting.ts:79 주석이 계약여부를 "동기화용 호환 필드"라 명시.
  · **정정 2**: `TERMINATED_IN_CONTRACT_COUNT` 정책은 이 통계와 무관(다른 코드 경로 전용) —
    N 열 수식에 해지 필터가 없음을 직접 확인, 잘못 적용할 뻔한 걸 리서치 단계에서 배제.
  · **독립 발견(기존 코드 갭)**: `lib/service/dashboard-aggregates.ts:weeklyContractsFromDb`
    가 이월(구분="이월") 제외 필터가 빠져 있음 — 실제 N 열 수식엔 `AO<>이월` 이 있는데 이 함수엔
    없다. 그림자 대조 전용(R2-7a, 아직 미서빙)이라 지금 당장 사용자 영향은 없지만, **회장 화면
    대상이 전원 아레나(이월이 실제 발생하는 파일럿 집단)** 라 그대로 재사용했으면 이 기능이 가장
    많이 쓰이는 화면에서 계약 수가 부풀 뻔했다. 재사용 대신 `DONE`/`CARRYOVER` 술어만 export 해
    새로 올바르게 구현 — `weeklyContractsFromDb` 자체는 이 PR 범위 밖(다른 트랙 소유, R2-7a)이라
    안 고쳤음. **별도 후속 필요 — FM/belie 인지 요청.**
- 구현: `lib/repo/db/profile-stats.ts`(신규, 배치 SQL `spreadsheet_id = ANY($1)`) +
  `lib/service/profile-stats-db.ts`(신규, 순수 집계+오케스트레이션) + `lib/service/me.ts`
  (`enrichUsersWithStats` 재작성 — 파일럿/비파일럿 분리→배치 DB 1회+기존 시트 경로 병행→
  객체 identity 기반 순서보존 병합, 문자열 키 Map 은 트레이너/admin 행 spreadsheetId="" 충돌
  위험 있어 회피) + `dashboard-aggregates.ts`(export 2개 추가만, 로직 무변경).
  **비파일럿 완전 불변** — `readBundle`/`readProfileBundle`/`pMapBundle` 코드 자체 무접촉.
- 검증: 3계층 테스트 24건(순수 집계 10·배치 SQL 7·게이팅/병합 7) + 회귀 확인(게이트 로직 제거
  시 실제로 테스트 실패 확인 후 원복). unstable_cache 가 Vitest 환경에서 결정적으로 동작 안 해
  scoreboard-cache-date.test.ts 전례대로 next/cache 목킹 추가(기존 me.test.ts 는 이 경로를
  한 번도 exercise 안 했었음 — 이번에 처음 커버). check.sh 초록(1033 테스트, 파일 전부 500줄 캡 내).
  적대적 리뷰 워크플로(3렌즈: 정합성·비파일럿 회귀·동시성/타입 + 스켑틱 검증) 실행 — **13건 제기 →
  11건 확인**. **HIGH 1건(두 렌즈 독립 확인) 즉시 수정**: `profileStatsFromDb` 가 `spreadsheetId`
  로 키 잡은 Map 을 반환했는데, 부부/멀티계정은 시트를 공유해 같은 `spreadsheetId` 를 쓰고
  (`lib/repo/users-claim.ts`) `/captain` 화면(`listArenaCohortMembers`)은 이런 중복 행을 거르지
  않아 실제 도달 가능 — 한쪽이 다른 쪽 통계로 조용히 덮어써지는 실제 버그였다(missing 아닌
  wrong). **입력 순서 배열 반환 + index 병합**으로 수정, 회귀 테스트 2건 추가(제거 시 실제 실패
  확인 후 원복). LOW 2건도 반영(`salesRowFromPayload` 에 형제 함수와 동일한 date 정규화·빈값
  필터·`Number.isFinite` 가드 추가). 나머지 LOW(DB/시트 순차실행으로 지연시간 이득 미달성 등)는
  범위 밖으로 판단·plan 문서에 사유 기록만. check.sh 재검증 초록(1038 테스트).
- 남은 위험(belie/FM 인지 필요): ①A2 백필 미완료(BBE-50 Todo 원복 상태) — 배포 시 A2 학생이
  DB 경로를 타는데 데이터가 없어 통계 0으로 조용히 틀릴 수 있음, 백필 완료 확인 후 머지 권장.
  ②위 `weeklyContractsFromDb` 이월 갭 후속 처리.
- 다음: PR 오픈 → §6.8 은 **머지 없이 PR 까지만**(belie 지시 — 관리자 화면 전체 영향이라 개막
  전후 안정화 창구 존중, `sheet-retirement-r7.md` §5 "개막 충돌" 원칙과 동일 결). 머지는 8/7 이후.
- SoR: `docs/plans/active/profile-stats-db.md`

### 2026-08-05 · 경영일지 작업원D(260805) · BBE-76 A2 병목 후보②③ 배제 + 차선책 안전성 + Plan B
- 의도: belie "작업원D 추가, 토큰 권한 해결에 기여했으면"(Cowork 발급) — A2 시트복사 0/55 병목
  근인 후보 3개 중 FM이 ①(OAuth 게시상태)을 파는 동안 D가 ②③을 병렬 배제 + belie 안내서 작성.
- 한 것: `docs/playbooks/oauth-console-check.md`(belie용 GCP 콘솔 확인 안내서, 쉬운말) +
  `docs/incidents/2026-08-05-a2-copy-permission-bottleneck.md`(② Drive저장용량 1.2%사용·③
  copyRequiresWriterPermission=false — FM whoami run `31026502670` 실측으로 둘 다 배제 확정,
  ④ daily-source.ts 게이트 차선책 코드추적 안전성 판정, ⑤ Plan B 3안 표). PR #702 → `6acdd56`
  머지, 배포 run `31028220066` success, health 200(curl 직접 확인).
- 결정: 남은 후보 = **①뿐**(②③ 실측 배제로 확정) — belie 콘솔 확인이 유일한 다음 액션.
  ④ 차선책은 "안전하나 `isArenaCohortLabel` 자체가 아니라 `isDbReadPilot` 내부만 고쳐야 한다"는
  구현 방향 경고를 함께 남김(공용 함수를 직접 고치면 로그인·dedup 로직까지 오염됨).
- **후속(같은 날 17:15 UTC) — belie 콘솔 확인 완료, 근인 확정**: ①OAuth 게시상태=**프로덕션**(원인
  아님) ②Drive 저장용량=5TB 여유(원인 아님, 위 실측과 일치) ③**진짜 근인 발견** — `copySheet()`가
  `parents` 미지정이라 원본과 같은 폴더에 사본 생성을 시도하는데, 그 **목적지 폴더**(`참가자 구글시트`
  `1L5LhWe…`·`참가자 업체관리` `16C_WfkE…`)의 소유자가 admin OAuth 계정과 다른 표기
  (`leadbzcenter@gmail.com`, belie 본인 계정 확인됨)이고 `anyone:writer` **링크공유뿐**이라 API
  쓰기가 거부됨. 기존 진단은 원본 파일 권한만 봐서 이 근인을 반나절 놓쳤다. belie가 목적지 폴더에
  `beliefkimkim` 접근권한을 직접 부여 → FM 재시도 중. 원인이 ①이 아니었으므로 belie 3/4단계
  실행은 불필요해짐(문서는 향후 유사 문제 대비 참고자료로 유지).
- 다음: FM 재시도 성공 여부 관찰. BBE-76 잔여(④⑤는 재시도 실패 대비 대비책으로 계속 유효 —
  이미 완료) + `oauth-console-check.md`에 이번 결과표·목적지 폴더 확인법 추가(후속 PR). 이어서
  BBE-52(R7 착수 · 문서 정합 수리) 착수.
- SoR: `docs/incidents/2026-08-05-a2-copy-permission-bottleneck.md`, Linear BBE-76(완주 도장 + belie 확인 코멘트)

### 2026-08-06 · 경영일지 작업원A(260805) · BBE-38(#596 재검증) — ③수리 유효 확인, ①②는 신규 경로로 재현(🚨발굴) + belie 라이브 재현 스크립트
- 의도: belie "바로 착수해" → 계약 F-596-REVERIFY-01. Ultracode 워크플로 6에이전트(증상별 스터디+적대검증)
  로 코드레벨 재검증, 이후 핵심 주장(채널간 행번호 충돌)을 제가 직접 코드로 재확인.
- 한 것: ①`lib/repo/db.ts` readPurchases/readProductions/readBanners/readLeads 전부 동일 기본
  `firstDataRow` 공유 확인 ②`RowList.tsx:59 key={r.row}`·`page.tsx`의 `<RowList>` 둘 다 채널 미스코프
  확인 → 채널 탭 전환 시 행번호가 우연히 같으면 React 가 이전 채널 폼 상태를 재사용 → 거짓dirty(①)·
  얼어붙은 이탈가드(②) 재현 + 최악시 "저장하고 이동"에서 **엉뚱한 채널 값이 PATCH** 될 위험. ③(저장
  실패시 이동강행)은 8개 근거 라인단위 재확인 + 중복PATCH 경합 1건 추가 발견(멱등이라 유실 아님) —
  반박 실패, 수리 유효.
- 결정(자율·§0.7): 코드 수정 필요 판명 시 반장에게 lease 재요청하라는 계약 조항대로, 최소수정안만
  제안(#596 코멘트)하고 직접 반영은 안 함. `lane:repo-db` 밖이라 FM 판단 필요 — belie 결정함 15번
  신설(우선순위·머지시점 판단 요청).
- 산출물: #596 GitHub 코멘트(기술상세) · Linear BBE-38 Done(검증 완료, 후속수정은 별건) · 아래 belie
  용 라이브 재현 스크립트(코드레벨로는 확정했지만 실제 로그인 세션에서의 최종 확인은 belie 몫).

**belie 용 라이브 재현 스크립트**
- **①거짓dirty**: DB생산→아무 채널에서 기존 항목 하나 펼침(손대지 않음) → +추가로 새 항목 하나
  최소입력해 저장(refetch 유발) → 펼쳐뒀던 항목이 그대로 펼쳐진 채인지 확인 → 손대지 않은 채 다른
  항목/채널로 이동 → **이탈 확인 팝업이 안 뜨면 정상**, 뜨면 재발.
- **②유령이탈가드**: 카드 펼쳐 값 하나 바꾸고 ×로 접기(뜨는 팝업에서 "무시하고 이동") → 다른 카드
  펼쳤다가 이번엔 아무 것도 안 바꾸고 곧바로 × → **또 팝업 뜨면 재발**, 조용히 접히면 정상.
- **③저장실패시 이동강행**: 개발자도구 Network 를 Offline 으로 → 필드 수정 후 "저장하고 이동" 클릭
  → **이동이 취소되고 "N건 저장 실패" 메시지가 뜨며 화면에 머물러야 정상**(입력값도 안 사라져야 함).
  직접 💾버튼도 동일하게 "저장 실패" 토스트 뜨고 카드 안 접혀야 정상.
- **④(신규, 채널충돌)**: 매입DB에서 항목 1개만 입력해 펼침 상태 → 직접생산 탭으로 전환(그 채널도
  항목 1개뿐이면 행번호가 같아 재현 잘 됨) → 아무 것도 안 건드렸는데 이탈 팝업이 뜨거나, 펼쳐진
  칸의 값이 이상하게(이전 채널 값처럼) 보이면 재발 확인.
- SoR: PR #596 코멘트 · Linear BBE-38 · docs/worklog.md 결정함 15번

### 2026-08-06 · 경영일지 작업원C(260806) · BBE-74 개막 리허설 + BBE-41 통합 완주 — launch-day-checklist.md
- 의도: belie 지시로 신규 세션 "작업원C" 개설 → BBE-74(개막 리허설) 배정, 진행 중 BBE-41(10기 온보딩
  잔여)이 같은 표면(10기 클레임 경로)이라 통합 배정됨.
- 한 것: 클레임 코드(`app/api/claim`·`lib/service/auth.ts`·`cohort-token.ts`) 전량 추적. 라이브로는
  클라이언트 검증(빈칸·1글자 이름 차단)·미인증 제출 401 안전 리다이렉트만 확인 가능했다 — **이 세션은
  구글 계정이 없어 실제 클레임 성공 케이스를 밟을 수 없었고**, 실제 학생 계정으로 시도하면 1회성 클레임을
  소진시키는 위험이 있어 하지 않았다(belie 직접 확인 권장으로 이관). 10기 학생 시트 1개(염기민)를 대표로
  열람해 시트명이 클레임 매칭 형식과 정확히 일치함을 확인. 산출물 `docs/playbooks/launch-day-checklist.md`
  (8/7 아침 5분 점검표 + 학생 안내 문구 초안 + 문제별 대응표) — PR #694·#696, 배포 success·health 200.
- 결정: 카페 hw_config·0주차 과제 연동은 별도 프로젝트(`salespt-cafe-bot`)라 이 세션 접근 불가로 확정
  — BBE-43(카페 세션) 쪽 별도 확인 필요로 이관.
- 사고(경미): 실측 중 실제 학생 구글시트를 브라우저로 직접 열람하다 "저장 안 됨" 표시가 잠깐 발생(해당
  시트가 anyone-editor 링크공유라 위험). Escape+Ctrl+Z 방어 후 제목·저장상태 원복 확인, 실제 편집은
  없었던 것으로 판단. 교훈: 실 학생 시트는 브라우저 직접조작 대신 admin impersonation이나 읽기전용
  스크립트로 확인할 것 — 체크리스트에 기록.
- 다음: BBE-74·BBE-41 둘 다 Done. belie가 launch-day-checklist.md §1.5 문구로 8/7 클레임 안내 발송,
  §1-③ 성공 케이스 1회 직접 확인 권장. 신규 배정 대기.
- SoR: `docs/playbooks/launch-day-checklist.md`, Linear BBE-74·BBE-41

### 2026-08-06 · FM(260804) · 거짓완료 2건 적발·조치(BBE-50·BBE-74) + A2 ②③ 진단 완료(①만 잔존)
- 의도: belie 지시 — "거짓 완료 2건 적발됐다. 확인하고 조치해라." 반장 임무에 **"거짓 완료 적발"**이
  신규 추가(기존 "도장 없는 착수 적발"에 더해). 병행해 A2 ②③(저장용량·copyRequiresWriterPermission)
  진단도 "배포 끝나면 이어서 실행"으로 승인받아 처리.
- 한 것 (BBE-50): Cowork(관제탑)가 16:31 에 이미 동일 건 "거짓 완료 적발" 코멘트를 남기고 반장 원복을
  요청해 둔 상태였음 — 반장이 1차 소스로 재검증(`gh run list --workflow="DB Backfill"` 최근 12건 전부
  7/14 이전=A2 대상 실행 이력 0건, `gh pr view 678 --files` = 전량 docs+stdout 안내문 추가뿐, 실행 코드
  없음) 후 **Done → Todo 원복 + 사유 코멘트 게시**(재완료 조건 = 적재행수·카나리아 확인·db-parity 3건
  실측 없이는 Done 재처리 금지, 카드 본문 명시).
- 한 것 (BBE-74): `docs/playbooks/launch-day-checklist.md` **실제 커밋 확인됨**(PR #694→#696, 8/7 아침
  체크순서·문구별 대응표까지 구체적 — belie 가 그대로 쓸 수 있는 수준). 카드 수용기준 핵심인 "10기
  클레임 왕복 라이브 실측"은 PR 본문 스스로 미달성 자백, 관제탑 16:32 완주 도장 요구에 **Linear
  코멘트 응답은 없어** Linear 코멘트로 작업원C 재요구를 게시했다. **정정(직후 발견)**: 당시 로컬
  워크트리가 origin/master 에서 뒤처져 있어 `docs/worklog.md`에서 "BBE-74 0건"으로 오판했다 —
  실제로는 작업원C가 같은 시각(#698) **워크로그에 상세 기록**을 남겨 뒀다(라이브 클레임 미검증
  자백·실 학생 시트 실수 인시던트·카페 연동 이관까지 투명하게 기술). 즉 증거 자체는 존재하되
  Linear 완주 도장 형식(§6.8)으로 관제탑 요구에 직접 응답하지 않은 것 — "증거 없음"이 아니라
  "증거가 다른 채널(워크로그)에만 있음"으로 판단을 하향 조정. Linear 에 후속 정정 코멘트 게시 예정.
  산출물이 실재해 BBE-50 처럼 전면 원복은 과함, 상태 유지.
- 한 것 (A2 ②③): `arena-season2-batch.yml --whoami` 재실행(run 31026502670, success) — 저장용량
  1.2%(여유), `copyRequiresWriterPermission:false`, 샘플 파일 소유자=admin 본인. **둘 다 원인 아님** →
  ①(GCP 콘솔 게시상태)만 유일하게 남은 설명으로 확정. 결정함 3-b·직전 로그 항목에 반영.
- 결정: **신규 규칙(belie 지시)** — 문서 작업과 실행 작업은 카드를 분리한다(BBE-50 이 한 카드에 섞여
  문서만 하고 Done 처리된 실패 사례). 향후 계약 발급 시 적용.
- 다음: BBE-74 작업원C 응답 대기(무응답 지속 시 FM 이 상태 재전환) · A2 는 belie 콘솔 확인 결과 대기
  (코드 쪽 진단 완전 종료) · BBE-42/BBE-36 접수 도장 유지.
- SoR: Linear BBE-50·BBE-74 코멘트, `scripts/ops/arena-season2-batch.mjs whoami()`, 결정함 3-b

### 2026-08-06 · 경영일지 작업원A(260805) · BBE-72 scope 판정 회수·보고(중복 실행 회피) + BBE-40 재개 + VPS ssh 완전장애 1건 실측
- 의도: belie 가 BBE-72(admin OAuth scope 진단)를 "임시 이양" — `--scopes` 진단 모드를 새로 만들라는
  지시였으나, 착수 전 확인해보니 FM 이 같은 결론으로 **이미 구현(#689)·배포·실행(Arena Season2 Batch
  `31021695449`, 15:43 success)까지 완료**한 상태였다. 중복 코드·중복 실행 대신 그 결과를 회수해 보고.
- 한 것: ①FM 실행 로그에서 scope 결과 추출 — `토큰 scope: https://www.googleapis.com/auth/drive`(전체,
  축소 아님)·`canCopy: true`·소유자=admin 본인. BBE-72 판정기준대로 **"scope 문제 아님 → 재발급 요청
  금지"** 확정, Linear BBE-72 코멘트+Done 처리(FM 실행분임을 명기, 제 실행 아님).
  ②새로 드러난 모순 — scope·ACL·canCopy 전부 정상인데 `files.copy` 만 거부됨. 다음 근인 후보 3가지
  (OAuth 동의화면 "테스트" 게시상태 제한·Drive 저장용량·파일별 copyRequiresWriterPermission 류 정책)를
  BBE-72 코멘트에 남기고, 추가 조사는 **FM 소관(`lane:arena`)으로 넘김** — 임의로 더 진행하지 않음.
  ③**VPS ssh 완전장애 1건 실측**(D-1 인프라 리스크로 기록): 15:47~15:57 10분간 7/7 재시도 전멸(기존
  최악 기록 "3회 필요"보다 악화). 단 **공개 사이트(salesptlog.online)는 그동안 200 정상**(배포
  파이프라인만 막힘, 라이브 무영향) — 동시간대 다른 세션 배포(#690)도 11분 걸려 겨우 success, 이후
  내 재배포(rerun)도 재시도 중. §6.8 "인프라 점검 후보"가 이제 "완전 전멸 1회" 실측치를 확보.
- 결정(자율·§0.7): BBE-40 4항목(admin 기수생성 경로 확인)은 **라이브 왕복 시도 보류** — BBE-72 로
  확인된 files.copy 거부가 cohort-create 의 동일 `copyTemplateSheet`/토큰에도 그대로 적용될 근거가
  강해, 지금 시도하면 예정된 실패 재현일 뿐. 근인 해소(FM lane) 전까지 대기.
- 다음: 내 재배포(rerun `31022040075`) 완주 확인 → BBE-40 1~3항목(주입로그·health) 결과 별도 기록.
  BBE-72 후속 근인 조사는 FM 픽업 대기.
- SoR: Linear BBE-72 코멘트 · Arena Season2 Batch run `31021695449`(FM 실행) · Deploy to VPS run
  `31022040075`(내 재배포)

### 2026-08-06 · FM(260804) · A2 진단 종료 — GCP OAuth 앱 게시상태로 근인 확정, belie 콘솔 확인 필요
- scope 실측(직전 항목) = `https://www.googleapis.com/auth/drive`(전체) 확인 — **스코프 문제 아님** 확정.
  belie 판정 기준대로 재발급 재요청 **하지 않았다**.
- 원본 오류 전체 추출(v2 details 포함) 결과: `{"code":403,"domain":"global","reason":"forbidden",
  "status":"PERMISSION_DENIED"}` — **구글이 줄 수 있는 가장 일반적인 거부 코드**, 더 이상 구조화된
  근인 필드가 없다(details[] 자체가 없음). 코드 쪽 자동 진단은 여기가 한계.
- 종합: 계정 일치·scope 전체·파일 메타데이터(canCopy=true) 전부 정상인데 실제 copy 만 이유 없이
  거부되는 패턴 → **가장 유력한 후보 = GCP OAuth 동의 화면 게시상태가 "테스트"** (미검증 앱은 앱이
  만들지 않은 기존 파일에 대한 민감 동작이 설명 없는 403 으로 막히는 사례가 알려져 있음).
- **belie 액션 요청**: GCP 콘솔 → API 및 서비스 → OAuth 동의 화면 → 게시 상태 확인(테스트/프로덕션).
  테스트면 프로덕션 전환 시도 + 관련 경고 문구 공유 요청.
- **D-1 시간 압박 고지**: 재발급 1·배포 2·진단 4회를 거쳐도 원인이 콘솔 설정으로 넘어감 — 코드로는
  더 못 판다. 5분 내 콘솔 확인이 안 되면 **§7-8 차선책(개강일만 공지, 시트 복사는 원인 해결 후) 전환
  권장**을 belie 에게 전달.
- SoR: `scripts/ops/arena-season2-batch.mjs reasonOf()` · 결정함 3-b · `docs/plans/active/arena-season2-setup.md` §7-8

### 2026-08-06 · 경영일지 작업원B(260806) · BBE-45 10기 시트 SA 공유 갭 — 복제 경로에서 차단 + 감사도구 (개막 D-1)
- 착수 선언(§3.5-1): 레인 `lane:drive-share` = `lib/repo/drive-client.ts` · `scripts/ops/verify-sa-sheet-access.mjs`
  · `tests/repo/drive-sa-share.test.ts` · plan 1건. **A 트랙 `lane:arena`(BBE-72 scope 진단) 와 파일 교집합 0** —
  아레나 스크립트·워크플로는 읽기만 하고 수정하지 않았다.
- **실측(읽기 전용 신규 도구)**: 9기 6명 = SA 명시공유 O·폴더상속 O(안전) / **10기 6명 = 둘 다 X,
  링크공유(anyone-with-link writer)에만 의존**. 10기는 부모 폴더가 SA 조회에 **아예 안 잡힌다**(폴더 권한 0).
- **근인 확정 — 버그가 아니라 전제 붕괴**: `704ac5c`(05-12 15:56)가 SA 자동공유를 넣었고, 같은 날
  `fe4a0b8`(21:44)이 *"폴더 한 번 공유하면 상속되니 자동화 불필요"* 를 근거로 걷어냈다. 그 판단은
  **폴더가 실제 공유돼 있을 때만** 옳다 — 9기는 성립, 10기는 미성립. 코드에 이를 보장·감지하는 장치가 없어
  **기수마다 결과가 갈리는 우연한 상태**였다.
- **고친 위치(핵심 판단)**: 복제 호출부가 **3곳**(일반 기수 라우트·아레나 라우트·pending 재시도 서비스)이라
  서비스만 고치면 **주 경로가 샌다**. 셋이 모두 지나는 `copyTemplateSheet` 안에 SA 공유를 동반시켰다.
  공유 실패는 **throw 하지 않는다** — 복제는 이미 성공했고 던지면 pending 재시도가 중복 복제를 만든다(#546 훼손).
  헬퍼는 **`lib/repo/drive-sa-share.ts` 로 분리**(500줄 캡 + `driveCreatorClient` ADR-0015 구조 가드 구간
  회피 — 같은 파일에 두면 `serviceAccount(` 사용 금지 가드가 폴백 아닌데도 걸린다).
- 검증: 신규 회귀 4테스트 green + **되돌리면 실제로 빨개지는 것까지 실측**(`await shareWithServiceAccount(id)`
  제거 시 1건 fail 확인 후 원복). check.sh 초록.
- **잔여 = belie 액션 1건**: 이미 만들어진 10기 6개는 코드로 못 고친다. `--execute` 는 파일 소유자
  (admin OAuth) 자격이 필요한데 로컬 토큰은 `invalid_grant`(반장 실측과 동일), VPS 토큰은 **BBE-72 와 같은
  scope 의심**이라 성공 보장 불가. → **권장 = belie 가 10기 부모 폴더를 SA 에 편집자 공유**(토큰 무관·즉시,
  앞으로 들어올 시트까지 한 번에 덮음). 결정함 등재.
- 아레나 확인(계약 3번): 런북 §7-7 에 "SA 편집자 공유" 명시 + 배치 `shareToSA()` 구현됨 — **원칙 이미 적용**.
  이번 PR 은 아레나 파일 미접촉.
- 범위 밖(후속 등재): anyone-writer 링크공유 관행 자체의 보안 개선 — 링크공유를 잠그려면 위 잔여가 먼저다(순서 의존).
- SoR: `docs/plans/active/cohort-sheet-sa-share.md`

### 2026-08-06 · FM(260804) · tokeninfo 실측 도구 추가 — scope 문제 확정 전 실증 절차로 교정 (belie 정정 수령)
- belie 지적: FM 이 "실제 부여 scope 를 조회할 API 가 없다"고 단정한 게 틀렸다. 구글 `tokeninfo`
  엔드포인트로 확인 가능 — 재발급 요청 전에 **실측으로 근인을 먼저 확정**하라는 지시.
- 한 것: 이미 배포된 `--whoami` 진단에 tokeninfo 조회 추가. `access_token` 발급 → tokeninfo 호출 →
  **scope·이메일(마스킹)만 출력**(토큰 값 자체는 로그에 한 글자도 안 남긴다 — fetch URL 조립에만 지역
  변수로 쓰고 즉시 폐기). 판정 기준: scope 에 `https://www.googleapis.com/auth/drive` 있으면 스코프
  문제 아님(다른 근인 재수사 필요) / `drive.readonly`·`drive.file` 등 축소면 재발급 확정.
- 재발급·재배포 뒤에도 카나리아가 계속 같은 오류라 근인 미확정 상태 — 이 조회로 다음 실행에서 확정한다.
- 병행: belie 지시대로 D-1 차선책(개강일 공지 + 시트 복사는 준비되는 대로)을 §7-8 에 이미 기재해 둔
  것을 재확인 — 시트 복사가 개막 전에 못 끝나도 개강 공지 자체는 막히지 않는다.
- SoR: `scripts/ops/arena-season2-batch.mjs whoami()` · `docs/plans/active/arena-season2-setup.md` §7-8

### 2026-08-06 · FM(260804) · B 앞 회신 — ①번 이미 구현·배포 완료(중복 방지), ②③번 수령
- **①(scope 판별)**: B 가 제안한 시점에 **이미 같은 결론으로 직접 구현해 배포 완료**했다(바로 위 항목,
  `whoami --scopes` 아닌 `tokeninfo` 경로 — 결과는 동일: scope 문자열 실측). **B 는 이 건 착수하지 말 것**
  — `scripts/ops/*` 는 여전히 반장 레인, 중복 PR 방지. 다음 실행 결과는 이 로그에 바로 이어 기록한다.
- **②(BBE-50 중복)**: 접수. 장부(레포) 쪽엔 영향 없음 — Linear 넘버링 정리는 Cowork(관제탑) 소관이라
  그쪽에 전달 요청으로 이관(FM 은 Linear 쓰기 안 함, §3.5 v2 원칙).
- **③(ssh 악화 데이터)**: 접수. §6.8 분기표 보강(재시도 3회 허용 명문화 + 제공사 확인 belie 액션 승격)은
  타당하나 **D-1 지금은 A2 확정이 급선무** — 이 PR 로 CLAUDE.md 를 건드리지 않고 후속 별건으로 넘긴다.
- B 는 계약 대기 유지(현재 배차 없음) — A2 근인 확정되는 대로 후속 작업(재발급 안내 또는 차선책 실행)을
  바로 배차하겠다.

### 2026-08-05 · DevB(260805) · 작업원 B 승계 선언 + 반장 앞 보고 3건 (A2 scope 판별법 포함)
- 승계: belie 지시로 A(260803) 창을 **작업원 B** 로 개명·전환. §3.5 세션 교체 절차대로 보드 B 줄 갱신.
  구 B(gcal, 260703)는 "신규 작업 대기" 상태였으므로 레인 충돌 없음. **현재 점유 레인 0 · 배차 대기.**
  belie 예고 = C~F 도 곧 재편성.

**📣 반장(FM) 앞 보고 — 3건**

**① A2 scope 는 belie 재발급 없이 지금 바로 판별할 수 있습니다 (권장 · 최우선)**
- 반장 기록: "토큰 자체를 안 보고는 실제 부여 scope 를 조회할 API 가 없다"(#687) — **이 전제가 틀렸습니다.**
- 구글 토큰 엔드포인트는 **refresh→access 교환 응답 자체에 `scope` 문자열을 담아 돌려줍니다**
  (`google-auth-library` 의 `Credentials.scope`). scope 문자열은 **비밀값이 아니라 권한 목록**이므로
  **그대로 출력해도 안전**합니다 — 토큰 값은 여전히 한 번도 안 봅니다.
- 즉 `arena-season2-batch.mjs` 에 `--scopes` 진단 모드(쓰기 0건) 하나만 붙여 VPS 워크플로로 돌리면,
  **지금 GitHub Secret 에 들어있는 그 토큰이 받은 권한 목록**이 그대로 찍힙니다.
  - `.../auth/drive` 가 **있는데도** copy 가 거부되면 → scope 문제 아님 → 파일 정책·소유 조직 쪽 재조사
  - `.../auth/drive.file` 등 **좁은 scope 만** 나오면 → 동의 화면 부분 승인 확정 → belie 재발급이 정답
- 보강: `https://oauth2.googleapis.com/tokeninfo?access_token=…` 도 같은 `scope` 를 돌려줍니다(2차 확인용).
- **효과**: 지금은 belie 재발급을 기다리며 D-2 를 소모하는 구조인데, 이 한 판이면 **기다릴 필요가 있는지
  없는지**가 확정됩니다. 재발급이 헛수고일 가능성도 같이 배제됩니다.
- B 가 구현 가능합니다 — 다만 `scripts/ops/*` 는 공용부(§3.5-2)이고 arena 는 반장·코덱스 레인이라
  **무단 진입하지 않고 배차를 기다립니다.** 계약 주시면 즉시 착수(예상 1 PR·소형).

**② `BBE-50` 카드 번호가 두 작업에 겹쳐 있습니다**
- #678 「W2 런북 DB 백필 항구 편입」과 #683 「파일럿 02 계약 드리프트 감사」가 둘 다 BBE-50 을 답니다.
- 별개 작업이라 관제탑에서 진행률·차단관계가 섞입니다. 하나를 신규 번호로 분리 권장(어느 쪽을 옮길지는
  반장 판단 — 장부 레인 소유자).

**③ VPS ssh 차단 실측 데이터 (§6.8 분기표 후속에 보태주십시오)**
- 반장이 남긴 "오늘 3회"는 **최소 5회+ 로 늘었습니다**. B 가 직접 겪은 최신 건:
  PR #686(`c859811`) 배포 run `31015135247` — **1·2차 실패(각 7회 재시도 전멸) → 3차에서 success**.
  약 **30분간 배포 불가**, 그 사이 health 는 계속 200(배포가 시작조차 못 해 라이브 무변경).
- 지금까지는 "rerun 1회면 회복"이었는데 **이번은 3회 필요** — 빈도·지속시간이 함께 악화되는 방향입니다.
- 제안: 분기표에 "Deploy on VPS 단계 ssh 타임아웃 = 롤백 금지·rerun" 명문화 + **재시도 3회까지 허용**
  기준을 같이 박고, 8/7 개막 전 제공사 확인을 belie 액션으로 승격.

- 다음: **배차 대기.** ① 계약이 오면 최우선 착수. 없으면 구 B 잔여(gcal pm2 침묵)로 대기.
- SoR: 이 항목 · 보드 B 줄 · `docs/plans/active/arena-season2-setup.md` §7-7 · `scripts/get-admin-drive-token.mjs:58`

### 2026-08-05 · FM(260804) · A2 권한 오류 근인 확정 — 토큰 scope 문제(파일 개별 문제 아님)
- 이전 세션에서 남긴 reason 코드 진단(#682)으로 재시도 → `forbidden (PERMISSION_DENIED)`(일반 코드,
  스코프/파일정책 구분 불가) → **다른 사람 파일로 교차검증**(김지훈 A1-1·A1-3 동명이인 2명, 손기학) —
  **3명 전부 동일 실패**. 메타데이터 조회(`files.get`·`about.get`)는 3명 다 정상(소유자=admin·canCopy=true).
  → **결론: 특정 파일 권한 문제가 아니라 토큰 자체의 쓰기 범위(scope) 문제**(읽기 계열만 되고 쓰기
  계열(copy)은 전부 거부되는 패턴은 파일별 ACL 이 아니라 OAuth 스코프 제한의 전형적 증상).
- ADR-0015 확인: 정본 발급 경로 `scripts/get-admin-drive-token.mjs` 는 `scope: drive`(전체 읽기·쓰기)를
  코드에 명시 요청 — 스크립트 자체는 정상. belie 가 재발급 시 그 스크립트를 안 썼거나, 구글 동의 화면의
  세부 체크박스가 일부만 승인됐을 가능성으로 좁혔다.
- **⚠️ 정정(belie 지적, 08-06)**: 위 로그의 "실제 부여 scope 를 조회할 API 가 없다"는 **사실과 다름**.
  구글 `tokeninfo` 엔드포인트(`https://oauth2.googleapis.com/tokeninfo?access_token=…`)로 실제 부여
  scope 를 직접 조회할 수 있다 — 다음 항목에서 그 조회로 근인을 확정한다(추측 아닌 실측으로 교정).
- 결정함 3-b 갱신: belie 액션 = 해당 스크립트로 재발급 + 동의 화면에서 전체 항목 체크 확인.
  차선책(개강일만 공지, 시트 복사는 준비되는 대로)도 함께 기재 — 8/7 D-1 이므로 무기한 대기는 안전하지 않음.
- SoR: 결정함 3-b · `docs/decisions/0015-admin-oauth-drive-create.md` · `scripts/get-admin-drive-token.mjs`

### 2026-08-05 · A(260803) · belie 결정 2건 수령·등재 — 퍼널 해지 제외 확정 + 오염행 2단계 대기 명시
- 의도: A 창에서 belie 가 R3-3 후속 3건을 직접 결정했다. 그중 **장부에 없던 것만** 등재해 휘발을 막는다.
- 실측(중복 방지): 등재 전 `origin/master=d13d1a7` 로 재측정 → 설계도 승인(2번)·append flip 승인(8번)·
  오염행 1단계(9번)는 **이미 FM 이 기록·실행 완료**였다. 같은 결정을 두 번 적지 않고 **신규 1건(12번)만
  추가**하고, FM 보고가 belie 액션을 기다리는 상태였던 오염행 2단계를 **13번으로 분리 명시**했다.
- 한 것: 결정함 12번(퍼널 계약수에서 해지 제외 = 승인) 신설 — 결정 내용·고지한 위험·머지 창구 권고·
  되돌리기까지 기록. 13번(오염행 2단계 승인 대기) 신설 + 12번과의 동형 관계 명시.
- 결정(belie): 퍼널 계약수에서 **해지 계약을 뺀다**. A 는 "전 시트 수식 전파라 기수 사이가 안전"이라
  권고했고 belie 가 근거를 듣고 재확인 → §0.5 에 따라 결정을 따른다. 실행 계약은 FM 발급.
- 다음: FM 이 12번 실행 계약 발급(전파 dry-run·역방향 revert 를 수용 기준에 포함) · belie 는 13번 한 줄 승인.
  **A 트랙은 여전히 R3-3 잔여 구현에 착수하지 않는다** — 12번은 FM 배차 대상.
- SoR: 이 항목 + 결정함 12·13번 · `docs/plans/active/db-write-flip.md` §6

### 2026-08-05 · FM(260804) · 오염행 감사 실행 완료 — 파일럿 전 기수 2건(경미), 158건은 스크립트 버그였음
- 배차한 `DB-DRIFT-AUDIT-01` 을 FM 이 직접 실행(VPS 원격 워크플로, #679~682 인프라 재사용).
- **1차 실행(#683 배포 직후)**: 유령 0 · 불일치 158 · cleared불일치 0 · 해지불일치 1 → **합계 159건**.
  158건이 소수가 아니라 넓게 퍼져 있어 즉시 의심 → 원인 규명: DB 백필이 저장한 계약일은 시트 원본
  날짜의 **일련번호(serial)를 문자열화한 것**인데, 감사 스크립트가 이를 ISO 로 변환하지 않고 시트의
  "2026-07-01" 과 그대로 비교해 전부 불일치로 오판(실제 앱은 `contractFromDbPayload`→`rowToCP`→
  `serialToISODate` 로 변환 후 비교하므로 이 드리프트를 안 겪는다).
- **수정(#684) → 재실행 → 실제 결과**: 55시트 전수 스캔, **합계 2건**.
  · 계약일/업체명 불일치 1건 — `연습` 기수 **테스트 계정**(salespt.local), 실제 수강생 아님.
  · 해지 반영 불일치(퍼널) 1건 — `A1-6` 실제 수강생 1명. 시트엔 해지 표시, DB엔 없음 → 그 사람 화면
    퍼널 계약수가 실제보다 1건 많게 보일 수 있음.
  · **유령 계약(지운 계약 부활) 0건 · _cleared 플래그 불일치 0건** — 가장 우려했던 유형은 없었다.
- 결정함 9번에 belie 보고용 요약 등재 + 2단계(1명 해지일 반영) 소규모 재승인 요청 표시.
- SoR: `docs/worklog.md` 📥 9번 · `.github/workflows/db-contract-drift-audit.yml`(재실행 가능, 다음
  실행 시 --cohort 미지정하면 파일럿 전체 재검증)

### 2026-08-05 · FM(260804) · VPS 경로 확인·카나리아 진전 — 권한 오류 진단 도구 추가
- VPS 원격 워크플로(#679) 배포 후 **`--plan` 성공**(대상 55명 재확인, VPS 경로 정상 동작).
- **카나리아 진전**: `손기학` 시도 → 인증은 **통과**(이전 `invalid_grant` 와 다름 — 토큰 자체는 VPS 에서 유효)했으나
  실제 복사에서 **`The caller does not have permission`**. 즉 admin OAuth 계정은 살아있지만 원본 시트에
  대한 **접근 권한이 없다**(계정 불일치 또는 공유 누락 가능성 — 미확정).
- 근인을 가르기 위해 `--whoami` 진단 모드 추가(쓰기 0건): admin OAuth 토큰 소유 계정(마스킹) + 샘플 원본
  시트 소유자·복사 가능 여부(`capabilities.canCopy`)를 실측 출력. 다음 실행에서 이 결과로 원인 확정.
- 다음: `whoami` 실행 → 계정 불일치면 belie 께 정확한 계정으로 재발급 요청, 공유 누락이면 원본 시트
  공유 설정 확인.
- SoR: `.github/workflows/arena-season2-batch.yml` · `scripts/ops/arena-season2-batch.mjs`

### 2026-08-05 · FM(260804) · admin 토큰 위치 확인(GitHub Secrets 전용) → VPS 원격 실행 워크플로 신설
- belie 재확인: **토큰은 GitHub Secrets 에만 등록**, 로컬 `.env.local` 은 미갱신 대상이었다(정상 — 노트북/로컬 PC 는 원래 갱신 경로가 아님). 로컬 재시도 2회 모두 `invalid_grant` 실측 재확인.
- **원인 정정**: 문제는 "토큰이 갱신 안 됨"이 아니라 **"로컬 PC 에서 W2 를 돌리는 경로 자체가 틀렸다"** —
  `deploy.yml` 이 이미 **매 배포마다 ADMIN_DRIVE_REFRESH_TOKEN 을 VPS `.env` 에 자동 주입**한다
  (`.github/workflows/deploy.yml:38-57`, 값 미출력). 즉 **VPS 는 이미 최신 토큰을 갖고 있다** — #678
  배포(13b9d8f)가 그 최신 secret 을 주입했다. 로컬 개발 PC 는 애초에 그 경로 밖이다.
- **해결(코드 변경 0 · 배선만)**: `db-backfill.yml`(기존 VPS 원격 실행 선례)과 동일한 SSH·재시도(rc=255
  7×30s) 패턴으로 `.github/workflows/arena-season2-batch.yml` 신설. `workflow_dispatch` 입력
  mode(plan/season-row/canary/all/flip-emails/rollback-emails) + canary_name. **제 세션은 토큰 값을
  한 번도 보지 않는다** — GitHub Secrets → VPS 주입 → 원격 스크립트 실행, 전 구간 비출력.
- 다음: 이 PR 머지·배포 후 `gh workflow run "Arena Season2 Batch" -f mode=canary -f canary_name=손기학`
  로 카나리아 재시도 → 성공 시 `mode=all` → DB 백필(§7-8, 기존 db-backfill.yml 재사용).
- SoR: `.github/workflows/arena-season2-batch.yml` · `docs/plans/active/arena-season2-setup.md` §7-7

### 2026-08-05 · FM(260804) · W2 재시도 실패(토큰 미반영) + DB 백필 단계 W2 런북 항구 편입 (BBE-50)
- belie "토큰 갱신 완료" → 카나리아 재시도. **결과: 여전히 `invalid_grant`**. 실측: `.env.local` **수정시각이 08-04 16:47 UTC(=08-05 01:47 KST) 그대로** — 갱신본이 이 파일에 반영되지 않았다(GitHub Secret 등 다른 경로에 들어간 것으로 보임). 토큰 접미 4자도 이전과 동일. **시트 복사 0건 유지**, 수강생 데이터 변경 0건.
- **백필 전제 2건 코드 실측(지시 검증)**: ①`lib/service/daily-source.ts:20` — `isDbReadPilot` 이 `isArenaCohortLabel` 로 **A2-N 을 자동 편입**(= A2 는 화면을 DB 에서 읽는다) ✅ 지시 근거 정확. ②`scripts/ops/backfill-sheet-rows.mjs` — `--cohort` 콤마목록 지원·기본 dry-run·`--execute` 실적재 ✅. 단 **`DATABASE_URL` 은 로컬에 없어** VPS 실행(또는 GitHub Actions "DB Backfill" 워크플로 `workflow_dispatch`)이 정본 경로.
- **항구 편입 완료**: 설계도 §7-8 신설 — "아레나 시트 복사 배치 = **복사 + DB 백필** 한 세트". 실행 순서(복사 → registry A2 적재 → dry-run → execute), 차선책(게이트에서 A2 일시 제외 후 시트 읽기로 개막), 다음 시즌 재발 방지 규칙 명문화. 배치 스크립트도 생성 성공 시 **백필 명령을 stdout 으로 상기**시키도록 수정(잊힘 방지).
- 다음(belie 액션 1개): `.env.local` 의 `ADMIN_DRIVE_REFRESH_TOKEN=` **값 자체를 교체**(파일 수정시각이 바뀌어야 반영된 것) 또는 VPS 실행 승인. 토큰만 들어오면 카나리아→55건→백필까지 30~40분.
- SoR: `docs/plans/active/arena-season2-setup.md` §7-8 · Linear BBE-50

### 2026-08-05 · DevA(260712) · ✅BBE-49(P0) 배포·라이브 확인 — 비파일럿 수료자 11주+ 저장/조회 (#676·363ba94)
- 의도: Cowork 가 클린 클론에서 만든 패치를 적용·검증·배포(라이브 김현지/7기 확인까지).
- 한 것: 패치 적용 후 **적대리뷰 4렌즈에서 BLOCKER 2·HIGH 4·MED 3 발견 → 수정 후 머지**.
  가장 큰 둘: ①읽기(K 캐시)·쓰기(시트 O1)가 **서로 다른 courseStart 로 물리한계를 판정** → 막겠다던
  read/write 비대칭 재생산 ②시트 폴백의 courseStart 원천 교체가 비파일럿 **전원·전 주차**에 영향
  (K 가 비ISO 면 NaN → 전 지표 0 → draft 0 시드 → **다음 저장이 정본을 0 으로 덮음**).
  추가로 비파일럿 백필 부재(누적합·현수막 재고 0)·주간 퍼널 0(contact-week 미수정)·dbEnabled 가드
  누락(롤백 레버 무력)·읽기측 테스트 0건을 닫음. 판정 원천을 **시트 O1 단일**로 통일.
- 검증: check.sh 초록(구조 25·단위 1002)·CI 초록·배포 success·health 200.
  **라이브 실측(김현지 임퍼스네이션, 12주차)**: `POST /api/daily/2026-08-05` **200**(수리 전 500),
  새로고침 후 오늘합계 유지 + **주차합계도 반영**(수리 전이면 0) + 유입대기 10건(시트 누적합 정상).
- 결정: DB_READ_COHORTS 확대(wave-2)는 선점하지 않는다 — "시트에 좌표가 없는 날짜"만 DB 로.
- 잔여: ①비파일럿 11주+ 의 생산(E) 기입·직접생산 M 동기화는 여전히 시트 1~10주 한정(별도 티켓)
  ②라이브 검증으로 김현지 8/5 에 컨택진행 1·미팅예약 1 이 남음(미팅 카드 1건이 실제 존재 →
  앱 규칙상 정합, 유입은 0 으로 원복). ③Linear BBE-49 = Done.
- SoR: docs/incidents/2026-08-05-bbe49-nonpilot-week11-save.md(리뷰 반영표·잔여 한계),
  docs/plans/active/bbe49-nonpilot-week11-save.md, Linear BBE-49

### 2026-08-05 · Cowork · BBE-49 진단+패치 (git write 금지 → 패치 핸드오프)
- 의도: belie 신고(김현지/7기) 진단 후 "실제로 고쳐줘" 지시 — origin/master 클린 클론에서 코드 수정.
- 한 것: 근본원인 확정(daily-source 파일럿목록에 7기 없음 → 물리한계 week>10 에서 throw).
  persistSalesRows(쓰기)·loadDay(읽기)에 "물리한계 밖이면 파일럿 무관 DB 우회" 추가.
  tsc 0에러·eslint 0경고·vitest 1019 passed 확인 후 `.patch` 로 핸드오프(§6.7 git write 금지).
- 다음: DevA 가 적용·재검증·배포(위 항목에서 완주 — 리뷰 지적 반영 후 머지).
- SoR: docs/incidents/2026-08-05-bbe49-nonpilot-week11-save.md(+동명 .patch), Linear BBE-49

### 2026-08-05 · DevA(260712) · ✅10기 날짜 마감 — 시트 O1/O2·B3/C3 + 레지스트리 I~L (#661·95bba0e)
- 의도: FOREMAN 배정 — 8/7 개막 전 필수. worklog ⑪(admin 폼 date 미반영 → 템플릿 잔존값 복제) 후속.
- 한 것: `scripts/ops/finalize-cohort10.mjs` 신설(dry-run 기본)·실행. **실측 6/6·6/6·6/6**
  (O1=2026-08-07·O2=2026-09-26 리터럴 · B3=10 · C3=이름 · 레지스트리 I~L, cohorts 10=active/cohort).
  **범위 확대(자율결정)**: 지시는 O1/O2+K/L 이었으나 동반 오염 2건 실측 발견 — 시트 **B3=8**
  (0605 8기 템플릿 잔재; me.ts:403 이 시트 기수를 레지스트리보다 우선 → 6명이 앱에서 "8기"로 표시)와
  **C3 빈값**, 레지스트리 **I=8·J 빈값**. 사전 안전 실측: 6시트 사용자 기록 **0건**(영업관리 37행·02
  31행은 전부 sum()·ROW()-5·라벨 골격) → O1 이동 무해 확정.
- 결정: 적대리뷰 4렌즈 HIGH 3·MED 4 전부 반영 후 실행(read 실패의 빈셀 오인·사후검증 옛 스냅샷·
  기존기록 미확인 flip·B3 무조건 덮기·hold 전파 누락·부분 실패 시 캐시 불일치).
- 사고/관찰: 배포 1차 rc=255 ssh timeout ×7(gh-runner-ssh-ban 재발, 타 트랙 동반 실패·PC SSH 정상)
  → `gh run rerun --failed` 로 success+200. 이 계열 **누적 5회+** — belie 제공사 콘솔 확인 권고.
- SoR: docs/plans/completed/finalize-cohort10-dates.md, scripts/ops/finalize-cohort10.mjs

### 2026-08-05 · FM(260804) · A2 W1 실행 완료 · W2 는 admin 토큰 invalid_grant 로 정지 (BBE-42)
- belie "모두 승인"(결정함 3-b 해소) → 즉시 착수. **운영 데이터 쓰기 실행분**:
  · `cohorts A1` J = **2026-06-12** 기입(비어 있던 칸 — 개막 전 A2 노출 차단용, §7-6②)
  · `cohorts A2` 행 **생성**(status=active · type=arena · J=**2026-08-07**)
  · 진단 재실행 결과 **"시즌2 개막 준비 완료 — 전광판이 개막일부터 자동 전환"** 초록.
- **⛔ W2 카나리아 실패 — 시트 복사 0건.** `손기학` 시도 → Drive `files.copy` 가 **invalid_grant**.
  진단(읽기 전용, 값 미출력): `ADMIN_DRIVE_REFRESH_TOKEN` 은 .env.local 에 **존재**(103자, `1//0…`)하나
  access token 발급 자체가 거부 = **폐기됐거나 다른 OAuth 클라이언트로 발급된 토큰**. 08-05 새벽 회수한
  .env.local 의 값이 그 뒤 GitHub Secret 에 등록된 **신규 토큰과 다른 것**으로 보인다.
- 대안 경로 실측: **SA(서비스계정)로는 복사 부적합** — SA Drive 접근은 되지만 `storageQuota.limit=0`,
  원본 시트는 **belie 개인 My Drive**(공유 드라이브 아님, SA 멤버 공유 드라이브 0개)라 SA 가 만든 사본은
  **소유자가 SA** 가 된다(수강생 시트 55개의 소유권 모델이 바뀜 → belie 결정 사항이라 임의 진행 금지).
- **수강생 데이터 영향 0** — 시트 생성·registry 변경 **0건**. cohorts 2칸만 바뀌었고 이는 전광판 시즌 판정용
  운영 설정이다(복구 = 그 2칸 원복).
- 다음(belie 액션 1개): 유효한 admin 토큰 확보 → ①로컬 `.env.local` 의 `ADMIN_DRIVE_REFRESH_TOKEN` 을
  현재 유효 값으로 교체(권장·2분) 또는 ②VPS 에서 배치 실행(배포가 Secret 주입) 또는 ③SA 소유 사본 허용(비권장).
  토큰만 들어오면 카나리아→전체 55건은 20~30분.
- SoR: `docs/plans/active/arena-season2-setup.md` §7-7

### 2026-08-05 · FM(260804) · "PLAN-001" 조회 결과 없음 + append flip 머지 창구를 개막 이후로 고정
- belie "PLAN-001 진행시켜" → **레포 전수 검색 0건**. 발급된 계약 id 는 6개뿐: FM-LEDGER-RECONCILE-01 · F-596-REVERIFY-01 · QA-DATEPICKER-LIVE-01 · DB-DRIFT-AUDIT-01 · CONTRACT-APPEND-IDEMPOTENT-01 · (완료)R3-3-MEETING-CONTRACT-DUAL-SYNC-01. → 어느 것을 뜻하는지 belie 에게 되묻는 중(디스패치 경유).
- **총괄 권고 접수 → 계약 조건으로 승격**: 신규추가 DB화는 **구현·PR 은 진행, 머지·배포는 8/7 개막 이후 창구**. 앞선 FM 판단("8/6 초록이면 8/6 머지")은 폐기 — 8/6 은 A2 55시트 검증일이라 매출 코드 배포를 겹치면 사고 원인 분리가 어렵다.
- 머지 선행 조건 3개 명문화: ①중복 방지 장치(자연키 upsert) 테스트 고정 ②머지 직전 레인 충돌 검사(아레나 W2 · 카페 hw_config — 겹치면 아레나·카페 우선) ③8/7 전환 후 전광판·health 정상 확인.
- SoR: `docs/plans/active/contract-append-idempotent-flip.md` §3

### 2026-08-05 · FM(260804) · env 실측(곁다리) — 로컬 실사용 검증 NOT_RUN 해제
- belie "env 옮겼어" 확인: **`.env` 는 이 레포 루트에 없다**(다른 경로에 떨어진 듯). `.env.local` 은 08-05 01:47 회수본 그대로 — 2,803B · 키 11개 · **LF** · BOM 없음 · 깨진 글자 0. 값·비밀은 열지 않음.
- 기능 실증: 이 세션의 A2 W0 정찰에서 **레지스트리·참가자 시트 55개 읽기 성공** → 자격증명 유효. 앱은 `.env` → `.env.local` 순으로 병합 읽기라 파일 합치기 불요.
- **해제**: 그동안 NOT_RUN 이던 **로컬 실사용 검증(dev 서버 기동 → 로그인 → 시트 연결 확인)** 이 가능해졌다. QA-DATEPICKER-LIVE-01(L3) 도 로컬 재현 경로 확보.
- ⚠️ 별개 유지: A2 배치의 **운영 시트 쓰기 차단**은 env 문제가 아니라 권한 정책 — 결정함 3-b 대기 그대로.
- SoR: 이 항목

### 2026-08-05 · FM(260804) · append flip 계약 발급(중복행 해소 설계) + 9번 "오저장값" 설명 등재
- 의도: belie 결정 2건 — ①계약 신규 추가 DB화 **승인**(같은 날 보류 뒤집음, 위험 해소 설계 명시 요구) ②"오저장값이 뭐냐" 질문.
- 한 것: 계약 `CONTRACT-APPEND-IDEMPOTENT-01` 발급(`docs/plans/active/contract-append-idempotent-flip.md`). 결정함 9번에 belie 질문 답변 5줄 등재(디스패치 전달용).
- **위험 해소 설계**: 행 번호를 키로 쓰는 한 재시도는 안전해지지 않는다 → **자연키 upsert** 로 전환. 미팅 계약=AK(미팅 id) · 폴백=계약일+업체명 · 이전계약=AJ(`prior:<uuid>`)를 요청 단위 id 로 승격. 저장 전 그 키로 기존 행을 찾아 있으면 update → 재시도해도 행 1개. **그 뒤에야** `{syncDb}` 관통. 기존 `findRowByLink` 재사용(새 검색 로직 0).
- 남는 위험 명시: 두 창 동시 저장은 시트에 행 잠금이 없어 완전 차단 불가 — 자연키로 수렴하되 테스트 고정 + 확률 문서화.
- FM 판단(머지 타이밍): 매출 집계에 닿는 변경 → **8/7 당일 머지 회피**(8/6 초록이면 8/6, 아니면 8/8 이후). belie 즉시 머지 지시 시 그것 우선.
- 실행 경로: **DevA 새 몸 배차**(레인 repo-db). FM 은 A2(크리티컬 패스·due 8/6) 대기 중이라 직접 수행하지 않는다 — 언블록 시 즉시 붙어야 함.
- SoR: `docs/plans/active/contract-append-idempotent-flip.md`

### 2026-08-05 · FM(260804) · 라운드1 배차 실행 + 9번 1단계 계약 발급 + Cowork 전사 회수
- 의도: belie 승인 4건(②R1 배차 ⑧보류 확정 ⑨1단계 ⑩카페) 접수 → 반장 라운드1 실행.
- **배차 발급 3건**(계약 전문 = `docs/plans/active/foreman-linear-ops-r1.md` §5-1, 워커 창에 그대로 복붙):
  ①`F-596-REVERIFY-01`(DevF·BBE-38) ②`QA-DATEPICKER-LIVE-01`(읽기 전용 라이브 확인)
  ③**`DB-DRIFT-AUDIT-01` 신규**(결정함 9번 1단계 — 과거 오염 행 **읽기 전용 계수**, write API 호출
  금지·email 마스킹·2단계 착수 금지를 NOT_RUN 에 명문화. DB 미접근 시 시트측만 스캔 후 명시 보고).
- **폐기**: N8(R3-3 설계도 1호)·N9(R3-3 잔여 구현) — 잔여는 #666·#667 로 이미 완주. 후속은 8·9번으로 대체.
- **레인 충돌 재판정**: L2·L3·L4 + BBE-42(FM) 네 레인의 코드 파일 교집합 **0** → 병렬 가능, 머지는 직렬.
- **전사 회수(§3.5 예외)**: Cowork 워킹트리 worklog 현재본(디스패치 v3·결정함 v4·로그 3건)을 master 기준으로
  회수. `arena-season2-setup.md` 는 **이미 #669 로 커밋됨**(그 판이 §7 정찰까지 포함한 상위집합이라
  워킹트리 사본은 폐기). 이 커밋 이후 워킹트리 미커밋 델타 **0**.
- ⛔ 잔존 블로킹: **A2 배치 실행 권한**(운영 시트 쓰기) — belie 승인 대기. 8/6까지 미실행 시 8/7 개막 지연.
- SoR: `docs/plans/active/foreman-linear-ops-r1.md` §5-1·§5-2

### 2026-08-05 · Cowork · belie 일괄 승인 — FM R1·카페·8번 보류·9번 1단계 (+index.lock 해소)
- 결정(belie): ②FM 설계도 R1 승인 → 라운드1 배차 GO ⑩카페 hw_config 승인(8/7 동시 반영) ⑧append flip 보류 확정(개강 후 재상정) ⑨오염 행 1단계 읽기전용 점검 진행(결과 후 2단계 재상정).
- 한 것: 결정함 2·8·10·11 [x], FM·카페 디스패치 갱신, BBE-43 블로커 해제, BBE-35 미러 동기, FM·카페 킥오프 카드 발급(belie 전달).
- 사고 종결: index.lock 은 Windows 실파일 없음 + 샌드박스 뷰 소멸 = 지연 해제, 실차단 없음. 교훈(Cowork git 는 log·show 계열만)은 유지 — §6.7 패치 후보로 FM 레인에 전달.
- 다음: belie 잔여 = ③10기 육안 2건·⑤#605·⑥육안 2건. FM 점검(9번 1단계) 결과 보고 대기.
- SoR: Linear BBE-35·43 · foreman-linear-ops-r1.md

### 2026-08-05 · Cowork · MWC 이관 접수 + BBE-39 Done 미러 + 카페 조율(BBE-43) + 🚨index.lock 잔류→해소
- 의도: 구 MWC(모아워크 코워크) 세션의 경영일지행 큐 이관 처리 + FM 미러 동기 요청(BBE-39) 이행.
- 실측: R3-3 완주 = master #666(9551b)·#667(c6698c7)·#668(cc0ef40) 확인. MWC의 "BBE-41=MoaWork P0" 오독 무효 확인(한 보드 두 프로젝트 혼재 착오 — R1 카드 규격·필터로 완화). 로컬 worklog 15커밋 뒤 → master 기준 재정합 + Cowork 델타(아레나·카페) 재삽입(FM 전사 레인 회수 요망).
- 한 것: BBE-39 Done·BBE-42 In Progress(반장 착수)·BBE-43 신설(카페 hw_config)·BBE-35 미러 1~11 동기. FM 설계도 R1 정합 검토 = 충돌 없음 → 승인 권장 의견 결정함 2번 병기.
- 🚨사고: Cowork `git status` 가 만든 `.git/index.lock` 이 샌드박스 unlink 차단으로 잔류(§6.7 패턴) — 삭제는 belie PC 1줄(결정함 11번). 하네스 교훈: §6.7 의 "status 허용"은 위험 — **Cowork git 읽기는 log·show·rev-parse·cat-file 만**으로 좁혀야 함(CLAUDE.md 패치 후보, FM 레인).
- SoR: Linear BBE-39·42·43 · docs/plans/active/foreman-linear-ops-r1.md

### 2026-08-05 · FM(260804) · A2 W1·W2 도구 완성 — ⛔실행은 권한 게이트에 막힘(belie 승인 필요)
- 한 것: 배치 스크립트 `scripts/ops/arena-season2-batch.mjs` 작성(#670 머지·배포 success) + `--plan` **드라이런 검증**(쓰기 0건, 대상 **55명**). 설계도 §7-6·§7-7 에 실행 절차·자율결정 등재.
- 자율결정 2건: ①**2단계 분리** — 시트 복사·A2 행은 8/5~6, **email 전환은 8/7 아침**(`--flip-emails`). 지금 옮기면 belie 공지보다 이틀 먼저 화면이 바뀐다. ②**cohorts A1 J=2026-06-12 채움** — 비워두면 시즌 판정이 "미상=전부 통과"라 미리 만든 A2 55행이 8/6까지 전광판에 0.0 으로 노출된다. 복구=셀 비우기.
- ⛔ **블로킹**: 운영 시트 쓰기(`--season-row`·`--canary`·`--all`)가 **로컬 권한 정책에 차단**됨. 우회하지 않고 정지. → belie 승인(권한 허용) 또는 VPS 실행 중 택1.
- SoR: `docs/plans/active/arena-season2-setup.md` §7-6·§7-7

### 2026-08-05 · FM(260804) · [병렬트랙 FM] 아레나 시즌2(A2) 착수 — W0 정찰 완료 + 진단 스크립트 수리 (BBE-42)
- **트랙 선언(§3.5)**: FM 이 A2 셋업 구역 점유 = 설계도 2호 · `scripts/ops/arena-season*` · 운영 데이터(cohorts·users·A2 시트). **코드(lib/·app/) 미접촉.**
- **W0 실측**: ①시즌 개막일 정본 = cohorts **J열 운영 데이터** → `lane:arena`(코덱스) 코드 구역과 **충돌 없음** ②대상 = **55시트**(A1 40 + 7기 8 + 8기 7 — 설계도 "37" 정정, email 없는 8행은 복사만) ③cohorts 에 A2 행 없음·A1 J 도 빈칸.
- **발견·수리(#669)**: 개막 진단 스크립트(#657·R트랙 산출물)가 **한 번도 작동한 적 없었다** — env 키 계약 불일치(항상 exit 2) + 존재하지 않는 탭 `영업관리`(실제 `01 영업관리`) + O1 문자열 읽기로 연도 소실 + 기대값 없을 때 거짓 초록. 4건 수리 후 라이브 실행 성공(40시트 스캔).
- **설계도 정정(§0.5)**: "이월매출 셀 쓰기" 단계 삭제 — 이월/시즌 매출은 `계약일 < O1` 로 **읽을 때 계산**된다. O1=8/7 세팅만으로 충족(셀 수기 입력은 사용자값 오염 위험).
- SoR: `docs/plans/active/arena-season2-setup.md` §7

### 2026-08-05 · Cowork · [재삽입] 설계도 2호 발행 — 아레나 시즌2(A2) 셋업(BBE-42)
- ※원본 기록이 워킹트리에만 있다가 master 재정합 과정에서 유실 → 요약 재기록. belie 발주(8/7 개막·A1+7·8기 전원·기존 시트 복사·계수 리셋·이월매출 누적·시즌1 공지 마감) → 설계도 `docs/plans/active/arena-season2-setup.md`(미커밋·전사 요망) + Linear BBE-42(Urgent·due 8/7). 자율 확정 4건(7·8기=수강시트 복사/자동 전환/업체폴더 유지/전광판 전원)은 설계도 §2. 킥오프는 belie 승인 하에 반장 전달·착수 중(MWC 확인).
- SoR: docs/plans/active/arena-season2-setup.md · Linear BBE-42

### 2026-08-05 · FM(260804) · R3-3 후속 결정 2건 📥 등재 + 미러 동기 요청(BBE-39 종료)
- 의도: R3-3 완주로 생긴 후속 결정을 belie 결정함에 정식 등재해, 세션이 바뀌어도 유실되지 않게 한다(§0.7 — 묻고 멈추지 않고 등재 후 진행).
- 한 것: 📥 4번(R3-3 킥오프)을 [x] 처리, **8번(계약 새로 추가까지 DB 기준 전환)·9번(과거 오염 행 리페어 + 퍼널 해지 반영)** 신설. 각 항목은 belie 가 결과로 판단할 수 있게 쉬운 말 4줄(지금/바꾸면/권장/미루면) 형식으로 기재(§0.6).
- 권장(FM): 8번=10기 개강 안정화까지 **보류**(유령 계약은 이미 차단, 매출 집계 건드릴 시기 아님). 9번=**읽기 전용 점검 먼저**(데이터 변경 0건) → 실측 건수 보고 후 수정 여부 결정. 0건이면 자동 종결.
- 요청(Cowork): Linear **BBE-39 = Done** 미러 갱신 + 8·9번을 BBE-35(📥 결정함) 하위로 등재. 정본은 이 워크로그이며 FM 은 카드 직접 수정 금지(디스패치 규약 준수).
- SoR: `docs/plans/completed/r3-3-meeting-contract-dual-sync.md` · 이 파일 📥 8·9번

### 2026-08-05 · FM(260804) · R3-3 잔여 착수·완주 — 미팅 화면발 02 계약 쓰기 dual-sync (BBE-39)
- 의도: belie 승인("R3-3 착수 승인"). 시트 느려짐 로드맵의 contracts+company_archive 쓰기 전환 잔여를 끝낸다.
- 착수 선언(§3-0·§3.5): **FM 이 A 트랙 구역(02 계약 쓰기)을 이 PR 한정 점유**(A 에 활성 몸 없음, C 종료로 소유권 A 이관 상태). 완료 후 A 로 반환. 동시 레인(10기=admin·scripts, 코덱스=arena)과 파일 교집합 0.
- 실측으로 잔여 확정: PR-1(contracts 편집 4종)·PR-2(company_archive)는 **이미 머지·라이브**, 읽기 동반 flip(=`readContractsFromDb`)과 TXT 내보내기 DB 기준도 **이미 충족**. 남은 구멍은 **미팅 화면(04)발 02 쓰기 6경로**가 `{syncDb}` 없이 나가던 것 — 파일럿(화면=DB read)에서 미러 최종 실패 시 **삭제한 계약이 DB 에 유령으로 잔존**(read-your-writes 위반, R3-2 의무 ⓐ).
- 한 것: `clearRowByLink` 에 opts 추가 + **파일럿 한정 DB-first 순서**(시트를 먼저 지우면 키가 (계약일,업체명)뿐이라 재시도가 행을 못 찾아 **치유 불가** → DB 먼저 확정, 실패 시 시트 무변경). contact.ts 6경로 게이트 배선. 신규 테스트 17(순서·throw·비파일럿 불변·DB-off 롤백·6경로 게이트).
- 결정(자율): 두 파일이 **master 기준 정확히 500줄**(캡 경계)이라 배선 자체가 불가 → PR-1 리뷰 후속⑤가 예고한 **split 선행**을 이 PR 에서 수행. `lib/repo/contract-payment-link.ts` · `lib/service/contact-cascade.ts` 로 이동 + 원 모듈에서 **재수출**(공개 API·기존 테스트 모킹 경로 무변경, 레포의 contract-payment-sync 선례와 동일 형태). 복구법: 이 PR revert 1건.
- 검증: check.sh 초록(구조 25 · 500줄 캡 통과 · doc-drift) + 전체 **115파일 1019테스트 green**.
- 완주(§6.8): PR **#666 → `9551c8b`** 머지 · 배포 run `30939294995` 1차 **VPS ssh 22 타임아웃**(코드 무관) → `rerun --failed` → **success** · health **200**. 계획서 `completed/` 이관.
- 다음: 남은 R3-3 계열은 belie 결정 대기분(append flip=B안 재키잉 · 오염행 리페어)뿐. **02 구역 A 반환 완료.**
- ⚠️ 인프라: VPS ssh 22 타임아웃이 오늘만 3회(#660 · #661 1차 · #666 1차). 매번 rerun 으로 회복되나
  반복 중 — 원인 점검(방화벽·fail2ban·러너 IP 대역) 후보. §6.8 분기표에 "Deploy on VPS 단계 ssh 타임아웃 = 롤백 아님, rerun" 명시 후속.
- SoR: `docs/plans/completed/r3-3-meeting-contract-dual-sync.md` · `docs/plans/active/db-write-flip.md` §6 R3-3

### 2026-08-05 · FM(260804) · 디스패치 260805판 전사 + #660 배포 실패(VPS ssh) 사후기록
- 의도: Cowork 가 워킹트리에만 남긴 260805 디스패치(🔺10기 최우선·DevE 언블록)를 정본으로 올리고, 반장 PR 의 §6.8 결과를 확정한다.
- 실측(§6.8): **#660 = `a253ba8` 머지 → 배포 run `30934412080` 실패**. 원인 = 코드 아님, **VPS ssh 22 연결 타임아웃 7회 재시도 전멸**(같은 시간대 #661 1차 run 도 동일 실패). 이후 ssh 회복 → #661 재실행 success, **#662(`d831da0`) run `30935808481` success** 로 `a253ba8` 포함 트리가 배포됨 → **health 200**. 별도 롤백 불요(배포가 시작조차 안 됨 = 라이브 무변경).
- 교훈(하네스): 배포 실패는 두 부류다 — ⓐ 코드(→즉시 롤백) ⓑ **VPS 도달성**(→롤백 금지·rerun). §6.8 분기표에 "Deploy on VPS 단계의 ssh 타임아웃도 Setup SSH 실패와 같은 부류"를 명시할 것(후속 문서 PR).
- 한 것: 디스패치·📥결정함 260805판 전사(Cowork 원문 유지 + FM 줄 추가), Cowork 08-05 로그 2건 전사, 보드 FM 줄 갱신.
- 다음: belie 승인 대기(설계도 §6). 10기 크리티컬 패스는 DevE·Cowork 소관 — FM 은 레인 충돌만 감시.
- SoR: `docs/plans/active/foreman-linear-ops-r1.md`

### 2026-08-05 · Cowork · 10기 생성 실측 확인(Drive·레지스트리) — 체인 ④까지 완료
- 의도: belie 요청 "드라이브에서 10기 만들어졌는지 확인".
- 실측: 시트 6개 전원 존재(8/4 새벽 생성·8/5 02:16 KST 일괄 갱신 — 레지스트리와 동시), registry prep 6행(기수 10·이름·시트ID 정확 일치·email 빈칸=클레임 대기), 시작 2026-08-07·종강 2026-09-26 기록 확인. 취합 시트(주차별 과제)도 별도 존재.
- 발견: ①10기 시트에 SA(masterbot) 명시 공유 없음 — 9기엔 있음. 현재 anyone-writer 링크공유 덕에 앱 작동 중이나, 링크공유 잠그면 앱 접근 끊김 → SA 공유 6건 추가 fast lane 후보 + cohort-create 코드의 SA 공유 단계 유무 점검 필요. ②anyone-writer는 전 기수 관행(템플릿 승계 추정) — 보안 정책 개선 후보로 후속 제안.
- 다음: belie 육안 2건(대시보드 #VALUE!·O1/O2) → 8/7 클레임 안내. BBE-40(주입로그 실측)은 DevE 완주 여부 확인 중.
- SoR: Linear BBE-41

### 2026-08-05 · Cowork · 🔺10기 준비 착수(BBE-41) + 08-03/04 편집분 유실 재적재
- 의도: belie 지시 "10기 준비"(6명). + Cowork 의 08-03/04 worklog 편집분이 워킹트리 리셋으로 유실된 것을 발견 → 재적재.
- 한 것: 절차 실측(admin 기수생성 버튼 + /claim = 이메일 사전수집 불요) → 10기 체인 설계 → Linear BBE-41 등재(Urgent·due 8/7·BBE-40 에 차단)·실행 큐 최우선 승격·BBE-40 Urgent(due 8/6) 격상. 디스패치·📥결정함 260805판 재구성(이 판이 정본).
- 결정(belie): 10기 시작일 = 2026-08-07(금) → O2 자동 +50 = 2026-09-26. 명단 6명 접수. 리스크 대응 = 연습 왕복 리허설 권장 + #VALUE! 검증(#490) 포함.
- 교훈(하네스): Cowork 편집은 커밋 전까지 휘발(§6.7 커밋 불가) — 각 트랙 다음 PR 에 worklog 현재본 포함 의무화. 근본 대책(자동 커밋 경로)은 후속 검토.
- SoR: Linear BBE-41 · `docs/plans/active/db-cohort-create-pending.md` · `docs/playbooks/setup-sheets.md` §5

### 2026-08-05 · 기수생성 날짜 트랙 · 수강시작일 유실 2회 재발 차단 (전달 보장 + 결과 가시화)
- 의도: admin 기수 생성 시 수강시작일이 조용히 유실돼 템플릿(0605=8기 사본) 날짜가 새 시트에 남던 사고(연습용2·10기 6명)를 코드로 막는다. 실데이터는 `scripts/ops/finalize-cohort10.mjs` 로 이미 수리 완료.
- 진단(§0.5): 원인이 **둘**이었다. ⓐ 자동화가 date input 의 DOM `.value` 만 세팅해 React onChange 미발화 → state 빈 채 제출. ⓑ **새로 발견** — 날짜가 제대로 와도 `create-cohort-members` 가 `writeCourseDates` 를 `allowTemplateOverwrite` 없이 불러 템플릿 raw O1 이 §2.5 가드에 걸려 **입력 날짜가 버려졌다**(warn 한 줄만). ⓑ는 아레나 경로에서 #658 로 이미 고쳐진 것과 동일 급소인데 일반 기수 경로만 누락돼 있었다. 모달 폼 자체는 정상 controlled input — "폼 버그" 오진 아님.
- 한 것: ① 제출 시 `resolveCourseStartInput` ref 폴백(+ state 동기화) ② 갓 복제한 시트에만 `allowTemplateOverwrite: true` ③ 응답 `dates[]` + 미기록 시 시트 실측 readback(O1/O2/B3) → 모달 초록/앰버 블록 ④ 날짜 미입력 시 확인 1회. check.sh 초록(구조 25 · 단위 977). 신규 테스트 17개, 그중 모달 회귀 3개는 **옛 코드로 되돌리면 실제로 빨개지는 것까지 실측 확인**.
- 결정: B3/C3 **쓰기는 추가하지 않는다** — claim 시점(`lib/service/auth.ts:196`)이 정본이라 두 갈래가 되면 더 위험. 이번엔 읽어서 보여주기만.
- 완주(§6.8): **PR #662 → squash `d831da0` → 배포 run `30935808481` success → health 200.** last-good(롤백 타겟)=`a253ba8`. 머지 전 master 가 `e09ee33→a253ba8`(#660·#661) 로 이동해 리베이스 후 재검증, worklog 충돌은 §3.5-2 대로 양쪽 항목 모두 보존.
- 다음: 잔여 별건 = 개막 전(8/5~8/6) 저장 500→400 매핑(`finalize-cohort10-dates.md` §6-1). 11기에 또 날짜 마감이 필요하면 스크립트 복사 말고 `--cohort/--start` 일반화(3회째 = harness issue).
- SoR: `docs/plans/completed/cohort-create-date-visibility.md`
### 2026-08-05 · FM(260804) · 작업반장 취임 + Linear 체제 설계도 R1 (START)
- 의도: belie 지시 — 경영일지 개발세션을 **작업반장**으로 승격, MoaWork 준용 Linear 체제로 A~F 를 직렬/병렬 조율.
- 실측: `origin/master=e09ee33`(배포 run `30830372094` success·health 200) · **Open PR 0** · 머지 큐 비어 있음 · Linear MCP 이 반장 세션에 연결됨(팀 1개 BBE · 프로젝트 2개 · 카드 BBE-35~40 조회 성공).
- 한 것: 설계도 `docs/plans/active/foreman-linear-ops-r1.md` 작성(Linear 구조 A/B 비교·**A안 권장**, 신규 카드 11장, 트랙=라벨·카드=계약·세션=몸 매핑, `lane:*` 구역 라벨과 "같은 lane 동시 In Progress 금지" 철칙, 라운드1 3레인 배분 + 계약 초안 3건). 보드에 **FM 줄 신설**. 로컬에만 있던 Cowork 디스패치 v2 를 그대로 전사(전달 유실 방지).
- 결정(자율): Linear 는 **미러**, 정본 순서 = GitHub(코드) > 레포 문서(현장·설계) > Linear(점유·상태). 근거: 세션마다 Linear 접근이 보장되지 않음. 복구법: 설계도 revert 1회.
- 다음: **belie 승인 대기** — 설계도 §6 4항(구조 A안·카드 11장·라운드1 배차·기존 결정 3건). 승인 시 반장이 Linear 카드 생성 + 계약 배차.
- SoR: `docs/plans/active/foreman-linear-ops-r1.md`

### 2026-08-05 · FM(260804) · 장부 정합 — 머지 5건 로그 미기재 확인
- 한 것: #654·#656(모바일 날짜달력 P0-2)·#657·#658(arena 시즌)·#659(대시보드 그림자 대조 off) 5건이 머지·배포 success 인데 **로그 항목이 없음**을 실측 기록. 보드 R 줄/코덱스 소유분이라 내용 판정은 소유 트랙 몫.
- 잔여(비차단): 위 5건의 사후 요약은 각 소유 트랙(R/코덱스)이 채운다. 라이브 확인이 필요한 것은 날짜달력 1건 → 라운드1 L3 카드로 등재.
- SoR: 이 항목 + `docs/plans/active/foreman-linear-ops-r1.md` §4-2 N1·N3

### 2026-08-04 · Cowork · Linear 관제탑 가동 (BBE 「경영일지 · 세일즈PT 영업일지」)
- 의도: belie Linear 인증 완료 → v2 합의(관제탑=위성) 즉시 실행.
- 한 것: 팀 BBE에 프로젝트 신설 + 사무소 라벨 4종(클로드코드·코덱스·Cowork·belie결정) + 활성 트랙 이슈 6건 등재(BBE-35 📥결정함/High·36 AR-2b 진행중·37 R6 HOLD·38 DevF·39 R3-3 대기·40 DevE 대기). 차단 관계 2건(39·40 ← 35) 연결.
- 결정(자율): 동기화 = 레포→Linear 단방향, MoaWork 프로젝트와 같은 팀 공유·프로젝트로 격리. 근거: 한 화면 겹침 정렬 + 정본 이원화 방지. 복구법: Linear 프로젝트 아카이브만 하면 원상.
- ※ 전사 주석(2026-08-05 FM): 이 항목과 아래 v2 항목은 Cowork 가 로컬 작업트리에만 남겨둔 미커밋 원고였다. 내용 변경 없이 그대로 옮겼다.
- SoR: docs/worklog.md 보드·📥 섹션 (Linear는 미러)

### 2026-08-03 · Cowork · 운영체계 v2 확정(설계도 모드·반장 편성·Linear 관제탑) + 디스패치 260803 갱신
- 의도: belie 가 총괄 PM 체계 증축을 지시 — 설계도(병렬·직렬 매트릭스)·반장 층·Linear 정렬 도입 검토.
- 한 것: 260712판 stale 디스패치 블록을 260803 실측으로 갱신, 운영체계 v2 를 디스패치 공통 항목으로 명문화, 📥 belie 결정함 섹션 신설.
- 결정(belie): ①Linear=관제탑(위성, 정본은 레포) ②반장 편성=건별 지정 ③fast lane 기준(PR1·구역1·결정0). 복구법: 디스패치 공통 v2 항목 제거로 원복.
- SoR: CLAUDE.md §3·§3.5·§6.7, docs/plans/active/_TEMPLATE.md

### 2026-08-03 · A(260803) · 레포 이동 승계 + §6.8 완주(#652) + 8/2 배포 실측
- 의도: 폴더 이동으로 끊긴 직전 세션을 이어받아, 미완이던 §6.8(PR→머지→배포 관찰→health)을 끝내고 8/2 머지분의 "배포 미확인" 잔여를 없앤다.
- 실측(GitHub 정본 우선): 새 레포 경로 `C:\Users\Belief-desktop\Desktop\개발프로젝트\경영일지`. 브랜치 `docs/board-plan-reconcile`(`03998ef`)은 origin 에 **푸시만 되어 있고 PR 은 없었다** → 중복 작업 없이 PR 부터 생성.
- 한 것: **PR #652 생성 → 체크 2/2 초록 → squash 머지 `80c94bb` → 배포 run `30797733939` success → health 200**(§6.8 완주). 8/2 머지분 #647~#651 다섯 건의 "Deploy to VPS" run 을 `gh` 로 조회해 **전부 success** 확인, 계획서 5건의 "미확인 잔여: 배포 run conclusion" 주석을 run ID 실측으로 교체.
- 결정: `gh` 는 설치되어 있었다 — 직전 세션의 "`gh` 미설치" 제약은 **해소**. 이동으로 깨진 워크트리 등록은 `git worktree repair` 로 새 경로에 재연결(`wt/docs-board-reconcile`, 삭제하지 않고 보존).
- 마감 실측(사후 추가): 이 항목의 후속 PR **#653 = `d9ce8eb`, 배포 run `30799167984` success, health 200** — 문서 정합 트랙 종료.
- 다음: **R3-3(contracts+company_archive) 착수 금지 유지 — belie 상세 프롬프트 대기.** 남은 잔여는 인증 화면 육안 확인 2건(#648 chip · #649 `/admin/cohorts` probe)뿐 — belie 몫.
- SoR: 이 항목 + `docs/plans/completed/{pr643-admin-cohorts-p0, stats-period-label, admin-formula-restore-c2-r1, windows-dev-watch-einval-c3-r2}.md` + `docs/plans/active/r6-current-master-integration-r1.md`

### 2026-08-03 · A(260803) · 데스크탑 승계 + 보드·계획서 정합
- 의도: belie 결정(1A). 데스크탑 신규 몸 승계 직후, 260712 에서 멈춘 활성 트랙 보드와 8/2 머지 실적의 괴리를 먼저 해소한다.
- 실측: `origin/master=6380916`(동기 0/0, worktree 0), 공개 health 200. 로컬 typecheck·구조 25/25·**check.sh PASSED**. Node v24.18.1 / npm 11.16 / git 2.55, node_modules 745(Windows 바이너리, 리눅스 잔재 0).
- 한 것: 보드 A 승계 갱신 · B stale 정정(#538 은 이미 머지 `274042a`) · 릴리스 계열 R 줄 신설. 완료 계획서 4건(#648·#649·#650·#651) → `docs/plans/completed/` 이관 + 각 문서에 종료 기록 추가.
- 판단: `r6-current-master-integration-r1`(#647)은 **[HOLD] 머지**라 migration GO 전까지 active 유지. `arena-season1-setup` 은 명단·규칙 상시 SoR + AR-2b 진행 중이라 유지.
- 제약: `gh` 미설치 → PR 오픈·배포 run 관찰(§6.8) 불가. 브랜치 `docs/board-plan-reconcile` + 커밋 + check.sh 초록까지만 완주하고 정지. 과거 머지분의 deploy run 성공 여부도 같은 이유로 미확인(health 200 대체).
- 다음: belie 가 `gh` 설치 → PR → §6.8 완주. **R3-3 은 착수 금지 유지(belie 상세 프롬프트 대기).** 디스패치 블록 갱신은 Cowork 몫.
- SoR: 이 항목 + `docs/plans/completed/{windows-dev-watch-einval-c3-r2, admin-formula-restore-c2-r1, pr643-admin-cohorts-p0, stats-period-label}.md`

### 2026-08-02 · C3-R2 · Windows Node 22 dev watcher EINVAL 수정 착수
- 의도: `npm run dev`가 `npx.cmd + shell:false`에서 EINVAL로 종료되는 Windows 개발 경로를 복구
- 한 것: 최신 master 전용 worktree에서 Windows 전용 shell 사용과 실제 `npx.cmd` 회귀 테스트를 최소 범위로 구현
- 결정: POSIX `shell:false`와 `windowsHide:true`는 유지하고 운영 앱·DB·Sheets·배포면은 변경하지 않음
- 다음: focused/typecheck/check/build 및 독립 검수 후 draft PR로 게시
- SoR: `docs/plans/active/windows-dev-watch-einval-c3-r2.md`

### 2026-08-02 · ADMIN-FORMULA-RESTORE-C2-R2 · current-master release candidate 준비
- 한 것: `origin/master=3b500960`을 merge하고 worklog append만 양쪽 보존했다. 제품 충돌은 없고 후보 delta는 route·setup-formulas·테스트 2개·plan·worklog 여섯 파일이다.
- 검증: focused 55/55, typecheck, lint, 구조 23/23, 전체 943/943, doc-drift, 정상 hook, production build 71/71 PASS.
- 경계: 운영 Sheets·DB·환경·PM2·deploy·merge는 0건이다. draft PR 뒤 독립 review 전에는 release하지 않는다.
- SoR: `docs/plans/active/admin-formula-restore-c2-r1.md`

### 2026-08-02 · ADMIN-FORMULA-RESTORE-C2-R1 · 오래된 HTTP500 후보 최신 master 재진단 착수
- 의도: 관리자 수식 복원 HTTP500을 live Sheets write 없이 재현·축소하고, idempotency·사용자 값 보존·quota를 지키는 최소 fix를 출시한다.
- 진단: source `fix/m345-batchget-merge@3dff145`는 최신 master보다 403 commit 뒤이며, 현재 `installFormulas`는 시트당 read 7회+write 1회라 source의 “3회×concurrency5” 계산은 폐기했다.
- 결정: 모든 pre-read를 단일 batchGet으로 합친 뒤 concurrency5 wave를 7.5초 간격으로 제한한다. self-hosted Next에서 효력이 없는 `maxDuration`에는 의존하지 않는다.
- 범위: 관리자 bulk route·setup-formulas·focused API/repo tests·단일 plan/worklog만. 운영 Sheets·DB·R6 write는 금지한다.
- SoR: `docs/plans/active/admin-formula-restore-c2-r1.md`

### 2026-08-02 · R6 current-master integration · PR #622 successor 착수
- 의도: DIRTY 상태인 PR #622의 verified R6 exact20을 최신 master 위에 재통합해 migration 전 clean deploy candidate를 만든다.
- 한 것: current master에 verified 3-commit lineage를 순차 통합했고 focused 13 files/95 tests, `check.sh` 구조 23/23·전체 901/901, production build 70/70이 PASS했다.
- 결정: #629 rollback·#633 날짜 매핑·#640 split 무효화를 보존했고, removed DB-cost UI test는 복원하지 않았다. 최신 production-data tuple은 plan에 evidence-only로 결합했다.
- 다음: 최종 docs receipt 정상 hook commit → DRAFT/HOLD successor PR → 독립 검증·DevG handoff. 운영 DB·env·PM2·live·Sheets는 계속 불변이다.
- SoR: `docs/plans/active/r6-current-master-integration-r1.md`

### 2026-08-02 · PR643 P0 RECOVERY · read-only GET 후보 검증 완료
- 한 것: `/admin/cohorts` render의 `ensureCohortsTab` import/call 제거, 정상·429 경로 cohort mutation 0회 회귀 2건 추가.
- 검증: focused 2/2, typecheck, check.sh 101 files/916 tests, production build(`/admin/cohorts`) PASS.
- 상태: 최신 `844ce045` 기반 격리 후보이며 운영 Sheets·DB·환경·live endpoint는 변경/재시도하지 않았다.
- 다음: 독립 review 후 PR→checks→merge→deploy→health→인증 read-only live 검증.
- SoR: `docs/plans/active/pr643-admin-cohorts-p0.md`

### 2026-08-02 · PR643 P0 RECOVERY · admin cohorts GET 읽기 전용 경계 착수
- 의도: PR #643 배포 뒤 `/admin/cohorts` digest `767408371` 500을 운영 데이터 추가 변경 없이 복구한다.
- 진단: remote/deploy/VPS SHA=`844ce045`; grid 26열·A1:J1 read 성공·헤더 9칸으로 J write 미착지, PM2 예외 본문은 미수집.
- 결정: Server Component GET의 `ensureCohortsTab` 자동 쓰기만 제거하고 명시적 admin mutation API ensure는 보존한다.
- 다음: 정상 render·read 429 무쓰기 회귀, focused/typecheck/check/build, 독립 review 뒤 release chain.
- SoR: `docs/plans/active/pr643-admin-cohorts-p0.md`

### 2026-08-02 · PR643 ARENA SEASON RELEASE R2 · 비실재 날짜 fail-closed 보강
- 의도: 독립 검증에서 재현된 달력 비실재 날짜의 잘못된 시즌 전환·주차 rollover를 차단한다.
- 한 것: 공용 ISO 의미 검증을 API·repo·시즌 판정·주차 앵커에 연결하고 locale 정규화도 같은 검증을 거치게 했다.
- 검증: API auth/권한/invalid 무쓰기, repo zero-write, service unknown/week0를 포함한 집중 41/41 PASS.
- 결정: 반복 scope 재계산은 비차단 설계 잔여로 유지하고 이번 release 범위에는 포함하지 않는다.
- 다음: full check·build·정상 hook 뒤 새 SHA를 DevD에 독립 재검증한다.
- SoR: `docs/plans/active/arena-season1-setup.md`

### 2026-08-02 · PR643 ARENA SEASON RELEASE R1 · 최신 master 통합 후보 준비
- 의도: 오래 열린 시즌 SSOT 기능을 최신 master에 최소 통합하고 운영값 쓰기 없이 release chain을 완주한다.
- 한 것: PR643의 고유 6커밋을 `3fe78acc`에 이식하고 Scoreboard import 충돌을 양쪽 보존으로 해소했다.
- 보강: 기존 미커밋 RAW 날짜 정규화 수정을 별도 검토·이식하고 Sheets 로케일/RAW 회귀를 7케이스로 고정했다.
- 검증: 시즌·scoreboard 집중 35/35 PASS; full check/build·독립 VERIFY·PR checks·merge/deploy/live는 후속 게이트다.
- 제약: A2 시즌 시작일과 Sheets/admin 운영 데이터는 이 release에서 쓰지 않는다.
- SoR: `docs/plans/active/arena-season1-setup.md`

### 2026-08-01 · SALES-PT LATENCY-R1 · 시트 fallback 병렬화 release 완료
- 한 것: PR #645를 squash merge(`ccedd64c`)하고 master QA·단일 VPS deploy(`30647563313`)·public `/api/health` 200을 확인했다.
- 검증: focused 2/2·관련 27/27·독립 `PASS_TO_RELEASE`·canonical CI SUCCESS; 기존 인증 대시보드 렌더·console 0, 운영 write 0.
- 제약: API cold/warm 실측은 브라우저 도구 제약으로 `AUTH_TIMING_BLOCKED`; public redirect를 인증 timing 증거로 대체하지 않았다.
- 결정: 기능·배포는 완료됐고, 이 항목과 completed plan이 최종 문서 영수증이다.
- SoR: `docs/plans/completed/dashboard-sheet-latency-r1.md`

### 2026-07-31 · SALES-PT LATENCY-R1 · 대시보드 시트 fallback CODE_READY
- 한 것: 프로필 의존 미팅 read를 초기 read와 겹쳤고, held-promise overlap·프로필 reject 회귀를 고정했다.
- 검증: 관련 27/27, `check.sh` 구조 23/23·전체 877/877·doc-drift PASS, production build 69/69 PASS.
- 결정: 반환값·해지 오버레이·정확히 7회 Sheets 호출·DB/admin/background 경로는 불변이다.
- 다음: 독립 VERIFY PASS 뒤 동일 writer가 commit→PR→serialized deploy→health→인증 read-only timing을 수행한다.
- SoR: `docs/plans/active/dashboard-sheet-latency-r1.md`

### 2026-07-31 · SALES-PT LATENCY-R1 · 대시보드 시트 fallback 병렬화 착수
- 의도: 프로필 의존 미팅 read를 다른 초기 Sheets read와 겹쳐 대시보드 응답 임계경로를 줄인다.
- 범위: `dashboard.ts`·신규 집중 테스트·단일 plan, worklog checkpoint만; DB/admin/reverse shadow/운영 데이터는 불변.
- 결정: wall-clock 임계값 대신 held promise로 시작 순서를 검증하고 정확히 7회 호출·반환값·오류 전파를 고정한다.
- 다음: RED 테스트 → 최소 구현 → full check/build → 독립 VERIFY용 candidate 동결.
- SoR: `docs/plans/active/dashboard-sheet-latency-r1.md`

### 2026-07-28 · DevD(VERIFY) · W1-1(#631) 판정 = **NO-GO** + P1 비용원장 근인(제4결함) 규명·수정 PR
- 의도: R4 wave-1 VERIFY 트랙 + 라이브 P1(비용원장 저장·조회 비대칭) 근인 규명·fix-forward.
- 한 것: **①W1-1 #631 = NO-GO** — 4렌즈 전부 blocks_merge, blocker 7 중 2건 D 직접 확인: (a) `getWritableUserEmail` 본문이 `return getActiveUserEmail();` 뿐이라 **cohort 판정이 없어** "비파일럿 완전 불변" 주장이 코드와 불일치(비파일럿 수료생이 마감 시트에 기입 가능) (b) 집계 클램프가 같은 함수 안에서 **반쪽** — salesRows 루프에만 걸리고 미팅 루프(예약·완료·계약)는 무필터. **②P1 근인 확정(제4결함)**: pg-types 가 `date`(OID 1082)를 **로컬 자정 Date** 로 주는데 매퍼가 `String(v).slice(0,10)` → `"Wed Jul 01"` → `days=NaN` 이 가드 두 조건을 **모두 통과** → 빈 배열 → 인식금액 0 → 조용히 증발. 증상 4개(일회성 미노출·요약 ₩0·영업이익 미반영·반복 '이번 발생 없음')가 전부 이 하나로 설명됨. **PR #633**(매퍼 로컬게터 포맷+형식위반 throw, NaN 봉인, 회귀 8건, 18/18 통과).
- 결정: ①②③(#620/#615 계열)과 **별개 결함**이므로 D 의 기존 NO-GO 목록이 불완전했음을 인정. E fix 범위는 read 경로로 **확장 불필요**(#633 이 덮음) — E 는 ③ split void + effectiveMonth 유지. 반복 '이번 발생 없음'은 `firstRecurringOccurrence` 설계상 정상 → **표시 문구** 사안으로 분리.
- 추가(2026-07-28 재판정): **#633 완주** — A 독립 VERIFY PASS(3렌즈·타임존 실물 검산) → 리베이스+check.sh 재통과 → 머지·배포 success(1차 SSH 인프라 장애 rerun)·health 200. **W1-1 #631 = 재VERIFY PASS**(head f3fcb11) — blocker 3건 전부 코드 확인 해소(①주장철회+CLAUDE.md §2.5 폐지표기 ②시트 실수식 실측으로 계약만 클램프 ③contact.ts:117 읽기상한 해제+왕복회귀). **D 지적 ② 부분오류 정정** — 미팅 3단계 일괄 클램프는 오히려 parity 파손, B 실측이 정확. 부수: 전 트랙 pre-commit 차단(no-sheet-guard 14.8s/15s) **#638 로 해소**(5.4s, 831/831).
- 다음: W1-1 머지는 FOREMAN 배정 대기(완료 조건 = §6.8 + **M7 감사 1회 실행·창밖 행 규모 공시**). 비차단 잔여=비파일럿 수료생 쓰기의 운영 파급(belie 정책 판단).
- SoR: dispatch-queue `r4-w11-verify`, PR #633, scratchpad/expense-ledger-live-repro-2026-07-28.md

### 2026-07-26 · DevD(VERIFY) · blocker 원인커밋 매핑·최소 revert 셋 확정 (READ_ONLY)
- 의도: FOREMAN 판정 수용 후 즉시 — ①②③ 원인 커밋 매핑 + 최소 revert 셋 확정. 실행은 DevA(#620 revert), D 는 매핑·검증만.
- 한 것: **①② = fed3307(#620)** lib/repo/db.ts:108·:122 → #620 revert 로 닫힘. **③ = 92a0a65(#615 본체)** splitRecurringRuleFromMonth → **#620 revert 로 안 닫힘**(#617 은 archive 경로에만 void SQL 추가, split 누락). revert 적용성 dry-run **CLEAN**(`git apply --reverse --check` 통과, 이후 동일파일 접촉 커밋 0, db-cost-ledger.ts·import·테스트 전부 #620 소산이라 자기완결). ③ 라이브 도달성 CONFIRMED(expense-ledger.ts:203 이 nextMonth 까지 선 materialize).
- 결정: **⚠️ #620 revert 는 순수 복구가 아님** — 그 파서 변경은 기존 결함(생산중 행 밀림) 수정 시도였고 삭제된 테스트가 옛 동작을 명시 인정. revert 시 옛 결함 복귀하나, 새 위험(레거시 O열 오판 금액전도 + 조용한 덮어쓰기)보다 노출이 작아 **지혈로 타당**. ②원복은 순수 이득(phantom 대칭 회복).
- 다음: **📥 belie 게이트 적재(실행 안 함)** — ③ 을 #615 본체 revert 로 갈지 타겟 fix-forward 로 갈지. **D 권고=fix-forward**(#617 패턴 void SQL 1개 + UI effectiveMonth→nextMonth 고정, #615 revert 는 기능 전면 제거라 과대). DevA revert 착지 시 D 검증 → 이후 W1-1 PR 부터 VERIFY 계속.
- SoR: dispatch-queue `r4-wave1-verify` (blocker_commit_map·minimal_revert_set·blocker3_gate)

### 2026-07-26 · DevD(VERIFY) · R4 wave-1 판정 = **NO-GO** — 비대상 기수 회귀·데이터 손실·이중계상 3 blocker
- 의도: R4 wave-1(비용원장 #615~#621) VERIFY 트랙 — 적대리뷰·구조가드·비대상 기수 불변 검증 후 GO/NO-GO.
- 한 것: 기계게이트 실측(**check.sh PASSED** on e4b0d1e — 신규 타입 SSOT 등재 포함) + 4렌즈 적대검증. L1 비대상기수불변 **FAIL**·L4 도메인정확성 **FAIL**·L2/L3 CONCERN. 에이전트 주장을 **D 가 코드 직접 읽어 3건 CONFIRMED**: ①#620 이 전 기수 공용 파서(lib/repo/db.ts:108 neo 판정) 변경 → 비파일럿 직접생산 비용·영업이익이 입력 변경 없이 바뀜(legacy O열 잔여문자 1자에 금액 전도) ②read/write 필터 비대칭(:122 완화 vs :245 그대로) → 보이는 행을 다음 추가가 덮어쓰는 **조용한 데이터 손실**(:241 주석의 대칭 불변식 위배) ③split 이 occurrence void SQL 없음(archive 경로엔 있음) → 같은 달 **이중 계상**, UI '다음 달부터'가 실제로는 조회 중인 달.
- 결정: **NO-GO**(라이브 배포 상태라 이미 영향 중). 조치안 A=#620(fed3307) revert / B=fix-forward 4건. 소유=Codex DEV-*, 최종 GO 는 belie 라이브 확인과 함께.
- 다음: 소유 트랙 조치 → D 재판정. 비차단 major 5건(비파일럿 대시보드의 Postgres 동기의존·query timeout 부재, archived GET→INSERT, 아레나 scope 갈라짐, cohort 게이트 미명시, db.ts 498/500)은 현황판 유지.
- SoR: dispatch-queue `r4-wave1-verify`

### 2026-07-24 · DevD(W0-C) · R4 wave-0 선행: R3 공식 재판정 + codex-stability STABLE 장부 + F 실측
- 의도: R4 wave-1 착수 선행조건(W0-C) — R3/codex 판정 공식 장부화 + F 트랙 실측 확정.
- 한 것: ①R3 공식 재판정 = **코드레벨 PASS** 재확인(§7 6수용기준 + correctness 3플래그 닫힘; L4=append 미러실패 silent 를 #598 union 시트 fallback 으로 종결·배포·health 200) → dispatch `r3-lockdown-close=done`. ②codex-stability = **STABLE**(#612): 2 blocker 실측 해소(AGENTS.md 추적+실질규약 #602 / 드라이런 채점표 registry 정본 5 PASS + relay #610 + 환경블로커 §C 박제 #611), L3 급소(전면소진 relay 주체)=takeover-runbook §C.5 명문화(belie 확정: 수동머지 or 한도리셋까지 머지동결), #605 회귀위험 경고 등재 → dispatch `codex-stability-gate=stable`. ③F 실측: EOL #603(.gitattributes LF 기계강제, autocrlf 착시 규명·내용무변경, 배포 health 200)·발굴피커 #591 MERGED·TRACK-F idle/ready.
- 결정: R3·codex 판정 모두 확정 + F ready → **R4 wave-1 선행조건 3건 전부 초록**. residual(hardening, blocker 아님): #605 close(belie 판단)·registry 트랙줄 stale(소유 트랙)·A(인수) full 왕복 1회 실연(B-1 축소판 자인).
- 다음: R4 wave-1 착수 가능. W0-C 완료 — belie 경유 Cowork 회신.
- SoR: dispatch-queue `codex-stability-gate`·`r3-lockdown-close`, takeover-runbook §C.5, registry `CODEX-DRYRUN.scoring_result`

### 2026-07-24 · Codex DevB · 반복 비용 삭제/종료 soft archive P1 보완 (독립 재검증 대기)
- 의도: 이미 배포된 반복 규칙 DELETE terminal soft archive 계약을 Option A 관리 행에서 안전하게 사용할 수 있게 하고, 여섯 항목 수용 감사의 마지막 P1 공백을 닫는다.
- 한 것: DELETE hook을 기존 원장·카테고리·반복 규칙·대시보드 cache invalidation에 연결하고 invalidation 완료까지 mutation을 기다리게 했다. active·paused 행에 과거 비용 보존을 설명하는 인라인 `삭제/종료` 확인, 취소, safe `401/403/503` 오류와 재시도를 추가했다. archived 행은 앞으로 재발생하지 않는 terminal 안내만 보이고 모든 mutation action을 숨긴다.
- 결정: 이 작업은 물리 삭제가 아니라 서버 soft archive만 호출한다. 성공 뒤 관련 네 query를 갱신하며, 실패 시 행과 확인 상태를 유지한다. backend route/repo/service와 운영 데이터는 변경하지 않는다.
- 증거: focused DOM 14/14, `scripts/check.sh` 86 files·801 tests, production build, `git diff --check`를 통과했다. 로컬 mock의 1280 확인, 390 오류·재시도, 360 성공·archived terminal, 390 스크롤·sticky CTA 캡처는 모두 기대 문구와 가로 overflow 없음·console error 0을 확인했다.
- 다음: DevE 독립 재검증으로 넘긴다. PASS 전에는 Git publication·merge·deploy를 시작하지 않는다.
- SoR: `docs/plans/active/expense-mobile-ui-a-r4.md`, `lib/query/expense-ledger-hooks.ts`, `components/dashboard/expense-ledger/ExpenseLedgerDialog.tsx`

### 2026-07-24 · Codex DevB · 비용 원장 모바일 Option A 구현 (VERIFY 대기)
- 의도: 승인된 Quick Action Dock을 360/390 모바일 제품 UI에 적용하면서 기존 비용·반복 API 계약과 PC 동작을 보존한다.
- 한 것: 압축 비용 요약과 기록/조회/관리 작업 탭, 카테고리 combobox 관리, 일회성 포함 일할과 분리된 반복 일정, 전체 카테고리 비용/비중/항목 수 표, 목록 행 상세, 하단 고정 저장 CTA를 구현했다. focused DOM 7건, check.sh 794건, production build, PC/360/390 브라우저 검증(error 0)을 통과했다. 디자인 artifact와 core/API는 변경하지 않았다.
- 결정: 카테고리 삭제 API는 추가하지 않고 사용 이력 보존을 위해 차단+보관 안내로 처리한다. 제품 구현은 신규 독립 VERIFY PASS 전까지 commit/push/PR로 진행하지 않는다.
- 다음: DevA가 DevD가 아닌 신규 독립 검증자를 지정해 구현 VERIFY를 수행한다. PASS 뒤에만 commit/push/PR·merge·deploy·health/live 체인으로 이동한다.
- SoR: `docs/plans/active/expense-mobile-ui-a-r4.md`, `components/dashboard/expense-ledger/ExpenseLedgerDialog.tsx`

### 2026-07-20 · F(260712) · KPI-④ EOL renormalize (막차) — .gitattributes LF 정책 기계강제 (#603)
- 의도: 레포 전반 EOL 노이즈 근절(막차, 머지 최우선). .gitattributes + renormalize 단독 PR.
- 한 것: **§0.5 진단으로 오진 정정** — `git ls-files --eol` 실측 결과 저장소(index)는 **이미 100% LF**(i/crlf·i/mixed 0건). 디스패치의 "~720파일"은 `core.autocrlf=true`가 Windows 체크아웃 시 작업트리를 CRLF(w/crlf 829)로 바꾼 **착시**(커밋 diff 아님). 진짜 가치=정책 부재 → `.gitattributes`(`* text=auto eol=lf` + 바이너리/배치 규칙)로 LF 기계강제(autocrlf 무관 CRLF 재유입 차단·경고 근절). `git add --renormalize .` → .gitattributes 1파일만 스테이징(내용 무변경 실측 증명). #603(1aa3b9a) 머지·배포 success·health 200.
- 결정: LF 단일화(저장소+작업트리). 배포=Linux·JS/TS=LF 관습. renormalize 는 저장소가 이미 LF라 no-op였음(오진이었지 무의미한 작업은 아님 — 정책 가드가 실 산출).
- 다음: #596(DB 유실 급행) D 라이브 재검증 대응 대기 / 큐 신규 배정.
- SoR: `.gitattributes`(커밋 헤더에 진단 전문)

### 2026-07-20 · Claude Code · R3 최종 판정 + §7-3 L4 종결: append 미러 실패 시트 보충 (fix/db-read-append-fallback)
- 의도: R3 전체를 코드 레벨로 완료 판정. 적대 4렌즈 검증 결과 §7-3 안전망(mirror_pending #587)·#559(→#568)·#558 잔여4(→#569)는 전부 RESOLVED, 유일 잔여 L4(append CREATE 의 silent 반쪽쓰기)만 blocks. belie 결정=옵션1(누락행 시트 fallback).
- 한 것: read 진입점 3곳(loadContractPayments·loadDBOverview·loadLeadsForPicker)을 union 으로 — DB 정본 + 시트 read **병렬** → 시트 누락행(=append 미러 실패로 DB 부재)만 row 조인 보충. 신규 lib/service/sheet-backfill.ts(순수 헬퍼, 계약은 linkedMeetingId 2차 dedupe) + 테스트 10케이스. check.sh 초록.
- 결정(자율, §0.7): 미러 실패 원인=DB blip 이라 옵션2(append durable redrive)는 무력(찍을 DB 행이 없음) → 시트 보충만 견고(belie 옵션1과 일치). R2-4/R2-5 "파일럿 시트 0회" 속도이득 반납(병렬이라 지연=시트 수준). 정합·정직성>속도(§0). 비파일럿 완전 불변.
- 다음: PR 오픈→머지→배포 success·health 200 확인 후 R3 완료 선언. 복구=revert 1커밋(정본 DB, 손실 없음).
- SoR: docs/plans/active/append-mirror-sheet-fallback.md

### 2026-07-20 · F(260712) · 급행: DB생산 카드 거짓 dirty·데이터 유실 수리
- 의도: belie 리포트(연습용) — DB생산 최신카드에서 ①이전 저장 내용 날아감 ②"저장 후 이동" 이탈 가드 반복. 유실급.
- 한 것: 근인 3겹 순차 수리(3커밋). ① dirty 판정을 첫 computed 스냅샷 → 순수함수 `rowFormDirty`(자동필드 제외+타입정규화)로 이관, RowForm `onDirtyChange` 보고, blank `[channel.cls]` 메모로 refetch 유실 차단. ② RowCard 접힘 시 dirty 해제(useState 얼음 회귀) + onExpand·+추가 guardedNav 로 선확인. ③ handleSave 저장 실패 rethrow(saveAll 실패 관측 → 이동 취소·편집 보존). 회귀테스트 9(거짓 dirty 0). check.sh 초록(725).
- 결정: dirty 판정은 컴포넌트 밖 순수함수로(테스트 가능), 비동기 저장 콜백은 실패를 throw 로 전파(가드 관측). 상세=incident.
- 다음: 머지 → §6.8 배포 관찰 → **D 재검증 요청**(dispatch 지시). 하네스 갭=컴포넌트/이펙트 테스트(RTL) 인프라 부재(별도 트랙 제안).
- SoR: `docs/incidents/2026-07-20-db-card-dirty-guard-dataloss.md`

### 2026-07-19 · Claude Code · 공용부 선행: lib/types/index.ts 도메인 분리(배럴) — 500줄 캡 해소 (#589)
- 의도: index.ts 가 정확히 500줄(check.sh 캡 경계) → 발굴 체인 PR-5·6 및 타 트랙이 타입 추가 시 즉시 막힘. §3.5 공용부(lib/types) 단독 PR 로 선제 분리해 언블록.
- 한 것: index.ts → 8개 도메인 파일(channel·meeting·db·user·contract·todo·announcement·dashboard, 각 ≤118줄) 분리 + `export *` 배럴(14줄). contract-status 재수출은 contract.ts 흡수. doc-drift.sh §C grep 대상 `index.ts`→`lib/types/*.ts`(-h) 확장(심볼 27개 검사 유지). data-model.md 경로 프로즈 갱신. check.sh 초록·CI 초록·#589(ca4efb5) squash 머지·배포 success(29670671592)·health 200.
- 결정: 소비자는 `@/types` 배럴만 사용(deep import `@/types/*` 0건 사전확인) → 전 소비자 무변경. 배럴 재수출은 doc-drift `^export const X = z.` 패턴에 안 걸리므로 대상 경로 확장이 가드 유효성의 필수조건.
- 다음: 발굴 체인 트랙은 이제 db.ts·meeting.ts 등 도메인 파일에 타입 추가 가능(각 파일 500줄 캡 개별 유지). #589 직후 발굴 PR-2(#590)가 리베이스 없이 클린 머지 확인.
- SoR: docs/plans/completed/types-barrel-split.md, PR #589

### 2026-07-17 · Codex(260717) · 대시보드 client directive 오류 복구·배포 완료 (#576)
- 의도: `salesptlog.online` 서버 오류 신고를 진단하고, #575 이후 실패한 운영 배포를 정상화한다.
- 한 것: `DashboardProgressBanner.tsx`·`OperatingProfitCard.tsx`의 `"use client"`를 최상단으로 이동. `scripts/check.sh`·구조검사 10/10·테스트 630개 통과 후 PR #576 squash merge(`c1dd7de`).
- 결과: Deploy run #29549181566 success(4분 21초), VPS HEAD 일치·BUILD_ID 존재·PM2 online·로컬 `/` 및 `/api/health` 200·공개 루트 5회 연속 200 확인.
- 결정: 원인은 머징 충돌이나 런타임 데이터가 아니라 #575의 두 파일에 생긴 Next.js client directive 순서 오류. 기존 프로세스가 살아 있어 일시적으로 루트 200이었지만 소스와 실행 빌드가 불일치했다.
- 다음: 없음. Node.js 20 기반 action deprecation 경고는 이번 장애와 무관한 별도 유지보수 항목이다.
- SoR: docs/plans/completed/client-directive-order.md, PR #576, Actions #29549181566

### 2026-07-12 · DevC(260712-2) · 트랙 C 마감 — read-only close 확정, plan 2건 completed 이동
- 의도: belie ①read-only close 결정(카나리아 없이 종료) → 트랙 C 종료 절차 실행.
- 한 것: ①`contract-termination.md`·`contract-delete-ghost.md` → completed 이동(status: completed·completed:2026-07-12) ②worklog 마감 항목 추가 ③보드 C행=완료(종료). docs 전용 PR(코드 무변경)로 커밋·머지·배포 관찰.
- 결정: 트랙 C 스펙 종결 확정 — #527~534 머지·배포 success·health 200·코드층 독립감사(단위테스트 매트릭스+repo write 가드-clean+delete cascade) 통과. 라이브 쓰기 왕복 카나리아는 belie 판단으로 생략(로직층 이미 검증). 02 구역 소유권 A(R3-3)로 이관.
- 다음: 유보 1건(퍼널 계약수·전환율 해지 제외=04 미팅 상태 기반 전 시트 수식 전파)은 belie 별도 결정 항목. 결정 시 구현은 §2.5 가드+전파 dry-run 필수.
- SoR: docs/plans/completed/{contract-termination,contract-delete-ghost}.md, PR #527~534

### 2026-07-12 · Claude Code · R3-2 PR-1: 실무투두(05) 쓰기·읽기 DB 정본 전환 (feat/db-write-todos-carry)
- 의도: belie "r3-2~5 시작"(무감독 완주 루프). R3-2 를 PR-1(todos 단독)/PR-2(meetings+carryover) 분할 — 이월은 tab="meetings" 라 PR-2 로.
- 한 것: chooseWriteSource 게이트(create/patch/remove) + writeRowToDb/clearRowInDb(client.ts) + **listTodos 읽기 동반 전환** + 시트 미러를 **수렴 동기화**(queueSheetSync 시트별 직렬 큐, 최신 DB 상태로 update-or-append/clear, gcal reconcile 은 행 보장 후 await)로 설계. 적대 리뷰 4라운드(6→12→2→0건 수렴), check.sh 초록(388+10).
- 결정: ①쓰기 flip 은 같은 표면 **읽기 동반 flip 필수** ②미러는 연산 재생이 아닌 **상태 수렴**이어야 레이스 자기수정 ③patch 는 _cleared(삭제)와 DB 공백을 구분(공백만 시트 self-heal) — 셋 다 db-write-flip.md §6 에 R3-2 PR-2·R3-3~5 의무로 등재.
- 다음: 머지→배포 관찰→파일럿 실사(생성/완료토글/삭제 + 시트 미러 Drive 대조 — ⚠️ 병렬트랙 A 발견 "practice cohort=''=비파일럿" 반영해 계정 게이트 선확인) → PR-2(meetings).
- SoR: docs/plans/active/db-write-flip.md §6

### 2026-07-12 · DevA(260712) · R3-2 write-path 테스트갭 해소 (#537 머지·배포)
- 의도: #535(R3-2 PR-1 todos)가 게이트/롤백(daily-source.test)만 커버하고 05 실무투두 서비스 CRUD 쓰기경로 단위테스트 0건인 갭(선세션 플래그) 해소. 승계 시점 디스패치는 belie 부재+"테스트 보강=안전작업 대기지침" → 원자 PR로 선처리(이후 갱신된 디스패치의 "R3-3에 포함" 의도를 결과적으로 선충족·재포함 불필요).
- 한 것: tests/service/todos.test.ts 15케이스 — create/patch/remove/list DB경로 인자정합 + 비파일럿 R2 완전불변 + 미러 수렴(append mirror:false·reconcile await)·미러 실패격리(caller 성공+Sentry). check.sh 초록(유닛 435). #537 squash 머지(469a61b). 배포 1차 실패=VPS SSH connect timeout(인프라·빌드 전 단계·코드무관, §6.8 "Setup SSH 실패" 케이스) → `gh run rerun --failed` success → 공개 health 200.
- 결정: R3-2 §7 테스트갭 종결. 롤백 불필요(테스트 전용·프로덕션 코드 무변경).
- 다음: R3-3(contracts+company_archive 쓰기 전환) belie 상세 프롬프트 대기. C 종료로 02 구역 소유권 확보(DevC 마감 커밋 worklog 충돌만 주의).
- SoR: tests/service/todos.test.ts, docs/plans/active/db-write-flip.md §6·§7, PR #537

### 2026-07-12 · DevD(260712) · 속도 성적표 완성·게시 — DB 읽기전환 5 route 목표달성 확인
- 의도: Cowork가 언블록(raw 추출)해준 데이터로 DB전환 전/후 속도 리포트 완성 → PR 코멘트.
- 한 것: `scratchpad/db-speed-raw-2026-07-12.md`(레포 scratchpad, 세션격리 아님) 가공 → 전/후 비교표+
  판정+미달원인 작성(`scratchpad/db-speed-report-FINAL.md`). belie 승인 후 **PR #491·496·499·500·509
  5건에 요약 코멘트 게시 완료**(issuecomment 4950078488·078728·078977·079256·079514).
- 결과: ✅5 route 목표(≤300ms) 대폭달성 — p50 22~36ms(전 396~1,845), 후 sheets_ms p50=0 수렴
  (daily −99%). 🟡dashboard 부분(p50 −66%, p95 51,165→3,217=−94%). ❌todos 미반영=측정창이
  todos DB전환 #535(7/12) **이전**(표2가 sheets_ms 424~597 확증) → 전환실패 아님.
- 결정/판단(§0.5): 이 창에 온 **"[병렬트랙 B 인계]" 프롬프트는 낡음/오배송** — 실측상 B는 별도 몸
  DevB(260703)가 gcal로 소유(방금 #538 오픈) → 이중점유 회피 위해 무시, belie 재확인받고 DevD 유지.
- 다음: #535 전면배포·파일럿 확대 후 todos·dashboard 재측정(그때 5 route처럼 수렴 예상). 신규 작업 대기.
- SoR: scratchpad/db-speed-report-FINAL.md, db-speed-raw-2026-07-12.md, PR #491·496·499·500·509

### 2026-07-12 · DevB(260703) · gcal 트랙 승계 + 관찰성 구멍 수리 PR(#538) — 머지는 belie 승인 대기
- 승계: 트랙 B가 gcal 트랙(카나리아·버그수정·QA) 이어받음(원본 카나리아 세션 인수인계). 남은 일 4건 중 belie 부재 무관하게 자율 실행 가능한 유일 항목 = pm2 로그 무음실패 조사(§0.5②, Observability/Hashimoto).
- 진단: gcal 라우트 6개 전부 `withApiTiming` 미적용 → 다른 ~60개 라우트와 달리 durable 관찰 채널(PostHog `api_timing`)에 안 잡힘 = "resync 500인데 로그 0줄"의 근인. callback은 OAuth 실패를 `?gcal=error`(307)로 삼켜 성공처럼 보임(무음).
- 한 것: PR **#538**(chore/gcal-route-telemetry) — 핸들러 8개 withApiTiming 래핑(500→PostHog `api_timing status=500`, pm2 로그와 무관 채널) + callback catch에 `captureServerEvent("gcal_connect_error")` 1줄(비-PII). withApiTiming=catch→re-throw라 **무동작변화**. check.sh 초록(구조10·단위420). 인시던트 노트 작성.
- 결정: **머지=프로덕션 배포는 보류 → belie 승인 대기.** belie 복귀 + 인수인계가 "제안" 프레이밍 + outward-facing 액션(DevD PR코멘트 대기와 동일선). 잔여=pm2 out 로그가 배포 몇 분 후 침묵하는 인프라 원인(VPS 필요, DevE 구역 근접).
- 다음: belie 머지 승인 시 §6.8(리베이스→머지→배포 conclusion=success→health 200) 완주. 그 후 resync 회귀 카나리아(belie 승인)·워크트리 정리(belie 승인)는 belie 결정 대기.
- SoR: PR #538, docs/incidents/2026-07-12-gcal-observability-gap.md, docs/plans/active/google-calendar-sync.md Log(2026-07-12), lib/analytics/api-timing.ts

### 2026-07-12 · Cowork(오케스트레이터) · 승계(fable) — DevD 언블록(PostHog raw 직접 추출) + C 종료 결정 + R3-3 발행
- 승계: opus → fable(260712). GitHub 재실측 — Open PR 0·Deploy #477 success·health 200(변화 없음). belie 복귀.
- 한 것: ①belie 결정 수령 — DevC 카나리아 = **①read-only close 확정** ②PostHog 쿼리를 Cowork가 직접 실행(belie 크롬 로그인 세션 경유, HogQL query API — MCP의 exec 도구는 이 세션에 미노출이라 크롬 경로 사용) → route 7종 전/후 14행 + todos·dashboard 일자별 12행 추출, `scratchpad/db-speed-raw-2026-07-12.md` 저장 = **DevD 언블록** ③디스패치 전면 갱신(A=R3-3 착수·B=gcal 조사 계속·C=close 절차·D=raw 전달·E=belie 직접 3건) + A·C·D 프롬프트 발행(belie 붙여넣기).
- 소견(가공은 DevD): 5개 route 후창 p50 22~36ms·sheets_ms p50=0 수렴. todos만 미수렴(p50 672·sheets 556 — R3-2 #535가 7/12 배포라 후창 대부분이 이전 + 파일럿 한정 혼합 추정), dashboard 부분 수렴.
- 다음: belie가 A·C·D 창에 프롬프트 붙여넣기 → A는 R3-3, C는 마감, D는 리포트 완성. belie 직접 3건(Secret·DB비번·퍼널 계약수 결정)은 별도 안내.
- SoR: scratchpad/db-speed-raw-2026-07-12.md, 디스패치 섹션(본 파일 상단)

### 2026-07-12 · DevC(260712-2) · 승계 — 코드층 독립 재검증(스펙 완료 확인), 카나리아만 미검
- 승계: 트랙 C(260712→260712-2). 디스패치 "수납·계약해지 스펙 완주"는 이미 완료(Cowork PR레벨 실측과 일치): #529~534 MERGED·배포 success·health 200·Open PR0·feat/c-payment-cancel 브랜치 부재.
- 한 것: PR레벨 위에 **코드층 적대적 감사** 추가 — ①단위테스트 매트릭스 충분(파서 AL~AO 왕복·DB payload 필드명+열문자 동치·매출규칙 정상/이월/split·서비스검증·6케이스·휴힐링 실시나리오) ②repo writeTermination 안전(AL~AO 전용 신규컬럼 단일행 update=§2-5 bulk-guard 비대상·헤더행 보호·그리드41 선보장·dual-write 미러) ③delete cascade=contracts-clear-sync.test 보유.
- 결정: 미검 항목=**순수 라이브 통합(실시트 쓰기왕복)뿐** — 로직층은 belie 없이 이미 검증됨(옵션① read-only close 근거 보강). 신규 Sheets-mock 테스트는 한계효용<공수(YAGNI) 미작성. 카나리아 재실행 안 함(§0.5③), belie 3택·plan completed 이동은 결정 후 불변.
- 다음: belie 결정 대기. belie 대기건(퍼널 계약수 해지반영)·타 트랙 구역 무접촉.
- SoR: tests/service/contract-termination.test.ts, lib/repo/contract-payment-termination.ts, docs/plans/active/contract-termination.md §3

### 2026-07-12 · Cowork(오케스트레이터) · 승계 + 6트랙 실측 재검증 — C→A→F 전부 완주 확인
- 승계: fable 세션에서 opus 세션으로 오케스트레이터 승계(260712).
- 한 것: GitHub PR·Actions·라이브 사이트 실측으로 6트랙 재검증. 핵심 발견 — 머지 우선순위
  C→A→F **전부 이행 완료**(보드는 stale이었으나 실측으로 확인):
  ①C: #529~534 전부 MERGED, Deploy #470~475 전부 success
  ②A: #535 MERGED, Deploy #476 success (3m 29s)
  ③F: #536 MERGED, Deploy #477 success (3m 0s)
  라이브 health 200, DB 파일럿 OK (110ms, 1643행). Open PR 0건.
- 결정: 디스패치를 현재 상태로 갱신(구 "C→A→F" 완주 반영). A트랙 보드 stale 지적.
  DevA 다음 임무 = R3-3(contracts 쓰기 전환). DevD PostHog raw 추출은 Cowork 시도 예정.
- 다음: ①DevA에 R3-3 디스패치 준비 ②DevD용 PostHog 데이터 추출 시도 ③belie 복귀 대기건 정리
- SoR: docs/worklog.md 디스패치 섹션, GitHub Actions Deploy #470~477

### 2026-07-12 · DevD(260712) · 속도 리포트 승계 — 블로킹 재확인 + 스캐폴드/HogQL 선제작
- 승계: 트랙 D(260712 신 몸). 미션=DB전환 속도 전/후 리포트, 레포 무접촉(읽기+PostHog만).
- 재확인: 전 세션 블로킹 조건 그대로 — PostHog 쿼리 접근 없음(MCP 미연결, 실 env `.env.local`/
  `.env.production`에 phx_/phc_ 없음=`.env.example`만, VPS pm2 로그 접근 없음), Cowork raw 미전달
  (docs/handoff/inbox·scratchpad·HANDOFF.md 모두 신규 데이터 0).
- 한 것(대기 중 안전 전진, §0.5②): ①route 상수 정확값 코드에서 추출(`api-timing.ts` withApiTiming
  인자 — 선행슬래시 없음·`:GET` 접미사·status 숫자) ②붙여넣기용 HogQL 2본(전/후 창) + 비교표
  스캐폴드 + 미달원인 프레임워크를 scratchpad `db-speed-report-scaffold.md`에 준비. raw만 오면 즉시 채워
  PR #491·496·499·500·509 코멘트 게시 가능.
- 다음(언블록 조건): Cowork/belie가 scaffold의 HogQL 실행→raw 표 전달, **또는** PostHog MCP 연결.
  그때 DevD가 표 완성→PR 5건 코멘트+worklog 완료 요약. 그 전까지 belie 대기건·타 트랙 구역 무접촉.
- SoR: docs/plans/active/api-timing-baseline.md, scratchpad/db-speed-report-scaffold.md, PR #491·496·499·500·509

### 2026-07-12 · DevF(260712) · gcal 45열 트랙 완주 — 04 열수 전수조사(#536) 머지·배포
- 의도: 45열 시트 gcal 버그 수리 트랙 마무리 — 완료기준 3(읽기 가드/전수조사 표/배포 관찰) 충족.
- 한 것: 읽기 가드는 이미 #522 머지·배포됨을 확인(criteria 1). READ-ONLY 전수조사 스크립트
  (`scripts/census-04-grid-2026-07-12.mjs`)로 trainee 68시트 04/05 열수 실측 → #536 머지·배포
  success·health 200(criteria 2·3). plan §2 census 표 등재.
- 결정: **67/68 시트가 04=45열(AT 미생성) → #522 읽기 가드가 프로덕션 전체 안전망으로 작동 중**.
  04 일괄 45→46 확장은 YAGNI(읽기 가드 + 첫 토글 자동확장, 대량쓰기=belie 승인)로 기각 —
  45열은 버그 아닌 가드 처리 정상 상태로 확정. 05 O(15) 취약 0건.
- 다음: DevF 트랙 완주. 신규 작업 대기(belie/디스패치). 45열 관련 회귀 재점검 불필요.
- SoR: docs/plans/active/google-calendar-sync.md §2, PR #522·#536

### 2026-07-12 · DevD(260712) · 속도 전/후 리포트 — PostHog 접근 부재로 ⛔블로킹, Cowork에 데이터 추출 핸드오프
- 의도: DB 전환(R2 읽기) "공식 성적표" — route별 p50/p95 전/후 비교표 작성 → PR #491·496·499·500·509 코멘트 + worklog 기록.
- 블로킹: 이 Claude Code 세션엔 **PostHog 쿼리 접근 없음** — 개인 API키(phx_)·PostHog MCP·VPS pm2 로그 모두 부재(로컬 .env엔 PostHog 키 자체가 0). #484는 계측 코드만 머지, 기준선 "숫자"는 미기록(PostHog에만 존재). belie 결정=**Cowork가 추출**(접근권 있는 쪽이 raw, DevD가 가공).
- 데이터 요청 스펙(Cowork 실행): event=`api_timing`, 속성 `ms`(전체)·`sheets_ms`·`status`. 지표=route별 `quantile(0.5)(ms)`·`quantile(0.95)(ms)`+count, `status=200`만, tz=UTC. 대상 route(모두 :GET)= `api/daily/[date]` · `api/meetings/week/[weekStart]` · `api/meetings/month/[yyyymm]` · `api/contract-payment` · `api/todos` · `api/db` · `api/dashboard`. 창: **전** `2026-07-06 16:40 ~ 07-08 04:00`(계측 라이브~첫 R2머지 전, Sheets 서빙) / **후** `2026-07-09 01:00 ~ now`(전 R2 머지 후, 07-08 전환일 제외해 mid-flip 노이즈 차단). 보조로 `sheets_ms` p50도(후엔 0 수렴이 전환 성공 방증).
- 주의: api_timing은 서버 이벤트(distinct_id="server")라 is_internal(ADR-0013) 필터 불가·불필요. 전 창 표본 짧음(~1.5일)—p50 신뢰 우선, p95는 방향참고. 미개선 route는 원인후보 기록 예정(캐시적중 비중·병렬콜·DB콜드스타트 등).
- 다음: Cowork/belie가 위 스펙으로 raw 표 전달 → DevD가 전/후 비교표+미달원인 작성→PR 5건 코멘트+worklog 요약표 기록. 그때까지 belie 대기 3건·타 트랙 구역 무접촉.
- SoR: docs/plans/active/api-timing-baseline.md, db-migration-pilot §1·§5, lib/analytics/api-timing.ts, PR #484(계측)·#491·496·499·500·509(R2 전환)

### 2026-07-12 · DevC(260712) · 계약해지 카나리아 — 배포·라이브 read-only 검증 OK, 쓰기 왕복은 보류(belie 승인 필요)
- 승계/맥락: C 트랙 승계. 미션="belie 대신 해지 왕복 카나리아→통과시 최우선 머지". **정찰 결과 머지는 이미 완료**(#529·531·532·533·534 전부 MERGED 7/11, 보드의 "머지 대기"는 stale). 실제 남은 건 라이브 카나리아뿐.
- 한 것: ①배포 검증 — Deploy run 29167294141(#534) success·공개 health 200 확인(§6.8 충족). ②라이브 read-only — belie 실세션(salesptlog.online, 김믿음 7기)에서 새소식 팝업이 해지보관함 "새 기능"(개봉 7/12) 노출 = 이미 공개, 실무/수납 화면이 해지 매출정의(총매출=수임비+수수료, 아레나/이월 분리) 정상 렌더. ③쓰기 가드 검증(코드) — `getWritableUserEmail`(identity.ts:155)은 admin 세션 impersonation 쓰기 허용(#519의 gcal 403 과 대조, terminate 라우트는 쓰기 가능).
- 결정/블로킹: **쓰기 왕복 카나리아 자율 실행 보류**. 근거 — (a) 미션 선호 "연습 시트 임시 연결"=마스터 레지스트리 쓰기 → 표준 가드(worklog 182·211) belie 승인 필수·부재 (b) 대안=belie 본인 실시트(현재 계약 0건 클린)에 테스트계약 주입/해지/복구/삭제 무감시 → 실패 시 실매출 오염 (c) 카나리아는 머지 게이트 아님(코드 기배포·#534 자동 6케이스 검증 포함) → 부재 중 강행 한계효용<하방(§0.5③). "통과시" 하우스키핑(Changelog-Done 그룹공개·plan completed 이동)은 게이트 미충족으로 미실행(단 팝업상 그룹공개는 선세션이 이미 적용한 정황).
- 다음: belie 결정 대기 3택 — ①read-only+자동검증으로 close(권고, plan completed 이동) ②연습시트 연결 승인 or admin+연습 trainee 지정 → 임퍼스네이션 쓰기 왕복 ③본인 실시트 왕복(주입→전량 원복) 명시 승인. 결정 전까지 belie 대기건·타 트랙 구역 무접촉.
- SoR: docs/plans/active/contract-termination.md §3(수용기준), lib/auth/identity.ts:152, PR #529·531·532·533·534

### 2026-07-12 · DevA(260712) · R3-2 PR-1(todos DB 정본) 독립 검수 — 초록 재확인 + 테스트갭 1건
- 승계: 트랙 A(260703→260712). 디스패치는 "git복구 후 R3-2 검수" 였으나 **git 정상**(.git/config 797줄 무손상, status/config-list 정상) → 복구 불필요. R3-2 PR-1 은 Fable 5 body 가 커밋 완료(ea83429, 미머지).
- 한 것: ea83429 정적 검수(적대적). 설계 견고 확인 — ①읽기/쓰기 게이트 대칭(chooseDailySource=chooseWriteSource, read-your-writes) ②list 는 _cleared SQL 제외 ③writer/reader 동일 풀(getDbPool→getPool) ④repo mirror:false 로 DB 재미러 차단 ⑤gcal 고아이벤트 방지(reconcile 를 직렬큐 내 행보장 후 await) ⑥수렴 미러(잡마다 최신 DB 상태). 독립 재검증: typecheck 초록·구조 10/10·게이트테스트(롤백·비파일럿불변·대칭) 통과.
- 결정/발견: **테스트갭** — 신규 R3-2 write-path(queueSheetSync 수렴·patchTodo _cleared throw·removeTodo 순서·listTodos DB 필터/정렬)에 단위테스트 0건. 게이트/롤백은 daily-source.test 로 커버되나 plan §7 "미러 정합·미러 실패 시나리오"는 todos 신규 로직 미충족. 머지 전(=C 후) 보강 권고.
- 다음: 머지는 DevC 후(§6.8). 테스트 보강은 worktree 동시세션(Fable body) 충돌 회피 위해 소유권 정리 후. belie 대기 3건 무접촉.
- SoR: docs/plans/active/db-write-flip.md §6·§7, 커밋 ea83429

### 2026-07-12 · DevE(260712) · 03 DB관리 헤더존 유령 진단 — 구조분석 무혐의 (#527 대체 임무)
- 의도: belie 대기 3건 동안 대체 임무 — 02 94행 사고(#527)와 같은 부류가 03 DB관리
  (backfill 시작행 row4)에도 있는지 dry-run 진단만(수리 금지). #524 MERGED 재확인 완료.
- 한 것: 코드 정독 진단 — **02 사고의 두 조건이 03 에는 구조적으로 부재**.
  ① backfill 시작행 4 == 앱 FIRST_DATA_ROW 4(`lib/repo/db.ts`, headerRow=3·헤더 1~3행)
  → 헤더행 과대적재 없음(02 는 row≥3 적재 vs 실데이터행 6/5 불일치가 근인).
  ② DB-read(`read-db-tab.ts`)가 섹션별 isMeaningful+isSumRow+_cleared 로 **재필터**
  → 헤더존 잡음이 화면에 못 뜸(02 는 read 가 헤더행 raw 노출 → #527 이 isContractHeaderZoneJunk
  가드를 뒤늦게 신설한 것과 대조). cohort-template.ts 는 03 예시행 미시드.
- 결정: 03 DB관리 = **02類 헤더존 유령 무혐의**(수리 불필요). 실측 dry-run 스크립트 작성
  (read-only SELECT, #527 패턴 재사용) — VPS 실행용 scratchpad 보관, PR 미주입(직렬 머지
  C→A→F 방해 안 함). belie 대기 3건(Secret·기수왕복·DB비번 교체) 불변.
- 다음: (선택) VPS 에서 diagnose 스크립트 1회 → ②헤더존 rowNum<4·④진성유령=0 실측 확인.
- SoR: lib/repo/db.ts(FIRST_DATA_ROW=4), lib/repo/db/read-db-tab.ts(isMeaningful 재필터),
  scripts/ops/backfill-sheet-rows.mjs:120, scratchpad/diagnose-db-header-zone.mjs

### 2026-07-12 · Cowork(오케스트레이터) · 야간 디스패치 발행 — 5트랙 지시 + belie 부재 모드
- 의도: belie 외출 — 트랙별 다음 지시를 디스패치로 발행, 중복·충돌 없이 자율 진행
- 한 것: 보드·로그·GitHub 재검증 후 디스패치 5건 발행 — M(R3-2 완주, R3-3은 A 머지 확인 후),
  A(자체 카나리아→직렬 머지→§6.8 완주), B(속도 전/후 리포트), C(잔여=belie Secret 대기 →
  대체 임무: 03 DB관리 backfill 헤더존 유령 진단 dry-run), G(계속+완료 시 보드 갱신)
- 결정: 머지 우선순위 A → M(R3-2) → G → C진단(머지 없음) — A가 R3-3의 선행이므로 최우선.
  belie 복귀 대기 3건: ①퍼널 계약수 해지 반영(유보 승인 여부) ②ADMIN_DRIVE_REFRESH_TOKEN
  Secret 등록 ③DATABASE_URL 비번 교체(보안 권고)
- 다음: 각 트랙 완료 보고는 워크로그로. Cowork 은 다음 접속 시 보드 기준 재검증
- SoR: 활성 트랙 보드(상단), CLAUDE.md §3.5

### 2026-07-12 · Cowork(오케스트레이터) · 세션 배치도 정정 + 귀속 착오 교정 + B트랙 재배정
- 의도: belie 지시 — 세션 6개(Dev2·Dev2-fork·Dev3-A/B/C·45열fix) 배치 확인, 진행 중인 일 중복 지시 금지
- 한 것: 귀속 착오 자백·교정 — R3-0(#515)·R3-1(#518)은 **Dev2**의 성과(7/10 이전 머지), Dev3-B 아님(B가 "감 못 잡던" 원인 = 이미 완료된 임무를 배정받아서). R3-2 검수(21에이전트)도 Dev2 계열. 45열 gcal 버그는 전담 세션이 수리 중 — "A·B·C에 붙여라" 제안 철회. 워크로그 형식에 세션명 표기 의무화
- 결정: **R3 트랙 소유 = Dev2.** R3-3(수납 쓰기)은 Dev3-A 구역과 겹침 → Dev2는 A트랙 머지 후 착수. Dev3-B 재배정 = 속도 전/후 리포트(PostHog — 레포 구역 0, 충돌 불가능)
- 다음: 각 세션은 자기 이름으로 기록. 오케스트레이터는 지시 전 워크로그+GitHub 최신 PR로 귀속 확인
- SoR: CLAUDE.md §3.5, docs/worklog.md 형식

### 2026-07-12 · Claude Code · [병렬트랙 A] 작업2 보완 — 해지 보관함 + 6케이스 테스트 (Dev3-A 스펙 완주)
- 의도: 오케스트레이터 스펙 갭 2·3 — 숨김 해지 계약의 접힌 보관함 열람 + (없음/일부/전액)×(보존/숨김) 6케이스 매출·건수 검증
- 한 것: TerminationArchive(접힌 아코디언, 업체명·해지일·사유·반환액 읽기전용, 0건이면 미표시 — SSOT #533 선등재) + payment 페이지 배선(숨김=목록·건수 제외, 보관함 열람 — 500줄 캡 내 압축). 6케이스 매트릭스 + 휴힐링 시나리오(수임비0+전액반환+숨김 → 매출 기여 0·건수 제외·보관함 열람) 테스트 — 총 17 초록
- 결정: 스펙 항목 중 "전환율·시트 수식·아레나 계약 건수의 해지 제외"는 **범위 유보** — 계약수·퍼널은 04 미팅 상태 기반(시트 수식+DB 집계 쌍둥이)이라 해지 반영은 전 시트 수식 전파가 필요(그림자 diff 0 유지 조건과 충돌). 현행 = 02 기반 표시(실무/수납 건수·매출)만 제외, 매출은 전 지점(대시보드·아레나 split) 반환 차감. 퍼널 계약수 처리 = belie 결정 필요(통계 기본값 미확정 항목과 함께)
- 다음: belie 카나리아(해지 보존/숨김 왕복 + 보관함 확인). Dev3-A 스펙 잔여 0(위 유보 1건 제외)
- SoR: docs/plans/active/contract-termination.md, PR #533·본 PR

### 2026-07-12 · Claude Code · [병렬트랙 A] 작업1 보완 — 삭제 시트+DB 동시 반영 + 전 파일럿 대조 0
- 의도: 오케스트레이터 스펙 전문 수령 — 기완주분과 대조해 갭 3개(삭제 동기화·해지 보관함·6케이스 테스트) 보완 착수. 본 항목 = 갭 1
- 한 것: clearRow {syncDb} — 파일럿 삭제는 DB _cleared 를 await+1회 재시도, 최종 실패 = 사용자 에러(조용한 반쪽 삭제 금지). 비파일럿은 기존 fire-and-forget(DB 장애가 시트 화면 사용자를 안 막게). 게이트 = chooseDailySource 대칭. 회귀 5테스트. **전 파일럿 시트↔DB 계약 대조 1회: 파일럿 불일치 0**(비파일럿 3건 = dual-write 이전 계약 미러 부재, 화면 무영향 — R4 백필 대상)
- 결정(발견 2): ① practice 계정 cohort="" → 비파일럿(시트 read) — R3 의 "연습 DB=0 읽기이상"은 손상 아닌 미백필로 설명(R3 트랙 참고) ② 일회성 VPS 스크립트는 heredoc 생성 시 SA 키 파싱이 깨질 수 있음 — Write 도구 파일로 생성할 것(이번 오진 원인, #524 무혐의 확인)
- 다음: 갭 2·3(해지 보관함 + 6케이스 테스트) — feat/termination-archive
- SoR: docs/plans/active/contract-delete-ghost.md §4.5, PR(fix/contract-delete-sync)

### 2026-07-12 · Claude Code · [병렬트랙 A] feat/contract-termination 구현 — 계약해지 (Dev3-A 완주)
- 의도: 7/10 belie 스펙 — 실무/수납 [계약해지](사유 필수·반환 없음/일부/전액·보존/숨김), 매출=수임비+수납−반환액
- 한 것: 모델 #529(types AL~AO+SSOT 선등재) 후 본 PR — writeTermination(신규 repo, 그리드 41열+미러)·rowToCP/DB payload 파서 확장·terminateContract(검증 KST 해지일)·terminate 라우트·TerminationModal+ContractRow 뱃지/버튼·건수 "해지 N건"(상수 1개)·computeContractRevenue/split 에 totalRefunded 차감. 500줄 캡 3파일 분리(contract-status·nameHighlight·DeleteConfirmModal — 동작 무변경). 테스트 29 초록(해지 정합 9 신규)
- 결정: 이월 계약의 반환액은 이월 버킷 차감(기존 이월 규칙 일관). 해지 취소 UI 는 미구현(시트 AL~AO 비우면 복구 — 운영 절차). reverseShadowCompare 는 revenue 비대조라 경보 영향 0
- 다음: belie 카나리아(연습 계정 해지 왕복) 후 그룹 공개는 이 PR 의 Changelog-Done. 이용호 안내(휴힐링 정리+해지 사용법) = belie/Cowork
- SoR: docs/plans/active/contract-termination.md, PR #529·본 PR

### 2026-07-12 · Claude Code · [병렬트랙 A 보충2] feat/contract-termination 구역 확장 + 모델 계약 PR
- 의도: 계약해지 기능(7/10 스펙)이 선언 구역 밖 파일을 요구 — §3.5 규칙 1 보충 선언
- 구역 추가: `lib/service/dashboard.ts`(computeContractRevenue·매출 분할 — 반환액 차감 반영) · `app/api/contract-payment/**`(terminate 라우트) · `lib/repo/contract-payment-termination.ts`(신규, 500줄 캡 분리) · `app/(app)/payment/_components/TerminationModal.tsx`(신규). 기존 선언 트랙(B=docs·C=deploy)과 겹침 없음
- 한 것(공용부 계약 PR): ContractPayment 에 해지 4필드(AL~AO: 해지일·해지사유·반환액·해지숨김) + isTerminatedContract + TERMINATED_IN_CONTRACT_COUNT 상수(기본 제외 — belie 미확정, 상수 하나로 뒤집기) + SSOT 3문서 선등재(data-model·sheet-structure·components)
- 다음: feat 코드 PR(repo 파서·writeTermination·service·모달·매출 차감·테스트)
- SoR: docs/plans/active/contract-termination.md(코드 PR 이 생성), 7/10 이용호 스펙(워크로그)

### 2026-07-12 · Claude Code · [병렬트랙 A] fix/contract-delete-ghost 완주 — 02 헤더존 유령 계약 94행 수리
- 의도: 이용호(8기) 신고 ①휴힐링 삭제 불능 ②0원 계약 잔존 — Dev3-A fix 트랙 실행
- 한 것: **근인 확정(DB 실측)** = backfill 이 02 헤더·예시 구간을 row≥3 으로 적재 → 전 기수 94행 유령 카드(r3 "수납총액" 안내행 = 업체명 "0"·0원·건수 포함 / r5 "00유통" 110만 예시행 = 이월 카드), clearRow 헤더보호(row<6 거부)로 **삭제 구조적 불가** = 신고 재현. 휴힐링 r8 은 7/9 에 이미 _cleared — 초기 가설(미러 미반영)은 기각. 수리: #527(backfill 시작행 신형6/구형5 + repair 스크립트, 머지·배포 success) → VPS repair dry-run 94행 검증 → execute → **잔여 0 · 이용호 live=실계약 5건(시트 실측 ₩750,002 와 일치)**. 본 PR = isContractHeaderZoneJunk 읽기 가드 + 정합 테스트 4(총 10)
- 결정: mirror 무재시도(유령 일반형)는 R3-3(contracts 쓰기 정본 전환)이 구조 해소 — 이 fix 비접촉(§0.5). 03 DB관리 backfill 시작행(row4)은 유사 사고 여부 미검증 — db 트랙(R3-4) 확인 권장
- 다음: feat/contract-termination(계약해지 — 사유·반환·soft delete). 이용호 안내는 belie/Cowork(휴힐링 정리 확인 + 유령 카드 소멸)
- SoR: docs/plans/active/contract-delete-ghost.md, PR #527 코멘트(증빙)

### 2026-07-12 · Claude Code · [병렬트랙 C] 완주 — 관리자 Drive 토큰 서버 주입 (#524, 배포 success·200)
- 의도: 9기 생성 때 admin "기수 생성" 버튼 전원 실패(VPS .env 에 ADMIN_DRIVE_REFRESH_TOKEN
  미설정, ADR-0015) → 10기부터 버튼으로 되게 (Dev3-C: deploy.yml + docs/playbooks)
- 한 것: #524 머지·배포 success·health 200. deploy.yml 주입 스텝 **다중 키 일반화**(INJECT_KEYS,
  #481 패턴 불변 — stdin→원격 600 임시파일·awk 제자리 교체·값 미출력·rc=255 재시도) +
  ADMIN_DRIVE_REFRESH_TOKEN 추가 + 플레이북 "Secret 추가 절차" 일반화. **배포 실로그 실증**:
  DATABASE_URL "주입 OK — 키 존재 확인(값 미출력)" / ADMIN 토큰 "::warning:: 미설정 — 스킵".
  §3.5 준수: #523(계약 PR) 머지·배포 종료 대기 → 리베이스 + check.sh 재통과 → 직렬 머지
- 다음: **belie — GitHub Settings→Secrets→Actions 에 ADMIN_DRIVE_REFRESH_TOKEN 등록**
  (발급: `node scripts/get-admin-drive-token.mjs`) → 다음 배포에서 자동 주입("키 존재 확인" 로그)
  → admin 기수 생성 테스트 기수 1개 생성→삭제 왕복 확인 (남은 수용 항목 2개)
- SoR: .github/workflows/deploy.yml, docs/playbooks/deploy-vps.md "Secret 추가 절차", PR #524

### 2026-07-12 · Claude Code · [병렬트랙 A 보충] plan 문서 소유 명시 + gcal plan §5 완료 기록 회수
- 의도: ①B트랙 docs/** 선언과의 경계 명시 ②로컬 메인 pull 차단 마지막 원인 해소(gcal plan 로컬 수정)
- 구역 보충: `docs/plans/active/{contract-delete-ghost,contract-termination}.md` = A트랙 소유 — 트랙별 plan 문서(생성·completed 이동)는 그 코드 트랙 몫. B 의 docs/** 선언과 상충 시 이 두 파일만 예외
- 한 것: google-calendar-sync.md §5 를 ✅완료(2026-07-06 Cowork 실측)로 갱신 — HANDOFF 가 "최신 정본"으로 지목한 로컬 워킹트리 수정분 회수(#511 포함 예정이었으나 누락). gcal 트랙 파일이지만 1회성 회수 — 이후 gcal 문서는 gcal 트랙/B 몫
- 다음: 로컬 메인 pull 재개(잔여 차단 3종 전부 해소: worklog·CLAUDE.md=#523, gcal plan=본 PR) → A트랙 fix/contract-delete-ghost 착수
- SoR: docs/plans/active/google-calendar-sync.md §5, CLAUDE.md §3.5

### 2026-07-12 · Claude Code · [병렬트랙 C] 관리자 Drive 토큰 서버 주입 (chore/deploy-env-admin-token)
- 의도: 9기 생성 때 admin "기수 생성" 버튼 전원 실패(VPS .env 에 ADMIN_DRIVE_REFRESH_TOKEN
  미설정, ADR-0015) → 10기부터 버튼으로 되게. Dev3-C 트랙(구역: deploy.yml + docs/playbooks —
  .github 은 공용부지만 이 트랙 전용 대상이라 예외 선언)
- 한 것: deploy.yml 주입 스텝을 #481 패턴 그대로 **다중 키 일반화**(INJECT_KEYS 루프 —
  stdin→원격 600 임시파일, awk ENVIRON 제자리 교체, 값 미출력, rc=255 재시도, 미설정=경고+스킵,
  주입 후 키 존재 검증 로그) + ADMIN_DRIVE_REFRESH_TOKEN 추가. 플레이북 "Secret 추가 절차" 일반화.
  검증: YAML 파싱 + bash -n 4스텝 + ssh 스텁 전체 시뮬레이션 7케이스(교체/추가/멱등/접두유사키/
  스킵경고/특수문자) 초록
- 다음: **belie — GitHub Settings→Secrets→Actions 에 ADMIN_DRIVE_REFRESH_TOKEN 등록**(값은
  `node scripts/get-admin-drive-token.mjs` 재발급 또는 기존 보관분). 등록 후 배포 1회 → 주입 확인
  → admin 기수 생성 테스트 기수 1개 생성→삭제 왕복 검증
- SoR: .github/workflows/deploy.yml, docs/playbooks/deploy-vps.md "Secret 추가 절차", ADR-0015

### 2026-07-12 · Claude Code · [병렬트랙 B] R3-0 재지시 = 중복 판정 → 로드맵 등재·D3 답변됨 (#525)
- 의도: Dev3-B 지시 "R3-0 쓰기 정본 전환 플랜 등재(docs/db-write-flip-plan)" — 착수 전 §3 0.5 대조
- 한 것: db-write-flip.md = #515 기등재 + R3-1 로그 반영 확인, 지시 ①인벤토리~⑤가드 전 항목 기충족 → **재등재 안 함**(검증 로그만 추가). 실변경 = db-first-unlimited-roadmap.md 레포 등재(R2 플랜 죽은 링크 해소) + D3 답변됨(시트 미러 유지). 겸사겸사(CLAUDE.md §3.5 박제·워크로그 유니온)는 #523(A트랙 계약 PR)이 선행 이행 — 리베이스 no-op 확인
- 결정: 로드맵 파일 등재 = R3-0 이 "belie 판단 대기"로 남긴 건을 이번 오케스트레이터 지시로 확정 처리
- 다음: R3-2~5 는 오케스트레이터 지시 대기. 메인 체크아웃 #491 고착(pull 차단) 정리 필요
- SoR: docs/plans/active/db-write-flip.md(Log), PR #525

### 2026-07-12 · Claude Code · gcal 읽기 경로 45열 시트 grid limits 내성 (fix/gcal-event-ids-grid-limits)
- 의도: #521 카나리아 실측 버그 — 04 가 45열(AT 미생성)인 시트에서 gcal 읽기 400 → upsert 무음실패·[다시 올리기] 500·토글 초기상태 실패
- 한 것: readCell·readGcalStates 에 "exceeds grid limits" 400 → 빈 맵/기본 ON 처리(400+메시지 보수 가드, 그 외 에러는 전파) + 단위테스트 6종(tests/repo/gcal-event-ids-grid.test.ts) + 플랜 §2 등재
- 결정: 읽기 경로에 그리드 확장(쓰기) 안 붙임 — 확장은 setGcalEventId 만. 컬럼 없음=매핑·마커 없음(의미 동치)
- 다음: 배포 후 연습 시트(45열 상태) 회귀 확인 — 레지스트리 수정은 belie 승인 필요, 코드 리뷰·테스트 수준 검증으로 갈음
- SoR: docs/plans/active/google-calendar-sync.md §2

### 2026-07-12 · Claude Code · [병렬트랙 B] Dev3-B(260712~) 구역 선언 — docs/ 전용 (playbooks 제외)
- 의도: Dev3 병렬 배치 B트랙 시작 — CLAUDE.md §3.5 규칙 1(트랙 선언). 코드 파일 수정 금지 트랙
- 구역: `docs/**` 단 ①`docs/playbooks/**` 제외(C트랙 소유 — C 선언 준수) ②SSOT 4문서(design/components·design/tokens·domains/data-model·domains/sheet-structure)는 §3.5 공용부(계약) — 수정 필요 시 단독 PR 선행 ③`docs/worklog.md`는 전 트랙 공유 append(§3.5 예외)
- 겹침 점검: A트랙(수납 lib·app)·C트랙(deploy.yml+playbooks)과 겹침 없음(2026-07-12 확인). 워크로그 이본 유니온 병합·아카이브·헤더 복원은 A트랙 선행 계약 PR이 이미 수행 — 중복 착수 회피(§3 0.5)
- 다음: B트랙 작업 스펙 수령 후 착수. 머지는 §3.5 규칙 3(직렬 머지 + §6.8 배포 관찰)
- SoR: CLAUDE.md §3.5

### 2026-07-12 · Claude Code · [병렬트랙 A] Dev3-A(260712~) 구역 선언 — 수납(계약수납) 트랙
- 의도: Dev3 병렬 배치 A트랙 시작 — 7/10 이용호 신고 트랙(fix/contract-delete-ghost → feat/contract-termination) 실행. CLAUDE.md §3.5 규칙 1(트랙 선언)
- 구역: `lib/service/contract-payment.ts` · `lib/repo/contract-payment.ts` · `lib/repo/db/`(contracts read) · `app/(app)` 실무/수납 화면 (A트랙 전용)
- 겹침 점검: 기존 선언 = C트랙(deploy.yml + docs/playbooks) — 겹침 없음(2026-07-12 확인). B트랙 미선언 — B는 선언 시 이 구역을 피할 것
- 한 것(선행 계약 PR): CLAUDE.md §0.5·§3.5 를 master 에 박제 + 워크로그 이본 병합(로컬 Cowork 전용 항목 + master 전용 항목 유니온, 40개 규칙으로 최고(最古) 3건 아카이브) — 이 항목이 그 PR 에 포함
- 다음: fix/contract-delete-ghost(수납 화면 DB read 유령 행) → feat/contract-termination(계약해지). 머지는 §3.5 규칙 3(직렬)
- SoR: docs/plans/active/contract-termination.md(feat PR 이 생성), CLAUDE.md §3.5

### 2026-07-12 · Claude Code · [병렬트랙 C] Dev3-C(260712~) 구역 선언 — deploy.yml + docs/playbooks
- 의도: Dev3 병렬 배치(260712~) C트랙 시작 — CLAUDE.md §3.5 규칙 1(트랙 선언)
- 구역: `.github/workflows/deploy.yml` + `docs/playbooks/**` (C트랙 전용)
- ⚠️ 예외 선언: `.github/`은 §3.5 기준 공용부(계약)이지만 deploy.yml 이 이 트랙의 전용 대상이므로
  이번 배치에 한해 C트랙 단독 소유. 다른 트랙은 배치 기간 중 위 구역 수정 금지(필요 시 C에 위임)
- 겹침 점검: 로컬·origin/master 워크로그에 기존 [병렬트랙] 선언 없음 — 겹침 없음(2026-07-12 확인).
  Dev3-B 트랙은 세션 존재만 확인, 구역 미선언 — B는 선언 시 이 구역을 피할 것
- 다음: C트랙 작업 스펙 수령 후 착수. 머지는 §3.5 규칙 3(직렬 머지 + §6.8 배포 관찰)

### 2026-07-12 · Claude Code · 🐛 gcal 미팅 동기화 카나리아 — 성공경로 확인 + 45열 시트 버그 발견
- 의도: belie "미팅이 구글캘린더에 보이는지 직접 실험" — 동기화 엔진 첫 라이브 E2E 검증
- 한 것: belie 승인 하에 김믿음 행에 연습 시트 임시 연결 → 실계정으로 미팅 작성·삭제 E2E.
  **성공경로 확인**: 토글 ON 경유 시 이벤트 생성(제목·시각·장소·메모 정확, eventId 맵 기록)
  + 앱에서 미팅 삭제 → 구글 이벤트도 삭제. 실험 후 레지스트리·미팅·연결 전부 원상복구
- 사고(버그): **04 탭이 45열(A~AS)인 시트는 미팅 동기화 전멸** — gcal-event-ids 읽기
  (readCell/readGcalStates)가 AT(46열)를 ensureGridColumns 없이 읽어 "exceeds grid limits"
  400 → 생성/수정 훅 무음 실패 + [다시 올리기] 500(빈 응답). 실측 재현 완료(연습 시트).
  쓰기(setGcalEventId)만 그리드 확장 → 토글 ON 1회가 우회책(그리드 46열로 확장됨)
- 다음: **fix 필요** — 읽기 경로에서 grid 초과=빈 맵 처리(또는 ensureGridColumns).
  다른 실사용 시트 04 탭 열수 전수조사 권장(45열 시트 = 전부 동일 증상)
- SoR: lib/repo/gcal-event-ids.ts(readCell·readGcalStates), docs/plans/completed/gcal-per-user-identity.md
### 2026-07-11 · Claude Code · gcal 귀속 수정 라이브 카나리아 통과 → plan completed (#519 마감)
- 의도: belie "카나리아를 자체적으로 돌려봐" — #519(gcal 귀속·localhost 복귀 수정) 수용기준 마지막 항목을 에이전트가 직접 검증
- 한 것: 운영자 Chrome 실세션으로 2케이스 실측. ①임퍼스네이션: 표시=화면의 수강생 상태(connected:false·impersonated:true), 카드 "본인 로그인에서만" + POST/DELETE/resync 전부 403 ②본인 실연결: OAuth 동의 완주 → **salesptlog.online/calendar 복귀(localhost 0회)**, connected:true·본인 계정 귀속·캘린더 목록 실로드. 레지스트리 마스터 행 S(토큰)·T(settings) 저장 실측 후 연결해제+스크립트로 원상복구(재실측 둘 다 빈 값)
- 결정: 수용기준 전항목 충족 → plan 을 completed 로 이동
- 다음: gcal 후속(동기화 엔진 QA·다시 올리기 실사용 검증)은 별도 트랙
- SoR: docs/plans/completed/gcal-per-user-identity.md

### 2026-07-10 · Cowork(Fable) · 병렬 작업 규약 도입 (CLAUDE.md §3.5) + 첫 병렬 배치 3트랙
- 의도: 사용자 요청 — 오케스트레이터/스텝게이트 방식 중 우리 하네스에 없는 것만 도입해 병렬 개발
- 한 것: CLAUDE.md §3.5 신설 — ①트랙 선언(worklog에 구역 명시, 겹치면 순차) ②구역 소유+계약 먼저(공용부 변경은 단독 PR 선행) ③병렬 구현·직렬 머지(머지는 한 번에 하나+리베이스). 기존 하네스와 중복되는 것(AGENTS.md·문서 재편·tmux)은 기각
- 결정: 오케스트레이터 = Cowork 세션(프롬프트 생산·게이트 검증), 머지 게이트 = 기존 §6.8 그대로
- 다음: 첫 병렬 배치 — A트랙(수납: fix/contract-delete-ghost→feat/contract-termination), B트랙(R3-0 docs), C트랙(chore/deploy-env-admin-token). 구역 안 겹침 확인됨
- SoR: CLAUDE.md §3.5

### 2026-07-10 · Cowork(Fable) · 이용호 신고: 계약 삭제 불능(휴힐링) + 계약해지 기능 스펙 확정
- 의도: 8기 이용호 신고 ①휴힐링 계약 삭제 안 됨(환불+수임비 0 처리 후) ②계약 해지 경우의 수 없음
- 한 것: 레지스트리·이용호 시트 실측(계약 5건·수임비 ₩750,002 — 0원 계약이 건수에 잔존). 유력 가설 = R2-4 이후 화면은 DB read인데 삭제가 DB 미러에 미반영(유령 행 — A1-5 전례 부류). fix/contract-delete-ghost + feat/contract-termination 프롬프트 전달
- 결정(사용자 스펙): 실무/수납 각 계약에 [계약해지] — 사유 필수, 반환(없음/일부/전액+금액), 해지 상태 보존 또는 삭제 선택. **매출 = 수임비+수납 − 반환액(삭제여도 반환분만 차감)** → 삭제 = soft delete(숨김·데이터 보존)로 구현해야 규칙 성립. 해지 계약의 건수 반영 기본값 = 제외+"해지 N건" 별도 표시(단일 상수로 변경 용이하게 — belie 미확정 항목)
- 다음: fix 먼저 → feat. 완료 후 이용호 안내(휴힐링 정리 + 해지 기능 사용법)
- SoR: docs/plans/active/contract-termination.md(feat PR이 생성)

### 2026-07-10 · Claude Code · gcal 귀속 사고 수정 완주 (#519) — 임퍼스네이션 오귀속·localhost 복귀
- 의도: 실사용 사고 2건 — ①임퍼스네이션 화면마다 "연결됨"+마스터 행에 연결 저장 ②연결 후 localhost 복귀(수강생 실패 오인)
- 한 것: #519 머지·배포 success·200. 진단 확정: 6라우트 전부 세션 기준(표시까지) — 훅·다중행은 원래 안전.
  수정: gcalActorFrom(순수·4테스트) — 표시=active(그 수강생)/조작=본인만(403·selfonly), 카드 3상태
  임퍼스네이션 비활성+안내, appBaseUrl(AUTH_URL) 단일 기준으로 callback 복귀 localhost 제거,
  [다시 올리기] 힌트 토스트. 오염 정리: 마스터 행26 T(settings) 비움(S토큰은 원래 빈값 — 실토큰 오염 없었음).
- 결정: (프라이버시) 수강생 실이메일·이름을 커밋/PR/테스트에 넣지 않는다 — 분류기 차단 계기,
  픽스처는 example.com, 문서는 익명 표기(식별정보는 레지스트리에만). 이번 PR 아멘드로 소급 적용.
- 다음: 라이브 카나리아(belie 1분) — 실계정 연결→salesptlog.online 복귀+연결됨 뱃지+임퍼스네이션 selfonly 확인.
  통과 시 plan gcal-per-user-identity → completed 이동.
- SoR: docs/plans/active/gcal-per-user-identity.md, PR #519

### 2026-07-09 · Claude Code · R3-1 컨택 4지표 쓰기 정본 전환 (feat/db-write-daily) — 첫 R3 코드 PR
- 의도: belie "1,2,3 순차/논스톱"의 ②. R3-1=sales 컨택 4지표 저장을 시트→DB 정본으로 뒤집기(파일럿만)
- 한 것: `chooseWriteSource`(daily-source.ts, 읽기 게이트 대칭·isDbReadPilot 재사용) + `writeSalesRowsToDb`
  (client.ts **트랜잭션 원자 upsert**, 실패=throw 저장실패·시트폴백 금지) + `sales-write.ts`(persistSalesRows
  게이트 + fireSheetMirror 시트 비동기 미러 3회 백오프) + sales.ts `{mirror:false}` 옵션(DB 재미러 차단).
  contact.ts saveContactMetrics 를 persistSalesRows 로 위임(추출로 502→500줄). check.sh 초록(유닛 384)
- 결정: **스코프 = 4채널 배치 저장만**. 단일셀 writer(writeProductionCell E집계·decrement H)는 R2 유지
  (이미 R2 async DB미러 신뢰 중 → 비회귀). DB payload=R2 미러와 동일 → DB 읽기 동일값. 적대적 리뷰 진행
- 다음: **⚠️ 라이브 학생 저장경로** — ①(detached 배포)이 health 200 확인된 뒤 머지·배포 관찰. 롤백=chooseWriteSource 게이트 뒤집기 즉시 R2. 후속 R3-2(미팅)
- SoR: docs/plans/active/db-write-flip.md §6 R3-1, lib/service/sales-write.ts

### 2026-07-09 · Claude Code · 🛡️ 배포 원격 스크립트 detached 실행 (chore/deploy-detached-remote)
- 의도: belie "1,2,3 순차 진행"의 ①. 2026-07-09 사이트다운 인시던트(연결끊김→`.next` 손상→502) 하네스 재발방지
- 한 것: deploy.yml "Deploy on VPS" 스텝의 **실행 래퍼만** 교체($REMOTE 본문 불변). 동기 `ssh "$REMOTE"` → 원격 `.deploy/` 에 스크립트 업로드 후 `setsid ... </dev/null >/dev/null 2>&1 &` **detached 실행** + 상태파일(`<run>.status`) **재접속 폴링**(최대 25분) + 전체로그 덤프. `flock` 로 VPS 상 배포 직렬화. ssh_do(rc=255만 7×20s 재시도, stdin 파일 재오픈). YAML 파싱·`bash -n` 4스텝 초록 + 적대적 리뷰(따옴표/errexit/detach/race 4차원)
- 결정: **배포 성공/실패 정본 = 원격 `.status` 코드**(러너 연결상태 아님). 연결이 swap 도중 끊겨도 배포는 완주 → 사이트다운 원천 차단. 문서 반영: deploy-vps.md §0, CLAUDE.md §6.8
- 다음: ②R3-1(컨택 쓰기 뒤집기). ⚠️ **첫 배포가 이 래퍼의 실전 첫 테스트** — 머지 후 run 관찰 필수(래퍼 버그 시에도 $REMOTE 원자 swap 이 사이트 보호). belie 최우선=provider 도달성 장애 해소(③)
- SoR: .github/workflows/deploy.yml, docs/playbooks/deploy-vps.md §0, docs/incidents/2026-07-09-deploy-connection-drop-site-down.md

### 2026-07-09 · Claude Code · 🚨 배포 연결끊김으로 사이트 다운→복구 + #490 닫기·#516 살림
- 의도: R3-0 후 belie "겸사겸사 #490 처리". #490 판정·정리 + 그 과정의 인시던트
- 한 것: **#490 닫기**(finalize-cohort9.mjs 이미 #11로 master·수리 실행완료·CONFLICTING). 유일 고유콘텐츠(setup-sheets #VALUE! 재발방지)는 **#516 으로 살림**(머지·배포). 그런데 **#516 배포가 도달성장애로 실행중간 끊겨 `.next` 손상→크래시루프→502 사이트다운**. `gh run rerun --failed` 재빌드로 **복구(health 200·pm2 uptime 안정)**
- 결정: **인시던트 박제** docs/incidents/2026-07-09-deploy-connection-drop-site-down.md. 근본원인=rc=255 도달성장애가 원격 스크립트를 swap 부근에서 끊음(deploy.yml 은 원자스왑 설계인데도 연결 끊기면 깨짐). **도달성장애가 이제 사이트다운 리스크로 격상** → 위 detached chore 로 재발방지
- 다음: **belie 최우선 — provider 도달성장애 해소**(배포마다 재확인 성가심 지속). 위 detached 로 사이트다운은 차단됨
- SoR: docs/incidents/2026-07-09-deploy-connection-drop-site-down.md, .github/workflows/deploy.yml

### 2026-07-09 · Claude Code · R3-0 쓰기 정본 전환 설계 등재 (docs) — R3 착수
- 의도: gcal 트랙 종료 후 belie "R3 착수". R3 프롬프트는 세션 압축돼 있어 세션 기록에서 원문 복원(못받은 것 아님). R3-0=쓰기 정본 전환 설계 문서(docs PR)
- 한 것: docs/plans/active/db-write-flip.md 신규 — 쓰기경로 인벤토리(7탭: sales·meetings·todos·contracts·company_archive·db·carryover, dual-write 미러 훅=R3 정본 대상)·전환 패턴(DB 동기 정본+시트 비동기 미러, 실패=사용자에러·폴백금지)·드리프트 감시·**탭별 롤백 스위치**·가드 유지(§2.5·편집기간, 은퇴는 R4)·PR 분할(R3-1~5). db-migration-pilot §0 에 D3(미러 유지) 답변 확정
- 결정: **⚠️ 불일치 발견** — R2 완료 플랜들이 `db-first-unlimited-roadmap.md` 를 관련문서로 참조하나 **그 파일은 부재(죽은 링크)**. R3 SoR 는 db-write-flip.md + db-migration-pilot.md 로 확정. 로드맵 파일 생성은 스코프 밖(belie 판단 대기)
- 다음: R3-1(feat/db-write-daily — sales 컨택 4지표 쓰기 뒤집기, 첫 코드 PR). R3-1 프롬프트는 세션 기록에 있음(복원 가능)
- SoR: docs/plans/active/db-write-flip.md, db-migration-pilot.md §0

### 2026-07-09 · Claude Code · gcal-2b 일정별 토글+다시올리기+계정표시 완주(#514) — gcal 트랙 종료
- 의도: gcal-2a 라이브검증 후 gcal 그룹 마지막 PR. 자동 담기 위에 "원하는 일정만 빼는" 개별 토글 + [다시 올리기] + 계정 표시. Changelog-Done 으로 gcal 새소식 공개
- 한 것: #514 머지·배포 success·health 200, VPS=master=`c1cba7e`. GcalItemToggle(제어형·낙관적·stopPropagation) + 카드 개정 + gcal-sync(toggleSchedule/removeOne/resyncAll) + gcal-event-ids(readGcalStates 배치·keepOnlyMarkers) + gcal-schedule-read + /api/gcal/{toggle,resync,states}. 제외 마커 "-"(upsert 존중). check.sh 380 초록
- 결정: **적대적 리뷰 2R로 결함 6종 수정** — CRITICAL 무한 리페치 루프(`?? []` 새배열→매렌더 재발화, 모듈상수로 안정화) / MAJOR 멀티계정 제외마커 유실(removeAll preserveMarkers+keepOnlyMarkers) / MAJOR 행삭제 마커잔존→행재사용 오염(2R 회귀, 전체비움) / resync O(N)·pushed 과다·states 낙관값 덮음
- 다음: **belie 브라우저 카나리아**(토글 OFF→구글에서 사라짐/ON→재등록, [다시 올리기], 계정 표시, 미팅만/투두만 있는 날 렌더 정상=루프 없음). belie 잔여: 레지스트리 66~70행 삭제(시트 UI), DATABASE_URL 비번 로테이션
- SoR: docs/plans/active/google-calendar-sync.md §2·§4·§6 PR-3b

### 2026-07-09 · Claude Code · gcal-2a 일정 자동 담기 엔진 완주(#513) — 배포·health 200
- 의도: gcal-1 카나리아 통과(belie vigilantback@gmail.com "연결됨") 후 gcal-2 착수. belie 결정으로 **2a(엔진)/2b(토글) 분할**. 2a = 연결 시 미팅·투두·일반이벤트를 구글에 단방향 자동 등록
- 한 것: #513 머지·배포 success(첫 시도)·health 200, VPS=master=`722e0ce`. 신규 gcal-client(v3 insert/patch/delete+salesptId dedup)·gcal-event-ids(meetings AT·todos O 사용자별 맵, 셀 뮤텍스)·gcal-sync(멱등 reconcile, fire-and-forget). 훅=contact.ts(미팅 CRUD·revert)+todos.ts. **미팅/투두 시트 쓰기 무접촉 설계**(AT/O 가 split-write 범위 밖 → meetings.ts/todos.ts/config 무변경, 사고 반경 0). 매핑 10테스트+380 초록
- 결정: 적대적 리뷰 2라운드로 **결함 7종** 잡아 수정(자정 end<start 무성손실→다음날 롤오버 / 재시도 중복삽입→salesptId 멱등 / 멀티계정 삭제 고아·행재사용→전사용자삭제+셀폐기 / revive 자식 누락 / lost-update→뮤텍스 / 뮤텍스 unhandledRejection). 자손 cascade·개별토글·다시올리기·계정표시는 gcal-2b
- 검증(라이브, VPS 1회성 스크립트): 연결된 토큰으로 구글 캘린더 왕복 확인 — 삽입✅·salesptId 멱등조회✅·patch(16:30KST=07:30UTC, 정상)✅·삭제·정리✅. 토큰 복호화·유효 확인. **실사용 발견: 강구수(gusutaepyeong)도 실제 연결**(설정 kgusu891024 커스텀 캘린더). belie(beliefkimkim)=vigilantback 캘린더
- 다음: gcal-2b(feat/gcal-toggle-resync). **belie 확인 필요: 레지스트리 유령행 5개**(이메일 없이 S=평문/T=`2026-08-01` — gcal 컬럼에 엉뚱한 값, gcal 처리엔 무해=이메일없어 앱이 안 건드림, 레지스트리 위생만). DATABASE_URL 비번 로테이션(보류)
- SoR: docs/plans/active/google-calendar-sync.md §3·§6 PR-3a, gcal_event_ids=sheet-structure §3(AT)/§5-2(O)

### 2026-07-09 · Claude Code · gcal-1 개정 완주(#512) — 유형 토글 폐기, 배포·health 200
- 의도: 사용자 2026-07-09 설계 변경 — 대상 유형 토글 3종(미팅/실무/일반) 폐기 → 일정별 개별 토글(기본 ON). 이미 머지된 gcal-1(#511)의 개정 PR
- 한 것: #512 머지·배포 success(첫 시도, 도달성 장애 없음)·공개 health 200, VPS=master=`00bce6f`. GcalSettings/SettingsPatch/카드/타입주석에서 토글 3종 제거→calendarId 만, 하위호환(옛 토글키 Zod strip)+parseGcalSettings 5테스트, SoR §0·§2·§4·§8+문서 6종 동기화. 적대적 리뷰 워크플로 3축→확인 결함 3건(스테일 주석·요약카드) 수정 후 머지
- 결정: [다시 올리기]·계정 표시·일정별 개별 토글은 **gcal-2(엔진 필요)로 확정 미룸**. gcal-connect plan 은 라이브 카나리아(belie)까지 active 유지. GCP 사전작업은 belie 이미 완료(7/6~7, #477/#479)
- 다음: belie 라이브 카나리아(연결→"연결됨"→캘린더 선택→해제). 이후 gcal-2(feat/gcal-sync-engine) 착수. DATABASE_URL 비번 로테이션(보류)
- SoR: docs/plans/active/gcal-connect.md, google-calendar-sync.md §6 PR-2

### 2026-07-09 · Claude Code · gcal-1 구글 캘린더 연결 완주(#511) + VPS 배포·health 200
- 의도: gcal-1(OAuth 연결/해제 + refresh token AES-256-GCM 암호화 + 연동 카드) PR 완주 → 배포까지(§6.8)
- 한 것: #511 머지(레지스트리 S/T 컬럼 append, gcal-crypto 7테스트, 3라우트, 카드 3상태). 배포는 **GH러너→VPS:22 도달성 장애(#495 계열) 연속 실패(#510 2회·#511 초기)** → `gh run rerun --failed` **새 러너에서 성공**. VPS=origin/master=`d644567`, 공개 health 200. (PC-SSH 수동배포는 오토모드 가드가 차단 → 파이프라인 재시도로 정상 완주, 수동 불필요)
- 결정: 도달성 장애는 provider-edge — rerun 우회 가능하나 재발성이라 belie 가 provider 방화벽 점검 필요. GCP 사전작업은 이미 belie 완료(7/6~7, #477/#479) — 직전 보고에서 잘못 미완으로 표기했던 것 정정
- 다음: gcal-1 설계 개정(유형 토글 폐기, 아래 항목), 이후 라이브 카나리아(belie), DATABASE_URL 비번 로테이션(보류)
- SoR: docs/plans/active/gcal-connect.md, docs/plans/active/google-calendar-sync.md §6

### 2026-07-09 · Cowork(Fable) · gcal 설계 변경: 유형 토글 3종 폐기 → 일정별 개별 토글(기본 ON)
- 의도: 사용자 요청 — 캘린더 탭에서 일정마다 연동 토글, 토글 상태 따라 구글 이벤트 자동 생성/삭제
- 한 것: 구조 확정(**개별 토글만 + 디폴트 ON** — 유형 토글 미팅/실무/일반 제거, 사용자 선택). gcal-1·gcal-2 프롬프트 개정판 전달(개별 토글은 엔진 필요 → gcal-2에 배치, gcal-1 카드에서 토글 3종 제거)
- 결정: 저장 구조 = gcal_event_ids 사용자별 값 eventId(켜짐)|"-"(껐음, 제외 마커 — 수정 훅·[다시 올리기]가 되살리지 않음), 키 없음=기본 ON. 연결 해제 시 기존 이벤트 잔존 원칙 유지(개별 토글 OFF만 구글에서 삭제). SoR §0·§2·§4·§8 갱신은 gcal-1 PR에 포함
- 다음: gcal-1 착수 가능(R2 완주됨) → gcal-2 → R3-0
- SoR: docs/plans/active/google-calendar-sync.md

### 2026-07-09 · Claude Code · R2-7b 대시보드 서빙 DB 전환 완주 (#509) — R2 읽기 전환 트랙 종료
- 의도: R2-7a 그림자 대조로 검증(51/52)된 대시보드 DB 집계를 실제 서빙으로 전환
- 한 것: #509 머지·배포 success 2.6분·health 200. loadDashboard 2경로(파일럿=loadDashboardFromDb 시트왕복0, 비파일럿=시트 무변경 리팩터)+assembleView 공용. 안전밸브 2중(DB실패→시트강등+Sentry / 역방향 그림자 reverseShadowCompare=서빙후 시트 async 대조 diff시 경보). 358테스트·비파일럿 불변
- 결정: 검증2(능동 시나리오)는 속도지시(세션내 수동 라이브검증 금지)와 상충 → 배포후 라이브 카나리아+역방향 그림자 감시+강등 안전밸브로 대체(검증1 실데이터 전케이스 커버로 등가). **R2 트랙 완주: 컨택·일정·수납·DB생산·캘린더·대시보드 6화면 전부 파일럿 시트 read 0**
- 다음: gcal-1(feat/gcal-connect)→gcal-2 → R3-0(쓰기 전환). 배포후 대시보드 p50/p95 관찰(#509 코멘트). 보안: DATABASE_URL 노출 비번교체 belie 대기
- SoR: docs/plans/completed/db-read-dashboard.md, docs/plans/completed/db-dashboard-aggregates.md

### 2026-07-09 · Claude Code · R2-7a diff 근인 A·C 완전 해결 (#508) — 51/52 정확일치
- 의도: #507 그림자 대조가 잡은 diff 3근인을 완전 해소(사용자 지시 "A·C 완전히 해결")
- 한 것: #508 머지·배포 success. **시트 수식 FORMULA 렌더로 직접 규명** → A(로직) 수정: R1:U6 R4미팅예약=상태∈{예약,완료,계약}·이월제외, R5미팅완료=상태∈{완료,계약}·이월제외, 활동량 미팅항=미팅완료(by미팅날짜)×2(sales.meetingReservation stale 폐기). C(데이터): mymk1005 실데이터가 A1-5 수렴때 유령 오마킹→_cleared 11행 해제+재backfill로 Σ생산0→33(시트일치). **재대조: 52명중 diff0=51, 규명예외1(zzzddz01=시트 02↔04 계약상태 불일치, 집계로직 무관)**
- 결정: 활동량 정확산식 확정=생산×1+컨택×1.5+미팅완료×2(이월제외). 미팅 퍼널 카운트는 stale sales 아니라 미팅카드 실시간+이월제외. R2-7b 게이트("diff0 또는 규명예외만") 충족
- 다음: R2-7b(서빙 전환) — 검증1(전수배치 완료=이 결과)+검증2(연습 능동시나리오) → 전환. 그 후 gcal-1→2. **보안: DATABASE_URL 세션로그 노출건 belie 비번교체 대기**
- SoR: PR #508 코멘트(전수대조표), docs/plans/active/db-dashboard-aggregates.md

### 2026-07-09 · Cowork(Fable) · 스코프 확정(R3까지) + R4 알림 예약 + gcal 재개
- 의도: 사용자 결정 — 이번 스코프는 R3까지, R4는 아레나 시즌1 종료(8/1) 후. 접어둔 기능(gcal) 재개
- 한 것: R4 착수 준비 알림 예약(7/25 09:00, scheduled task r4-kickoff-reminder — R3 상태 확인+D2 리마인드 포함). gcal-1(feat/gcal-connect)·gcal-2(feat/gcal-sync-engine) 프롬프트 전달. 메모리(project-db-first-roadmap) 갱신
- 결정: gcal 순서 = R2-7 마무리(미팅예약 로직 수정 + mymk1005 sales 재backfill + R2-7b) **후** 순차 — #507이 찾은 diff 3근인 중 C는 실사용자 화면 영향이라 gcal보다 우선. DATABASE_URL 노출 건은 belie에게 비번 교체 재권고(결정 대기)
- 다음: R2-7 마무리 → R2-7b → gcal-1 → gcal-2 → R3-0. 9기 클레임 안내(내일 7/10)
- SoR: docs/plans/active/google-calendar-sync.md, docs/plans/active/db-first-unlimited-roadmap.md

### 2026-07-09 · Claude Code · R2-7a 대시보드 그림자 대조 완주(#507) — diff 3근인 발견, R2-7b 게이트 미충족
- 의도: 대시보드 시트수식 4종(R1:U6·N·H·B21) raw 재계산 + 그림자 대조(응답은 시트값). 재계산 스펙은 워크플로(4설계→4적대검증)로 확정
- 한 것: #507 머지·배포 success·health 200. dashboard-aggregates.ts(순수4함수+shadowCompare fire-and-forget)+dashboard-parity.mjs(전수배치)+정합9테스트. 배포후 전수대조: **52명 중 diff0=35, diff발생=17(48건)** — 그림자가 정확히 3근인 노출
- 결정(diff 근인): **A[로직·수정확정]** 미팅예약(R1:U6 R4)=Σsales 아니라 상태='예약' count(sangjun 시트6 vs 카드수9 실측). **B[로직·A연동]** 활동량(H) 미팅항이 A와 같은 오차(주3 +6=미팅 +3×2) → A수정후 재대조로 확정. **C[데이터·R2-1 라이브영향⚠️]** mymk1005(A1-5) DB sales 27행 전부 값0(시트엔 실데이터) = backfill sales-0 공백(#488계열) → 파일럿이라 컨택화면이 0 표시 중일 수 있음, sales 재backfill 필요
- ⚠️ **보안사고**: SSH 명령 export \$(grep..) 빈결과→export단독→셸 env 덤프로 **DATABASE_URL 값 세션로그 노출**. Supabase 비번 교체 권장. 이후 node가 .env 직접로드(셸덤프 방지)
- 다음: A 수정(미팅예약=상태예약)→재대조로 B확인 · C 영향사용자 식별+sales 재backfill · diff0 확인후에만 R2-7b. R3 파이프라인은 R2-7b 후
- SoR: docs/plans/active/db-dashboard-aggregates.md, PR #507 코멘트(대조표·진단)

### 2026-07-09 · Claude Code · R2-4b·R2-5·R2-6 완주 + R2-7a 착수 (탭 전환 6개 완료)
- 의도: R2 읽기 전환 파이프라인 계속 — 업체정보 카드(4b)·DB생산(5)·캘린더(6) DB 전환 후 대시보드(7a) 착수
- 한 것: #502(R2-4b 업체정보 06)·#504(R2-5 DB생산 4섹션)·#506(R2-6 캘린더 미팅+투두) 전부 머지·배포 success·health 200. **파일럿 기수는 컨택·일정·수납·DB생산·캘린더 6탭 전부 시트 read 0회.** #498 배포 캐시로 배포 2.5~2.7분 유지. R2-7a(대시보드)는 재계산 스펙을 워크플로(4 설계→4 적대적 검증)로 확정 중
- 결정: (1) R2-5 직접생산 "생산중"(종료일 빈) 행 — 배열 파서 neo 감지 밀림 → dual-write 필드명은 Zod, backfill 열문자만 파서(형태별 분기). (2) R2-6 캘린더는 투두 read 도 있었음(프롬프트 예상=미팅만) → todos=meetings 쌍둥이라 새 스키마 아님. (3) **교훈: 같은 워크트리에서 백그라운드 git 커밋 + 포그라운드 브랜치 전환 동시 실행 금지** — R2-6 docs 이동 커밋이 R2-7a 브랜치에 얹히는 사고(무해 복구, R2-7a PR이 함께 태움). 워크트리 git 작업은 직렬화
- 다음: R2-7a 워크플로 스펙 확정 후 집계+그림자 대조+전수 배치 스크립트 구현. R2-7b(검증 절차 통과 조건 — 세션 내 완주 가능)
- SoR: docs/plans/completed/db-read-{company-archive,production,calendar}.md, docs/plans/active/db-dashboard-aggregates.md

### 2026-07-09 · Claude Code · 대시보드 캡처 6장 (기능설명 '대시보드 깊게 읽기' 편) [콘텐츠]
- 의도: 카페 연재 2단계(기능설명) 대시보드 편 이미지 — 연습 계정·실렌더·스크롤 전 구간
- 한 것: dev(stub=practice@salespt.local)+Playwright(412px·DPR2), tall-viewport 전체 1샷 +
  섹션 5샷(제목 기준 카드 bbox±12px) → screens/에 대시보드_{전체,A_상단,B_생산성지표,
  C_퍼널차트,D_주차추이,E_채널성과}.png. Next dev 도구 버튼(N) 제거 후 재촬영, 육안 검증 2장.
- 결정: 전체샷은 fullPage 대신 **뷰포트=콘텐츠 높이** 방식(고정 하단 STEP 탭이 자연 위치).
  캡처 스크립트 = scratchpad(shot/capture-dashboard.js) — 재사용 시 복사.
- 다음: 마커·프레임은 belie(Cowork 콘텐츠 세션)가 씌움. 사고 부기: 메인 체크아웃 npm ci 가
  좀비 dev 서버(내 3986)에 잠겨 실패→프로세스 종료 후 복구(node_modules 최신화 부수효과).
- SoR: 경영일지 앱관련 카페글쓰기/screens/, _기능설명_보류(2단계)/

### 2026-07-08 · Cowork(Fable) · 비판적 사고 프로토콜 박제 (CLAUDE.md §3 0.5단계) — ※헤더 복원
- 의도: 지시-목적 불일치·중복 요청·안전장치 과부족을 실행 전에 걸러내고, 상호 납득으로 완급 조절되는 개발(사용자 지시)
- 한 것: CLAUDE.md §3에 0.5단계 추가 + Cowork 메모리(feedback-critical-thinking) 박제. 내용 = 실행 전 ①목적 정합 ②더 나은 방법·중복·악수 ③안전장치 과부족 점검 → 납득 안 되면 질문, 반박은 쉬운 말+대안, 재확인 시 수용
- 결정: R2-7b "3일 그림자 관찰" → 전수 배치 대조+능동 시나리오 배터리로 개정(이 프로토콜의 선례 — 사용자 비판이 설계를 개선)
- 다음: CLAUDE.md·worklog 변경분은 다음 docs PR에 편승 커밋. 떠 있는 세션엔 지침 추가 한 줄 프롬프트(워크로그 도입 때와 동일 방식)
- SoR: CLAUDE.md §3 0.5, 메모리 feedback-critical-thinking

### 2026-07-08 · Cowork(Fable) · D3 결정 확정(시트 자동 미러 유지) + R3 프롬프트 시리즈 전달
- 의도: R2 후속 R3(쓰기 정본 전환) 착수 준비 — 로드맵 D3 결정을 사용자에게 받음
- 한 것: **D3 = 자동 미러 유지** (DB 정본 전환 후에도 시트에 사본 자동 기록 — 트레이너/운영 열람·롤백 안전망).
  R3-0(플랜 docs)~R3-5(기수 생성 DB화) 프롬프트 시리즈 전달. R2-2~R2-7b 프롬프트는 이미 전달됨(순차 실행 중)
- 결정: D3 확정 → R3-0 docs PR 이 로드맵 D3 항목을 답변됨으로 갱신할 것. R3 전 기간 §2.5 보존 가드·편집기간
  가드 유지(가드 은퇴는 R4 재정의와 함께). R3-5(기수 생성)는 chore/deploy-env-admin-token 선행 필요
- 다음: R2 시리즈 완주 관찰 → R3-0 착수. 9기 7/10 클레임 안내는 여전히 대기
- SoR: docs/plans/active/db-first-unlimited-roadmap.md(R3·D3)

### 2026-07-08 · Claude Code · R2-4 실무/수납 DB 전환 완주 (#500) — R2 파일럿 읽기 4탭 완료
- 의도: R2 트랙 4호 — 02 계약수납 전체 스캔(최중량 read) 제거, 이월 필드 정합 사수
- 한 것: #500 머지·배포 success 2.6분·health 200. contracts payload 3형태 흡수(rowToCP 재사용), 이월 픽스처 정합 5테스트, sheets_calls 2→0(resolveLayout 포함). plan 2건(R2-3·R2-4) completed 이동 docs PR 진행
- 결정: company_archive(06)=R2-4b 분리(작음 — read-daily 함수 1개). R2-5(DB생산) 사전조사 완료: loadDBOverview 4 read → db 탭 미러 1쿼리+섹션 파서 재사용이면 됨(패턴 동일)
- 다음: R2-4b, R2-5 [작업] 대기. 속도 후 수치(#491·#496·#499·#500 코멘트, api_timing 쌓이면). 컨택·일정·수납 3탭 = 파일럿 시트 read 0회 상태
- SoR: docs/plans/completed/db-read-payments.md, lib/repo/db/read-daily.ts

### 2026-07-08 · Claude Code · R2-3 일정탭 DB 전환(#499) + 배포 캐시(#498) 완주, R2-4 PR 오픈(#500)
- 의도: R2 트랙 3호(일정·계약 탭) + 배포 시간 단축 chore 를 한 파이프라인으로(캐시 실측에 배포 재활용)
- 한 것: **#498** npm ci 스킵 게이트+빌드 캐시 보존 — 실측 기준선 4.86분 → 1회차 3.4분(-30%) → 2회차 **2.5분(-49%)**, clean=true 탈출구 검증(4.9분 회귀+강제 로그), playbook 절차 추가. **#499** loadWeekMeetings DB 전환(readMeetingsFromDb 재사용, 새 repo 함수 0 = R2-2 설계 검증, funnel=weekFunnelFromRows 동치) — 시트 3→0회, 배포 success·health 200. **#500**(R2-4 실무/수납) PR 오픈 — contracts payload 3형태(backfill 열문자 C..AK/전체 객체/append 부분+이명 meetingId·원본행id) 흡수, 이월 필드 정합 5테스트, company_archive 는 R2-4b 분리(사유=plan)
- 결정: 배포는 이제 캐시 경로가 기본(2.5분대), 빌드 이상하면 clean=true 1회(playbook). contracts 는 미러 사이트 2곳이라 payload 형태가 3개 — 이후 탭 전환 시 미러 사이트별 payload 형태 수부터 셀 것
- 다음: #500 머지·배포 관찰(진행 중), R2-4b(06 company_archive), R2-5(DB생산 탭) 사전조사, 속도 후 수치(#491·#496·#499·#500 코멘트)
- SoR: docs/plans/active/db-read-payments.md, docs/plans/active/db-read-schedule.md(완료 이동 예정), PR #498 코멘트(실측표)

### 2026-07-08 · Claude Code · R2-2 컨택 미팅·현수막 읽기 DB 전환 완주 (#496)
- 의도: R2 읽기 전환 2호 — loadDay 잔여 시트 왕복(findByDate 미팅카드·readBanners 주문합) 제거 → 파일럿 컨택 탭 **시트 read 0회**
- 한 것: #496 머지(36c6dc7)·배포 conclusion=success·health 200. lib/repo/db/read-daily.ts 신설(readMeetingsFromDb·readBannerOrderQtyFromDb), loadDay DB 3쿼리 병렬+전체 시트 fallback, 정합 8테스트, plan completed 이동 후속 docs PR 진행. sheets_calls 5→2(R2-1)→0(본 PR, 캐시 히트 시)
- 결정: **payload 두 형태 공존 발견** — dual-write=필드명 키, backfill=열문자 키·문자열화(직렬날짜 "46042"·"true"). 변환기(meetingFromDbPayload)가 필드명 우선→열문자를 행 배열 복원해 rowToMeeting 재사용으로 흡수. **R2-3 등 이후 모든 DB read 는 이 이중 형태를 반드시 고려**(read-daily.ts 참조). 미팅 카드 순서는 예약시각 정렬(결정적, 시트 행순과 다름 — 중립)
- 다음: R2-3(일정·계약 loadWeekMeetings·캘린더 — readMeetingsFromDb 재사용만 하면 됨), #491·#496 속도 후 수치(파일럿 api_timing 쌓이면 PostHog HogQL→PR 코멘트), 대기열 gcal-connect→sync-engine
- SoR: docs/plans/completed/db-read-meetings-banners.md, lib/repo/db/read-daily.ts

### 2026-07-08 · Claude Code · R2-1.5 아레나 backfill 수렴 완료 — PC 직행 SSH(승인) 경로
- 의도: "끝까지 완료" — GH 차단으로 대기 중이던 아레나 backfill 을 수렴시켜 R2-1.5 종결
- 한 것: belie 승인 후 PC→VPS 직접 SSH 로 backfill execute 2회 → DB 대조: **전 탭 기준값
  (dry-run 1,083행) 이상, 미달 0** (m162/c229/t27=일치/s437/db247/ca78, 전체 1,467행 ≥
  목표 1,370). 증빙 = PR #492 코멘트. 반복 run 의 스킵 경고는 읽기측 429 노이즈로 판명.
- 결정: **진단 정정 — fail2ban 아님**(VPS 실측: fail2ban 미설치·ufw inactive·거부 로그 0)
  → GH러너 차단은 **호스팅 제공사 네트워크 엣지**. 서버측 조치 불필요, #495 재시도가 정답.
- 다음: p50/p95 후 수치(아레나 유입 후 PostHog → PR #492 코멘트). GH 경로 복구는 다음
  deploy success 로 자동 판정. R2-2(meetings·banners 읽기 전환) 착수 가능.
- SoR: docs/plans/active/db-pilot-arena.md

### 2026-07-08 · Cowork · 사용법 시리즈 재기획 실행 (워크플로우 순서로 재배치) [콘텐츠]
- 의도: (belie) 탭별 how-to 전에 영업 워크플로우를 먼저 가르치고 탭 개념 매핑 + 앱 STEP 순서대로(DB생산 먼저) 재정렬
- 한 것: 기획 v2 확정(`_사용법시리즈_기획_상세.md`). 12편 폴더/파일/제목/다음편링크 일괄 재번호: **02=워크플로우·탭지도(신설), 03=DB생산(STEP1), 04=컨택관리(구02)**, 05 미팅잡기·06 미팅결과(4케이스 상세)·07 실무수납·08 캘린더·09~12 유지. 구08 대시보드는 `_기능설명_보류(2단계)/`로 이관. 표지 6장(02·04·05·06·07·08) 재렌더, EP2 이미지 신규 2종(탭지도 개념도·대시보드 목표판) 제작·검증. 인벤토리 정합 확인(프리픽스=폴더번호, 마커수=본문)
- 결정: EP6 미팅결과는 완료·계약·변경·취소 4케이스 각각 상세(+되돌리기·추가미팅). 대시보드 '심화 읽는 법'은 **2단계 기능설명 시리즈**로 분리(사용법 12편 유지). 연재 순서 = 사용법→기능설명
- 다음: 재배치된 04~08 화면 마커/legend가 새 번호와 맞는지 최종 확인(마커 이미지 자체는 화면 동일이라 유효), 기능설명 시리즈 목차, 게시는 운영세션
- SoR: `경영일지 앱관련 카페글쓰기/사용법/_사용법시리즈_기획_상세.md`, 메모리 feedback-usage-series-writing

### 2026-07-24 · Codex DevC · DB 자동 비용 원장 정합 R5 구현
- 의도: `03 DB관리` 자동 비용을 월별·전체·카테고리 비용 원장에 읽기 전용 시스템 행으로 노출하고, DB-primary + sheet fallback에서 같은 금액·인식 규칙을 사용
- 한 것: 직접생산 신규 I:O 생산중/비정상 날짜 parser 보존, `loadDBOverview` 기반 매입·직접생산·현수막 원장 투영, system/readOnly·인식 상태/메모·선택 범위·DB/추가/합계·카테고리 금액/건수/비중 계약 추가, 108만원·월 경계·ongoing·unallocated·수동/반복 합산 회귀 추가
- 결정: 유효 기간은 양끝 포함 일할, 종료일 누락/비정상은 시작일 전액 1회, 시작일 누락/비정상 양수 예산은 전체·카테고리에 미배분 1회(월 제외). 시스템 카테고리는 편집 목록과 분리해 쓰기 표면을 만들지 않음
- 검증: targeted 3 files/26 tests PASS, typecheck PASS(전체 check/build 및 독립 VERIFY 전 checkpoint)
- SoR: `docs/plans/active/expense-db-cost-ledger-parity-r5.md`
- 확정: 승인된 11파일만 변경, DevD 두 테스트 SHA-256 불변, `git diff --check` PASS

### 2026-07-25 · Codex DevC · DB 자동 비용 원장 R5 통합 검증 checkpoint
- 한 것: DevD 독립 계약 테스트 2파일을 SHA-256 일치 상태로 인수하고, 0원 사용자 카테고리도 `categoryTotals`에 identity/0원/0건/0%로 남기는 P1 계약 누락을 구현에서 보완
- 검증: DevD 14/14, 전체 targeted 5파일 40/40, `scripts/check.sh` 전체 824/824·structural 10/10·lint/typecheck·500줄·doc-drift PASS, Next production build 69/69, `git diff --check` PASS 예정
- 안전: 시스템 카테고리는 편집 가능한 `categories`에 넣지 않고 모든 DB 행은 system/readOnly로 유지. 대시보드 산술 파일과 운영 데이터·시트 쓰기는 변경 없음
- 다음: normal hook 통합 커밋 후 DevD exact-SHA 독립 VERIFY
- SoR: `docs/plans/active/expense-db-cost-ledger-parity-r5.md`
- 최종 diff: 승인된 11파일만 변경, DevD 두 테스트 SHA-256 불변, `git diff --check` PASS
