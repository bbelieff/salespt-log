---
slug: db-read-contact
status: completed
created: 2026-07-08
owner: belie
related: db-first-unlimited-roadmap, db-migration-pilot, api-timing-baseline
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: R2 읽기 전환 시리즈 1호 — 컨택 탭(loadDay)의 readWeek+readChannelStacking 을 파일럿 기수(8·9·연습)에 한해 DB 단일 쿼리로 교체(실패 시 시트 fallback).
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: GET /api/daily/:date, lib/service/contact.ts·daily-source.ts, lib/repo/db/client.ts(readSalesRowsFromDb)
> - **읽고 나면 알 수 있는 것**: 무엇이 DB 로 갔고 무엇이 시트에 남았나, 게이트는 어디 하나뿐인가, 정합은 어떻게 고정되나
> - **관련 문서**: docs/plans/active/db-first-unlimited-roadmap.md §R2, db-migration-pilot.md

# R2-1 — 컨택 탭 읽기 DB 전환

## 스코프
- DB 로 감: loadDay 의 4지표 주간 rows(readWeek) + 누적 3값(readChannelStacking) →
  `readSalesRowsFromDb` 단일 쿼리(사용자당 ≤280행). courseStart 는 레지스트리 K 캐시 우선.
- 시트에 남음(다음 PR): meetings(findByDate)·banners(readBanners). ADR-0010 카드수 파생 보존.
- 게이트: `chooseDailySource`(daily-source.ts) **단 한 곳** — cohort ∈ {8,9,연습} && DATABASE_URL.
- 안전벨트: DB 예외 → Sentry 캡처 + 기존 시트 경로 silent fallback(화면 에러 0).

## 정합 고정
- 시트/DB 양 경로가 같은 순수 집계(dayChannelsFromRows·stackingSumsFromRows)를 통과 —
  tests/service/daily-source.test.ts 가 4채널×4지표 동등 + 비파일럿 시트 고정 을 테스트로 박제.

## Log
- 2026-07-08 구현(R2-1). p50/p95 전후는 PR 본문 표.
