---
slug: db-cohort-create-pending
status: active
created: 2026-07-13
owner: belie
related: db-write-flip (§6 R3-5), deploy-env-admin-token (#524)
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: R3-5 phase-1 — admin 기수 생성 시 Drive 복제 실패가 생성을 막지 않게 DB pending 큐(정본)에 적재 + 재시도 라우트.
> - **누가 읽나요**: 개발자, 운영자(belie)
> - **어떤 기능·작업과 연결?**: create-cohort-members·retry-cohort-creates 라우트, lib/repo/db/cohort-pending, lib/service/cohort-create
> - **읽고 나면 알 수 있는 것**: 왜 pending 큐인가 / DB 정본 범위 / phase-1↔2 경계 / O1/O2 는 왜 이월인가
> - **관련 문서**: [[db-write-flip]] §6 R3-5

# db-cohort-create-pending (R3-5 phase-1)

## 배경·결정
- 증상: admin 기수 생성 시 Drive 시트 복제 실패(ADMIN_DRIVE_REFRESH_TOKEN 미설정·429·권한)면 그 멤버가 통째로 누락(생성이 Drive 에 막힘). 9기 전원 실패 전례(#524 맥락).
- **belie 결정(2026-07-13)**: "DB 정본"을 **DB 백드 pending 큐**로 구현. 현재 DB 는 sheet_rows(7탭 미러)뿐이라 기수생성은 그 모델 밖 → 전용 테이블 신설로 pending 상태를 DB 정본화.

## phase-1 (이 PR, Secret 불요)
1. **DB 테이블 `cohort_pending_creates`** (lib/repo/db/cohort-pending.ts) — 자연키 (cohort_label, name) upsert=멱등. 컬럼: mode·sheet_id·folder_id·template_id·sheet_title·roster_sheet_id·status·attempts·last_error. pg 격리 구역.
2. **생성 비차단**: create-cohort-members 라우트가 `copyWithRetry` 실패 시 `failed[]` 대신 **enqueue + `pending[]`** 반환(DB 미설정이면 기존 failed 폴백).
3. **재시도**: `POST /api/admin/retry-cohort-creates`(admin) → `processPendingCohortCreates` = 기존 시트 재사용 or 복제 → addTraineePrepRow(#546 멱등) → (아레나) roster → done. 부분 실패는 pending 유지.
4. **순수 헬퍼 테스트**: `buildPendingCohortJob`(정규화 4케이스). SQL 은 라이브+정합으로.
5. **관찰성**: `countPendingCohortCreates` (admin 배너용 잔량).

## phase-2 (belie Secret 등록 후)
- `ADMIN_DRIVE_REFRESH_TOKEN` 등록 → 재시도 라우트 1회 → 실제 시트 복제 완주 실검증(연습/연습용2 등).
- **O1/O2=USER_ENTERED 는 이 단계로 이월** — 근거: 현재 CohortConfig 에 날짜 필드가 없고(출처 미정) O1/O2 값 쓰기 지점도 없음. 복제된 시트에 수강시작(O1)/종강(O2)을 USER_ENTERED 로 쓰려면 **날짜 출처 결정(config 날짜 필드 vs admin 입력)** 이 선행. 대상 시트가 Drive 복제(Secret) 산물이라 phase-2 귀속이 자연스러움. belie 날짜 출처 확정 후 착수.

## Acceptance
- [ ] Drive 복제 실패 → 멤버 pending 적재(생성 비차단), 응답 pending[] 노출
- [ ] 재시도 라우트 → 성공 시 done, 실패 시 pending 유지(멱등: 중복 시트·행 없음)
- [ ] buildPendingCohortJob 정규화 단위테스트
- [ ] check.sh 초록
- [ ] (phase-2) Secret 등록 후 라이브 복제 왕복 + O1/O2 USER_ENTERED
