---
slug: db-read-payments
status: active
created: 2026-07-08
owner: belie
related: db-migration-pilot, db-read-contact, db-read-meetings-banners, db-read-schedule
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: R2 읽기 전환 4호 — 실무/수납 탭 loadContractPayments(02 탭 전체 스캔, 앱에서 가장 무거운 read 급)를 파일럿 기수 한정 DB 단일 쿼리로 전환. 이월 계약 필드 정합이 리스크 중심.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: lib/service/contract-payment.ts, lib/repo/db/read-daily.ts(contracts 섹션), R2-4b(company_archive 분리)
> - **읽고 나면 알 수 있는 것**: contracts payload 3형태가 무엇인가 / 이월 필드는 어떻게 보존되나 / company_archive 는 왜 분리했나
> - **관련 문서**: docs/plans/completed/db-read-meetings-banners.md(payload 이중 형태 원리), docs/plans/active/db-first-unlimited-roadmap.md §R2

# R2-4 — 실무/수납 탭 읽기 DB 전환

## payload 3형태 (contracts 는 미러 사이트가 2곳이라 R2-2 보다 한 형태 더 많음)
1. **backfill** = 열문자 C..AK(문자열화·직렬날짜) — `rowObj(r, 2)`.
2. **updateUserFields 미러** = ContractPayment 전체(필드명).
3. **appendFromContract 미러** = 부분 필드명 + **이명**: `meetingId`(→AK linkedMeetingId),
   `원본행id`(→AJ 이월원본행id), `구분`, `_cleared:false`(재사용 행 되살림).

변환기 contractFromDbPayload: 열문자 → A기준 행 배열 복원 → 필드명(이명 매핑 포함) overlay
→ **시트 파서 rowToCP 그대로 재사용**. 이월 깃발(AI/AJ)·수납 1~3·체크박스 좌표는
cpToRow 와 동일 맵(CP_FIELD_IDX/CP_SLOT_START) — 파서 단일화로 이월 매출 누수 계열 차단.

## 게이트·경계
- chooseDailySource 재사용, 실패 시 readAll fallback + Sentry(where=loadContractPayments-db-read).
- DB 경로는 resolveLayout(스프레드시트 meta read) 도 안 탐 — 파일럿 read 왕복 0.
- 쓰기 경로·TXT 내보내기 전부 불변(시트 정본).
- 정렬: row 번호 오름차순 — readAll(시트 행 순서)과 동일.

## R2-4b 분리 (사유 기록)
loadCompanyInfoByContract(06 company_archive)는 **R2-4b 로 분리**:
① 06 미러 payload(계약ref 키) 검증이 별도 조사 단위, ② 본 PR 은 이월 정합(사고 이력)에
집중 — 스코프 §3 의 분리 허용 조건 발동. R2-4b 는 read-daily.ts 에 함수 1개 추가면 됨.

## 수용 기준 스냅샷
- 정합 5케이스(3형태 + 병합 + phantom 방지), **이월 계약 필드 전부 대조**(픽스처 = 이월+수납 1·2).
- 실무/수납 GET sheets_calls: 전 2(readAll+resolveLayout meta) → **후 0**(파일럿).
- 비파일럿 불변·pg 격리·check 초록.

## Log
- 2026-07-08 구현: read-daily.ts contracts 섹션(+92줄), loadContractPayments 게이트,
  rowToCP export(1단어), 정합 5테스트. company_archive 는 R2-4b 분리.
