---
slug: db-pilot-arena
status: active
created: 2026-07-08
owner: belie
related: db-read-contact, db-migration-pilot, rejoin-routing
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: R2-1.5 — 아레나(A1-0~A1-6, 최대 활성 집단)를 DB 읽기 파일럿에 편입: 게이트에 아레나 라벨 허용 + 아레나 전 시트 backfill.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: lib/service/daily-source.ts(단일 게이트), scripts/ops/backfill-sheet-rows.mjs(콤마 목록), DB Backfill 워크플로
> - **읽고 나면 알 수 있는 것**: 무엇이 바뀌나(게이트 1곳), 이중기록은 왜 무변경인가, backfill 을 어떻게 돌리나
> - **관련 문서**: docs/plans/active/db-read-contact.md(R2-1), db-migration-pilot.md

# R2-1.5 — 아레나 파일럿 편입

## 확인 결과 (스코프 1 — 이중기록 게이트)
- `lib/repo/db/mirror.ts` 의 dual-write 는 **기수 무제한** — `dbEnabled()`(DATABASE_URL)만
  게이트, cohort 는 라벨로 적재만 함. **아레나는 이미 미러되는 중 → 변경 없음.**

## 변경 (게이트 1곳 + 운영 도구)
- `isDbReadPilot`: 기존 {8,9,연습} + **아레나 라벨**(`isArenaCohortLabel` 재사용, A{시즌}-{기수}).
  라벨 통합(A1-N→N)·동일인 병합은 R5 — 여기서 불변, DB 에도 현재 라벨 그대로.
- backfill 스크립트: `--cohort` 콤마 목록 허용(아레나 7라벨 1회 실행) + 대조표 cohort별 출력.
  단일 라벨 동작 불변.
- 안전벨트(DB 실패 → Sentry + 시트 fallback)는 R2-1 상속 — 코드 추가 없음(확인만).

## 실행 순서 (머지 후)
1. 배포 conclusion=success + health 확인.
2. DB Backfill 워크플로: cohort=`A1-0,A1-1,A1-2,A1-3,A1-4,A1-5,A1-6` dry-run → 결과 검토
   → execute → 시트/DB 대조표를 PR 코멘트 + 본 문서 Log 에 기록.
3. api_timing 으로 아레나 유입 후 p50/p95 전후 비교(PR 코멘트).

## Log
- 2026-07-08 구현 착수.
