---
status: draft
---

# Architecture Map — 세일즈PT 영업일지

## 스택
- **Framework**: Next.js 15 (App Router, Server Components 우선)
- **Language**: TypeScript strict, `noUncheckedIndexedAccess`
- **Styling**: Tailwind + shadcn/ui 패턴 (필요 시 `components/ui/` 에 직접 복사)
- **Auth**: NextAuth v5 (Google Provider)
- **Data**: Google Sheets (googleapis) — 유일 SSOT
- **Charts**: Recharts
- **Tests**: Vitest (구조 테스트·단위·통합)
- **Deploy**: 자체 VPS (Caddy 리버스 프록시 + Docker Compose, `next build --standalone`)

## 레이어 (단방향 의존)

```
types → config → repo → service → app(api·ui) → components
```

**강제 수단**: `tests/structural/layers.test.ts`
1. 하위는 상위를 import 할 수 없다.
2. `googleapis` / `google-auth-library` 는 `lib/repo/` 전용.
3. `SHEET_RANGES.dashboard` 를 쓰기 API 근처에서 사용하면 실패.

## 퍼시스턴스: Google Sheets

### 핵심 원칙
- **SSOT**: 별도 DB 없음. 모든 상태는 Sheets 에 있다.
- **수강생마다 개별 시트**. 앱은 `spreadsheetId` 를 사용자별로 바꿔 호출한다.
- **마스터 레지스트리 시트** 한 개가 `email → { cohort, name, spreadsheetId, role }` 매핑을 소유. 관리자(트레이너)만 추가/수정.
- **배치 I/O**. 셀 단위 `updateCell` 금지. `values.append` / `values.update` / `batchUpdate` 만 사용.
- **읽기는 범위 단위**. N건마다 호출하는 N+1 패턴 금지.
- **대시보드 탭(탭1)은 읽기 전용.** 시트의 수식이 집계를 담당한다. 앱은 수치만 읽어가서 Recharts 로 **다시 그린다** (임베드 X).

### 탭 구조 (확정 필요)
- `성과관리` (탭1) — 대시보드. 읽기 전용.
- `계약관리` (탭2) — 상단: 기관 집계(읽기). 하단: 계약 상세 로그(append 가능).
- `DB관리` (탭3) — 매입DB / 직접생산 / 현수막 3개 섹션(각각 append 가능).
- `앱_일일입력` (신규) — 앱이 쓰는 전용 탭. 컬럼: date | production | contact | meeting | contract | note. 시트 대시보드는 이 탭을 참조해 4대 지표 수식을 갱신.

실제 A1 범위는 `lib/config/index.ts` 의 `SHEET_RANGES` 에 있다. 시트 구조가 바뀌면 **여기만** 고치고 `npm run test:structural` 을 돌린다.

## 사용자·인증

- **NextAuth v5 + Google Provider**. 수강생은 본인 Google 계정으로 로그인.
- 첫 로그인 시 **온보딩 화면**에서 기수와 이름을 선택 → 마스터 레지스트리에서 검색해 `spreadsheetId` 를 귀속.
- 이후엔 세션 쿠키로 **자동 접속**. 기기 메모리(쿠키) 만료 시까지 재로그인 불필요.
- 트레이너(admin)는 레지스트리에 신규 수강생을 추가하는 전용 화면 사용.

## 게이미피케이션 (MVP)

- **4대 지표**: 생산 · 컨택 · 미팅 · 계약 (`MetricKey`)
- **XP 가중치**: `lib/service/gamification.ts` — 초기값 (1 / 3 / 15 / 100). 변경은 ADR 필요.
- **레벨**: `√(xp/100)` 기반 간단 커브.
- **Streak**: 연속 기록일. 끊기면 리셋. 개인 베스트 별도.
- **Phase 2**: 기수 내 랭킹, 주간 목표 링, 배지.

## UI 분기

- **모바일** (`< 768px`): 입력 중심. 하단 네비 + 빠른 입력 폼 + 카운터·스트릭.
- **PC** (`≥ 768px`): 트레이닝·코칭 모드. 대시보드 + 차트 + 수강생 현황 그리드.
- 같은 데이터·API. 레이아웃만 분기 (반응형, 서버 사이드 조건부 금지).
