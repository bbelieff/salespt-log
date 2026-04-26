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
| Primary | `blue-500` | #3b82f6 | 로고, 메인 버튼, 링크 |
| Primary Dark | `blue-700` | #1d4ed8 | 버튼 hover, 강조 텍스트 |
| Primary Light | `blue-50` | #eff6ff | 카드 selected 상태 |
| Gradient | `from-blue-500 to-purple-600` | - | 헤더 배경, 대시보드 카드 |

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

### 재무 시각화 색상 규칙

#### 수익/손실 시각화
| 항목 | 양수 (이익) | 음수 (손실) | 사용처 |
|------|------------|------------|--------|
| 총매출 (+) | `text-gray-900` | - | 매출은 항상 양수 |
| 총비용 (−) | - | `text-red-600 bg-red-50` | 비용은 항상 음수 표시 |
| 영업이익 (=) | `text-blue-700 bg-blue-50` | `text-red-600 bg-red-50` | 계산 결과에 따라 |

#### 미팅 카드 5가지 상태 색상 ⭐
일정·계약 탭에서 사용. **노쇼·미처리 미팅이 시각적으로 즉시 보이게** 하는 게 목적.

| 상태 | 의미 | 카드 배경 | 좌측 4px 보더 | 텍스트 강조 |
|---|---|---|---|---|
| 🟡 **예약** (reserved) | 액션 미선택, 처리 대기 | `bg-yellow-50` (#fffbeb) | `border-yellow-400` (#fbbf24) | `text-yellow-800` |
| 💵 **계약** (contract) | 계약 성사 (가장 좋은 결과) | `bg-green-100` (#dcfce7) | `border-green-600` (#16a34a) + `shadow-lg shadow-green-500/15` | `text-green-700` |
| 🟠 **완료** (done, 계약X) | 미팅했으나 계약 X (시각 강조) | `bg-orange-50` (#fff7ed) | `border-orange-400` (#fb923c) | `text-orange-700` |
| 📅 **변경** (rescheduled) | 일정 변경됨 (무효 + 정보 보존) | `bg-purple-50` (#faf5ff) | `border-purple-500` (#a855f7) + `opacity-85` | `text-purple-700` |
| 🔴 **취소** (canceled) | 취소·노쇼 | `bg-red-50` (#fef2f2) | `border-red-500` (#ef4444) + `opacity-72` | `text-red-700` (제목은 `line-through text-gray-400`) |

> **노란색이 "예약 대기"인 이유**: 흰 배경이면 처리해야 할 미팅이 시각적으로 안 띈다. 노랑 = "여기 봐야 함" 신호.
> **주황색이 "완료(계약X)"인 이유**: 미팅은 성공이지만 계약 실패 → 좋은 상태 아님을 강조해 추적 유도.

#### 액션 폼 강조 색상 (인라인 입력 폼)
| 액션 | 폼 배경 | 폼 보더 | 확정 버튼 |
|---|---|---|---|
| 💵 계약 | `bg-green-50` | `border-2 border-green-300` | gradient `from-green-600 to-green-700` |
| 🟠 완료 | `bg-orange-50` | `border-2 border-orange-300` | `bg-orange-500 hover:bg-orange-600` |
| 📅 변경 | `bg-purple-50` | `border-2 border-purple-300` | `bg-purple-500 hover:bg-purple-600` |
| 🔴 취소 | `bg-red-50` | `border-2 border-red-300` | `bg-red-500 hover:bg-red-600` |

#### 기존 단순 상태별 색상 (배지·라벨용)
미팅 카드가 아닌 **인라인 텍스트 배지**일 때:

| 상태 | 색상 | 클래스 |
|------|------|-------|
| 예약 | 파란색 | `text-blue-600 bg-blue-50` |
| 완료 | 초록색 | `text-green-600 bg-green-50` |
| 취소 | 빨간색 | `text-red-600 bg-red-50` |

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