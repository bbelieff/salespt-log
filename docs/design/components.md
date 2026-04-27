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

**구현 예시:**
```html
<button class="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors">
  취소
</button>
```

### Ghost Button
텍스트 링크 형태의 버튼.

**구현 예시:**
```html
<button class="px-2 py-1 text-blue-600 hover:text-blue-700 font-medium transition-colors">
  더보기...
</button>
```

### Icon Button
아이콘만 있는 버튼 (네비게이션, 설정 등).

**구현 예시:**
```html
<button class="w-11 h-11 rounded-full hover:bg-gray-100 flex items-center justify-content transition-colors">
  ⚙️
</button>
```

### Stepper Button
숫자 증감 버튼 (+/-).

**구현 예시:**
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

**현재 사용 위치:** 생산/유입/컨택/수납 수치 입력

## 2. Inputs

### Text Input
일반 텍스트 입력 필드.

**구현 예시:**
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
  이유: 좌우 +/- 버튼과 상하 화살표가 동시에 보이면 사용자 의도가 모호해지고,
  모바일에서는 상하 스피너가 터치하기 너무 작다.
- 숫자를 직접 타이핑하고 싶으면 숫자 자체를 클릭 → focus 상태에서 입력.

**구현 예시:**
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
  -moz-appearance: textfield; /* Firefox 스피너 제거 */
}
/* Chrome/Edge/Safari 스피너 제거 — 이 두 셀렉터 반드시 포함 */
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
- 키보드 방향키(↑/↓)는 브라우저가 여전히 값 증감 지원 (스피너만 시각적으로 숨김)
- 모바일에서 숫자 키패드 노출: `inputmode="numeric"` 속성 유지

**현재 사용 위치:** 컨택관리 탭(생산/유입/컨택진행/컨택성공), 수납관리 탭(승인·수납 건수)

### Date Input (커스텀 표시 박스 + native picker) ⭐
**문제**: `<input type="date">`는 표시 형식을 바꿀 수 없음 (`MM/DD/YYYY` 또는 브라우저 기본). 한국어 UX는 `2026-04-25 (목)` 형태로 요일까지 보여줘야 함.

**해법**: native input을 0×0 크기로 숨기고 커스텀 박스가 표시 담당. 박스 클릭 시 `showPicker()`로 native picker만 띄움.

**HTML 패턴:**
```html
<div class="date-display-box" onclick="openDatePicker('meeting-date-input')">
  <span class="date-text" id="date-text">2026-04-25</span>
  <span class="date-suffix" id="date-suffix">(토)</span>
  <span class="ml-auto text-gray-400">📅</span>
  <input type="date" class="date-input-hidden" id="meeting-date-input"
    value="2026-04-25" onchange="refreshDateBox(this, 'date-text', 'date-suffix')">
</div>
```

**CSS:**
```css
.date-display-box {
  position: relative; display: flex; align-items: center; gap: 4px;
  padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 8px;
  background: white; cursor: pointer; font-size: 14px; user-select: none;
}
.date-display-box:hover { border-color: #93c5fd; }
.date-display-box:focus-within {
  border-color: #3b82f6; outline: 2px solid #3b82f6; outline-offset: -2px;
}
.date-display-box .date-text { color: #1f2937; font-weight: 600; }
.date-display-box .date-text.empty { color: #9ca3af; font-weight: 400; }
.date-display-box .date-suffix { color: #4b5563; font-weight: 600; }
/* native input을 진짜로 안 보이게 */
.date-display-box .date-input-hidden {
  position: absolute; left: 0; top: 0; width: 0; height: 0;
  opacity: 0; border: 0; padding: 0; margin: 0; pointer-events: none;
}
```

**JS:**
```js
function openDatePicker(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.style.pointerEvents = 'auto';   // pointer-events 잠시 켰다가
  try {
    if (typeof input.showPicker === 'function') input.showPicker();
    else { input.focus(); input.click(); }
  } catch (e) { input.focus(); input.click(); }
  setTimeout(() => { input.style.pointerEvents = 'none'; }, 0);
}

function refreshDateBox(inputEl, textId, suffixId) {
  const DAY_KO = ['일','월','화','수','목','금','토'];
  const text = document.getElementById(textId);
  const suffix = document.getElementById(suffixId);
  const v = inputEl.value;
  if (v) {
    text.textContent = v; text.classList.remove('empty');
    const day = DAY_KO[new Date(v).getDay()];
    suffix.textContent = day ? `(${day})` : '';
  } else {
    text.textContent = '날짜 선택'; text.classList.add('empty');
    suffix.textContent = '';
  }
}
```

**브라우저 호환**: `showPicker()` Chrome 99+, Safari 16.4+, Firefox 101+. 미지원 시 `input.click()`으로 폴백.

**현재 사용 위치**: 컨택관리 탭(미팅 일정), 일정·계약 탭(일정 수정·일정 변경)

---

### Time Input (시·분 select 강제) ⭐
**문제**: `<input type="time" step="900">`은 15분 단위를 일부 모바일 브라우저(특히 iOS)가 무시하고 1분 단위 picker를 띄움.

**해법**: 시(0~23) select와 분(00·15·30·45) select 두 개로 강제 분리.

**HTML 패턴:**
```html
<div class="flex items-center gap-1">
  <select class="time-select" required onchange="updateTime('h', this.value)" aria-label="시">
    <option value="" disabled hidden>시</option>
    <option value="00">00</option><option value="01">01</option>
    <!-- ... 23까지 -->
  </select>
  <span class="text-gray-500 font-bold">:</span>
  <select class="time-select" required onchange="updateTime('m', this.value)" aria-label="분">
    <option value="" disabled hidden>분</option>
    <option value="00">00</option><option value="15">15</option>
    <option value="30">30</option><option value="45">45</option>
  </select>
</div>
```

**CSS:**
```css
.time-select {
  flex: 1; padding: 8px 4px;
  font-size: 14px; font-weight: 600;
  border: 1px solid #e5e7eb; border-radius: 8px;
  background: white; cursor: pointer;
  appearance: none; -webkit-appearance: none; -moz-appearance: none;
  text-align: center; text-align-last: center;
  min-width: 0;
}
.time-select:focus { outline: 2px solid #3b82f6; border-color: transparent; }
.time-select:invalid { color: #9ca3af; }   /* 미선택 placeholder 색 */
```

**JS (시·분 결합 로직):**
```js
function updateTime(part, value) {
  const [hh = '', mm = ''] = (slot.meetingTime || '').split(':');
  const newHH = part === 'h' ? value : hh;
  const newMM = part === 'm' ? value : mm;
  // 둘 다 입력되어야 유효 시간으로 저장
  slot.meetingTime = (newHH && newMM) ? `${newHH}:${newMM}` : '';
}
```

**대안 비교**:
- `<input type="time">`: ❌ 모바일 step 무시, 폼 일관성 깨짐
- 두 select: ✅ 모든 브라우저 동일 동작, 15분 단위 강제
- 커스텀 picker (모달 등): 과도한 구현, MVP에 불필요

**현재 사용 위치**: 컨택관리 탭 미팅 카드, 일정·계약 탭 일정 변경 폼

### Select Dropdown
드롭다운 선택 필드.

**구현 예시:**
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

**구현 예시:**
```html
<textarea 
  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
  rows="3"
  placeholder="특이사항을 입력하세요"
></textarea>
```

**현재 사용 위치:** 특이사항, 미팅 비고, 수납 비고

## 3. Cards

### Basic Card
기본 카드 컨테이너.

**구현 예시:**
```html
<div class="bg-white rounded-lg p-4 shadow-sm">
  <h3 class="font-semibold text-gray-900 mb-2">카드 제목</h3>
  <p class="text-gray-600">카드 내용</p>
</div>
```

### Highlighted Card
강조된 카드 (선택 상태, 오늘).

**구현 예시:**
```html
<div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
  <h3 class="font-semibold text-blue-900 mb-2">오늘의 기록</h3>
  <p class="text-blue-700">4월 17일 데이터</p>
</div>
```

**현재 사용 위치:** 선택된 날짜 카드, 오늘 표시

### Warning Card
주의/경고 카드.

**구현 예시:**
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

**구현 예시:**
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

### 상태 배지 (3종)

**예약 상태:**
```html
<span class="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">예약</span>
```

**완료 상태:**
```html
<span class="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">완료</span>
```

**취소 상태:**
```html
<span class="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded">취소</span>
```

**현재 사용 위치:** 미팅 상태, 주문 상태 표시

## 5. Navigation

### Bottom Navigation (모바일) ⭐ 5탭 + 의미 SVG 아이콘 고정

하단 탭 네비게이션 = **5개 고정**: 컨택관리 / 일정·계약 / 캘린더 / 수납 / DB관리.
아이콘은 **이모지 금지, SVG 고정**. 각 아이콘은 탭의 의미를 함축하므로 임의 변경 금지 (변경 시 ADR 필요).

**아이콘 의미·결정 기록:**
| 탭 | 아이콘 의미 | 디자인 출처 |
|---|---|---|
| 컨택관리 | 수화기(전화) + 우상단 캘린더 + 점 4개(채널 슬롯) — "전화로 컨택 → 일정 → 4채널 관리" | calendar-monthly v3, 후보 G/G-1/G-2 중 G-3 채택 |
| 일정·계약 | 클립보드 + 체크 — 미팅 진행/계약 처리 | Heroicons clipboard-check |
| 캘린더 | 월간 그리드 — 한 달 전체 시각화 | Heroicons calendar (filled) |
| 수납 | 코인 + $ — 수임비 입금 처리 | Heroicons currency-dollar |
| DB관리 | 카트 + 위에 DB박스 — "DB 매입(카트) + 생산(박스 채워가기)" | calendar-monthly v3, E안 채택 |

**활성 탭 색**: `text-blue-600 + font-semibold`, 비활성: `text-gray-400 hover:text-gray-600`.
**각 버튼**: `flex-1 py-2 flex flex-col items-center gap-0.5`, 아이콘 `w-5 h-5`, 라벨 `text-xs`.

**SVG 정본은 `docs/design/prototypes/calendar-monthly.html` 의 `<nav class="bottom-nav">` 영역.** 다른 시안에 옮길 때는 그 마크업을 그대로 복사. React 포팅 시 `components/TabBar.tsx` 단일 파일로 분리.

**CSS 정의:**
```css
.bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; z-index: 50; }
.content-area { padding-bottom: 76px; }   /* 5탭 높이에 맞춰 76px */
```

**원칙:**
- 5개 탭 순서·라벨·아이콘은 **고정**. 추가/제거/순서변경 = ADR 필요.
- 같은 SVG 코드를 여러 시안에 복붙해야 한다면 **이미 분리 시점**. React 포팅 시 즉시 컴포넌트화.

### Tab Navigation (채널 전환)
상단 채널 탭 (4개 채널).

**구현 예시:**
```html
<div class="flex border-b border-gray-200">
  <button class="flex-1 py-2 px-3 text-sm font-medium border-b-2 border-blue-500 text-blue-600">
    매입DB
  </button>
  <button class="flex-1 py-2 px-3 text-sm font-medium text-gray-500 hover:text-gray-700">
    직접생산
  </button>
  <button class="flex-1 py-2 px-3 text-sm font-medium text-gray-500 hover:text-gray-700">
    현수막
  </button>
  <button class="flex-1 py-2 px-3 text-sm font-medium text-gray-500 hover:text-gray-700">
    콜·지·기·소
  </button>
</div>
```

### Week Navigator
좌우 화살표 날짜 네비게이션.

**구현 예시:**
```html
<div class="flex items-center justify-between py-3">
  <button class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center">
    ◀
  </button>
  <div class="text-center">
    <div class="text-lg font-semibold">4월 17일 (수)</div>
    <div class="text-sm text-gray-500">17주차</div>
  </div>
  <button class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center">
    ▶
  </button>
</div>
```

**현재 사용 위치:** 컨택관리, 수납관리 날짜 전환

## 6. Feedback

### Toast
성공/에러 알림 메시지.

**구현 예시:**
```html
<div id="toast" class="toast">저장 완료! +45 XP</div>
```

**CSS 정의:**
```css
.toast {
  position: fixed; top: 20px; left: 50%; 
  transform: translateX(-50%) translateY(-100px);
  background: #1e293b; color: white; padding: 12px 20px;
  border-radius: 12px; font-size: 14px; z-index: 200;
  transition: transform 0.3s ease;
}
.toast.show { transform: translateX(-50%) translateY(0); }
```

**현재 사용 위치:** 저장 성공/실패 피드백

### Alert (경고)
모달형 경고 메시지.

**구현 예시:**
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

**구현 예시:**
```html
<div class="bottomsheet-overlay" onclick="closeBottomSheet()"></div>
<div class="bottomsheet">
  <div class="w-12 h-1 bg-gray-300 rounded-full mx-auto my-3"></div>
  <div class="px-4 pb-4">
    <h3 class="font-semibold text-lg mb-4">미팅 추가</h3>
    <!-- 폼 내용 -->
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

**현재 사용 위치:** 미팅 추가 폼

### Modal (중앙 모달)
화면 중앙 모달 다이얼로그.

**구현 예시:**
```html
<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
  <div class="bg-white rounded-xl max-w-md w-full max-h-screen overflow-y-auto">
    <div class="p-6">
      <h2 class="text-xl font-semibold mb-4">모달 제목</h2>
      <p class="text-gray-600 mb-6">모달 내용</p>
      <div class="flex justify-end gap-2">
        <button class="px-4 py-2 text-gray-600">취소</button>
        <button class="px-4 py-2 bg-blue-500 text-white rounded-lg">확인</button>
      </div>
    </div>
  </div>
</div>
```

## 7. Data Display

### Stat Card (지표 카드)
숫자 지표 표시 카드.

**구현 예시:**
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

**현재 사용 위치:** 대시보드 지표 카드

### Progress Bar (XP 바)
경험치/진행률 표시 바.

**구현 예시:**
```html
<div class="xp-bar">
  <div class="xp-fill" style="width: 60%"></div>
</div>
<div class="flex justify-between text-xs text-gray-500 mt-1">
  <span>1,200 XP</span>
  <span>2,000 XP</span>
</div>
```

**CSS 정의:**
```css
.xp-bar { 
  height: 8px; border-radius: 4px; background: #e2e8f0; overflow: hidden; 
}
.xp-fill { 
  height: 100%; border-radius: 4px; 
  background: linear-gradient(90deg, #3b82f6, #8b5cf6); 
  transition: width 0.8s ease; 
}
```

### Calendar Cell
캘린더 날짜 셀.

**구현 예시:**
```html
<div class="cal-cell">
  <span class="text-sm font-medium">17</span>
  <div class="flex gap-0.5 mt-1">
    <span class="dot"></span>
    <span class="dot"></span>
  </div>
</div>

<!-- 오늘 날짜 -->
<div class="cal-cell today-cell">
  <span class="text-sm font-medium">17</span>
</div>
```

**CSS 정의:**
```css
.cal-cell { 
  width: 14.28%; aspect-ratio: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; cursor: pointer;
  border-radius: 8px; font-size: 14px;
}
.cal-cell:hover { background: #f1f5f9; }
.cal-cell.today-cell { background: #3b82f6; color: white; border-radius: 50%; }
.dot { 
  width: 6px; height: 6px; border-radius: 50%; background: #3b82f6; 
  display: inline-block; margin: 0 1px; 
}
```

### Meeting Card
미팅 정보 카드.

**구현 예시:**
```html
<div class="bg-white rounded-lg p-4 border border-gray-200 mb-3">
  <div class="flex items-start justify-between mb-2">
    <div>
      <div class="font-semibold text-gray-900">ABC업체</div>
      <div class="text-sm text-gray-500">13:00 ~ 14:00</div>
    </div>
    <span class="badge badge-banner">현수막</span>
  </div>
  <div class="text-sm text-gray-600 mb-2">
    📍 서울 강남구
  </div>
  <div class="text-sm text-gray-500 mb-3">
    📝 첫 상담, 메뉴 소개 필요
  </div>
  <div class="flex items-center gap-2">
    <span class="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">예약</span>
    <button class="text-xs text-blue-600 hover:text-blue-700">수정</button>
  </div>
</div>
```

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

## 8. 미팅 카드 시스템 ⭐ (일정·계약 탭 전용)

### MeetingCard (5가지 상태)
일정·계약 탭에서 미팅 1건 = 카드 1개. 상태별 색상은 [tokens.md "미팅 카드 5가지 상태"](./tokens.md#미팅-카드-5가지-상태-색상-) 참조.

**구조:**
```html
<div class="meeting-card card-{state} rounded-xl mb-2 overflow-hidden">
  <!-- 헤더: 상태 아이콘 + 시간 + 업체 + 장소 + 수임비 + 펼침 화살표 -->
  <button class="w-full px-3 py-3 flex items-center gap-2 text-left">
    <span>🟡</span>             <!-- 상태 아이콘 -->
    <span class="font-bold">14:00</span>
    <span class="font-semibold flex-1 truncate">○○부동산</span>
    <span class="text-xs text-gray-500">잠실</span>
    <!-- 계약 상태일 때만: -->
    <span class="text-xs font-bold text-green-700">300만원</span>
    <svg class="w-4 h-4 transition-transform">⌄</svg>
  </button>
  <!-- 펼친 본문 (선택 시) -->
  <div class="expand-body border-t px-3 py-3 space-y-3">...</div>
</div>
```

**상태별 헤더 아이콘:**
| 상태 | 아이콘 | 카드 클래스 |
|---|---|---|
| 예약 | 🟡 | `card-reserved` |
| 계약 | 💵 | `card-contract` |
| 완료(계약X) | 🟠 | `card-done` |
| 변경 | 📅 | `card-rescheduled` |
| 취소 | 🔴 | `card-canceled` (제목 `line-through`) |

### MeetingCard 신규/등록완료 토글 (컨택관리 탭)
컨택관리 탭의 미팅 카드는 두 모드:

| 모드 | 상태 | UI | 액션 버튼 |
|---|---|---|---|
| 신규 | `saved=false` | 강제 펼침 + 좌측 회색 보더 | [✓ 등록] [✕ 삭제] |
| 등록완료 | `saved=true` | 한 줄 접힘 + 좌측 파란 보더 + 클릭하여 펼침 | [💾 수정 완료] [✕ 삭제] |

```js
// 신규 카드는 등록 시 검증
if (!slot.meetingDate || !slot.meetingTime || !slot.company) {
  showToast('⚠ 미팅 일정·시간·업체명은 필수입니다');
  return;
}
slot.saved = true;
```

### InlineActionForm (4가지 액션)
일정·계약 탭에서 예약 카드의 4가지 액션 (계약/완료/변경/취소). **모달 X, 카드 안 인라인 폼.**

**버튼 그리드:**
```html
<div class="grid grid-cols-2 gap-2 pt-1">
  <button onclick="setPendingAction('xxx', 'contract')"
    class="py-2.5 text-sm font-bold rounded-lg bg-green-50 text-green-700">
    💵 계약
  </button>
  <button onclick="setPendingAction('xxx', 'done')"
    class="py-2.5 text-sm font-bold rounded-lg bg-orange-50 text-orange-700">
    🟠 완료 (계약X)
  </button>
  <button onclick="setPendingAction('xxx', 'reschedule')"
    class="py-2.5 text-sm font-bold rounded-lg bg-purple-50 text-purple-700">
    📅 변경
  </button>
  <button onclick="setPendingAction('xxx', 'cancel')"
    class="py-2.5 text-sm font-bold rounded-lg bg-red-50 text-red-700">
    🔴 취소
  </button>
</div>
```

**선택된 액션의 인라인 폼:** 색상은 [tokens.md 액션 폼 강조 색상](./tokens.md#액션-폼-강조-색상-인라인-입력-폼) 참조.
- **계약**: 수임비 (만원, 필수) + 계약조건 (선택) + 확정 버튼 → 시트 `K=TRUE, L=수임비, M=계약조건`
- **완료**: 사유 (필수, M열 누적) + 확정 버튼 → `J=완료`
- **변경**: 새 날짜 + 새 시간 (필수) + 확정 버튼 → 새 카드 자동 생성, 기존은 `J=변경`
- **취소**: 사유 (필수, M열 누적) + 확정 버튼 → `J=취소`

**확정 후 동작**: `pendingAction.delete(id)` + 카드 자동 접힘 + 토스트.

### 미팅결과 누적 (시트 M열)
모든 액션의 메모는 timestamp + 태그를 prepend로 누적:
```js
function appendMeetingResult(m, tag, content) {
  const stamp = `${YYYY}-${MM}-${DD} ${hh}:${mm}`;
  const newLine = `[${tag} · ${stamp}] ${content}`;
  m.미팅결과 = m.미팅결과 ? `${newLine}\n${m.미팅결과}` : newLine;
}
```

읽기 전용 영역으로 카드 펼침에 표시 (시간순 역방향 = 최신 위).

---

## 9. 레이아웃 컴포넌트 (일정·계약 탭)

### DaySection (요일 그룹 박스)
7일을 시각적으로 묶고 그 날의 미팅 카드를 하위로 배치.

```html
<div class="day-section is-today">  <!-- is-today면 파랑 강조 -->
  <div class="day-header">
    <span>4월 23일</span>
    <span class="text-blue-700">(목)</span>
    <span class="today-badge">오늘</span>
    <span class="ml-auto text-xs">3건</span>
  </div>
  <div class="meeting-card">...</div>   <!-- 카드는 좌측 18px 들여쓰기 + 가지선 -->
</div>
```

**CSS:**
```css
.day-section {
  background: #f1f5f9; border-radius: 14px;
  padding: 12px 12px 8px; margin-bottom: 14px;
  border-left: 5px solid #cbd5e1;
}
.day-section.is-today {
  background: linear-gradient(180deg, #dbeafe 0%, #eff6ff 100%);
  border-left: 5px solid #2563eb;
  box-shadow: 0 4px 16px rgba(37, 99, 235, 0.22);
}
.day-section .meeting-card {
  margin-left: 18px;             /* 위계 들여쓰기 */
  position: relative;
}
.day-section .meeting-card::before {  /* 좌측 가지선 */
  content: ''; position: absolute;
  left: -10px; top: 50%; width: 8px;
  border-top: 2px solid rgba(0,0,0,0.10);
}
```

### SummaryBar (상단 요약 바)
주간 진척도 한눈에. 일정·계약 탭 상단 sticky 영역 아래에 배치.

```html
<div class="bg-white rounded-xl px-3 py-2.5 mb-3 shadow-sm flex items-center justify-between">
  <div class="flex items-center gap-3 text-xs">
    <span><span class="text-gray-400">전체</span> <b>8</b></span>
    <span><span class="text-blue-500">예약</span> <b class="text-blue-700">3</b></span>
    <span><span class="text-green-500">완료</span> <b class="text-green-700">2</b></span>
    <span><span class="text-red-500">취소</span> <b class="text-red-600">1</b></span>
  </div>
  <div class="text-xs flex items-center gap-1">
    <span>💵</span><b class="text-green-700">300</b><span class="text-gray-400">만원</span>
  </div>
</div>
```

---

💡 **컴포넌트 사용 원칙**
1. **일관성**: 같은 용도에는 같은 컴포넌트 사용
2. **접근성**: 44px 터치 타겟, 키보드 네비게이션 지원
3. **반응형**: 모바일 우선, 375px 기준 설계
4. **성능**: 애니메이션은 transform/opacity 위주로 사용
5. **레퍼런스**: 새 화면 디자인 전 `docs/design/prototypes/` 의 확정 시안을 먼저 확인