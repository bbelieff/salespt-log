> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 다른 세션(claude.ai 프로젝트 등)에 헤더 SSOT를 한 번에 넘기는 핸드오프 패키지
> - **누가 읽나요**: prototype HTML 작성자, 외부 세션
> - **어떤 기능·작업과 연결?**: TopHeader / PageBanner / DDayBadge / 대시보드 버튼
> - **읽고 나면 알 수 있는 것**:
>   - 헤더 4 그룹의 데이터 출처 + JSX/Tailwind 규격
>   - D-day 기준일과 라벨 규칙
>   - 로고 자산 경로 + 인증 흐름
> - **관련 문서**: [components.md §8](../design/components.md#8-app-shell), [tokens.md §Z-Index & Sticky 적층](../design/tokens.md#z-index--sticky-적층), [data-model.md §사용자 프로필 + D-day](../domains/data-model.md#사용자-프로필--d-day-topheader-ssot)

# 헤더 SSOT 핸드오프 (Prototype용 압축)

위 세 문서가 정본. 이 문서는 그 핵심을 한 페이지에 묶은 **요약**일 뿐, 충돌 시 상위 SSOT가 우선.

## 1. 구조 한눈에

```
┌─────────────────────────────────────────────────────────┐ TopHeader 슬림 바  (h-12, top-0,  z-50, bg-white)
│ [logo.png]  [{기수} {이름} 대표님 · 경영일지]  [D-23]  [대시보드 →] │
├─────────────────────────────────────────────────────────┤ PageBanner       (h-12, top-12, z-40, bg-slate-100)
│ ▍ 📞 컨택관리                              01 영업관리 │
└─────────────────────────────────────────────────────────┘
   본문 ─────────────────────────────────────────────────
                                                            ↓ (BottomNav 모바일은 fixed bottom-0 z-50)
```

- **단일 컴포넌트**: `components/TopHeader.tsx` 가 슬림 바 + PageBanner 두 sticky 영역을 모두 포함.
  별개의 `<PageBanner />` 컴포넌트 없음. 자식 각각 sticky 금지(부모 묶음 패턴).
- **대시보드(`/`)** 자체는 TopHeader 미사용 — 자체 헤더로 별도 디자인.
- 5개 (app) 탭(contact/schedule/calendar/payment/db) **공통** 셸.

## 2. 데이터 출처 (구체)

### 2-1. 사용자 표시 ("7기 김믿음 대표님")

```
[현재 dev]   STUB_USER_EMAIL env  →  email
[MVP]        NextAuth Google      →  session.user.email   (email 만 사용)
                                       ↓
                       마스터 레지스트리 시트 users 탭
                       (env: SHEETS_REGISTRY_ID, SHEETS_REGISTRY_TAB=users)
                       컬럼: A=email, B=cohort, C=name, D=spreadsheetId, E=role
                                       ↓
                       개인 시트 01 영업관리!B3 (cohort), C3 (name)  ← 표시 SSOT
```

**중요**: NextAuth session에서는 `email` 만 가져옴. cohort/name을 Google 계정 정보에서 절대 안 가져옴. 항상 시트 B3/C3 우선.

표시 형식 (`formatDisplay(cohort, name)`):
- 정상: `"7기 김믿음 대표님"`
- name만: `"김믿음 대표님"`
- cohort만: `"7기"`
- 둘 다 없음: `"—"`

`formatCohort` — B3가 `"7"` 만 있으면 `"7기"`로 보정, 이미 `"7기"`면 그대로.

### 2-2. D-day (DDayBadge)

| 후보 | offset | MVP 채택? |
|---|---|---|
| 수강시작일 N1 | +0d | — |
| **7주차 D-day** | **+49d** | ✅ **채택** (발표·평가 기준) |
| 수료일 N2 | +55d | ❌ |
| 편집 종료 | +69d | ❌ |

```
weekTargetISO = courseStartISO + 49d
remain = weekTargetISO - today  (브라우저 자정 기준 정수 일수)
```

| remain | 표시 | 색 |
|---|---|---|
| > 0 | `D-N` (두자리 박스 분할) | 검정 박스 / 흰 글자 |
| 0 | `D-DAY` | brand red #d71617 |
| < 0 | `D+\|N\|` | 회색조 |
| 데이터 없음 | `D-—` | gray placeholder |

**라벨 prefix 안 붙임**: `"수료 D-N"` / `"종강 D-N"` 사용 안 함 (의미는 7주차인데 "수료"는 오해 발생).

### 2-3. 캐싱

`useMe()` (lib/query/me-hook.ts) 한 곳에서 `['me']` queryKey로 fetch.
staleTime **1시간** (B3/C3/N1 거의 안 바뀜). TopHeader는 컴포넌트별 fetch 안 함.

## 3. 로고 자산

- 경로: **`/salespt-logo.png`** (즉 `public/salespt-logo.png`)
- 형식: **PNG** (SVG 인라인 아님)
- 워드마크 포함된 이미지라 별도 "세일즈PT" 텍스트 워드마크 추가 안 함
- 사이즈: `h-6 w-auto object-contain` (xs), `sm:h-7` (sm+)

## 4. 색·z-index 토큰

- **Brand Red `#d71617`** — `[#d71617]` arbitrary로 고정 (Tailwind 팔레트에 동등 hue 없음)
  - 사용처: 로고($ 심볼), `D-DAY` 강조, 대시보드 버튼 글자/테두리, hover `bg-red-50`
- **Z-stack**:
  - 슬림 바: `top-0 z-50`
  - PageBanner: `top-12 z-40`
  - 모달/Toast: `z-50` 이상
  - BottomNav (모바일): `fixed bottom-0 z-50`

## 5. JSX 핵심 마크업 (Tailwind 정확)

### 5-1. 슬림 바 (TopHeader 그룹 ①~④)

```tsx
<header className="sticky top-0 z-50 flex h-12 items-center justify-between gap-2 border-b border-gray-100 bg-white px-2 sm:px-3">
  {/* ① 로고 */}
  <img src="/salespt-logo.png" alt="세일즈PT"
       className="h-6 w-auto shrink-0 object-contain sm:h-7" />

  {/* ② 사용자 + 경영일지 — 한 그룹 (gap-1.5) */}
  <div className="flex min-w-0 items-center gap-1.5">
    <span className="min-w-0 truncate text-[11px] font-black text-gray-900 sm:text-sm">
      {display /* "7기 김믿음 대표님" */}
    </span>
    <span className="hidden shrink-0 text-xs font-black text-gray-900 sm:inline sm:text-sm">
      경영일지
    </span>
  </div>

  {/* ③ D-day */}
  <div className="flex shrink-0">
    <DDayBadge weekTargetISO={me.data?.weekTargetISO} />
  </div>

  {/* ④ 대시보드 버튼 — 흰 배경 + brand red */}
  <Link href="/"
        className="group inline-flex shrink-0 items-center gap-1 rounded-full border border-[#d71617] bg-white px-2.5 py-1 text-[11px] font-bold text-[#d71617] shadow-sm transition-all hover:bg-red-50 hover:shadow-md active:scale-95 sm:px-3 sm:py-1.5 sm:text-xs">
    <span>대시보드</span>
    <svg className="h-3 w-3 transition-transform group-hover:translate-x-0.5" /* arrow path */ />
  </Link>
</header>
```

### 5-2. PageBanner (TopHeader 안)

```tsx
<div className="sticky top-12 z-40 flex h-12 items-center gap-2 border-b border-slate-200 bg-slate-100 px-3 sm:gap-3 sm:px-4">
  <div className="h-5 w-1 shrink-0 rounded-sm bg-slate-500" />
  <h1 className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-slate-700 sm:gap-2">
    <span className="shrink-0 text-base leading-none">{pageEmoji}</span>
    <span className="truncate">{pageTitle}</span>
  </h1>
  {pageSubtitle && (
    <span className="ml-auto shrink-0 truncate text-[10px] text-slate-500 sm:text-xs">
      {pageSubtitle}
    </span>
  )}
</div>
```

### 5-3. 탭별 props

| 페이지 | pageEmoji | pageTitle | pageSubtitle |
|---|---|---|---|
| `/contact` | 📞 | 컨택관리 | `01 영업관리` |
| `/schedule` | 📅 | 일정·계약 | `04 업체관리` |
| `/calendar` | 🗓️ | 캘린더 | `04 업체관리` |
| `/payment` | 💰 | 수납 | `02 계약수납관리` |
| `/db` | 🗂️ | DB관리 | `03 DB관리` |
| `/` (대시보드) | TopHeader 미사용, 자체 헤더 |

## 6. 의사결정 노트 (Hashimoto 로그)

- **헤더는 4 의미 그룹** (1234 의미 묶음): 로고 / [사용자+경영일지] / D-day / 대시보드.
  ② 그룹만 `gap-1.5` 타이트, 나머지는 `justify-between` 자동 분배. 그룹 ↔ 그룹을 추가로 묶지 않음 (④가 우측 끝에 떨어져야 함).
- **대시보드 버튼**: 흰 배경 + brand red 글자/테두리 (사용자 결정 — "흰배경에 빨간글씨가 나은거 같아").
  빨강 배경 음영 시도 → 거절됨.
- **D-day = 7주차** (`+49d`), 수료일(N2) 아님: 사용자가 의식하는 가장 큰 마일스톤이 7주차 발표·평가.
- **D-day 라벨 없음**: `"수료 D-N"` 같은 prefix 안 붙임 (공간 + 의미 모호 방지).
- **자식 각각 sticky 금지 → 부모에 묶기**: 일정·계약 탭에서 WeekHeader+SummaryBar drift 발생 후 학습한 패턴 (PR #198da19).
- **PageBanner는 별도 컴포넌트 X**: TopHeader.tsx 안의 두 번째 sticky `<div>`. props로 emoji/title/subtitle 받음.

## 7. 미해결 / TODO

- 대시보드 페이지(`/`) 자체 헤더 디자인 — PR 12 dashboard-tab에서 prototype 확정 후.
- D-day 0(`D-DAY`) 시각 효과 — 현재 brand red만, 진동/맥동 효과는 미정.
