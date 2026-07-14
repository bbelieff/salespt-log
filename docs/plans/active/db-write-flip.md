---
slug: db-write-flip
status: active
created: 2026-07-09
owner: belie
related: db-migration-pilot, db-read-contact, api-timing-baseline
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: R3 — 쓰기 정본을 시트→DB 로 뒤집는 설계. DB 동기 저장(성공 판정) + 시트 비동기 미러(fire-and-forget). 탭별 롤백 스위치·드리프트 감시·가드 유지.
> - **누가 읽나요**: 개발자, 에이전트, 운영자(belie)
> - **어떤 기능·작업과 연결?**: dual-write 미러(lib/repo/db/mirror.ts), R3-1~5 코드 PR, 게이트(chooseSource 계열)
> - **읽고 나면 알 수 있는 것**: 어떤 쓰기 경로를 뒤집나 / DB 실패·미러 실패는 어떻게 처리하나 / 롤백은 어떻게 즉시 되나 / 무엇이 R4 로 미뤄지나
> - **관련 문서**: db-migration-pilot.md(§0 결정·D3), R2 읽기 전환 완료 플랜(docs/plans/completed/db-read-*.md)

# R3 — 쓰기 정본 전환 (시트 → DB 뒤집기)

## 0. 방향과 원칙
- **R2 상태(현행)**: 시트 = 정본. 쓰기 = **시트 동기 저장(성공 판정) + DB 비동기 미러**(`mirrorSheetRow`, fire-and-forget). 읽기는 파일럿 기수만 DB(`chooseSource` 게이트).
- **R3 목표**: **DB = 쓰기 정본**. 쓰기 = **DB 동기 저장(실패=사용자 에러) + 시트 비동기 미러**. 방향만 뒤집고 미러 메커니즘(비차단·백오프)은 재사용.
- **D3 결정(2026-07-08 belie, 본 문서에서 답변 확정)**: **시트 자동 미러 유지**. DB 정본 후에도 시트 사본을 자동 기록(운영자용 export·안전망·롤백 근거). 시트 은퇴는 R4.
- **정본 이원화 금지**: DB 저장 실패 시 시트로 폴백 저장하지 않음(어느 게 진실인지 모호해지는 사고 방지). 실패는 사용자에게 저장 실패로 응답.
- **파일럿 한정**: 8·9·연습·아레나만. 게이트 하나로 탭별 즉시 R2 복귀.

## 1. 쓰기 경로 인벤토리 (역방향 기준 — R2 미러 훅이 곧 R3 정본 대상)
현행 dual-write 미러 훅(`lib/repo/db/mirror.ts` 호출부)이 R3 에서 **동기 DB 쓰기로 승격**될 지점. row_key 규칙은 mirror.ts §10(backfill 과 동일) 준수.

| 탭 | 파일·함수 | 종류 | row_key | 트랜잭션 | R3 PR |
|---|---|---|---|---|---|
| **sales**(01 컨택 4지표) | sales.ts `batchWriteChannelDailyRows`·`syncDirectProductionForDate`·(de/in)crement | 배치·병합 | `{날짜}:{채널}` | ✅ 다채널 1저장 | R3-1 |
| **meetings**(04 미팅) | meetings.ts `appendMeeting`·`updateMeeting`·`clearMeeting` | append/update/clear | A열 앱 id | 단일행(단, 서비스 cascade 는 다행) | R3-2 |
| **todos**(05 실무투두) | todos.ts `appendTodo`·`updateTodo`·`clearTodo` | append/update/clear | A열 앱 id | 단일행 | R3-2(동반) |
| **contracts**(02 계약수납) | contract-payment.ts(writeSlot·updateLinkFields·clearRowByLink)·contract-payment-sync.ts | append/update/병합/clear | `r{행번호}` | 슬롯 1~3단계 | R3-3 |
| **company_archive**(06 업체정보) | company-info-archive.ts `upsert`·rename·clear | upsert/rename/clear | C열 계약ref | 단일행 | R3-3(동반) |
| **db**(03 DB관리 4섹션) | db.ts(4×add/patch/clear)·db-production-cell.ts | add/patch/clear/병합 | `{섹션}:r{행번호}` | 단일행(합계행=시트 수식) | R3-4 |
| **carryover**(이월·아레나) | carryover.ts `mirrorSheetRow` | 이월 append | (미팅 id) | 마이그레이션 전용 | R3-2 편입/후속 |

※ 레지스트리(users)·기수 생성은 별도 — R3-5(admin 기수 생성 DB 정본).

## 2. 전환 패턴 (탭마다 동일 골격)
1. **DB 동기 저장 = 정본**: 서비스 유스케이스 끝에서 `await` DB upsert(트랜잭션 필요 시 트랜잭션). 성공해야 사용자에게 성공 응답. **실패 = 저장 실패 응답**(시트 폴백 금지).
   - upsert 키: `row_key + spreadsheet_id` 동시 지정(#495 교훈 — row_key 만으로 행 지정 금지, 시트 간 충돌).
2. **시트 미러 = 비동기 강등**: 응답 후 fire-and-forget. 실패 시 **지수 백오프 n회 재시도** → 최종 실패 시 `mirror_pending` 마킹 + Sentry(`db_mirror_error` 유지). 미러 쓰기는 **§2.5 bulk-write 보존 가드 경유 유지**.
3. **게이트**: 탭별 `chooseWriteSource(cohort)` — 파일럿·해당 탭 켜짐이면 DB 정본, 아니면 R2(시트 정본). 읽기 게이트(chooseSource)와 대칭.
4. **읽기 경로(R2) 무변경**: R3 는 쓰기만 뒤집음.

## 3. 드리프트 감시
- **주기 대조**: 탭별 시트 행수 vs DB 행수 + 샘플 필드 대조(R2-7 그림자 대조 방식 재사용). 불일치 시 목록.
- **admin 노출**: /admin 하단 배너 또는 스크립트(scripts/ops/*-parity.mjs 패턴). `mirror_pending` 잔량도 노출.
- 목적: 미러 강등 후에도 시트=DB 정합을 사람이 볼 수 있게(Observability §0).

## 4. 롤백 스위치 (즉시 R2 복귀)
- **탭별 게이트 플립 하나**로 그 탭을 즉시 R2 상태(시트 정본)로 되돌릴 수 있어야 함. 각 R3 PR 은 이 스위치 동작을 테스트로 고정.
- 롤백 시: 쓰기 정본이 시트로 돌아가고, 그동안 DB 에만 있던 쓰기는 시트 미러가 이미 반영(미러 유지 원칙의 근거). `mirror_pending` 은 재시도로 흡수.
- master revert 없이 게이트만으로 복귀 = §6.8 롤백보다 가볍고 빠른 1차 안전망.

## 5. 가드 정책 (R3 전 기간 유지, 은퇴는 R4)
- **§2.5 bulk-write 보존 가드**(FORMULA pre-read + raw 값 skip): 시트 미러 쓰기에서 그대로 유지.
- **편집 가능 기간(+69일) 가드**: R3 에서도 유지(기간 후 읽기전용).
- **표시문자열·시트 수식 몫**(미팅 N/O, DB 합계행, 대시보드): 미러는 raw 행만 쓰고 수식은 시트가 계산 — 무변경.
- **카드 수 파생(ADR-0010)·이월 깃발**: 미러 쓰기에서 기존 로직 그대로.

## 6. PR 분할
- **R3-0(본 문서)** — 설계 등재. docs 만.
- **R3-1** feat/db-write-daily — sales(컨택 4지표). 첫 코드 PR. **✅ 구현 완료**.
  - 범위: **saveContactMetrics 의 4채널 배치 저장**(batchWriteChannelDailyRows 경로)만 DB 정본 전환.
    `chooseWriteSource`(daily-source.ts — 읽기 게이트 대칭·isDbReadPilot 재사용) + `writeSalesRowsToDb`
    (client.ts — **트랜잭션 원자 upsert**, 실패 throw·시트폴백 금지) + 시트 비동기 미러(sales-write.ts
    persistSalesRows/fireSheetMirror, batchWriteChannelDailyRows `{mirror:false}` 로 DB 재미러 차단).
    DB payload = R2 미러가 쓰던 동일 full 행 → DB 읽기(R2부터 라이브) 동일값.
  - **스코프 밖(이 PR 아님)**: 단일셀 writer `writeProductionCell`(E 집계, ADR-0020)·
    `decrementMeetingReservation`(H) 는 R2 유지(시트 정본+비동기 DB 미러). DB 읽기는 R2부터 그 미러를
    이미 신뢰 → **비회귀**. 후속(R3-1b 또는 R3-4 편입)에서 전환.
  - ⚠️ 인벤토리 정정: §1 표가 `syncDirectProductionForDate` 를 sales 로 귀속했으나 실제는
    `lib/service/db.ts` 에 있고 03 DB탭(writeProductionCountCell)을 씀 — R3-4 소관.
  - 🐛 리뷰 CONFIRMED 수정: 유입(F) 시트쓰기를 async 로 강등하니 직접생산 M(=Σ유입) 재집계가
    시트 F 재읽기라 오늘치 누락→과소집계. → `sumChannelInflowOverPeriod(opts.fromDb)` 로 파일럿은
    유입을 **DB 에서 합산**(동기 저장됨). fromDb 를 syncDirectProductionForDate(cohort)·addProduction·
    patchProduction 에 관통(게이트=서비스 chooseDailySource, repo 는 boolean 만 — 레이어 유지).
- **R3-2** feat/db-write-meetings — meetings(+todos·carryover). 카드수·N/O 미러 무변경.
  - **2 PR 분할(2026-07-12)**: PR-1 `feat/db-write-todos-carry`=todos 단독(단순·독립), PR-2=meetings+carryover
    (이월은 tab="meetings" 에 쓰므로 meetings 와 동반 — §1 표의 "R3-2 편입" 확정) + cascade 처리.
  - **PR-1 설계 확정(적대 리뷰 3라운드 반영)**:
    (a) **읽기 동반 전환** — listTodos(슬롯 ToDo 목록)가 시트를 읽는 채 쓰기만 뒤집으면 read-your-writes
    위반(방금 만든 ToDo 목록 실종 · DB 에 없는 legacy ToDo 수정 영구 500). 쓰기 flip 은 **같은 표면의
    읽기 경로 동반 flip 이 전제** — R3-2 PR-2·R3-3~5 에서도 각 표면 읽기 게이트 여부 선확인 의무.
    (b) **시트 미러 = 연산 재생이 아니라 수렴 동기화**(r2 리뷰 12건의 공통 근원) — 쓰기별 스냅샷을
    fire-and-forget 재생하면 생성↔삭제 역전(좀비 행+고아 gcal 이벤트)·append 재시도 중복·미러 순서
    역전이 남는다. queueSheetSync(시트별 직렬 큐)가 실행 시점 **최신 DB 상태**를 읽어 시트를
    update-or-append/clear 로 수렴시킴 — 어떤 인터리빙도 마지막 잡이 자기수정. **R3-2 PR-2·R3-3~4 의
    미러도 이 패턴 의무**(meetings 는 cascade 다행이라 특히).
    (c) patch 병합기반: DB(정본) 우선 — **_cleared(삭제됨)와 DB 공백을 구분**(삭제면 에러, 공백만
    시트 self-heal). (d) gcal 이벤트ID 맵=시트 행(O열) → gcal reconcile 은 동기화 잡 안 **행 보장 후**
    최신 상태(known)로만 실행(행 없이 실행 시 이벤트ID 유실→지울 수 없는 고아 이벤트).
  - **PR-2 구현(2026-07-12)**: 게이트 내장 프리미티브 `lib/service/meetings-write.ts`
    (create/patch/clear + 소스드 read 3종 + queueMeetingSheetSync 수렴 잡) — contact.ts(캡 압박)와
    contract-payment.ts 는 repo 직접 호출을 프리미티브로 1:1 치환만. meetings.ts 코덱을
    meetings-rows.ts 로 무동작 추출(façade 재수출). gcal 은 reconcileMeetingEvent(awaitable)를 잡 안
    행 보장 후 await. **이월 payload 열문자 평탄화**(carriedMeetingPayload) — 구 {_carryRaw} 형태가
    이월 미팅을 DB read 에서 소실시키던 결함 수정(E1), 멱등키 = 시트 AP ∪ DB(AP·원본행id) 합집합.
    읽기 동반 전환: saveContactMetrics 카드수·patch/cascade/계약처리 lookup 전부 DB 소스드로.
    R2 유지: 02 contracts 쓰기(R3-3 소관)·decrementMeetingReservation(01 H 단일셀).
- **R3-3** feat/db-write-payments — contracts + company_archive. 이월깃발·수납 1~3단계, TXT 내보내기 DB 기준.
  - **키 제약 발견(2026-07-13)**: contracts row_key=`r{행번호}` 는 **시트가 append 시 할당**(todos=UUID·
    sales=자연키와 근본 다름). 읽기(readContractsFromDb)도 이 키에서 row 를 역산 → UI 가 그 번호로
    patch/delete. 따라서 §2 "DB-first·시트 async" **진짜 flip 은 append 에서 불가**(행번호 원천이 시트).
  - **belie 결정(2026-07-13) = A안(dual-sync)**: 삭제(#532 clearContractRowInDbSync) 선례를 편집에 확장 —
    파일럿은 시트 쓰기(행번호 할당 유지)+**DB 동기 정본**(실패=throw·시트폴백 금지, 1회 재시도),
    비파일럿은 R2 미러(async) 완전 불변. 헬퍼=`upsertContractRowToDbSync`(contracts-clear.ts, clear 와 코어 공유).
    §2 지연감소(시트 왕복 제거)는 미달성(시트가 여전히 동기)—진짜 flip(B안 재키잉)은 belie 후속 결정.
  - **PR-1 `feat/db-write-payments`(2026-07-13) = contracts 편집만**: updateUserFields(수납 슬롯)·
    updateLinkFields(계약일·업체명)·syncFeeFromContract(수임비)·writeTermination(해지·반환액) 를 syncDb 게이트로
    dual-sync. **append 는 제외**(dual-sync throw→재시도 시 findFirstEmptyRow 가 중복 계약행 생성=매출 이중계상;
    삭제·편집은 기존 행 멱등이라 안전). append 직후 사용자 편집(updateUserFields dual-sync)이 全행 정본 write 로
    정합 회복. company_archive(자연키)=**PR-2** 로 분리(todos식 flip 가능).
  - 게이트: 서비스 resolveSheetWithSyncDb(=chooseDailySource 파일럿) → repo opts.syncDb. 읽기 경로 무변경(R2-4 라이브).
- **R3-4** feat/db-03-write-flip — db 4섹션. 합계행=시트 수식 몫(미러 raw 만).
  - **PR-1(2026-07-13) = raw 4섹션 편집(update/clear)만 dual-sync**(contracts A안 패턴, 신규 `db/db-tab-sync.ts`
    persistDbRow/clearDbRow — {섹션}:r{row} 멱등 upsert, 실패=throw·시트폴백 금지). 게이트=서비스
    resolveWriteCtx.syncDb(chooseWriteSource) → repo opts. **append 제외**(행번호=시트 할당, throw 재시도
    중복행, C2 확정) — R2 async 유지. 읽기 게이트(loadDBOverview=DB) 이미 라이브 → read-your-writes 충족.
  - **critic-2 수정(HIGH)**: append+update DB payload 에 `_cleared:false` 포함 — 삭제 후 같은 행 재추가 시
    _cleared:true 잔존으로 재추가 행이 파일럿 화면에서 사라지던 사고(jsonb 병합) 방지.
  - **파생셀 writer 제외 → R3-4b 후속**: writeProductionCountCell(생산개수 M)·writeProductionCell(생산 E)는
    R2 async 유지. 근거: (a) M 은 컨택 저장(contact.ts, 저장 완료 후 try/catch 없이 호출) 경유라 dual-sync
    throw 시 이미 저장된 컨택이 에러(critic-1) (b) 백필 컬럼폼 행에 필드명 부분쓰기 shadowing(C5-A) (c) E 는
    본 §6 71-73 에서 R2 유지 명시. R3-4b = 컨택경로 non-throw 분리 + shadowing 처리 후 M/E 편입.
  - **알려진 한계(수용)**: 편집 DB throw 시 syncProduction(E) skip → E 일시 stale(화면 DB 도 옛 값이라 정합,
    재시도 회복). 합계행 방어(isSumRow pre-read)는 드리프트 전제라 미추가(후속).
- **R3-5** feat/db-cohort-create — admin 기수 생성 DB 정본(선행: chore/deploy-env-admin-token). 시트 복제 실패가 생성을 막지 않게 pending 재시도. O1/O2=USER_ENTERED.

## 7. 수용 기준 공통(R3-1~5)
- 저장 API p50/p95 전/후 표(시트 동기 왕복 300~800ms 제거 → 저장 체감 개선 수치화).
- 미러 정합 테스트(저장 n건 후 시트==DB) + 미러 실패 시나리오(DB성공·시트실패 → 응답 성공 + mirror_pending).
- 롤백 스위치 동작 테스트. **비파일럿 기수 완전 불변**. check.sh 초록. §6.8 배포 관찰 + 실사.

## Log
- 2026-07-14 R3-3 PR-2 fix-forward(DevB): patchMeeting(04 화면 06 편집) 파일럿 silent 반쪽쓰기 수리(DevD #548 검증 플래그).
  근인: patchMeeting 이 06 upsert·rename 을 `syncDb` 없이 호출 → 파일럿도 async 미러(warn-only) → 미러 드롭 시 DB 에
  stale **non-empty** 06 잔존, `loadCompanyInfoByContract` 가 그 stale 반환(시트폴백=빈 DB에서만) → 결제카드 옛 값·무에러·200.
  수리: ①patchMeeting 06 upsert 에 `{syncDb}` 관통 + 파일럿 실패는 **삼키지 않고 throw**(loud, 재시도 자연키 멱등 수렴),
  비파일럿 warn 삼킴 불변 ②rename 도 `{syncDb}` 관통(키만이라 warn 유지·masked, 동기+재시도로 신뢰↑)
  ③`persistCompanyArchiveRow` sync payload 에 **두 기본값** 병합(시트 A:AB 전체행 replace 와 의미 일치):
  `_cleared:false`(rename-이탈 자연키 재사용 시 부활 — DevD C-caveat·기존 P2 흡수) + `커스텀:{}`.
  ⚠️ 커스텀 기본값은 **적대 리뷰가 잡은 자체 회귀 수정** — `_cleared:false` 만 넣으면 부활한 행에 이전 생(生)의
  stale 커스텀이 얕은병합(payload||excluded)으로 딸려 올라와 결제카드에 **남의 커스텀**이 노출됨(커스텀만 optional=키 부재).
  회귀 테스트: contact-company-archive-sync(5, 반쪽쓰기 재현=파일럿 06 실패→throw 고정) +
  company-archive-write-sync ①-b(부활)·①-c(stale 커스텀 차단)·①-d(사용자 커스텀 우선). check.sh 초록.
  **되돌리기**: 이 PR revert 1건(squash). 스코프 밖(후속): staleness 판정 기반 DB-only read 탭 근본 종결(#544·#541·#551·#548 공통)=DevA/DevB 후속.
- 2026-07-13 R3-2 PR-2 채택·리베이스·리뷰수정(DevA): 타세션 #541(meetings+carryover DB정본, meetings-write.ts·meetings-rows.ts 신설, todos PR-1 수렴미러 패턴)을 master(#544 포함)로 리베이스. contract-payment.ts 충돌=resolveSheetWithSyncDb에 ctx 통합(syncDb[#544 dual-sync]+ctx[meetings-write] 겸용). 적대적 리뷰(5관점, merge-correctness 무결) 확정 결함 **A/B/C 수정**: ①A(HIGH) listCarrySourceMeetings FORMATTED_VALUE→UNFORMATTED+SERIAL(ko_KR "오전10:00" 파싱실패로 이월 예약 DB read 소실) ②B(MED) runSheetSync meeting분기 이월 gcal guard(구분=이월 skip — 아레나 재참가 중복 캘린더) ③C(MED, 디스패치 cascade 게이트) findMeetingsByDateRecord·findChildMeetingRecord DB공백 시 시트 self-heal 폴백(미러갭 고아 계약 방지). **D 후속(문서화)**: 비파일럿 contract-payment 3경로가 patchMeetingRecord 경유 gcal reconcile 유발(R2엔 없음) — 개명은 캘린더 동기라 개선, saveCompanyInfo insert-if-missing만 엣지. gcal=B구역이라 정밀수정은 후속(patchMeetingRecord gcal-skip 옵션). check.sh 초록(유닛466). **되돌리기**: 이 PR revert 1건(squash). 근거=적대리뷰 output w93pd4tn8.
- 2026-07-13 R3-3 PR-2 구현(DevB): company_archive(06 업체정보) `upsertCompanyInfoArchive`·`renameCompanyInfoKey`
  쓰기 dual-sync(파일럿만). 신규 `lib/repo/db/company-archive-sync.ts` = #544 contracts-clear 골격 이식,
  **차이=row_key 가 자연키(계약ref, C열)** 라 upsert 가 시트 append 를 유발해도 DB `on conflict(row_key)` 병합 →
  재시도가 중복행 無(contracts append 를 dual-sync 제외한 이유가 여기선 무효 = #544 "자연키는 PR-2" 근거).
  라우터 persistCompanyArchiveRow/Rename(파일럿=동기 정본 실패=throw·1회재시도, 비파일럿=R2 미러 async).
  게이트 배선: saveCompanyInfoByContract(직접 저장)·editContractLinkedFields(개명 rename) 에 syncDb 관통.
  **2차효과 3경로 제외**(addFromContract 스냅샷·patchMeeting cascade 2)=warn-wrapped + read fallback(DB→시트06→04)
  커버라 R2 async 미러 유지(강제 sync=조용한 반쪽쓰기·R3 §0 금지). rename DB payload 는 키필드만이라
  업체정보 read 는 시트 fallback 이 정본(무변경). 비파일럿·DATABASE_URL 미설정=R2 완전 불변(롤백 스위치).
  테스트: company-archive-write-sync(10: 성공·재시도·2회실패throw·no-op·owner폴백·미러경로·rename순서) +
  company-archive-write-gate(5: save·rename 파일럿/비파일럿/DB-off). check.sh 초록. §2 지연감소는 PR-1 과 동일 미달(dual-sync).
- 2026-07-13 R3-4 PR-1 구현(DevF): 03 DB관리 raw 4섹션 편집(update/clear ×4) dual-sync(파일럿). 신규
  `lib/repo/db/db-tab-sync.ts`(persistDbRow/clearDbRow) + db.ts 8함수 opts 관통 + service resolveWriteCtx.syncDb.
  **적대적 검증 워크플로 7에이전트**(6주장 + 완전성 비평가)로 블루프린트 검증 → **중대 발견 2건 수정**:
  ①critic-2 _cleared:false(재추가 행 부활, append+update) ②파생셀 M/E dual-sync 제외(컨택 저장 회귀 critic-1
  +shadowing C5-A → R3-4b). append 제외(C2). 신규 테스트 23(repo dual-sync 9·게이트/롤백/append제외/E-cascade/
  throw회귀 12·_cleared 부활 2). check.sh 초록. §2 지연감소는 미달성(dual-sync·시트 동기 유지=cascade 무회귀 전제).
- 2026-07-13 R3-4 PR-1 적대적 diff 리뷰(4차원×검증) → **회귀 1건 CONFIRMED·수정**: patch/remove(매입DB·
  콜지기소)에서 DB dual-sync throw 시 시트는 이미 변경됐는데 syncProduction(E 재집계) skip → 재시도 시
  oldDateOf 가 변경된 시트를 재읽어 옛 날짜 유실 → 생산(E) 영구 오집계(master 는 미러 fire-forget라 무해).
  수정=4함수 try/finally(시트 확정 후 E 재집계는 DB throw 무관 실행, DB 에러는 전파). throw 회귀 2테스트.
  비파일럿 불변=리뷰 clean(0), _cleared 부활 오더링 우려=REFUTED.
- 2026-07-13 R3-3 PR-1 구현(DevA): contracts 편집 4종(updateUserFields·updateLinkFields·syncFeeFromContract·
  writeTermination) dual-sync(A안, belie 승인). 라우터 persistContractRow + 동기 헬퍼 upsertContractRowToDbSync
  (contracts-clear.ts — clear 와 재시도/owner역조회 코어 공유). patch·terminate·syncFee·editLinked 는 dual-sync,
  **addPrior·append 은 제외**(행번호=시트할당, throw 재시도 시 중복행=매출 이중계상; #532 delete 는 멱등이라 안전).
  company_archive=PR-2.
  §2 지연감소는 미달성(dual-sync, 시트 동기 유지) — §7 "저장 p50/p95 표"는 이 PR 스코프 아님(진짜 flip=B안 후행).
- 2026-07-13 R3-3 PR-1 적대적 다중에이전트 리뷰(5관점×검증, 확정10/반증4): **회귀 1건 발견·수정** —
  addPriorContract 가 비멱등 append 직후 dual-sync updateUserFields(throw)를 엮어, DB장애 throw→사용자 재시도 시
  중복 계약행(이월 매출 이중계상). 3관점 독립 확인. → addPrior 를 append 계열로 재분류해 dual-sync 제외(R2 미러).
  회귀 방지 테스트 추가(gate 테스트 addPrior + persistContractRow 라우터 비파일럿 no-throw + 비파일럿 비대칭).
  **후속(선재·이 PR 무관, 별도 처리)**: ①updateUserFields 全행 payload 가 해지필드 default 로 DB 해지 clobber 가능
  (R2 미러도 동일·round-trip 시 안전, low) ②clearRowByLink(미팅화면 계약삭제 cascade 5경로)는 #532 dual-sync 미적용
  (delete 커버리지 확장 소관) ③arena-carryover.ts 마이그레이션 updateUserFields 미게이트(1회성·append계열) ④owner
  역조회 실패 시 cohort/email 메타데이터 일시 강등(자가치유·대조표 한정) ⑤patchMeeting(contact.ts) 의 updateLinkFields
  링크편집은 dual-sync 미배선(회귀 아님·async 미러 유지) — contact.ts 가 이미 500줄 캡이라 배선하려면 파일 분리 선행
  필요 → 후속 PR(contact.ts split + 미팅화면 계약편집 dual-sync). 다섯 다 회귀 아님·불변식 무저촉.
- 2026-07-12 R3-0 재검증(Dev3-B): 오케스트레이터 재지시분(인벤토리·전환패턴·드리프트·롤백·가드 ①~⑤)과
  본 문서 대조 — 전 항목 기충족 확인, 재등재 안 함(중복 회피, CLAUDE.md §3 0.5).
  후속 처리: db-first-unlimited-roadmap.md 레포 등재(죽은 링크 해소) + D3 답변됨 반영.
- 2026-07-09 R3-1 구현: sales 4채널 배치 저장 DB 정본 전환(파일럿만). chooseWriteSource(읽기 대칭)
  + writeSalesRowsToDb(트랜잭션·실패 throw) + sales-write.ts(persistSalesRows/시트 비동기 미러 3회 백오프)
  + sales.ts `{mirror:false}` 옵션. contact.ts 502→500(추출로 슬림). 게이트 테스트(읽기 대칭·롤백 불변)
  추가. check.sh 초록(384 유닛). 적대적 리뷰(실패정책·트랜잭션·게이트·payload 정합 4차원). 단일셀 writer는 스코프 밖.
- 2026-07-09 R3-0 등재: 인벤토리(7탭)·전환 패턴·드리프트·롤백 스위치·가드 정책·PR 분할. D3(미러 유지) 답변 확정.
  ⚠️ 발견: R2 플랜들이 `db-first-unlimited-roadmap.md` 를 참조하나 그 파일은 부재(죽은 링크) — R3 SoR 는 본 문서 + db-migration-pilot.md 로 확정. 로드맵 파일 생성은 스코프 밖(belie 판단).
