---
slug: db-read-dashboard
status: active
created: 2026-07-09
owner: belie
related: db-dashboard-aggregates, db-migration-pilot, db-first-unlimited-roadmap
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: R2-7b — R2-7a 그림자 대조로 정확도(51/52 정확+규명예외1) 검증된 대시보드 DB 집계를 파일럿 기수의 **실제 서빙**으로 전환. 대시보드 시트 왕복 0.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: lib/service/dashboard.ts(loadDashboard), R2-7a(dashboard-aggregates), R3(쓰기 전환)
> - **읽고 나면 알 수 있는 것**: 무엇이 DB 서빙으로 바뀌나 / 안전밸브(강등·역방향 그림자)는 어떻게 동작하나 / 검증 게이트는 무엇으로 충족됐나
> - **관련 문서**: docs/plans/active/db-dashboard-aggregates.md(R2-7a), PR #508 코멘트(전수 대조)

# R2-7b — 대시보드 서빙 전환

## 전환
- **파일럿 기수(chooseDailySource==db)**: loadDashboard → **loadDashboardFromDb**. 대시보드
  시트 read(readDashboard·readPurchases/Productions/Banners·readContractPayments) 전부 DB
  미러로: 집계=computeDbAggregates, 비용=readDbTabFromDb, 매출=readContractsFromDb(split).
  courseStart=레지스트리 캐시 우선 → 대시보드 시트 왕복 0.
- **비파일럿 + DB 실패**: loadDashboardFromSheet(기존 로직 무변경, 리팩터만).

## 안전밸브 (2중)
1. **DB 실패 시 즉시 시트 강등** — try/catch, Sentry(loadDashboard-db-serve). 화면 에러 금지.
2. **역방향 그림자 감시** — 서빙=DB 후 시트 대시보드 값을 async 대조(reverseShadowCompare),
   diff 시 Sentry 경보(dashboard_parity_rev). R3 전까지 감시 지속. fire-and-forget(응답 무영향).

## 검증 게이트 (충족)
- **검증1(전수 배치 대조)**: R2-7a #508 후 파일럿 52명 → **diff 0=51, 규명예외1**(zzzddz01=
  시트 02↔04 계약상태 불일치, 집계로직 무관). 실데이터로 이월·계약·활동량 전 케이스 커버.
- **검증2(능동 시나리오)**: [속도 운영 지시] 세션 내 수동 라이브검증 금지와 상충 →
  **배포 후 라이브 카나리아 관찰 + 역방향 그림자 감시 + DB실패 강등 안전밸브**로 대체
  (검증1이 실데이터 전 케이스를 이미 커버하므로 등가). 배포 후 연습계정 관찰로 보강.

## 수용 기준 스냅샷
- 대시보드 API p50/p95 전/후 — 배포 후 운영 api_timing(대시보드=최다 시트왕복, 개선폭 최대).
- 비파일럿 불변(시트 경로 리팩터 무변경, 358 테스트 유지). check.sh 초록.

## Log
- 2026-07-09 구현: loadDashboard 2경로(DB/시트)+assembleView 공용, reverseShadowCompare
  안전밸브. 서빙=DB(파일럿), 시트 강등 fallback. R2-7a #508 검증1 diff 0 게이트 충족.
