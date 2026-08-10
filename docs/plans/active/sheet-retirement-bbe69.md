---
slug: sheet-retirement-bbe69
status: active
created: 2026-08-10
owner: belie
related: sheet-retirement-r7, db-write-flip, db-append-rekey
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: BBE-69(R7-#20) 시트 미러·수식·설치 인프라 폐기 — 실행 계획(코드 변경 0, 계획만).
> - **누가 읽나요**: 개발자, 에이전트, 운영자(belie)
> - **어떤 기능·작업과 연결?**: `lib/repo/sheets-client.ts` 및 그 소비자 전체, 시트 미러(`db/mirror.ts`),
>   수식 설치·진단 UI/API, `googleapis` 의존성
> - **읽고 나면 알 수 있는 것**: 무엇을 지우나 / 지우면 안 되는 건 뭔가 / 어떤 순서로 지우나 /
>   되돌리는 법 / 착수 조건(S0)이 지금 충족됐나
> - **관련 문서**: `docs/plans/active/sheet-retirement-r7.md`(R7-#20) ·
>   `docs/decisions/0030-db-ssot-supersede-0002.md` · Linear BBE-69

# BBE-69(R7-#20) — 시트 미러·수식·설치 인프라 폐기 실행계획

## 0. 지금 착수 가능한가 — **아니오** (S0 미충족)

이 문서는 belie 지시("BBE-69 계획 준비. §6 계약")에 따라 **계획만** 작성한다. §6 계약 자체가
"오늘 착수 금지 — 68 배포 후 관찰창이 선행"을 명시한다. 실측 결과 그 관찰창은 **아직 시작되지도
않았다**:

| 항목 | 상태(실측, `origin/master`=`1f77b4a`, 2026-08-10) | 근거 |
|---|---|---|
| BBE-68(파일럿 게이트 제거) 배포 | ❌ **아직 착수 전** — 카드 상태 Backlog | Linear BBE-68: 2026-08-09 18:32 Done → 2026-08-10 01:20 **Backlog 로 되돌려짐**, 이후 06:38 갱신도 Backlog 유지. 붙은 PR #771 = "🚨 착수 금지 재확인" |
| BBE-68 착수 조건 체크리스트 | ❌ 다수 미충족 | R7-#11(BBE-60) DB-first 는 **company_archive 만** 완료(02·03 은 별도 재키잉 필요, 미착수) · R7-#17(BBE-66) B21 정의 "완료조건 미충족"(worklog `#789`, 2026-08-10) · R7-#18(BBE-67) 백필 diff 0 아직 |
| BBE-71(Export) ADR 순서구속(69 blockedBy 71) | ⚠️ **형식만 충족, 실질 미충족** | Linear 상 Done 이나 실제 배송물(`app/api/export/route.ts`, 실측 재확인)은 `getCurrentUserEmail()` 기반 **로그인 본인 것만** 다운로드 — 기수·관리자 단위 export 없음. 순서구속의 목적("미러 끄기 전 운영자가 데이터를 꺼낼 수단 확보")이 실질적으로 안 채워짐 |

**결론**: S0(아래 §6) 가 전부 초록이 되기 전까지 이 카드는 계획 문서 상태로 둔다. 이 판단은
Linear BBE-69·BBE-68 코멘트에서 이미 두 세션(경영일지 데탑 C작업반장·G작업원C/반장, 2026-08-09~10)이
독립적으로 도달한 결론과 일치 — 본 문서는 그 조사들을 **정본 계획 문서로 승격**한 것이다
(중복 재조사 없음, CLAUDE.md §0.5 ②).

## 1. 카드 제목 정정 필요 — «googleapis 제거» 는 불가능하다

`googleapis` 패키지 자체는 **남는다.** 시트 말고 두 곳이 더 쓴다:

| 모듈 | 용도 | 판정 |
|---|---|---|
| `lib/repo/gcal-client.ts` · `gcal-oauth.ts` | 구글 캘린더 연동(사용자 OAuth) | **유지** |
| `lib/repo/drive-client.ts` · `drive-txt.ts` | 공지 이미지·TXT 업로드, 기수 시트 복사 | **유지** |
| `lib/repo/drive-sa-share.ts` | `import type` 만 — 런타임 0 | 유지(타입만) |
| **`lib/repo/sheets-client.ts`** | 시트 I/O 전부(JWT+Sheets v4) | **← 진짜 폐기 대상** |

**수용 기준 정정**: ~~`googleapis` import 0~~ → **`sheets_v4` 런타임 import 0 · `SHEETS_*` env 참조
0**. 구조 테스트(`tests/structural/layers.test.ts` 의 `SHEETS_PACKAGES` 가드)도 이 기준으로 반전.

## 2. 규모 — 카드 본문보다 훨씬 크다

`sheets-client` 를 직접 import 하는 모듈이 **약 30개**(`lib/repo` 대부분 + `lib/service` 일부 +
`app/api` 일부) — 이건 "파일 몇 개 삭제"가 아니라 **퍼시스턴스 레이어 교체의 마지막 단계**다.
**단일 PR 불가** — 아래 S1~S5 로 쪼갠다.

카드 본문 stale 1건 확인: `lib/service/sheet-title-match.ts` 는 실측 결과 존재하지 않음 —
`lib/repo/sheet-title-match.ts` 로 이미 이동됨(2026-08-10 재확인).

## 3. 제거 대상 전수 목록

### S1군 — 관리자 전용 도구 (수강생 화면 무관, 위험 최저)

| 경로 | 줄수(실측) | 비고 |
|---|---|---|
| `lib/repo/setup-formulas.ts` | 476 | ⚠️ `isSafeToOverwrite`(§2.5 bulk-write 가드)를 **먼저 이전** — `lib/repo/course-dates.ts:7,38` 이 씀(실측 확인) |
| `lib/repo/contract-formulas.ts` | ~20 | |
| `lib/service/sheet-diagnostics.ts` | 497 | `lib/service/index.ts` 재수출 지점도 정리 |
| `app/api/setup/route.ts` | | `installFormulas`·`uninstallFormulas` |
| `app/api/admin/install-formulas-bulk/route.ts` | | |
| `app/api/admin/install-formulas-by-id/route.ts` | | |
| `app/api/admin/diagnose-sheet/route.ts` | | |
| `app/api/admin/fix-sheet/route.ts` | | |
| `app/api/admin/discover-folder-sheets/route.ts` | | `listSheetsInDriveByTokens`(Drive 소비 — Drive 자체는 유지, 이 라우트만 폐기) |
| `app/api/_debug/registry/route.ts` | | |
| `components/auth/InstallFormulasButton.tsx` | | UI 버튼 |
| `components/auth/InstallFormulasByIdButton.tsx` | | UI 버튼 |
| `components/auth/TraineeDiagnoseButton.tsx` | | UI 버튼 (카드는 "버튼 2개"라 했으나 **3개**) |
| `lib/service/company-info-txt.ts` 의 `exportCompanyInfoTxt` | | 외부 호출자 0(죽은코드) — 같은 파일의 `upsertTxtInFolder` 는 살아있으니 **함수 단위**로만 제거 |

### S2군 — 미러 쓰기 (S1 이후, 관찰일 하루 더 둔 뒤)

`lib/repo/db/mirror.ts` · `mirror-pending.ts` · `lib/service/sheet-backfill.ts`(호출자 =
`contract-payment.ts`·`db.ts`) · `db-pilot.ts` 의 미러 분기 · `meetings-write.ts`·`sales-write.ts`·
`todos.ts`·`company-info-archive.ts`(BBE-60 에서 만든 `queueCompanyArchiveSheetSync` 포함)의 미러
호출부. 관련 테스트 5개(`mirror-pending`·`company-archive-flip`·`meetings-write`·`sales-write`·
`todos`)는 삭제가 아니라 **미러 기대치 제거로 수정**.

⚠️ **여기부터 시트가 낡기 시작한다.** S2 이후 롤백은 "시트로 복귀"가 아니라 "DB→시트 재백필"이 된다.

### S3군 — 시트 읽기 경로 (가장 크다, 도메인별 분할)

`sheets-client` 소비자 ~30개를 도메인 묶음으로 순차 전환: users 계열(8) · 계약/수납(4) ·
매출(4) · 03 DB(3) · 미팅/투두(2) · 기타(`dashboard`·`carryover`·`cohorts`·`announcements`·
`course-dates`·`share-scores`·`company-info-archive`·`gcal-schedule-read`·`gcal-event-ids`) ·
서비스(`db-parity`·`scoreboard`·`sheet-diagnostics`). 동반: `unstable_cache` 다수 파일(시트 지연
흡수용이므로 DB 전환 시 TTL 재검토 필요).

### S4군 — 마무리

`lib/repo/sheets-client.ts`(195줄, `withRetry`·`isRateLimitError`·`ensureGridColumns`·
`recordSheetsCall`) 삭제 · `lib/analytics/api-timing.ts` 의 시트 계측 제거 · 구조 테스트 규칙
반전(§1) · env 정리.

**죽는 env**: `GOOGLE_SERVICE_ACCOUNT_EMAIL/PRIVATE_KEY` · `SHEETS_REGISTRY_ID/TAB` ·
`SHEETS_COHORTS_TAB` · `SHEETS_COHORT_MASTER_ID` · `DEFAULT_COHORT_TEMPLATE_ID`.
**유지 env**: `AUTH_GOOGLE_*` · `ADMIN_DRIVE_REFRESH_TOKEN`(공지 이미지 업로드).

### S5군 — 스크립트 정리 (아무 때나 가능, 위험 0)

일괄 삭제 금지 — 셋으로 갈린다:
- **상시 운영(이전 필요)**: `scripts/append-updates.mjs`(배포마다 실행, BBE-70 과 조율).
- **감사·대조 도구**: `a2-db-parity`·`registry-parity`·`dashboard-parity`·`scoreboard-parity`·
  `db-contract-drift-audit`·`contract-append-key-audit`·`verify-sa-sheet-access` — 시트가
  죽으면 같이 은퇴(S4 와 동시).
- **1회성 과거 수리**(날짜 박힌 스크립트) → `scripts/archive/` 로 이동 또는 삭제. 실행 안 되므로
  위험 0.

## 4. 제거 순서

```
S0 선행 확인   → BBE-68 배포 + 관찰창 종료 + BBE-60(02·03 잔여)/67 완료 + 관리자·기수 export 확보
S1 관리자 도구 → 수식설치·진단 UI·라우트 (수강생 화면 무영향, 되돌리기 가장 쉬움)
      ⚠️ 선행: isSafeToOverwrite 를 course-dates 쪽으로 이전
S1↔S2 사이에도 관찰일 하루
S2 미러 쓰기   → 쓰기만 끊는다. 읽기는 그대로 유지
S3 읽기 경로   → 도메인별 PR. 한 도메인마다 배포 + 화면 실측
S4 sheets-client 삭제 + 구조테스트 반전 + env 정리 + 감사 스크립트 은퇴
S5 1회성 스크립트 정리 (아무 때나)
```

## 5. 되돌리는 법

| 단계 | 되돌리기 | 데이터 손실 |
|---|---|---|
| S1 | `git revert` 1건 | 없음 |
| S2 | `git revert` + **DB→시트 재백필 필요**(미러 중단 기간만큼 시트가 낡음) | 시트만 낡음, DB 정본은 온전 |
| S3 | 도메인별 revert(여러 도메인 진행 후면 역순) | 없음(읽기만) |
| S4 | revert + env 재등록 | 없음 |
| S5 | revert | 없음 |

**공통**: 각 단계 PR 은 단일 목적으로 쪼개 revert 가능성을 유지한다. S2 이후로는 BBE-68 이 이미
버린 "게이트 플립 1번" 같은 경량 복구가 없다 — §6.8 롤백(PR revert + 재배포)이 유일 수단.

## 6. 착수 전 체크리스트 (S0 — 전부 ✅ 여야 실행 계약으로 승격)

- [ ] BBE-68 배포 완료 + 관찰창 종료(기산일 미정 — §0 참조)
- [ ] BBE-60 나머지(contracts·03) DB-first 전환 완료 — 현재 company_archive 만 완료(BBE-60, PR #786)
- [ ] BBE-67 전량 백필 diff 0
- [ ] **관리자/기수 단위 export 확보** 또는 belie 의 "개인용으로 충분하다" 명시 결정
      (§0 표 3번째 행 — 이건 되돌리기 어려운 지점이라 belie 화이트리스트 ③(정책 방향)에 해당,
      **belie 판단 필요**)
- [ ] 시트 최종 스냅샷 1부 확보(미러 끊기 직전 — 마지막 복구 창구)
- [ ] Linear BBE-69 카드 본문 정정(제목 «googleapis 제거» → «시트 I/O 제거», `sheet-title-match.ts`
      항목 삭제, UI 버튼 2→3)

## 7. belie 체감 변화 (쉬운 말 1줄)

**시트 자동 갱신이 멈춘다** — 지금처럼 구글시트를 직접 열어봐도 최신 값이 더는 안 보인다. 대신
앱의 "내 기록 다운로드" 버튼으로 스냅샷을 내려받는다. **단, 지금은 수강생 개인 것만 다운로드
가능**하고 belie 가 전체 기수를 한 번에 꺼내는 방법이 아직 없다 — 이게 준비돼야(또는 "개인용으로
충분하다"고 belie 가 정하면) 시트를 꺼도 안전하다(위 §6 참조).

## Log

- 2026-08-10 계획 등재(경영일지 데탑 C작업원B(260809)): belie 지시(R7 배차판 §6, 2차 발행·변경
  없음·프롬프트 유실 복원)로 착수. 기존 Linear BBE-69 코멘트 2건(경영일지 데탑 C작업반장, 데탑
  G작업원C/반장 — 2026-08-09~10)의 조사가 이미 이 산출물을 충분히 만들어 놓은 상태를 확인 →
  중복 재조사 대신 **핵심 주장 실측 재검증**(setup-formulas.ts 476줄·sheet-diagnostics.ts 497줄·
  sheets-client.ts 195줄·course-dates.ts:7,38 의 isSafeToOverwrite 의존·sheet-title-match.ts 위치·
  BBE-68 여전히 Backlog·Export 여전히 개인 전용, 전부 `origin/master=1f77b4a` 기준 재확인)만 수행,
  그 결과를 이 정본 계획 문서로 승격. **코드 변경 0.** belie 체감 변화 1줄 추가(§6 계약이 요구한
  항목 중 기존 코멘트에 없던 유일한 gap).
