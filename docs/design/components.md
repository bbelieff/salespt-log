> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 세일즈PT 영업일지의 모든 UI 컴포넌트 카탈로그 (용도, 변형, 구현 예시)
> - **누가 읽나요**: 개발자, UI/UX 디자이너
> - **어떤 기능·작업과 연결?**: 모든 UI 컴포넌트 구현, React 컴포넌트 개발
> - **읽고 나면 알 수 있는 것**:
>   - 각 컴포넌트의 변형(Variants)과 사용법
>   - Tailwind CSS 기반 구현 코드
>   - 접근성과 사용성 가이드라인
> - **관련 문서**: [tokens.md](./tokens.md), [preview.html](./preview.html), [wireframes.md](../domains/wireframes.md)

# 컴포넌트 카탈로그 (Components Catalog)

## 1. Buttons

### Primary Button
메인 액션용 버튼 (저장, 제출 등).

**Variants:**
- Default: `bg-blue-500 hover:bg-blue-600 text-white`
- Disabled: `bg-gray-300 text-gray-500 cursor-not-allowed`

**구현 예시:**
```html
<button class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors">
  💾 저장하기
</button>
```

**현재 사용 위치:** 컨택관리 저장, 미팅 추가, 수납 저장
**접근성:** 터치 타겟 44px, focus:outline-2 focus:outline-blue-500

### Secondary Button
보조 액션용 버튼 (취소, 닫기 등).

```html
<button class="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors">
  취소
</button>
```

### Ghost Button
텍스트 링크 형태의 버튼.

```html
<button class="px-2 py-1 text-blue-600 hover:text-blue-700 font-medium transition-colors">
  더보기...
</button>
```

### Icon Button
아이콘만 있는 버튼.

```html
<button class="w-11 h-11 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
  ⚙️
</button>
```

### Stepper Button
숫자 증감 버튼 (+/-).

```html
<button class="stepper-btn bg-blue-500 hover:bg-blue-600 text-white">+</button>
<button class="stepper-btn bg-gray-200 hover:bg-gray-300 text-gray-700">-</button>
```

**CSS 정의:**
```css
.stepper-btn {
  width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; font-weight: 700; cursor: pointer;
  user-select: none; transition: all 0.15s;
}
.stepper-btn:active { transform: scale(0.9); }
```

**현재 사용 위치:** 생산/유입/컨택진행/컨택성공 수치 입력

## 2. Inputs

### Text Input
일반 텍스트 입력 필드.

```html
<input 
  type="text" 
  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
  placeholder="업체명을 입력하세요"
>
```

### Number Input (Stepper)
숫자 입력 + 스테퍼 조합.

**원칙 — UI 중복 방지 ⚠️**:
- 증감 수단은 **커스텀 +/- 버튼 하나만** 사용.
- HTML 기본 `<input type="number">`의 **네이티브 스피너(상하 화살표)는 CSS로 반드시 숨긴다.**

```html
<div class="flex items-center gap-2">
  <button class="stepper-btn bg-gray-200 hover:bg-gray-300 text-gray-700">-</button>
  <input type="number" class="stepper-val" value="12" inputmode="numeric">
  <button class="stepper-btn bg-blue-500 hover:bg-blue-600 text-white">+</button>
</div>
```

**CSS 정의 (네이티브 스피너 제거 필수):**
```css
.stepper-val {
  width: 48px; text-align: center; font-size: 20px; font-weight: 700;
  border: none; background: transparent; cursor: pointer;
  -moz-appearance: textfield;
}
.stepper-val::-webkit-outer-spin-button,
.stepper-val::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.stepper-val:focus {
  outline: 2px solid #3b82f6; border-radius: 8px;
  background: white; cursor: text;
}
```

**접근성**:
- 키보드 방향키(↑/↓)는 브라우저가 여전히 값 증감 지원
- 모바일에서 숫자 키패드 노출: `inputmode="numeric"` 속성 유지

**현재 사용 위치:** 컨택관리 탭 4지표(생산/유입/컨택진행/컨택성공), 수납관리 탭(승인·수납 건수)

### Date Input (커스텀 박스 + 숨겨진 native) ⭐

**왜 커스텀이 필요한가**:
- 한국어 UX는 `2026-04-25 (목)` 처럼 **요일 표시**가 필수
- 그러나 native `<input type="date">`는 표시 형식을 바꿀 수 없음 (YYYY-MM-DD 고정, 요일 없음)
- 해결: 보이는 박스는 커스텀, 진짜 input은 0×0으로 숨겨두고 `showPicker()`로 picker만 호출

**구현 예시:**
```html
<div class="custom-date-wrapper" onclick="openDatePicker(this)">
  <span class="custom-date-display" id="dateDisplay-1">2026-04-25 (목)</span>
  <span class="text-gray-400">📅</span>
  <input 
    type="date" 
    class="hidden-native-date"
    id="dateNative-1"
    value="2026-04-25"
    onchange="updateDateDisplay(this, 'dateDisplay-1')"
  >
</div>
```

**CSS 정의:**
```css
.custom-date-wrapper {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  cursor: pointer;
  background: white;
  user-select: none;
  position: relative;
}
.custom-date-wrapper:hover { border-color: #9ca3af; }
.custom-date-wrapper:focus-within { border-color: #3b82f6; outline: 2px solid #dbeafe; }

.custom-date-display {
  font-size: 14px; font-weight: 500; color: #111827;
  flex: 1;
}

/* native input은 0×0으로 숨김 (showPicker 호출 가능 상태 유지) */
.hidden-native-date {
  position: absolute;
  width: 0; height: 0;
  opacity: 0;
  pointer-events: none;
}
```

**JS 헬퍼:**
```javascript
const DAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

function openDatePicker(wrapper) {
  const native = wrapper.querySelector('.hidden-native-date');
  if (native.showPicker) {
    native.showPicker();
  } else {
    native.focus(); // 폴백
  }
}

function updateDateDisplay(native, displayId) {
  const display = document.getElementById(displayId);
  const date = new Date(native.value);
  const dayKo = DAY_KO[date.getDay()];
  display.textContent = `${native.value} (${dayKo})`;
}
```

**브라우저 호환성**:
- `showPicker()` 지원: Chrome 99+, Edge 99+, Safari 16+, Firefox 101+
- 미지원 브라우저: `focus()` 폴백 (picker 자동 안 뜨고 키보드 입력만 가능)

**현재 사용 위치:** 컨택관리 미팅예약 폼(미팅날짜), 일정·계약 변경 폼

### Time Input (시 + 분 select 분리) ⭐

**왜 select 분리가 필요한가**:
- iOS Safari가 `<input type="time" step="900">`의 `step` 속성을 **무시하고 1분 단위 picker** 띄움
- 15분 단위 강제(0/15/30/45)를 위해 시·분을 별도 select로 분리
- Android·데스크톱은 무관하지만 일관된 UX를 위해 모든 플랫폼에서 동일 구현

**구현 예시:**
```html
<div class="time-select-wrapper">
  <select class="time-hour" id="hourSelect-1">
    <option value="">--</option>
    <option value="09">09</option>
    <option value="10" selected>10</option>
    <!-- 09 ~ 22 (영업시간) -->
  </select>
  <span class="time-separator">:</span>
  <select class="time-minute" id="minuteSelect-1">
    <option value="00" selected>00</option>
    <option value="15">15</option>
    <option value="30">30</option>
    <option value="45">45</option>
  </select>
</div>
```

**CSS 정의:**
```css
.time-select-wrapper {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
}
.time-select-wrapper:focus-within {
  border-color: #3b82f6;
  outline: 2px solid #dbeafe;
}
.time-hour, .time-minute {
  border: none;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  text-align: center;
  padding: 4px 2px;
}
.time-hour { width: 36px; }
.time-minute { width: 36px; }
.time-hour:focus, .time-minute:focus { outline: none; }
.time-separator { color: #6b7280; font-weight: 600; }
```

**JS 헬퍼 — 시 옵션 동적 생성:**
```javascript
// 영업 시간 09:00 ~ 22:00 채우기
function fillHourOptions(selectEl, defaultHour = '10') {
  for (let h = 9; h <= 22; h++) {
    const hh = String(h).padStart(2, '0');
    const opt = document.createElement('option');
    opt.value = hh;
    opt.textContent = hh;
    if (hh === defaultHour) opt.selected = true;
    selectEl.appendChild(opt);
  }
}

// 시·분 합쳐서 HH:MM 가져오기
function getTimeValue(hourId, minuteId) {
  const h = document.getElementById(hourId).value;
  const m = document.getElementById(minuteId).value;
  if (!h || !m) return null;
  return `${h}:${m}`;
}
```

**검증 규칙**:
- 분은 **반드시 00/15/30/45** 중 하나 (다른 값은 select에 없음)
- 시는 영업시간 09~22 권장 (사용자 환경에 따라 조정 가능)

**현재 사용 위치:** 컨택관리 미팅예약 폼(미팅시간), 일정·계약 변경 폼

### Select Dropdown
일반 드롭다운 선택 필드.

```html
<select class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500">
  <option value="purchase">매입DB</option>
  <option value="direct">직접생산</option>
  <option value="banner">현수막</option>
  <option value="referral">콜·지·기·소</option>
</select>
```

### Textarea
여러 줄 텍스트 입력.

```html
<textarea 
  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
  rows="3"
  placeholder="특이사항을 입력하세요"
></textarea>
```

**현재 사용 위치:** 미팅 비고, 수납 비고, 미팅사유 입력

## 3. Cards

### Basic Card
기본 카드 컨테이너.

```html
<div class="bg-white rounded-lg p-4 shadow-sm">
  <h3 class="font-semibold text-gray-900 mb-2">카드 제목</h3>
  <p class="text-gray-600">카드 내용</p>
</div>
```

### Highlighted Card
강조된 카드 (선택 상태, 오늘).

```html
<div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
  <h3 class="font-semibold text-blue-900 mb-2">오늘의 기록</h3>
  <p class="text-blue-700">4월 17일 데이터</p>
</div>
```

### Warning Card
주의/경고 카드.

```html
<div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
  <div class="flex items-center gap-2 mb-2">
    <span class="text-amber-600">⚠️</span>
    <h3 class="font-semibold text-amber-900">주의</h3>
  </div>
  <p class="text-amber-700">저장하지 않은 변경사항이 있습니다.</p>
</div>
```

### Info Card
정보 안내 카드.

```html
<div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
  <div class="flex items-center gap-2 mb-2">
    <span class="text-blue-600">ℹ️</span>
    <h3 class="font-semibold text-blue-900">안내</h3>
  </div>
  <p class="text-blue-700">매입DB 채널 데이터를 확인하세요.</p>
</div>
```

## 4. Badges

### 채널 배지 (4종 고정)

**매입DB 배지:**
```html
<span class="badge badge-purchase">매입DB</span>
```

**직접생산 배지:**
```html
<span class="badge badge-direct">직접생산</span>
```

**현수막 배지:**
```html
<span class="badge badge-banner">현수막</span>
```

**콜·지·기·소 배지:**
```html
<span class="badge badge-referral">콜·지·기·소</span>
```

**CSS 정의:**
```css
.badge { 
  font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: 500; 
}
.badge-purchase { background: #dbeafe; color: #1d4ed8; }
.badge-direct { background: #dcfce7; color: #16a34a; }
.badge-banner { background: #fef3c7; color: #d97706; }
.badge-referral { background: #f3e8ff; color: #7c3aed; }
```

### 미팅 상태 배지 (5종) ⭐

미팅의 라이프사이클 5상태와 1:1 매핑. 상세 의미는 [data-model.md](../domains/data-model.md), [sheet-structure.md](../domains/sheet-structure.md) 참조.

> **사용 원칙**: 상태 배지는 **단독으로 잘 안 씀**. 미팅 카드의 **이모지 + 좌측바 색상**으로 상태를 표현하는 게 디자인 표준 (§7 Meeting Card 참고). 배지 형태가 필요한 곳은 일정·계약 탭 헤더의 상태 필터 정도.

| 상태 | 의미 | 배지 색 | 이모지 |
|---|---|---|---|
| 예약 | 액션 미선택 (기본값) | amber | 🟡 |
| 계약 | 미팅 후 계약 체결 | green (진함) | 💵 |
| 완료 | 미팅했으나 계약 X | orange | 🟠 |
| 변경 | 일정 변경됨 (이 카드 무효) | purple | 📅 |
| 취소 | 취소·노쇼 | red | 🔴 |

```html
<span class="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded">🟡 예약</span>
<span class="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">💵 계약</span>
<span class="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded">🟠 완료</span>
<span class="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded">📅 변경</span>
<span class="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded">🔴 취소</span>
```

**현재 사용 위치:** 일정·계약 탭 상태 필터 (제한적 사용. 카드 본체에는 §7 Meeting Card의 좌측바 패턴 사용)

## 5. Navigation

### Bottom Navigation (모바일) — 5개 탭

**탭 순서 (좌→우)**: 컨택관리 / 일정·계약 / 캘린더 / 수납 / DB관리

**전체 컨테이너:**
```html
<nav class="bottom-nav bg-white border-t border-gray-100 flex">
  <!-- 5개 탭 버튼 (아래 5개 SVG 아이콘 차례로 삽입) -->
</nav>
```

**활성/비활성 색상 규칙**:
- 활성 탭: `text-blue-600` + `font-semibold`
- 비활성 탭: `text-gray-400 hover:text-gray-600`
- SVG의 `fill`/`stroke`는 **반드시 `currentColor`** 사용 (텍스트 색을 따라감)

**CSS 정의:**
```css
.bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; z-index: 50; }
.content-area { padding-bottom: 76px; }
```

#### 탭 버튼 공통 구조
```html
<button class="flex-1 py-2 flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600 transition-colors">
  <!-- SVG 아이콘 -->
  <span class="text-xs">탭 이름</span>
</button>
```

활성 상태:
```html
<button class="flex-1 py-2 flex flex-col items-center gap-0.5 text-blue-600">
  <!-- SVG 아이콘 -->
  <span class="text-xs font-semibold">탭 이름</span>
</button>
```

---

#### 탭 아이콘 1 — 컨택관리 (G-3: 수화기 + 우상단 캘린더)
"전화로 미팅을 잡는다"는 의미. 좌하단 수화기 + 우상단 캘린더(일정 점 4개) 조합.

```html
<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.7"
     stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
        transform="translate(-1, 5.5) scale(0.68)"/>
  <rect x="14.5" y="0.5" width="9" height="9" rx="1.4"
        fill="white" stroke="currentColor" stroke-width="1.7"/>
  <line x1="14.5" y1="3.3" x2="23.5" y2="3.3" stroke="currentColor" stroke-width="1.5"/>
  <line x1="16.8" y1="0.5" x2="16.8" y2="2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
  <line x1="21.2" y1="0.5" x2="21.2" y2="2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
  <circle cx="17" cy="5.7" r="0.85" fill="currentColor"/>
  <circle cx="19" cy="5.7" r="0.85" fill="currentColor"/>
  <circle cx="21" cy="5.7" r="0.85" fill="currentColor"/>
  <circle cx="17" cy="7.8" r="0.85" fill="currentColor"/>
</svg>
```

**핵심 좌표 메모**:
- 수화기: `translate(-1, 5.5) scale(0.68)` — 좌하단
- 캘린더: `x=14.5, y=0.5, w=9, h=9` — 우상단
- 갭: 약 0.5 단위 (대각선 분리)

#### 탭 아이콘 2 — 일정·계약 (체크 클립보드)
```html
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
</svg>
```

#### 탭 아이콘 3 — 캘린더 (격자 달력, solid)
```html
<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
  <path fill-rule="evenodd"
        d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
        clip-rule="evenodd"/>
</svg>
```

#### 탭 아이콘 4 — 수납 (달러 사인 동그라미)
```html
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
</svg>
```

#### 탭 아이콘 5 — DB관리 (E: 카트 + DB박스)
"DB를 매입·생산해서 담는다"는 의미.

```html
<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.7"
     stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
  <circle cx="9" cy="20" r="1.3"/>
  <circle cx="17" cy="20" r="1.3"/>
  <path d="M3 4 L5 4 L7 13 L18 13 L20 6 L7 6"/>
  <rect x="9" y="7.5" width="7" height="4.5" rx="0.5" fill="white"/>
  <line x1="9" y1="10" x2="16" y2="10"/>
  <line x1="11" y1="7.5" x2="11" y2="12"/>
</svg>
```

---

**디자인 의도 요약**:
- 컨택관리(1) ~ 수납(4)는 **line-icon** 통일 (stroke 위주)
- 캘린더(3)는 의도적으로 **solid** — 가운데 위치 + 시각적 anchor 역할
- 모든 SVG는 `currentColor` 사용 → 활성/비활성 색 자동 전환

### Tab Navigation (채널 전환)
상단 채널 탭 (4개 채널).

```html
<div class="flex border-b border-gray-200">
  <button class="flex-1 py-2 px-3 text-sm font-medium border-b-2 border-blue-500 text-blue-600">매입DB</button>
  <button class="flex-1 py-2 px-3 text-sm font-medium text-gray-500 hover:text-gray-700">직접생산</button>
  <button class="flex-1 py-2 px-3 text-sm font-medium text-gray-500 hover:text-gray-700">현수막</button>
  <button class="flex-1 py-2 px-3 text-sm font-medium text-gray-500 hover:text-gray-700">콜·지·기·소</button>
</div>
```

### Week Navigator
좌우 화살표 날짜 네비게이션.

```html
<div class="flex items-center justify-between py-3">
  <button class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center">◀</button>
  <div class="text-center">
    <div class="text-lg font-semibold">4월 17일 (수)</div>
    <div class="text-sm text-gray-500">17주차</div>
  </div>
  <button class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center">▶</button>
</div>
```

**현재 사용 위치:** 컨택관리, 수납관리 날짜 전환

## 6. Feedback

### Toast
성공/에러 알림 메시지.

```html
<div id="toast" class="toast">저장 완료!</div>
```

**CSS 정의:**
```css
.toast {
  position: fixed; bottom: 80px; left: 50%; 
  transform: translateX(-50%);
  background: rgba(17, 24, 39, 0.95); color: white;
  padding: 10px 18px; border-radius: 10px;
  font-size: 13px; font-weight: 500;
  z-index: 100; opacity: 0;
  transition: all 0.3s; pointer-events: none;
}
.toast.show { opacity: 1; transform: translateX(-50%) translateY(-8px); }
```

**현재 사용 위치:** 저장 성공/실패 피드백

### Alert (경고)
모달형 경고 메시지.

```html
<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
  <div class="bg-white rounded-xl p-6 mx-4 max-w-sm w-full">
    <h3 class="font-semibold text-gray-900 mb-2">저장하지 않은 변경사항</h3>
    <p class="text-gray-600 mb-4">변경사항이 손실될 수 있습니다. 저장하시겠습니까?</p>
    <div class="flex gap-2">
      <button class="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg">저장</button>
      <button class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg">취소</button>
    </div>
  </div>
</div>
```

### Bottom Sheet
하단에서 올라오는 모달.

```html
<div class="bottomsheet-overlay" onclick="closeBottomSheet()"></div>
<div class="bottomsheet">
  <div class="w-12 h-1 bg-gray-300 rounded-full mx-auto my-3"></div>
  <div class="px-4 pb-4">
    <h3 class="font-semibold text-lg mb-4">미팅 추가</h3>
  </div>
</div>
```

**CSS 정의:**
```css
.bottomsheet-overlay { 
  position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 90; 
}
.bottomsheet {
  position: fixed; bottom: 0; left: 0; right: 0; background: white;
  border-radius: 16px 16px 0 0; z-index: 100; transform: translateY(100%);
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
  max-height: 85vh; overflow-y: auto;
}
.bottomsheet.open { transform: translateY(0); }
```

## 7. Data Display

### Stat Card
숫자 지표 표시 카드.

```html
<div class="metric-card">
  <div class="text-2xl font-bold text-gray-900 mb-1">125</div>
  <div class="text-sm text-gray-500">총 생산</div>
  <div class="text-xs text-green-600 mt-1">+12 (+10.6%)</div>
</div>
```

**CSS 정의:**
```css
.metric-card { 
  background: white; border-radius: 12px; padding: 16px; 
  text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.06); 
}
```

### Calendar Cell ⭐
캘린더 월간 뷰의 날짜 셀. **시간+업체명 박스** 표시로 한눈에 일정 파악 가능.

**셀 비율**: `1 : 1.7` (정사각형 X, 세로로 길어 미팅 박스 표시 공간 확보)

**기본 셀 (편집 가능 + 미팅 있음):**
```html
<div class="cal-cell">
  <div class="date-num">17</div>
  <div class="meeting-pill ch-banner"><span class="pill-time">10:30</span>○○부동산</div>
  <div class="meeting-pill ch-banner"><span class="pill-time">14:00</span>△△식당</div>
</div>
```

**상태별 변형 (모두 같은 `.cal-cell`에 클래스 추가)**:
- `.is-today` — 오늘 (날짜 숫자에 파란 배경 동그라미)
- `.is-selected` — 선택됨 (셀 배경 하늘색 + 파란 outline 2px)
- `.disabled` — 편집 가능 기간 외 (회색, 클릭 불가)
- `.other-month` — 다른 달의 날짜 (40% 투명도)
- `.is-sun` / `.is-sat` — 일/토 (날짜 숫자 빨강)

**3개 초과 시 더보기 표시:**
```html
<div class="cal-cell">
  <div class="date-num">27</div>
  <div class="meeting-pill ch-purchase"><span class="pill-time">09:00</span>A업체</div>
  <div class="meeting-pill ch-direct"><span class="pill-time">11:00</span>B업체</div>
  <div class="meeting-pill ch-banner"><span class="pill-time">13:00</span>C업체</div>
  <div class="meeting-more">+2</div>
</div>
```

**셀에 표시할 미팅 필터링 규칙** ⚠️:
- 표시 대상: `예약`, `계약`, `완료` (3가지)
- 표시 제외: `변경`, `취소` (2가지)
- 이유: 셀 공간이 좁아 활성 미팅만 우선. 변경/취소 이력은 셀 클릭 → 하단 미팅 요약 카드에서 확인

**CSS 정의:**
```css
.cal-cell {
  aspect-ratio: 1 / 1.7;
  display: flex; flex-direction: column;
  align-items: center; justify-content: flex-start;
  padding: 4px 2px 3px;
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
  transition: all 0.15s;
  position: relative;
  overflow: hidden;
}
.cal-cell:active { transform: scale(0.96); }
.cal-cell.other-month { cursor: default; pointer-events: none; opacity: 0.35; }
.cal-cell.disabled { cursor: not-allowed; background: #f9fafb; }
.cal-cell.disabled:active { transform: none; }

.date-num {
  font-size: 12px; font-weight: 600;
  width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  color: #374151;
  flex-shrink: 0;
}
.cal-cell.is-sun .date-num,
.cal-cell.is-sat .date-num { color: #ef4444; }
.cal-cell.disabled .date-num,
.cal-cell.other-month .date-num { color: #d1d5db; }

.cal-cell.is-today .date-num {
  background: #3b82f6;
  color: white;
  font-weight: 700;
  box-shadow: 0 2px 5px rgba(59, 130, 246, 0.35);
}

.cal-cell.is-selected {
  background: #eff6ff;
  outline: 2px solid #3b82f6;
  outline-offset: -2px;
}

.meeting-pill {
  font-size: 9px;
  line-height: 1.25;
  padding: 1px 3px;
  border-radius: 2px;
  margin-top: 1.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  text-align: left;
  letter-spacing: -0.2px;
}
.meeting-pill .pill-time {
  font-weight: 700;
  margin-right: 2px;
}
.meeting-pill.ch-purchase { background: #dbeafe; color: #1d4ed8; }
.meeting-pill.ch-direct   { background: #dcfce7; color: #15803d; }
.meeting-pill.ch-banner   { background: #fef3c7; color: #b45309; }
.meeting-pill.ch-referral { background: #f3e8ff; color: #7c3aed; }

.meeting-more {
  font-size: 9px;
  font-weight: 600;
  color: #6b7280;
  text-align: center;
  margin-top: 2px;
  line-height: 1.2;
  width: 100%;
}
```

**현재 사용 위치:** 캘린더 탭 월간 뷰 (calendar-monthly_3.html)

### Meeting Card ⭐
미팅 1건의 정보를 보여주는 카드. **상태별 좌측바 색**으로 5상태를 시각화.

**디자인 원칙**:
- 좌측 4px 색 바 + 카드 배경 연한 색 → 시각적으로 상태 즉시 인식
- 좌측바 색 = 상태 색 (amber/green/orange/purple/red)
- 이모지를 카드 안에 표시 (배지 대신)
- 변경/취소는 추가로 `opacity` 낮춤

#### 풀 카드 (Full Card) — 일정·계약 탭에서 사용

**예약 (기본):**
```html
<div class="card-reserved rounded-lg p-4">
  <div class="flex items-center gap-2 mb-2">
    <span class="text-base leading-none">🟡</span>
    <span class="font-bold">13:00</span>
    <span class="badge badge-banner">현수막</span>
    <span class="font-semibold ml-auto">○○부동산</span>
  </div>
  <div class="text-sm text-gray-500">📍 잠실</div>
  <div class="text-sm text-gray-600 mt-1">📝 견적서 지참</div>
</div>
```

**계약 (가장 좋은 결과):**
```html
<div class="card-contract rounded-lg p-4">
  <div class="flex items-center gap-2">
    <span class="text-base leading-none">💵</span>
    <span class="font-bold">13:00</span>
    <span class="badge badge-banner">현수막</span>
    <span class="font-semibold flex-1">○○부동산</span>
    <span class="text-sm font-bold text-green-700">300만원</span>
  </div>
</div>
```

**완료 (계약 X):**
```html
<div class="card-done rounded-lg p-4">
  <span class="text-base leading-none">🟠</span>
  <!-- ... 동일 구조 ... -->
</div>
```

**변경:**
```html
<div class="card-rescheduled rounded-lg p-4">
  <span class="text-base leading-none">📅</span>
  <!-- ... opacity 낮음 ... -->
</div>
```

**취소 (취소선 + 회색):**
```html
<div class="card-canceled rounded-lg p-4">
  <span class="text-base leading-none">🔴</span>
  <span class="canceled-text font-semibold">○○부동산</span>
</div>
```

#### 미니 카드 (Mini Card) — 캘린더 탭 하단 요약

```html
<div class="card-reserved rounded-lg px-3 py-2 flex items-center gap-2">
  <span class="shrink-0 text-base leading-none">🟡</span>
  <span class="text-xs font-bold text-gray-700 shrink-0">09:00</span>
  <span class="badge badge-purchase shrink-0">매입DB</span>
  <span class="text-xs font-semibold text-gray-900 truncate flex-1">▽▽의원</span>
  <span class="text-xs text-gray-500 truncate shrink-0 max-w-16">서초</span>
</div>
```

#### CSS 정의 (5상태 공통)
```css
.card-reserved    { background: #fffbeb; border-left: 4px solid #fbbf24; }
.card-contract    { background: #dcfce7; border-left: 4px solid #16a34a;
                    box-shadow: 0 1px 4px rgba(22, 163, 74, 0.12); }
.card-done        { background: #fff7ed; border-left: 4px solid #fb923c; }
.card-rescheduled { background: #faf5ff; border-left: 4px solid #a855f7; opacity: 0.85; }
.card-canceled    { background: #fef2f2; border-left: 4px solid #ef4444; opacity: 0.72; }

.canceled-text { text-decoration: line-through; color: #9ca3af; }
```

#### 상태별 시각 강도

| 상태 | 시각 강도 | 이유 |
|---|---|---|
| 계약 💵 | **가장 강함** (그림자 추가) | 가장 좋은 결과, 강조 |
| 예약 🟡 | 보통 | 기본 상태 |
| 완료 🟠 | 보통 | 계약 못한 결과지만 미팅은 진행됨 |
| 변경 📅 | 약함 (opacity 0.85) | 무효화된 카드 (새 카드로 대체) |
| 취소 🔴 | 가장 약함 (opacity 0.72 + 취소선) | 진행 안 됨 |

**현재 사용 위치:**
- 일정·계약 탭: 풀 카드
- 캘린더 탭 하단 요약: 미니 카드

---

## 접근성 가이드라인

### 터치 타겟
- 최소 44px × 44px 크기 보장
- 버튼 간 최소 8px 간격

### 키보드 네비게이션
```css
button:focus, input:focus, select:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}
```

### 스크린 리더 지원
```html
<button aria-label="생산 수량 증가">+</button>
<input type="number" aria-label="생산 수량" />
<div role="alert">저장 완료!</div>
```

### 색상 대비비
- 텍스트: 최소 4.5:1 (WCAG AA)
- 배지/라벨: 최소 3:1

---

💡 **컴포넌트 사용 원칙**
1. **일관성**: 같은 용도에는 같은 컴포넌트 사용
2. **접근성**: 44px 터치 타겟, 키보드 네비게이션 지원
3. **반응형**: 모바일 우선, 375px 기준 설계
4. **성능**: 애니메이션은 transform/opacity 위주로 사용
5. **상태 색상 SSOT**: 미팅 상태 5색은 [tokens.md](./tokens.md)와 1:1 일치

---

## 변경 이력

| 날짜 | 변경 내용 | 출처 |
|---|---|---|
| 2026-04-27 (v2) | §5 Bottom Navigation: 4탭 이모지 → **5탭 SVG** (캘린더 탭 신설) | calendar-monthly_3.html |
| 2026-04-27 (v2) | §4 Badges: 상태 배지 3종 → **5종** | data-model.md |
| 2026-04-27 (v2) | §7 Calendar Cell: 점 표시 → **시간+업체명 박스**, 1:1 → 1:1.7 | calendar-monthly_3.html |
| 2026-04-27 (v2) | §7 Meeting Card: 단순 카드 → **5상태 좌측바 + 이모지** 패턴 | calendar-monthly_3.html, schedule-weekly_5.html |
| **2026-04-27 (v3)** | §2 **Date Input**: native input → **커스텀 박스 + 0×0 hidden native + showPicker()** 패턴 (한국어 요일 표시 위해) | 클로드코드 검증 #3 |
| **2026-04-27 (v3)** | §2 **Time Input**: `<input type="time">` → **시 select + 분 select** 분리 (iOS Safari step 무시 회피, 15분 단위 강제) | 클로드코드 검증 #4 |
| **2026-04-27 (v3)** | §6 Toast 위치 정정: 상단(top: 20px) → **하단(bottom: 80px)** | 시안과 일치 |
| **2026-04-27 (v3)** | Number Input(Stepper) 사용 위치 라벨 정정: "신규명함/팔로업" → "유입/컨택진행/컨택성공" | 클로드코드 검증 #1 |
