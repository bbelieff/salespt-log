---
status: verified
verified: 2026-10-15
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 경영일지(세일즈PT 영업일지)가 **지금** 어떻게 생겼는지 — 스택·레이어·데이터 흐름·배포·안전장치를 2쪽에 담은 지도.
> - **누가 읽나요**: 새로 합류한 개발자, 외부 기술 검토자, 에이전트
> - **어떤 기능·작업과 연결?**: 레포 전체 (`lib/`, `app/`, `components/`, `.github/workflows/`)
> - **읽고 나면 알 수 있는 것**: 데이터의 정본은 어디인가 / 코드는 어느 방향으로만 의존하나 / 배포·롤백은 어떻게 도나 / 아직 남은 숙제는 무엇인가
> - **관련 문서**: `CLAUDE.md`(작업 규약), `docs/quality.md`, `docs/decisions/`(ADR), `docs/playbooks/deploy-vps.md`, `docs/plans/active/yc-hardening-safe-fixes.md`(남은 정비)

# Architecture Map — 세일즈PT 영업일지 (2026-10-15 현행화)

> 2026-10-15 이전 판은 "Google Sheets 가 유일 SSOT · Docker 배포" 로 적혀 있었다(2026-08 이전 설계). 지금은 아래와 같다.

## 스택

| 영역 | 사용 |
|---|---|
| 웹 | Next.js 15 (App Router) · React · TypeScript strict(`noUncheckedIndexedAccess`) · Tailwind |
| 인증 | NextAuth v5 (Google) — JWT 세션 |
| 데이터 정본 | **Postgres** (Supabase, `pg`) — 2026-08-24 이후 활성 기수 전부 |
| 미러·백업 | Google Sheets (`googleapis`) — 비동기 수렴 미러 + 수강생/코치용 보기 |
| 화면 데이터 | `@tanstack/react-query` 훅(`lib/query`) + 일부 직접 fetch |
| 검증 | Zod(`lib/types`) — API 입력·DB/시트 경계 |
| 관측 | Sentry(서버·클라이언트, PII 미전송) · PostHog(제품 분석) · `withApiTiming` API 계측 |
| 테스트 | Vitest 약 3,600개 · 구조 테스트 16개 · 실제 Postgres/PGlite 동시성 테스트 |
| 배포 | 단일 VPS · pm2(`ecosystem.config.cjs`, `next start`) · Caddy · GitHub Actions |

## 레이어 (단방향 의존)

```
types → config → repo → service → app(api·ui) → components
                  ↑ util(순수, import 0) · format · document-ocr(순수 헬퍼) 는 어디서나
```

- `lib/types` Zod 모델 · `lib/config` env·시트 좌표·기간 상수 · `lib/repo` DB(`repo/db/*`)·Sheets I/O 전용 ·
  `lib/service` 유스케이스 · `app/api` 라우트(`withApiTiming(…)` 래퍼) · `app/(app)` 화면 · `components` UI.
- **기계로 강제** (`tests/structural/`):
  - `layers.test.ts` — lib 4레이어 방향, `googleapis` 는 `lib/repo` 안에서만.
  - `ui-repo-boundary.test.ts` — app·components 의 repo 직접 import 금지(2026-10-15 기존 34곳 박제, 줄어드는 방향만).
  - `sheets-request-path-guard.test.ts` — 사용자 요청 경로에서 시트 API 동기 호출 금지(화이트리스트).
  - `period-hardcode.test.ts` — 기간 상수(50/57·69·10·8)·주차 계산 재구현 금지.
  - 그 밖에 저장 경로 관측, 시트 append 가드, 빌드 메모리 가드 등.

## 데이터 흐름

```
화면 ──(fetch / react-query)──▶ app/api/* ──▶ service ──▶ repo/db (Postgres, 정본 · 동기)
                                                     └──▶ 시트 미러 큐(비동기·재시도) ──▶ Google Sheets
```

- **정본 선택 한 곳**: `lib/service/daily-source.ts` 의 `chooseDailySource`/`chooseWriteSource`
  (`DB_READ_COHORTS`). 기수 하나를 Set 에서 빼면 그 기수만 시트 정본으로 되돌아가는 안전선으로 남겨 둠.
- **수강생마다 개별 시트**, `email → spreadsheetId` 는 마스터 레지스트리. DB 행도 `spreadsheet_id` 로 사용자 경계를 긋는다.
- **사용자 입력 보존 가드**: 시트 일괄 쓰기는 대상 셀을 `FORMULA` 로 먼저 읽어 값이 있으면 건너뛴다(CLAUDE.md §2-5).
- **문서 자동입력**: 서류 OCR(tesseract.js·pdfjs)은 **브라우저 안에서만** — 서버 업로드·외부 API 없음(`lib/document-ocr`).

## 퍼시스턴스: Google Sheets

이제 **정본이 아니라 미러·백업**이다. 요청 경로에서 동기 호출하지 않는다(구조 테스트가 막음).
시트 좌표는 `lib/config/index.ts` 의 `SHEET_RANGES` 한 곳. 대시보드 탭(수식)은 읽기 전용 — 앱이 쓰지 않는다.
영업관리 I~P 는 시트 수식 칸이라 웹이 쓰면 린터가 막는다. 상세 = `docs/domains/sheet-structure.md`.

## 인증·권한

- Google 로그인 → 레지스트리에서 기수·이름으로 시트 연결. 역할: 수강생 / 트레이너 / 관리자.
- 관리자 대리접속은 쿠키를 "의도" 로만 쓰고 요청마다 서버에서 권한을 다시 판정(`lib/auth/identity.ts`).
- 업체 계정 보관함: AES-256-GCM + PIN(scrypt) — `lib/repo/vault-crypto.ts`.

## 배포·롤백 (`.github/workflows/deploy.yml`, CLAUDE.md §6.8)

1. PR → CI(`typecheck.yml` → `scripts/check.sh`: 타입·린트·구조·단위·파일 500줄·SSOT 드리프트).
2. master 머지(squash) → VPS 에서 `git reset --hard` → `npm ci` → **별도 폴더 빌드 후 원자 교체**(BUILD_ID 검증) → `pm2 reload`.
3. `/api/health` 게이트(필수 env + `DATABASE_URL`) 실패 시 **자동 롤백**. 원격 스크립트는 연결이 끊겨도 끝까지 돈다.
4. 사람의 롤백 = `git revert <squash>` 후 push(force-push 금지).

## 게이미피케이션

4대 지표(생산·컨택·미팅·계약) XP 가중치는 `lib/service/gamification.ts` 한 파일(변경은 ADR). 연속기록(streak)은 KST 기준.

## 알려진 숙제 (2026-10-15 외부 실사 관점 리뷰)

- 시트→DB 전환의 뒷정리: 서비스마다 남은 DB/시트 분기, 시트 모양 그대로인 `sheet_rows`(jsonb) 표, 런타임 DDL 과 마이그레이션 파일 이원화.
- 미팅 동시 저장 잠금, 미팅 연쇄 삭제 트랜잭션, 시트 미러 대기열의 재시작 내구성, DB 백업 자동화·외부 보관.
- 단일 VPS(다른 서비스와 공유). 상세·우선순위 = `docs/plans/active/yc-hardening-safe-fixes.md` §2.
