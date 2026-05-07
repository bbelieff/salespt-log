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

**기준일 = 종강총회일 = 수료일** (같은 날, 토요일).

| 후보 | offset | 의미 | MVP 채택? |
|---|---|---|---|
| 수강시작일 N1 | +0d | 1주차 시작 (금요일) | — |
| 7주차 끝 | +49d | 7주차 평가 (금요일) | ❌ |
| **종강총회일 = 수료일** | **+57d** | **종강총회 = 수료 (8주차 끝 + 2일, 토)** | ✅ **채택** |
| 편집 종료 | +69d | 8주 + 2주 마감 유예 | ❌ |

```
graduationISO = courseStartISO + 57d   (= 수료일, 같은 날)
remain = graduationISO − today          (브라우저 자정 기준 정수 일수)
```

**검증 예시 (6기) — 확정**:
- N1 (1주차 시작) = `2026-04-10` (금)
- + 57d = **`2026-06-06` (토) ← 종강총회 = 수료일 (graduationISO)**
- 분해 검증: 4월 잔여 `30−10=20일` + 5월 `31일` + 6월 `6일` = **57일** ✓

### 2-2-b. 주차 계산 (currentWeek)

**1주차는 N1(금)부터, 각 주차는 금~목 7일.**

```
currentWeek = Math.floor((today − N1) / 7) + 1
```

**6기 주차 표 (N1 = 2026-04-10)**:

| 주차 | 시작 (금) | 끝 (목) |
|---|---|---|
| 1주차 | 4/10 | 4/16 |
| 2주차 | 4/17 | 4/23 |
| 3주차 | 4/24 | 4/30 |
| 4주차 | 5/1  | 5/7  |
| 5주차 | 5/8  | 5/14 |
| 6주차 | 5/15 | 5/21 |
| 7주차 | 5/22 | 5/28 |
| 8주차 | 5/29 | 6/4  |
| **종강총회 = 수료** | **6/6 (토)** = N1 + 57d (8주차 끝 + 2일) |

**검증 (today=5/4 일요일 기준 prototype 더미)**:
- 주차: `(5/4 − 4/10) / 7 = 24/7 = 3.43 → floor=3 → +1 = 4주차` ✓
- 진행률: `24/57 ≈ 42%` ✓
- D-day: `6/6 − 5/4 = D-33` ✓

> ⚠️ N1이 항상 **금요일**이라는 가정. 다른 요일이면 주차 시작/끝 다시 잡아야 함.

**표시 규칙**:

| remain | 텍스트 | 색 |
|---|---|---|
| > 0 | `D-N` (두자리 박스 분할: 10의 자리 / 1의 자리) | 검정 박스 / 흰 글자 |
| 0 | `D-DAY` | brand red `#d71617` |
| < 0 | `D+\|N\|` | 회색조 |
| 데이터 없음 (loading/error) | `D-—` | `bg-gray-100 text-gray-400` |

**라벨 prefix 금지**: `"종강 D-N"` / `"수료 D-N"` 사용 안 함 (공간 협소 + 종강총회=수료라 라벨 분리 의미 없음). 항상 `D-N`만.

**갱신 / Hydration**: 30분 polling으로 자정 경계 처리. SSR mismatch 방지 위해 `today`는 `useEffect`에서만 계산(초기 렌더 placeholder).

> ⚠️ **코드 follow-up (이번 docs PR 머지 후 별도 `fix/dday-graduation-anchor` PR로)**:
> - `lib/service/me.ts` — `WEEK_TARGET_OFFSET_DAYS = 49` → `GRADUATION_OFFSET_DAYS = **57**`
> - `MeProfile.weekTargetISO` → `graduationISO`
> - `DDayBadge` prop `weekTargetISO` → `graduationISO`
> - 호출부 (`TopHeader.tsx`, hooks, API route) 일괄 동기화
> - 6기 fixture 단위 테스트: `courseStart=2026-04-10` → `graduation=2026-06-06`

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

  {/* ③ D-day — graduationISO = courseStart + 57d (종강총회 = 수료일) */}
  <div className="flex shrink-0">
    <DDayBadge graduationISO={me.data?.graduationISO} />
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
- **D-day = 종강총회일 = 수료일** (`+57d`, 토요일, 같은 날): 종강총회와 수료일이 같은 날이라 단일 마일스톤. 7주차 끝(+49d)이나 별도 수료일은 없음.
- **D-day 라벨 없음**: `"종강 D-N"` / `"수료 D-N"` 같은 prefix 안 붙임 (공간 협소 + 종강총회=수료라 라벨 분리 의미 없음).
- **주차 = 금~목 7일**: N1(금)부터 1주차. `currentWeek = floor((today−N1)/7) + 1`.
- **자식 각각 sticky 금지 → 부모에 묶기**: 일정·계약 탭에서 WeekHeader+SummaryBar drift 발생 후 학습한 패턴 (PR #198da19).
- **PageBanner는 별도 컴포넌트 X**: TopHeader.tsx 안의 두 번째 sticky `<div>`. props로 emoji/title/subtitle 받음.

## 7. 미해결 / TODO

- 대시보드 페이지(`/`) 자체 헤더 디자인 — prototype 도착(2026-05-07), Q3 결정 대기 중. `docs/handoff/inbox/dashboard-2026-05-07/` 참조.
- D-day 0(`D-DAY`) 시각 효과 — 현재 brand red만, 진동/맥동 효과는 미정.
- `lib/service/me.ts` 코드 정합성 (**49→57**, weekTargetISO→graduationISO) — `fix/dday-graduation-anchor` 브랜치.

## 8. 변경 이력 (Changelog)

| 일자 | 커밋 | 내용 |
|---|---|---|
| 2026-05-07 | `8a903d8` | 최초 등록 — TopHeader/DDayBadge/brand red/sticky 적층 |
| 2026-05-07 | `d784118` | 보강 — PageBanner 명시, 로고 경로(`/salespt-logo.png`), 인증 흐름, 마스터 레지스트리 컬럼 |
| 2026-05-07 | `633a370` | D-day 1차 정정 — 7주차(+49d) → 종강총회일(+50d) (이후 +57d로 재정정) |
| 2026-05-08 | (이번) | **D-day 2차 정정 — `+50d` → `+57d`** (종강총회 = 수료일, 6기 N1=4/10 → 6/6 토). 주차 계산 규칙 명시 (금~목, `floor((today−N1)/7)+1`). 6기 주차 검증 표. dashboard prototype 핸드오프 수용 (`docs/handoff/inbox/dashboard-2026-05-07/`) |

---

## ✅ Prototype 작성자 체크리스트

이 핸드오프를 prompt로 받았다면 **다음 모두**가 prototype HTML/JSX에 반영됐는지 확인:

- [ ] 슬림 바 4 그룹 순서: 로고 / [사용자+경영일지] / D-day / 대시보드 — `justify-between`
- [ ] 로고 경로 `/salespt-logo.png` (PNG, SVG 인라인 X)
- [ ] 사용자 표시 = `formatDisplay(cohort, name)` 4분기 (정상/name만/cohort만/—)
- [ ] D-day = **종강총회일 = 수료일 (`courseStart + 57d`, 토요일, 같은 날)**
- [ ] 주차 계산: `currentWeek = floor((today − N1) / 7) + 1`. **각 주차 금~목 7일**. N1은 금요일
- [ ] D-day 텍스트는 `D-N` / `D-DAY` / `D+\|N\|` / `D-—`만 — 라벨 prefix X
- [ ] 대시보드 버튼: 흰 배경 + `border-[#d71617]` + `text-[#d71617]` + hover `bg-red-50`
- [ ] 슬림 바 sticky `top-0 z-50`, PageBanner sticky `top-12 z-40` (적층 분리)
- [ ] PageBanner는 별도 컴포넌트 X — TopHeader 안의 두 번째 sticky `<div>`
- [ ] 5탭 props 표 그대로 (`/contact` 📞 컨택관리 / `01 영업관리` 등)
- [ ] 대시보드 페이지(`/`)는 TopHeader 미사용 — 자체 헤더 별도

위 모두 ✅ 면 SSOT 일치.
