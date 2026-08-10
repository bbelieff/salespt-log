---
slug: sheet-retirement-r7
status: active
created: 2026-08-05
owner: belie(발주) · Cowork(설계) · 반장 CC(실행 총괄)
related: db-first-unlimited-roadmap, db-write-flip, db-migration-pilot, arena-season2-setup
worktree: (작업별 개별 워크트리 — 아래 §3 배차표 참조)
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 구글시트 완전 은퇴(= DB 단일 정본) 전체 조감도 — 남은 결합 지점 인벤토리 + 4 Phase 22개 PR 단위 분해 + 임계경로.
> - **누가 읽나요**: belie(우선순위·결정), 반장 CC(배차), 각 워커 세션, 코덱스 R트랙
> - **어떤 기능·작업과 연결?**: R2(읽기 전환·완료)·R3(쓰기 전환·진행)의 종착점. Linear 마일스톤 Phase 0~4.
> - **읽고 나면 알 수 있는 것**: 아직 시트에 묶여 있는 게 정확히 무엇인가 / 어떤 순서로 풀어야 하나 / 무엇이 진짜 병목인가 / 어디서 되돌릴 수 있나
> - **관련 문서**: db-first-unlimited-roadmap.md(R0~R7 원 로드맵), db-write-flip.md(R3 상세), db-migration-pilot.md(스키마)

# 설계도 3호 — 시트 은퇴 (R7) · DB 단일 정본 전체 조감도

## 0. 꼬리표
- **발주**: belie 2026-08-05 — "시트 은퇴를 앞당기자. 이슈들을 기획해 Linear에 올려 조감도를 만들자."
- **계기**: 관리자 [수강생관리] 진입 지연(BBE-48). 근인이 "전 기수 수강생 시트를 매번 개별 조회"였고,
  이 화면은 DB 파일럿 대상이 **아예 아님**이 드러남 → 부분 전환의 한계가 체감으로 노출됨.
- **⚠️ 이름 주의**: 원 로드맵의 "R6"는 시트 은퇴지만, 레포에 **비용원장 R6**(`r6-current-master-integration-r1.md`)가
  이미 존재해 충돌. 본 트랙은 **R7 / `sheet-retirement`** 로 부른다.
- **⚠️ 이 설계도는 origin/master 기준**. 조사 시점 로컬 워킹트리가 21커밋 뒤처져 있었음(#666·#670~674 미반영).

## 1. 전제 — 지금 어디까지 왔나
- **R2(읽기)**: 파일럿 기수(8·9·연습·아레나)의 **수강생 개인 화면**은 DB 읽기 라이브.
- **R3(쓰기)**: sales·meetings·todos = **완전 DB 정본 + 수렴 미러**. contracts·company_archive·03DB탭 = **dual-sync**(시트도 여전히 동기).
- **핵심 사실 ①**: 지금까지의 R2/R3 는 전부 `sheet_rows`(= 수강생 개인 데이터) 하나만 다뤘다.
  **레지스트리(users/cohorts)는 한 줄도 손대지 않았다.** Postgres 에 users·cohorts 테이블 자체가 없다.
- **핵심 사실 ②**: 파일럿 게이트는 **수강생 개인 앱 서비스에만** 적용된다. admin·트레이너·회장·전광판은
  **하나도 게이트를 통과하지 않는다** → 전부 100% 시트.
- **핵심 사실 ③**: DB 에 데이터가 있는 기수는 8·9·연습·아레나뿐. **1~7기·10기·A2 는 DB 에 없다.**

## 2. 남은 결합 인벤토리 (코드 실측 2026-08-05)

### A. 쓰기 — 아직 시트가 행 번호를 매기는 곳
| 대상 | 상태 | 남은 일 |
|---|---|---|
| sales(01 E~H)·meetings(04)·todos(05) | ✅ 완전 DB 정본 | 미러 제거만 |
| `writeProductionCountCell`(03 M 생산개수) | ✅ **완료(2026-08-09, BBE-61)** — non-throw 안전모드로 편입 | — |
| contracts(02) | 🟠 편집·삭제만 dual-sync, **append 는 시트-first** | L — 자연키 재키잉(설계 완료·미머지) |
| company_archive(06) | 🟠 dual-sync(시트 동기 유지) | M — 진짜 flip |
| db(03 4섹션) | 🟠 update/clear 만 dual-sync, **append 4경로 시트-first** | L — UUID 키 도입 + row_key 마이그레이션 |
- append 가 막힌 이유 = row_key 가 `r{행번호}`인데 그 번호를 **시트의 `findFirstEmptyRow` 가 할당**.
  재시도 시 중복행 = **매출 이중계상** 위험이라 의도적으로 제외돼 있음.
- contracts 해법은 이미 설계 완료(자연키 upsert, `contract-append-idempotent-flip.md`) — **머지 창구 = 8/7 개막 이후**.
- 03 은 자연키 후보가 없어 **UUID 신규 컬럼 + 기존 row_key 리라이트 마이그레이션**이 필요(더 무겁다).

### B. 읽기 — 게이트 밖 (전부 시트)
- `/admin/users`·`/trainer`·`/captain` — `readProfileBundle` 이 **수강생 1인당 시트 1회 batchGet**. DB 경로 전무. → BBE-48 근인.
- **전광판**(`/admin/arena/scoreboard`) — 참가자 시트마다 3회 읽기. 참가자 전원이 이미 파일럿인데도 시트를 읽는다(= 즉시 개선 가능한 저비용 표적).
- `/admin/cohorts`·`/admin/arena`·`/admin/trainers`·`/admin/popup`·`/api/admin/*` — 전부 **레지스트리 시트** 기반.
- 아레나 이월 읽기(`listCarrySourceMeetings` 등) — 쓰기는 게이트, 읽기는 게이트 밖.
- `sheet-diagnostics.ts` — 시트 은퇴 시 통째 폐기.

### C. 시트 수식 의존
- **대시보드**: 파일럿은 TS 재구현 완료(`dashboard-aggregates.ts`). 단 `reverseShadowCompare` 가 아직 시트를 읽음(대조용).
- **B21 누적수임비**: 코드 주석에 **"정의 미확정"** 명시 — 가장 미검증인 재구현 지점. 검증 필요.
- **전광판 주차별 5지표(C33:H40)**: DB 경로 없음 — 파일럿에게도 100% 시트 수식값.
- **영업관리 I~P**: 앱이 실제로 읽는 건 L(미팅완료)·N(계약) 둘뿐. 나머지는 사람 열람용.
  ※ CLAUDE.md §2.5 의 "I~L/N~T" 표기는 **stale** — 실제는 I~P, Q~T 는 폐기된 입력값.
- **03 합계행**: ✅ 이미 앱이 계산(2026-05-15 사고 이후 `isSumRow` 스킵).
- **04 N/O 표시문자열**: 시트 수식이지만 소비처 0. 단 영업관리 I/J 의 입력이라 같이 없애야 함.

### D. 프로비저닝 (시트를 "만드는" 인프라)
- `setup-formulas.ts`(477줄)·`contract-formulas.ts`·`/api/setup`·수식설치 UI 2개·진단 6규칙 → **전부 사장**.
- 기수 생성 = Drive 파일복사 + 폴더생성 + 레지스트리 쓰기 + O1/O2 기록 → **DB insert 1건으로 붕괴**.
  `cohort_pending_creates` 재시도 큐도 존재 이유 소멸(Drive copy 실패 대비였음).
- **수강기간(01!O1/O2) 은 DB 등가물이 없다** — 별도 컬럼 신설 필요.
- **export 코드는 0** — xlsx/csv 라이브러리 의존조차 없음. 로드맵의 "export 버튼"은 **새로 만들어야 함**.
- 살아남는 것: `AUTH_GOOGLE_*`(로그인·gcal), 공지 이미지 업로드용 Drive.

### E. 백필 갭
- 백필 스크립트 = `scripts/ops/backfill-sheet-rows.mjs` 1개(6탭, dry-run 기본) + `db-backfill.yml` 워크플로.
- **DB 에 없는 기수**: 1~7기(archived)·10기·**A2 시즌2 전원**.
- 🔴 **개막 블로커(BBE-50)**: `A2-N` 은 정규식상 **자동으로 파일럿 편입**되는데 A2 배치 스크립트에 backfill 이 없다.
  → 8/7 개막 시 55명이 빈 DB 를 읽는다. **개막 전 백필 실행 필수.**
- 대조 도구: `/admin/db-parity`(행수) · `scripts/ops/dashboard-parity.mjs`(수식 vs SQL 항목별 diff — 재사용 가치 높음).

### F. 기타 결합
- 🔴 **gcal ↔ 시트**: 캘린더 이벤트ID 가 **시트 셀에 산다**(04!AT, 05!O — 사용자별 JSON 맵).
  gcal refresh token 도 **레지스트리 S열(암호화)**, 설정은 T열. `gcal_tokens` 테이블 없음. → 테이블 2개 신설 필요. **L**
  ※ db-write-flip.md 의 "O열" 표기는 04 가 아니라 05 기준 — 본 문서가 정정본.
- `googleapis` 런타임 import = 4파일뿐(구조 테스트가 강제) → 은퇴 시 제거 범위가 명확한 건 다행.
- 죽는 인프라: quota 재시도·`unstable_cache` 7종·`ensureGridColumns`·`sheet-backfill.ts`·구조테스트 2·3번.

### G. 미결 결정 (belie)
1. ✅ **D3 뒤집기 — belie 회신됨(2026-08-05): "시트는 다운로드 버튼 형태로 남긴다."**
   = 시트를 정본으로도 자동 미러로도 유지하지 않고, **앱 export(다운로드)로 대체**.
   ⛓️ **순서 구속 신설**: export(#22)가 동작하기 전에는 미러(#20)를 끄지 않는다 → #20 blocked_by #22.
   남은 미결 = export 의 형식(엑셀/CSV)·범위·사용 주체(#22 소관, ADR 착수는 이것 없이 가능).
2. **ADR 부재** — DB-as-SSOT·시트 은퇴에 대한 ADR 이 하나도 없고, **ADR-0002(시트=SSOT)가 유효 상태로 남아 현실과 모순**.
3. **D2 미답** — 아레나 라벨 통합(A1-N→N) 시 동일인 병합 규칙. 시즌2가 A2 를 추가해 문제가 2배.
4. ~~ADR 번호 충돌(0029 두 개).~~ → ✅ **해소(2026-08-05, BBE-52)**: 후발 문서(무제한 CRM)를
   `0031-unlimited-crm-supersede-0005.md`로 재발행 + 양쪽 문서 상호 링크, 코드·문서 참조 전량 갱신.
   (⚠️ 최초 시도는 0030을 썼으나 같은 시각 병렬 PR #706이 `0030-db-ssot-supersede-0002.md`를
   선점해 리베이스 중 발견·**0031로 재조정** — R7 Phase 0 동시착수 시 번호 재충돌 가능성을
   보여준 사례, 향후 ADR 발급은 머지 직전 origin/master 재확인 권장.)

## 3. 작업 분해 — 4 Phase · 22건 (= Linear 이슈)

### Phase 0 — 선행·블로커 해소 (지금 바로)
| # | 작업 | 선행 | 크기 |
|---|---|---|---|
| 1 | **A2 시즌2 백필 실행** + 런북 항구 편입 | — (**8/7 전 필수**) | S |
| 2 | **ADR: 시트 은퇴 + DB-as-SSOT** (0002·D3 supersede) | belie 결정 | S |
| 3 | ~~ADR 0029 번호 충돌 정정 + CLAUDE.md §2.5 stale 수정~~ ✅완료(BBE-52) | — | S |
| 4 | contracts append 자연키 upsert 머지 | 8/7 개막 | M |

### Phase 1 — 레지스트리 DB화 (**진짜 병목**)
| # | 작업 | 선행 | 크기 |
|---|---|---|---|
| 5 | `users`·`cohorts` Postgres 스키마 + **마이그레이션 러너 도입** | 2 | L |
| 6 | 레지스트리 이중기록 + 1회 backfill | 5 | L |
| 7 | 레지스트리 읽기 flip (admin 전 화면) | 6 | L |
| 8 | 수강기간(O1/O2) DB 컬럼화 | 5 | M |
| 9 | gcal 토큰·설정 DB 이전(레지스트리 S/T → 테이블) | 5 | M |

### Phase 2 — 나머지 쓰기 진짜 flip
| # | 작업 | 선행 | 크기 |
|---|---|---|---|
| 10 | 03 append 재키잉(UUID + row_key 마이그레이션) — **완료(2026-08-10, BBE-59)**: Phase 1(UUID 키 발급 + 신규 append 부터 적용, update/clear 는 물리 행의 현재 매핑 키 조회) + Phase 2(레거시 행 payload 에 `_row` 백필 — row_key 문자열 자체는 안 바꿈, 실행 직전 발견한 라이브 파일럿 동시편집 경쟁조건 때문에 범위 축소). VPS 실행 완료: dry-run 대상 1004건 → `--execute` 1004/1004 갱신(충돌 0). **행동 변화 0**(순수 additive) — R7-#11(BBE-60) 착수 가능. 상세 = `docs/plans/completed/db-append-rekey.md` | 4 | L |
| 11 | contracts·company_archive·03 → DB-first + 수렴 큐 | 4·10 | L |
| 12 | `writeProductionCountCell` DB 정본화(R3-4b 잔여) — **완료(2026-08-09, BBE-61)**: `mirrorSheetRowAwaitable`(재시도 3회·non-throw)로 파일럿(syncDb) 이면 DB 반영을 기다리도록 편입, 컨택 저장 경유 호출은 실패해도 throw 안 함(성공한 주 동작 보호). 상세 = worklog. | — | S |
| 13 | gcal 이벤트ID 맵 DB 이전 | 5 | L |

### Phase 3 — 읽기 잔여 (**체감 즉효 · Phase 1과 병행 가능**)
| # | 작업 | 선행 | 크기 |
|---|---|---|---|
| 14 | 전광판 DB 전환 | — | M |
| 15 | `readProfileBundle.stats` DB 대체 → **admin·트레이너·회장 동시 해결(BBE-48)** | — | M |
| 16 | 아레나 이월 읽기 게이트 적용 | — | S |
| 17 | B21 누적수임비 정의 확정 + 검증 | — | S |

### Phase 4 — 은퇴 실행
| # | 작업 | 선행 | 크기 |
|---|---|---|---|
| 18 | 잔여 기수 전량 백필(1~7기·10기) + 대조 리포트 | 1·5 | M |
| 19 | **파일럿 게이트 제거**(= 롤백 스위치 상실 지점) | 4·10·11·13·18 | M |
| 20 | 시트 미러·수식 설치 인프라 폐기(`googleapis` 제거) | 19 | L |
| 21 | 기수 생성 = DB insert 1건 | 5·7·20 | M |
| 22 | **Export 버튼 신규 제작**(xlsx/csv) | 19 | M |

### 임계경로
```
2(ADR) → 5(스키마) → 6(이중기록) → 7(읽기flip) → 19(게이트제거) → 20(시트제거)
```
**Phase 1 이 전체의 실질 병목.** Phase 3(14~17)은 선행이 없어 **Phase 1과 완전 병렬 가능** —
belie 체감 개선(admin 느림·전광판)이 여기서 나오므로 **먼저 태우는 것을 권장**.

## 4. 수용 기준 (트랙 전체)
- [ ] 전 기수(1~10기·A1·A2)가 DB 에 적재되고 시트 대조 diff 0
- [ ] `googleapis` 런타임 import 0 (구조 테스트가 강제하도록 규칙 반전)
- [ ] admin·트레이너·회장·전광판 응답시간 개선 수치 제시(#484 기준선 대비)
- [ ] export 기능으로 기수/개인 데이터를 파일로 받을 수 있음
- [ ] 신규 기수 생성이 시트 없이 완료됨
- [ ] ADR 로 ADR-0002·D3 supersede 완료

## 5. 리스크·롤백
- **최대 리스크 = 19번(게이트 제거)**. 그 순간 "탭별 즉시 R2 복귀" 안전망이 사라진다.
  → **18(전량 백필+대조 0건) 완료 전에는 절대 착수 금지.** 19 이전까지는 모든 단계가 게이트 플립 하나로 복귀 가능.
- **매출 데이터 위험 = 4·10·11(append 재키잉)**. 중복행 = 매출 이중계상. 카나리아 + 멱등성 테스트 의무.
- **개막 충돌**: 8/7 전후 2주는 10기·A2 안정화 창구 → Phase 0 의 1번 외에는 머지 금지 권장.
- 각 PR 은 §6.8(머지→배포 관찰→health 200) 완주. 실패 = revert 가 정본.

## 6. 규모 감각 (belie용)
지금까지 R3(쓰기 전환) 절반을 진행하는 데 약 1개월·PR 6~7건이 들었다. R7 전체는 그 **3~4배 규모**로,
PR 20건 이상·Phase 1(레지스트리)만으로도 R3 전체와 맞먹는다. 정확한 비용은 Phase 0~1 실착수 후
반장이 실적 기반 견적을 낼 수 있다. **Phase 3 를 먼저 태우면 적은 비용으로 체감 개선을 먼저 확보**할 수 있다.

## Log
- 2026-08-05 설계도 작성(Cowork) — belie 발주. 서브에이전트 코드 실측 인벤토리 A~G 반영.
  개막 블로커 1건(A2 백필 누락) 발견 → BBE-50 별건 등재. Linear Phase 0~4 마일스톤·이슈 22장 조립.
