---
slug: api-timing-baseline
status: active
created: 2026-07-07
owner: belie
related: db-migration-pilot
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 모든 /api 라우트의 서버 처리시간(전체 + Sheets 구간 분리)을 계측해 DB 파일럿 이전 효과를 숫자로 증명할 기준선(P0)을 만드는 계획.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: db-migration-pilot §1 P0, lib/analytics/api-timing.ts, lib/repo/sheets-client.ts, app/api/** 전체
> - **읽고 나면 알 수 있는 것**: 무엇을 어디서 재나, 로그·이벤트 형식, p50/p95 뽑는 법
> - **관련 문서**: docs/plans/active/db-migration-pilot.md

# API 서버 처리시간 계측 (P0 기준선)

## 방식
- `withApiTiming(route, handler)` 래퍼(lib/analytics/api-timing.ts, 서버 전용):
  전체 ms + AsyncLocalStorage 로 Sheets 구간(sheets_ms/sheets_calls) 분리.
  콘솔 JSON 1줄 + PostHog `api_timing` 이벤트(HTTP capture, 의존성 0, 샘플링 100%).
- Sheets 계측점 = sheets-client 의 기존 429-retry shadow(patchMethods) 확장 — 단일 지점.
- 적용: app/api/** 58 라우트. 제외: [...nextauth](특수 export) ·
  /api/health(동기·Sheets 무접촉·배포 게이트 — 노이즈 방지 의도적 제외).
- 민감값 금지: route 는 경로 상수 문자열만(파라미터·이메일·시트ID 불포함).
- 오버헤드: Date.now 2회 + fetch fire-and-forget — 무시 수준. 로컬(NODE_ENV≠production)은
  콘솔 로그만(PostHog 전송 안 함).

## p50/p95 추출
PostHog → Trends → 이벤트 `api_timing`, 속성 `ms` 의 median/p95 집계 + `route` breakdown.

## Log
- 2026-07-07 구현 (58 라우트 래핑 + sheets-client 계측).
