> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 세일즈PT 영업일지의 디자인 토큰 시스템 (색상, 타이포, 간격, 모든 시각적 일관성)
> - **누가 읽나요**: 개발자, UI/UX 디자이너
> - **어떤 기능·작업과 연결?**: 모든 UI 컴포넌트, Tailwind CSS 클래스, 브랜딩
> - **읽고 나면 알 수 있는 것**:
>   - 채널별 고정 색상 규칙과 Tailwind 매핑
>   - 타이포그래피와 간격 체계
>   - 재무 시각화 색상 규칙
> - **관련 문서**: [components.md](./components.md), [preview.html](./preview.html), [wireframes.md](../domains/wireframes.md)

# 디자인 토큰 (Design Tokens)

## 색상 시스템

### Brand Colors
브랜드 메인 컬러와 그라디언트:

| 용도 | Tailwind Class | Hex | 사용처 |
|------|---------------|-----|--------|
| **Brand Red** ⭐ | `bg-brand-red` / `text-brand-red` / `border-brand-red` | **#d71617** | 세일즈PT 로고($ 심볼)·D-DAY 강조·대시보드 버튼 글자/테두리 |
| Brand Red Hover | `red-50` | #fef2f2 | 대시보드 버튼 hover 배경 |
| Primary | `blue-500` | #3b82f6 | 메인 버튼, 링크, 활성 탭 |
| Primary Dark | `blue-700` | #1d4ed8 | 버튼 hover, 강조 텍스트 |
| Primary Light | `blue-50` | #eff6ff | 카드 selected 상태 |
| Gradient | `from-blue-500 to-purple-600` | - | 대시보드 카드 |

> **brand-red 토큰** (Q2 A 결정 2026-05-08, 코드 정합 완료): `tailwind.config.ts` 의
> `theme.extend.colors.brand.red = '#d71617'` 로 등록.
> 사용처에선 `bg-brand-red` / `text-brand-red` / `border-brand-red` 클래스 사용.
> **arbitrary `[#d71617]` 사용 금지** (CLAUDE.md 정책 일치).

### Semantic Colors
의미별 색상:

| 의미 | Tailwind Class | Hex | 사용처 |
|------|---------------|-----|--------|
| Success | `green-600` | #16a34a | 성공 토스트, 완료 상태 |
| Warning | `amber-500` | #f59e0b | 경고 메시지, 주의 필요 |
| Danger | `red-500` | #ef4444 | 에러, 삭제 버튼 |
| Info | `blue-400` | #60a5fa | 정보 메시지 |

### 채널별 색상 (고정 4종)
**중요**: 이 4가지 색상은 변경 금지. 사용자가 학습한 색상 매핑입니다.

| 채널명 | Tailwind Base | 배지 배경 | 배지 텍스트 | 사용 예시 |
|--------|---------------|----------|-----------|-----------|
| 매입DB | `blue` | `blue-100` | `blue-700` | 매입DB 관련 모든 UI |
| 직접생산 | `green` | `green-100` | `green-700` | 직접생산 채널 UI |
| 현수막 | `amber` | `amber-100` | `amber-700` | 현수막 채널 UI |
| 콜·지·기·소 | `purple` | `purple-100` | `purple-700` | 콜센터, 지인, 기존고객, 소개 |

### 실무투두 색상 (Scope 2 — 캘린더 04 미팅 + 05 투두 머지)

**중요**: 실무(투두) 색은 채널 4색(blue/green/amber/purple) 어디와도 **안 겹치는 진회색 단색**. 영업(미팅)=채널색, 실무(투두)=진회색+카테고리 아이콘으로 구분.

| 용도 | Hex | 사용처 |
|------|-----|--------|
| **실무 진회색** ⭐ | **#334155** (slate-700) | 캘린더 투두 pill 배경 · 일자상세 좌측바 · "실무" 배지 (흰 글자). inline style (채널 hex와 동일 방식). |

**type 아이콘 4종** (lucide 모티브 인라인 SVG, `TodoTypeIcon`): 미팅=사람들(users) · 전화=수화기(phone) · 메시지=말풍선 · 기타=점3(•••). 진회색 배경 + 흰 아이콘.

**채널 좌측바 hex** (일자상세 영업 카드 좌측바 — 채널 4색 진한값, tokens 채널색과 1:1):

| 채널 | Hex |
|------|-----|
| 매입DB | #1d4ed8 |
| 직접생산 | #15803d |
| 현수막 | #b45309 |
| 콜·지·기·소 | #7c3aed |

### 재무 시각화 색상 규칙

#### 수익/손실 시각화
| 항목 | 양수 (이익) | 음수 (손실) | 사용처 |
|------|------------|------------|--------|
| 총매출 (+) | `text-gray-900` | - | 매출은 항상 양수 |
| 총비용 (−) | - | `text-red-600 bg-red-50` | 비용은 항상 음수 표시 |
| 영업이익 (=) | `text-blue-700 bg-blue-50` | `text-red-600 bg-red-50` | 계산 결과에 따라 |

#### 미팅 상태별 색상 (5상태) ⭐

> **단일 SSOT**: 이 색상 매핑은 `components.md` §4 미팅 상태 배지 / §7 Meeting Card와 1:1 일치해야 함.
> 변경 시 두 파일 동시 갱신 필수.

| 상태 | 색상 | 좌측바 | 카드 배경 | 배지 클래스 | 이모지 | 적용 대상 |
|------|------|------|-----------|-----------|------|----------|
| 예약 | amber | `#fbbf24` | `#fffbeb` | `bg-amber-100 text-amber-700` | 🟡 | 액션 미선택 (기본값) |
| 계약 | green | `#16a34a` | `#dcfce7` | `bg-green-100 text-green-800` | 💵 | 미팅 후 계약 체결 (가장 좋은 결과) |
| 완료 | orange | `#fb923c` | `#fff7ed` | `bg-orange-100 text-orange-700` | 🟠 | 미팅했으나 계약 X |
| 변경 | purple | `#a855f7` | `#faf5ff` | `bg-purple-100 text-purple-700` | 📅 | 일정 변경됨 (이 카드 무효) |
| 취소 | red | `#ef4444` | `#fef2f2` | `bg-red-100 text-red-700` | 🔴 | 취소·노쇼 |

**시각 강도 규칙** (의도적):
- `계약`: 가장 강함 (그림자 추가) — 가장 좋은 결과
- `예약` / `완료`: 보통
- `변경`: 약함 (`opacity: 0.85`) — 무효화된 카드
- `취소`: 가장 약함 (`opacity: 0.72` + 텍스트 취소선)

**중요**: `완료`는 **초록색이 아닌 주황색**(orange). 의미상 "미팅했으나 계약 못 함" = 좋지 않은 결과라서 강조 X. 초록은 `계약` 전용.

### 중립 색상
| 용도 | Tailwind Class | Hex | 사용처 |
|------|---------------|-----|--------|
| 텍스트 기본 | `gray-900` | #111827 | 본문 텍스트 |
| 텍스트 보조 | `gray-500` | #6b7280 | 설명 텍스트, 라벨 |
| 텍스트 비활성 | `gray-400` | #9ca3af | 비활성 요소 |
| 배경 기본 | `gray-50` | #f8fafc | body 배경 |
| 배경 카드 | `white` | #ffffff | 카드, 모달 배경 |
| 경계선 | `gray-100` | #f3f4f6 | border, divider |
| 경계선 진함 | `gray-200` | #e5e7eb | input border |

## 타이포그래피

### 폰트 패밀리
```css
font-family: 'Noto Sans KR', system-ui, -apple-system, sans-serif;
```

### 폰트 크기
| 이름 | Tailwind Class | Size | Line Height | 사용처 |
|------|---------------|------|-------------|--------|
| xs | `text-xs` | 12px | 16px | 배지, 캡션 |
| sm | `text-sm` | 14px | 20px | 라벨, 보조 텍스트 |
| base | `text-base` | 16px | 24px | 기본 본문 |
| lg | `text-lg` | 18px | 28px | 카드 제목 |
| xl | `text-xl` | 20px | 28px | 섹션 제목 |
| 2xl | `text-2xl` | 24px | 32px | 페이지 제목 |
| 3xl | `text-3xl` | 30px | 36px | 헬로 카드 메인 텍스트 |

### 폰트 굵기
| 용도 | Tailwind Class | Weight | 사용처 |
|------|---------------|--------|--------|
| 기본 | `font-normal` | 400 | 본문 텍스트 |
| 중간 | `font-medium` | 500 | 라벨, 버튼 |
| 반굵게 | `font-semibold` | 600 | 카드 제목, 탭 |
| 굵게 | `font-bold` | 700 | 헤더, 강조 텍스트 |

## 간격 시스템

### Spacing Scale (Tailwind 기본 4px grid)
| 이름 | Tailwind | Size | 사용처 |
|------|----------|------|--------|
| 1 | `1` | 4px | 작은 여백 |
| 2 | `2` | 8px | 텍스트 간 여백 |
| 3 | `3` | 12px | 카드 내부 패딩 |
| 4 | `4` | 16px | 컨테이너 패딩 |
| 5 | `5` | 20px | 섹션 간 여백 |
| 6 | `6` | 24px | 큰 여백 |

### 컨테이너
- **메인 컨테이너**: `px-4` (좌우 16px 패딩)
- **카드 패딩**: `p-3` (12px) 또는 `p-4` (16px)
- **버튼 패딩**: `px-4 py-2` (가로 16px, 세로 8px)

## Border Radius

| 크기 | Tailwind Class | Size | 사용처 |
|------|---------------|------|--------|
| 기본 | `rounded-lg` | 8px | 카드, 입력 필드 |
| 크게 | `rounded-xl` | 12px | 모달, 바텀시트 |
| 매우 크게 | `rounded-2xl` | 16px | 헬로 카드, 메인 컨테이너 |
| 원형 | `rounded-full` | 50% | 아바타, 원형 버튼 |

## 그림자 (Shadow)

### 기본 그림자
| 크기 | Tailwind Class | CSS | 사용처 |
|------|---------------|-----|--------|
| 작게 | `shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | 카드 기본 |
| 크게 | `shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | 모달, 드롭다운 |

### 컬러 그림자 (강조용)
```css
shadow-lg shadow-blue-500/25   /* 파란색 25% 투명도 */
shadow-lg shadow-green-500/25  /* 초록색 25% 투명도 */
```

## Z-Index & Sticky 적층 ⭐

화면에 sticky/fixed 요소가 여럿일 때 순서·top 좌표를 고정한다. 각 페이지는 이 표대로만 쌓는다.

| 레이어 | 컴포넌트 | z-index | top | 높이 |
|---|---|---|---|---|
| 1 (최상단) | `TopHeader` (슬림 브랜드 바) | `z-50` | `top-0` | `h-12` (48px) |
| 2 | 페이지 배너 (TopHeader 내부 `<div>`. 일정·계약은 `WeekHeader + SummaryBar` wrapper로 변형) | `z-40` | `top-12` (48px) | 가변 |
| 3 | 대시보드 메인 배너 (`DashboardProgressBanner` — 대시보드 페이지 한정) | `z-30` | `top-24` (96px) | `h-12+` |
| 4 | 모달/Toast/Sheet 등 floating | `z-50` 이상 (별도) | — | — |
| 0 | 본문 `main` | (없음) | — | — |
| -1 | `BottomNav` (모바일) | `z-50` (fixed bottom) | bottom-0 | `h-[60px]` |

**규칙**:
- 페이지 배너가 두 영역(예: WeekHeader + SummaryBar)이라도 **반드시 한 부모에 묶어 단일 sticky**.
  자식 각각에 `sticky`를 주면 스크롤 시 약간 어긋남(drift) 발생 — 수정 이력 PR #198da19.
- `top-12`는 슬림 바 높이와 1:1 매칭 — 슬림 바 높이를 바꾸면 이 값도 동시에 바꾼다.
- 모달은 별도 z-stack(`z-50` 이상). 슬림 바를 가려야 정상.

## Breakpoints (반응형)

| 이름 | Min Width | 설명 | 우선순위 |
|------|-----------|------|----------|
| base | 375px | 모바일 기본 | Primary |
| sm | 640px | 큰 모바일 | Secondary |
| md | 768px | 태블릿 | Secondary |
| lg | 1024px+ | 데스크탑 | Secondary |

**설계 원칙**: 모바일 우선 (Mobile First) - 375px 기준으로 설계 후 확장

## 상호작용 (Interaction)

### 터치 타겟
- **최소 크기**: 44px × 44px (접근성 기준)
- **버튼 높이**: `h-11` (44px) 또는 `h-12` (48px)
- **아이콘 버튼**: `w-11 h-11` (44px × 44px)

### 애니메이션
```css
transition: all 0.15s ease;  /* 기본 전환 */
transition: transform 0.2s;  /* hover/tap 효과 */
```

### 상태 변화
- **hover**: `hover:opacity-80`
- **active**: `active:scale-95`
- **focus**: `focus:outline-2 focus:outline-blue-500`

## 사용 예시

### 채널 배지 구현
```html
<!-- 매입DB 배지 -->
<span class="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">매입DB</span>

<!-- 직접생산 배지 -->
<span class="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">직접생산</span>
```

### 재무 카드 구현
```html
<!-- 영업이익 양수 -->
<div class="bg-blue-50 text-blue-700 p-3 rounded-lg">
  <span class="text-sm">영업이익</span>
  <span class="text-xl font-bold">+125만원</span>
</div>

<!-- 영업이익 음수 -->
<div class="bg-red-50 text-red-600 p-3 rounded-lg">
  <span class="text-sm">영업이익</span>
  <span class="text-xl font-bold">-35만원</span>
</div>
```

---

💡 **중요 원칙**
1. **임의 값 금지**: `text-[15px]` 같은 arbitrary value 사용 금지
2. **채널 색상 고정**: 4개 채널 색상은 절대 변경하지 말 것
3. **재무 색상 일관성**: 양수/음수에 따른 색상 규칙 준수
4. **토큰 우선**: 새로운 색상이 필요하면 토큰 먼저 정의
5. **상태 색상 SSOT**: 미팅 상태 5색은 `components.md`와 1:1 일치 (변경 시 양쪽 동시 갱신)

---

## 변경 이력

| 날짜 | 변경 내용 | 출처 |
|---|---|---|
| 2026-04-27 | 미팅 상태 색상: 3종(예약 파랑/완료 초록/취소 빨강) → **5종**(예약 amber/계약 green/완료 **orange**/변경 purple/취소 red) | 클로드코드 검증 #5 |
| 2026-04-27 | "완료=초록"의 의미 오류 정정: **완료=주황** (계약X 의미). 초록은 계약 전용 | 동일 |
| 2026-04-27 | 시각 강도 규칙 추가 (계약 강조, 변경/취소 흐림) | 동일 |