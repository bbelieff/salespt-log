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

## phase-2a — O1/O2 날짜 세팅 코드 (Secret 불요분, 오케스트레이터 승인 후 구현)
belie 자율 결정 = 날짜 출처 **생성 요청의 courseStartISO(cohort 단위)**. 구현:
- `lib/service/cohort-dates.ts`: `computeGraduationISO(start, 50)`(ADR-0005 7기+)·`isValidISODate`.
- `lib/repo/sales.ts writeCourseDates(sid, startISO, gradISO)`: O1=start·O2=start+50 **둘 다 리터럴
  USER_ENTERED**(ADR-0005 "O2 직접값이 진실", 레거시 =O1+57 drift 방지, finalize-cohort9 일반화).
  **§2.5 bulk 가드**: O1/O2 FORMULA pre-read → raw(사용자 수기) 보존, 빈/수식만 덮어씀.
- create-cohort-members 라우트: `courseStartISO`(선택, ISO 검증) 접수 → 생성 성공 시 writeCourseDates,
  복제 실패 enqueue 시 pending 잡에 courseStartISO 저장(재시도가 세팅).
- 재시도(cohort-create.ts): completeOnePending 이 courseStartISO 로 O1/O2 세팅.
- UI CohortCreateModal: 수강시작일(date, 선택) 입력 + pending[] 리포트 노출(#547 완성).
- pending 스키마: `course_start_iso` 컬럼(ALTER ADD IF NOT EXISTS, 멱등).
- 미제공 시 무기록(역호환). 단위테스트: computeGraduationISO·isValidISODate·buildPendingCohortJob.

## phase-2b (belie Secret 등록 후 — 라이브 검증)
- `ADMIN_DRIVE_REFRESH_TOKEN` 등록 → create/재시도로 **실제 시트 복제 + O1/O2 세팅 실검증**(연습/연습용2).
  코드는 phase-2a 로 이미 완성 — Secret 만 있으면 end-to-end 동작.

## Acceptance
- [ ] Drive 복제 실패 → 멤버 pending 적재(생성 비차단), 응답 pending[] 노출
- [ ] 재시도 라우트 → 성공 시 done, 실패 시 pending 유지(멱등: 중복 시트·행 없음)
- [ ] buildPendingCohortJob 정규화 단위테스트
- [ ] check.sh 초록
- [ ] (phase-2) Secret 등록 후 라이브 복제 왕복 + O1/O2 USER_ENTERED
