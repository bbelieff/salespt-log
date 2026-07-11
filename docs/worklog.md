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
### YYYY-MM-DD · 세션종류(Cowork/Claude Code) · 한줄 제목
- 의도: 사용자가 왜 시켰나
- 한 것: 결과 중심 (PR#, 검증 결과, 생성물)
- 결정: 새로 확정되거나 뒤집힌 것 (없으면 생략)
- 다음: 남긴 것, 차기 세션이 이어받을 것
- SoR: 상세 문서 경로
```

**유지 규칙**
- 새 항목은 항상 맨 위 (최신순).
- 항목 40개 초과 시 오래된 것을 `docs/worklog-archive/YYYY-MM.md` 로 이동.
- 비밀값(비밀번호·토큰·URI) 절대 기록 금지.
- 이 파일은 append 전용에 가깝게 — 과거 항목 수정은 오기 정정만.

---

## 로그

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

### 2026-07-08 · Claude Code · 아레나 backfill 수렴 완료 + GH 차단 판정 (#495)
- 의도: #492가 남긴 backfill 미수렴(1,322행) 해소 — GH 러너 차단 우회(PC→VPS 직접 SSH)
- 한 것: A1-0~A1-6 전체 재실행(경고 0) → 총 유효 1,467행(기준 1,370 ✅). VPS 실측으로 fail2ban 미설치·ufw inactive·iptables ACCEPT 확인 → 제공사 edge 간헐 차단 판정(incident 문서). #495 머지·배포 success(=GH 경로 복구 실증). 유령 행 11건(A1-5 sales) belie 승인 하 _cleared. 증빙 = PR #492 코멘트 2건
- 결정: (사고·교훈) 기수+row_key는 유일키 아님 — DB 행 지정은 반드시 spreadsheet_id 포함. 1차 마킹이 정상 행 14건까지 건드려 3단계 복구(해제→재실행→타임스탬프 기준 정밀 재마킹)로 손실 0 회복. "유령 추정" 중 3건은 429 읽기 누락 착시 — 멱등 재실행 먼저, 마킹은 그 다음
- 다음: 제공사 방화벽 콘솔 확인(belie, 재발 시). R2-2(meetings·banners 읽기 전환). #491 후 속도 수치 코멘트(파일럿 api_timing 대기)
- SoR: docs/incidents/2026-07-08-gh-runner-ssh-ban.md, docs/plans/active/db-pilot-arena.md

### 2026-07-08 · Claude Code · 워크로그 프로토콜 레포 박제 (#494)
- 의도: Cowork가 워킹트리에 설계해둔 세션 공유 워크로그(이 파일)+CLAUDE.md §3 0단계를 내용 무수정으로 커밋 — 프로토콜을 정본화
- 한 것: #494 머지(8e089b8)·배포 conclusion=success. 커밋 직전 Cowork 신규 항목 2건 추가 감지 → 브랜치 최신본 재동기화(amend) 후 진행. 이 파일은 이제 git 추적 대상 — 이후 항목은 워킹트리에 쌓고 주기적으로 docs 커밋으로 반영
- 결정: 워크로그 커밋 주기는 별도 규칙 없음 — 당분간 다른 docs PR에 편승 또는 쌓이면 단독 docs PR
- 다음: 모든 세션이 §3 0단계 준수(시작 시 읽기·종료 시 쓰기)
- SoR: CLAUDE.md §3, docs/worklog.md 상단 프로토콜

