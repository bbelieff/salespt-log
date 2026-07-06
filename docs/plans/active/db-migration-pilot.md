---
slug: db-migration-pilot
status: active
created: 2026-07-06
owner: belie
related: architecture, sheet-structure, handoff-2026-07-06-cowork
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 느림의 구조적 원인(Sheets=DB)을 제거하기 위한 Postgres 파일럿 — 8기(진행 중)·9기(7/10 시작)에 이중 기록(P1)을 가동하고, 검증 후 10기부터 정본 전환(P3)을 노린다.
> - **누가 읽나요**: 개발자, 에이전트(Opus 세션 포함), 운영자(belie)
> - **어떤 기능·작업과 연결?**: lib/repo 전체(쓰기 경로), Supabase Postgres(관리형), 배포 파이프라인, 이후 P2(읽기 전환)·P3(정본 전환)
> - **읽고 나면 알 수 있는 것**: 왜 DB인가, 파일럿 범위/일정, 스키마 초안, 무엇이 위험하고 무엇이 무위험인가
> - **관련 문서**: docs/architecture.md, docs/handoffs/2026-07-06-cowork-session-to-opus.md

# DB 마이그레이션 파일럿 (8기·9기 이중 기록)

## 0. 배경·결정 (2026-07-06 사용자)
- 병목 진단: Sheets API 왕복(300~800ms/회)+쿼터+수식 재계산이 구조적 원인(증거: quota-retry·
  stats 10분 캐시·registry 60초 캐시·chunk 계열 PR 역사). 프론트 최적화는 소진 단계.
- 기각: ① 시트 구조만 DB화(왕복·쿼터 그대로, 효과 미미) ② 기수 통합 시트(동시 쓰기 충돌·
  수식 범위 확대·장애 반경 — 속도에 악수).
- 채택: **Postgres 를 SSOT 로 단계 전환. 시트는 폐기가 아니라 "운영자용 미러/export"로 강등.**
- 호스팅: **Supabase(관리형) 채택** ← ~~VPS Docker Postgres~~ (2026-07-06 사용자 정정).
  확정값(비밀 아님): 프로젝트 `aoevgfroxdvgbmgvzlfb` · 리전 ap-northeast-2(Seoul) ·
  Postgres 17 · 접속 = **Session Pooler URI**(`sslmode=require`). 접속 경로는
  `DATABASE_URL` 하나(GitHub Secrets 등록 완료, 배포가 VPS .env 주입 — #481 적용됨).
  무료 티어 함정 2건은 **대응 병기**:
  ① 7일 무요청 일시정지 → **주 1회 keep-alive 쿼리**(서버 크론) 추가.
  ② 자동 백업 없음 → `scripts/ops/` 에 pg_dump 백업 스크립트 주기 실행 준비.
  VPS Docker compose·pg_dump cron 산출물은 `scripts/ops/` 에 **"옵션 B(셀프호스트)"**
  로 보존하되 기본 아님. 스키마 마이그레이션 스크립트는 `DATABASE_URL` 대상 실행형으로
  작성(URL·비밀번호 코드/로그 노출 금지).
- 근거 인프라: googleapis 가 lib/repo/ 에 격리(구조 테스트 강제) → 교체 = repo 재구현이지
  앱 재작성 아님.

## 1. 파일럿 범위 (P0+P1) — 8기·9기, 무중단
- **P0 계측(기준선)**: API 라우트별 서버 처리시간 p50/p95 수집(콘솔+PostHog). 이전 효과를
  숫자로 증명할 기준선. 파일럿 전 1일 이상 수집.
- **P1 이중 기록**: 앱의 모든 시트 쓰기 경로가 성공 시 DB 에도 upsert(fire-and-forget —
  DB 실패가 앱 동작에 영향 0). 읽기는 100% 시트 유지. 8기 기존 데이터는 backfill 스크립트로
  1회 적재. 9기는 7/10 첫날부터 자연 축적.
- P2(읽기 전환: 탭별, 대시보드=SQL 집계+수식 대조 테스트)·P3(정본 전환, 기수 생성=insert)는
  파일럿 정합 검증 후 별도 계획 — 본 문서 범위 밖(10기 목표).

## 2. 스키마 초안 (파일럿 = jsonb 미러, 정규화는 P2 에서)
```sql
create table sheet_rows (
  id bigserial primary key,
  cohort text not null,              -- '8' | 'A1-6' 등 (라벨)
  email text,                        -- 시트 소유 수강생(멀티계정은 대표 이메일)
  spreadsheet_id text not null,
  tab text not null,                 -- meetings|contracts|todos|sales|db|company_archive
  row_key text not null,             -- 앱 행 id(미팅 id 등). 없으면 tab:rowIndex
  payload jsonb not null,            -- 행 전체 키-값(컬럼명 기준)
  updated_at timestamptz not null default now(),
  unique (spreadsheet_id, tab, row_key)
);
create index sheet_rows_cohort_tab on sheet_rows (cohort, tab);
create index sheet_rows_payload on sheet_rows using gin (payload);
```
- 파일럿 목적 = 파이프라인 검증 + 데이터 축적. 이 단계에서 정규화 테이블 설계에 시간 쓰지 않음
  (YAGNI — P2 에서 실사용 쿼리 기준으로 정규화).
- 연결: `DATABASE_URL` env (config 등재) — Supabase Session Pooler URI(`sslmode=require`),
  **pg Pool** 사용. pg 클라이언트는 **lib/repo/db/ 전용**(googleapis 격리와 동일한
  구조 테스트 가드 신설).

## 3. 안전 원칙
- dual-write 는 **비차단·후행**: 시트 쓰기 성공 후 시도, 실패는 경고 로그+PostHog 카운트만.
- §2.5 보존 가드는 시트 쪽 이야기 — DB upsert 는 row_key 기준 멱등이라 별도 가드 불필요.
- 정합 검증: admin 진단(기수·탭별 시트 행수 vs DB 행수 + 샘플 diff) + 주 1회 대조 스크립트.
- secret: DB 비밀번호·DATABASE_URL 은 VPS .env 에만(사용자가 직접 입력). 채팅·코드·로그 금지.

## 4. 일정 (2026-07-06 기준)
| 날짜 | 내용 | 주체 |
|---|---|---|
| 7/6(월) | 본 기획서+프롬프트 3종 | Cowork ✅ |
| 7/7(화) | P0 계측 PR + P1a 인프라 PR(스키마·클라이언트·compose) 구현 | Claude Code |
| 7/7~8 | ~~VPS Postgres 기동~~ → ✅ Supabase 생성 + Secrets 등록 + 배포 주입(#481) 완료 | **belie** ✅ |
| 7/8(수) | P1b 이중기록 PR + 8기 backfill 실행, Opus 세션 인수 | Claude Code |
| 7/9(목) | 라이브 정합 확인(8기 실사용 하루) + 9기 시트 생성(기존 배치) | 공동 |
| 7/10(금) | 9기 시작 — 첫날부터 dual-write 축적 | — |

## 5. 성공 기준 (파일럿 종료 판정)
- 8·9기 2주 운영 후: 시트 vs DB 행수 불일치 0(또는 원인 규명된 예외만), dual-write 실패율 <1%,
  앱 쓰기 체감 저하 0(비차단 확인).
- P0 기준선 리포트 존재(라우트별 p50/p95) → P2 전환 시 개선폭을 이 숫자로 검증.

## Log
- 2026-07-06 파일럿 확정: 대상 8기+9기, VPS Docker Postgres, jsonb 미러 dual-write, 읽기 무변경.
- 2026-07-07 P1a 인프라 구현: lib/repo/db/(pg Pool·스키마 자동생성·upsert/count) +
  pg 격리 구조테스트 + keep-alive 크론(.github/workflows/db-keepalive.yml, 주1회) +
  scripts/ops/(백업·옵션B) + admin 랜딩 DB 상태 스트립. P0 계측은 #484 로 가동 중.
- 2026-07-06 호스팅 정정: **VPS Docker → Supabase 관리형**(Seoul, PG17, Session Pooler).
  대응 병기: 주1회 keep-alive 크론 + scripts/ops/ pg_dump 백업. VPS compose 는 옵션 B 강등.
  DATABASE_URL Secrets 등록 + 배포 주입(#481)까지 완료 — belie 인프라 단계 종료.
