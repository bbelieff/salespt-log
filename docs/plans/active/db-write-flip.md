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
- **R3-1** feat/db-write-daily — sales(컨택 4지표). 첫 코드 PR. p50/p95 전후·미러 정합·롤백 스위치 테스트.
- **R3-2** feat/db-write-meetings — meetings(+todos·carryover). 카드수·N/O 미러 무변경.
- **R3-3** feat/db-write-payments — contracts + company_archive. 이월깃발·수납 1~3단계, TXT 내보내기 DB 기준.
- **R3-4** feat/db-write-production — db 4섹션. 합계행=시트 수식 몫(미러 raw 만).
- **R3-5** feat/db-cohort-create — admin 기수 생성 DB 정본(선행: chore/deploy-env-admin-token). 시트 복제 실패가 생성을 막지 않게 pending 재시도. O1/O2=USER_ENTERED.

## 7. 수용 기준 공통(R3-1~5)
- 저장 API p50/p95 전/후 표(시트 동기 왕복 300~800ms 제거 → 저장 체감 개선 수치화).
- 미러 정합 테스트(저장 n건 후 시트==DB) + 미러 실패 시나리오(DB성공·시트실패 → 응답 성공 + mirror_pending).
- 롤백 스위치 동작 테스트. **비파일럿 기수 완전 불변**. check.sh 초록. §6.8 배포 관찰 + 실사.

## Log
- 2026-07-09 R3-0 등재: 인벤토리(7탭)·전환 패턴·드리프트·롤백 스위치·가드 정책·PR 분할. D3(미러 유지) 답변 확정.
  ⚠️ 발견: R2 플랜들이 `db-first-unlimited-roadmap.md` 를 참조하나 그 파일은 부재(죽은 링크) — R3 SoR 는 본 문서 + db-migration-pilot.md 로 확정. 로드맵 파일 생성은 스코프 밖(belie 판단).
