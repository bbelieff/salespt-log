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
/* 2026-06-23 모바일 360px 축소: 36/20 → 30/16 (합계 칼럼 복원에 맞춰 스테퍼 폭 양보, 탭타깃은 row py-3). */
.stepper-btn {
  width: 30px; height: 30px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: 700; cursor: pointer;
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
  width: 32px; text-align: center; font-size: 16px; font-weight: 700; /* 2026-06-23 모바일 축소 48/20→32/16 */
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

### TimePicker15 (시 select + 15분 segmented) ⭐

components/ui/TimePicker15.tsx — 일정/추가미팅 폼 공용. HH select + [00|15|30|45] 4 버튼.

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

### NEW 뱃지 (NewBadge) — 새 기능 하이라이트 ⭐

> SoR: `docs/plans/*/new-feature-highlight.md`. 활성 앵커(visible feat 중 anchor 있는 최신 1건, 상한 14일)와 `anchorKey` 가 일치할 때만 "NEW" 필 렌더. 앵커 키 SSOT = `lib/config/anchors.ts` ANCHORS(코드 상수가 정본, 미등록 키는 서버가 무시+경고 로그).

```html
<span class="ml-1 inline-flex shrink-0 items-center rounded-full bg-brand-red px-1.5 text-xs font-bold leading-tight text-white">NEW</span>
```

- **문구 "NEW" 고정** (2~3자, 모바일 잘림 없음). 색 = 기존 `bg-brand-red` 토큰.
- 래퍼 사용: `<NewBadge anchorKey="calendar.gcalCard">{children}</NewBadge>` — children 뒤 인라인 append(레이아웃 밀림 최소).
- 위치 뱃지는 활성 기간 동안 유지(개인 해제 없음). 개인 해제는 **하단 탭 점만**(localStorage `anchorSeen:{key}:{pr}`, 해당 화면 방문 시).
- **팝업/보관함 "새 기능" 뱃지**: UpdateAccordion 이 feat 포함 항목(그룹)에 `bg-red-50 text-brand-red` "새 기능" 필 + `border-red-200` 테두리 강조. fix/perf/chore 는 없음.

**현재 사용 위치:** (배치 예정) 캘린더 탭 구글 캘린더 연동 카드 — feat/gcal-connect. 팝업·보관함 뱃지는 UpdateAccordion 내장.

## 5. Navigation

### Bottom Navigation (모바일) — 4+1 (ADR-0019)

> 정본: `docs/design/prototypes/bottom-nav-4plus1.html`. 결정: [ADR-0019](../decisions/0019-bottom-nav-4plus1.md)(4+1 구조) + [ADR-0027](../decisions/0027-bottom-nav-step-indicator.md)(STEP 배지·탭별 컬러). 변경 시 새 ADR 필요.

**탭 순서 (좌→우)**: DB생산(STEP1) `›` 컨택관리(STEP2) / **[캘린더 중앙 FAB]** / 일정·계약(STEP3) `›` 실무/수납(STEP4) — 순서·라벨·아이콘 불변(ADR-0019).
- **단계 인디케이터(ADR-0027)**: 아이콘 칩 **위 STEP 배지**("STEP 1~4", `text-[9px]`). 점(dots) 폐기. 캘린더는 단계 없음(도구).
- **흐름 화살표**: STEP1·2 사이, STEP3·4 사이에만 `›`(chevron, `text-slate-300`, 좁은 고정폭, 행 높이 중앙). **캘린더 양옆엔 없음**.
- **아이콘 칩**: `h-8 w-9 rounded-lg`. 비활성=`bg-slate-200`+`text-slate-600`, 활성=탭색 채움(`bg-{tab}`)+흰 글리프+`shadow`. STEP 배지·라벨도 같은 탭색(라벨 `font-bold`). **탭색 5종 = tokens.md "탭 단계 색상"**(blue-700/emerald-600/amber-500/violet-600/rose-600).
- **중앙 캘린더 = 입체 FAB**: 흰 원(`h-[52px] w-[52px]`) + `border` + `shadow-lg` + `-mt-6`. 비활성=흰 원+`text-slate-500`, **활성=`bg-amber-500` 채움+흰 글리프**(border-amber-500).
- **양끝 여백**: 바 내부 `px-5`(20px) + `env(safe-area-inset-*)` 유지 → 아이폰 라운드 모서리 잘림 방지.
- **반응형**: 모바일 전폭(flex-1) / 넓은 화면 `max-w-bottom-nav`(480px) 중앙정렬. **탭타깃 ≥44px**(`minHeight:44`+py).
- **미저장 가드 유지**: 모든 탭/FAB 라우팅은 `useGuardedRouter().push` 경유(절대 제거 금지).
- **a11y**: 활성 탭 `aria-current="page"`, 아이콘 칩·화살표 `aria-hidden`, FAB `aria-label="캘린더"`.
- **새 기능 점(dot)**: 활성 앵커(§4 NewBadge)가 속한 탭의 아이콘 칩 우상단에 `h-2 w-2 rounded-full bg-brand-red` 점. 해당 화면 방문 시 localStorage(`anchorSeen:{key}:{pr}`)로 개인 해제 — 위치 NEW 뱃지는 유지.
- **라벨**: `DB관리 → DB생산`(사용자 노출만). 라우트 `/db`·코드 키·아이콘 SVG는 불변.
- 구현: `TabBar.tsx` 설정 기반(LEFT/RIGHT `Tab[]`{step,color} + CenterFab) + 프리미티브 `TabItem`/`CenterFab`/`FlowArrow`.

#### (legacy 참고) 기존 5탭 평면 구조 — ADR-0019로 supersede됨

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

#### 탭 아이콘 5 — DB생산 (E: 카트 + DB박스) — 라우트 `/db` 유지(라벨만 변경, ADR-0019)
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

## 8. App Shell

모든 (app) 탭(컨택관리/일정·계약/캘린더/수납/DB관리)이 공유하는 최상단 셸.

**구조 (한 컴포넌트, 2 sticky 영역)**:

```
┌─────────────────────────────────────────────────────────┐ ← TopHeader (h-12, top-0, z-50)
│ [logo] [기수 이름 대표님 · 경영일지] [D-23] [대시보드 →] │   슬림 브랜드 바
├─────────────────────────────────────────────────────────┤ ← PageBanner   (h-12, top-12, z-40)
│ ▍ 📞 컨택관리                              01 영업관리 │   페이지 식별
└─────────────────────────────────────────────────────────┘
   본문 영역 ─────────────────────────────────────────────
```

**구현 파일**:
- `components/TopHeader.tsx` — **두 sticky 영역을 한 컴포넌트로 묶음**
  (TopHeader = 슬림 브랜드 바 + PageBanner. 별도 `<PageBanner />` 컴포넌트 없음)
- `components/DDayBadge.tsx` — TopHeader 그룹 ③에서 import

**API**:
```tsx
<TopHeader pageEmoji="📞" pageTitle="컨택관리" pageSubtitle="01 영업관리" />
```

| Prop | 타입 | 필수 | 비고 |
|---|---|---|---|
| `pageEmoji` | string | ✅ | PageBanner 좌측 이모지. 탭별 고정값 (아래 표) |
| `pageTitle` | string | ✅ | PageBanner 한글 라벨 |
| `pageSubtitle` | string \| undefined | — | PageBanner 우측 회색 보조 (시트 탭 출처 등) |

**탭별 고정 props** (5개 탭 일관성):

| 페이지 | pageEmoji | pageTitle | pageSubtitle |
|---|---|---|---|
| 컨택관리 (`/contact`) | 📞 | 컨택관리 | `01 영업관리` |
| 일정·계약 (`/schedule`) | 📅 | 일정·계약 | `04 업체관리` |
| 캘린더 (`/calendar`) | 🗓️ | 캘린더 | `04 업체관리` |
| 수납 (`/payment`) | 💰 | 수납 | `02 계약수납관리` |
| DB관리 (`/db`) | 🗂️ | DB관리 | `03 DB관리` |
| 대시보드 (`/`) | 📊 | 대시보드 | `8주 누적` (Q3 A 결정 — 5탭과 동일한 TopHeader 사용. ④ 대시보드 버튼 자리만 변형 — 아래 §대시보드 변형 참조) |

### TopHeader (슬림 브랜드 바) ⭐

**용도**: 5개 탭 페이지 최상단 sticky 브랜드 바. 사용자/D-day/대시보드 진입 한 줄.

**구조** — 한 줄, `h-12` (48px), `justify-between`으로 4 그룹 균등 분할:

```
[① 로고 png]   [② {기수} {이름} 대표님 · 경영일지]   [③ DDayBadge]   [④ 대시보드 →]
```

| 그룹 | 내용 | 데이터 출처 | 비고 |
|---|---|---|---|
| ① 로고 | **`/salespt-logo.png`** (PNG, 워드마크 포함) | `public/salespt-logo.png` 정적 자산 | `h-6 sm:h-7 w-auto object-contain`. **SVG 인라인 아님 — PNG 파일**. "세일즈PT" 워드마크가 이미지에 포함되어 있어서 별도 텍스트 워드마크 추가하지 않음 |
| ② 사용자 + 라벨 | `formatDisplay(cohort, name)` + `"경영일지"` | `useMe()` ([data-model.md](../domains/data-model.md#사용자-프로필--d-day-topheader-ssot)) | 그룹 내부만 `gap-1.5` 타이트 묶음. xs(<sm)에선 `"경영일지"` 숨김(워드마크에 포함됨) |
| ③ D-day | `<DDayBadge />` | `me.graduationISO` (= `courseStartISO + 57d`, 종강총회일 = 수료일) | 아래 §DDayBadge 참고 |
| ④ 대시보드 버튼 | "대시보드 →" Link to `/` | — | 흰 배경 + **brand red #d71617** 테두리/글자, hover `bg-red-50` |

**대시보드 버튼 동작 사양**:
- 표시 위치: **모든 (app) 탭의 우상단** (5개 탭 동일 — contact/schedule/calendar/payment/db).
- 활성/비활성 상태 **없음** — 항상 동일하게 노출.
- **대시보드 페이지(`/`) 자체에서도 동일한 TopHeader 사용** — 단, ④ 대시보드 버튼은 **현 페이지 표시 라벨**(비활성 링크)로 대체 (Q3 결정 2026-05-08, 옵션 A).
- 탭 표시(active 표시)는 하단 `BottomNav`(§5)의 책임. TopHeader는 브랜드/사용자/D-day/대시보드 진입 4가지만 다룬다.

**대시보드 페이지(`/`) TopHeader 변형 (Q3 A)**:
- 슬림 바 + PageBanner 구조 그대로 (5탭과 일관성).
- ④ 자리: `<Link href="/">대시보드 →</Link>` 대신 현 페이지 라벨 또는 빈 칸:
  - 옵션 A1: 그냥 비움 (가장 단순, 시각 일관성)
  - 옵션 A2: `📊 대시보드` 텍스트만 (현재 위치 표시) — 권장
- PageBanner: `pageEmoji="📊"`, `pageTitle="대시보드"`, `pageSubtitle="8주 누적"` (prototype 기준)

**HTML/Tailwind 규격** (안정 버전, 변경 시 PR로 동시 갱신):

```tsx
<header className="sticky top-0 z-50 flex h-12 items-center justify-between gap-2 border-b border-gray-100 bg-white px-2 sm:px-3">
  {/* ① 로고 */}
  <img src="/salespt-logo.png" alt="세일즈PT"
       className="h-6 w-auto shrink-0 object-contain sm:h-7" />

  {/* ② 사용자 + 경영일지 — 한 그룹 */}
  <div className="flex min-w-0 items-center gap-1.5">
    <span className="min-w-0 truncate text-[11px] font-black text-gray-900 sm:text-sm">
      {display}  {/* "7기 김믿음 대표님" */}
    </span>
    <span className="hidden shrink-0 text-xs font-black text-gray-900 sm:inline sm:text-sm">
      경영일지
    </span>
  </div>

  {/* ③ D-day */}
  <div className="flex shrink-0">
    <DDayBadge graduationISO={me.data?.graduationISO} />
  </div>

  {/* ④ 대시보드 버튼 — 흰 배경 + 빨간 글자 */}
  <Link href="/"
        className="group inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-red bg-white px-2.5 py-1 text-[11px] font-bold text-brand-red shadow-sm transition-all hover:bg-red-50 hover:shadow-md active:scale-95 sm:px-3 sm:py-1.5 sm:text-xs">
    <span>대시보드</span>
    <svg className="h-3 w-3 transition-transform group-hover:translate-x-0.5" /* arrow */ />
  </Link>
</header>
```

**의미 그룹 간격 원칙**:
- 4 그룹은 `justify-between`으로 균등 분배(자동 여백) — `gap-2`는 최소 안전 간격.
- ② 그룹 **내부**만 `gap-1.5`로 타이트하게 묶어 한 덩어리로 보이게.
- 그룹 ↔ 그룹 사이는 `gap-1.5` 같은 작은 값으로 **추가 묶기 금지**(④가 우측 끝에 명확히 떨어져야 함).

**반응형 (display-reference-v2.html 기준)**:
- xs(<640, Galaxy 360px): "경영일지" 숨김(`hidden sm:inline`), 폰트 `text-[11px]`/`text-xs`
- sm(≥640, iPhone 12~17e): "경영일지" 표시, 폰트 `sm:text-sm`
- md+ : 동일 (여유)

**적층 (sticky)**: `top-0 z-50`. 그 아래 페이지 배너는 `top-12 z-40`. → [tokens.md §Z-Index & Sticky 적층](./tokens.md#z-index--sticky-적층).

### DDayBadge

**용도**: TopHeader ③에 들어가는 카운트다운 배지. **종강총회일 = 수료일**(`courseStart + 57일`, 토요일)까지 남은 일수.

**표시 규칙** ([data-model.md §D-day 계산 규칙](../domains/data-model.md#d-day-계산-규칙-ddaybadge) SSOT):

| 상태 | 텍스트 | 색상 | 비고 |
|---|---|---|---|
| 양수 N (남음) | `D-N` (두 자리 박스 분할: 10의 자리 / 1의 자리) | 검정 박스 / 흰 글자 | 카운트다운 강조 |
| 0 | `D-DAY` | **brand red #d71617** | 발표일 강조 |
| 음수 N (지남) | `D+\|N\|` | 회색조 | 지난 일수 |
| loading/error | `D-—` | `bg-gray-100 text-gray-400` | placeholder |

**갱신**: 30분 polling(`setInterval` 30 * 60 * 1000ms)으로 자정 넘어가는 케이스 대응.
**Hydration**: SSR mismatch 방지 위해 `today`는 `useEffect` 안에서만 계산(초기 렌더는 placeholder).

**한도**: 두 자리 박스 가정으로 99일까지. 종강총회까지 57일 기준이라 충분.

**현재 사용 위치**: TopHeader 그룹 ③ 단독.

### PageBanner (TopHeader 내부 두 번째 sticky 영역)

**용도**: 슬림 브랜드 바 바로 아래 붙어 현재 페이지가 어느 탭인지 식별. 별도 컴포넌트가 아니라
**TopHeader.tsx 내부의 두 번째 `<div sticky>`**. props는 `pageEmoji` / `pageTitle` / `pageSubtitle` (TopHeader가 전달).

**HTML/Tailwind 규격**:

```tsx
{/* 페이지 배너 — TopHeader 내부, 슬림 바 바로 아래 */}
<div className="sticky top-12 z-40 flex h-12 items-center gap-2 border-b border-slate-200 bg-slate-100 px-3 sm:gap-3 sm:px-4">
  {/* 좌측 세로 막대 */}
  <div className="h-5 w-1 shrink-0 rounded-sm bg-slate-500" />

  {/* 이모지 + 제목 */}
  <h1 className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-slate-700 sm:gap-2">
    <span className="shrink-0 text-base leading-none">{pageEmoji}</span>
    <span className="truncate">{pageTitle}</span>
  </h1>

  {/* 보조(시트 탭 출처 등, 우측 회색) */}
  {pageSubtitle && (
    <span className="ml-auto shrink-0 truncate text-[10px] text-slate-500 sm:text-xs">
      {pageSubtitle}
    </span>
  )}
</div>
```

**디자인 규격**:
- 높이: `h-12` (슬림 바와 동일). 두 영역 합쳐 96px 고정.
- 배경: `bg-slate-100` (슬림 바의 `bg-white`와 시각 구분).
- 좌측 액센트 바: `w-1 h-5 bg-slate-500` (페이지 안에 들어왔다는 시각 신호).
- 적층: `sticky top-12 z-40` (슬림 바 바로 아래, 본문 위) — [tokens.md §Z-Index & Sticky 적층](./tokens.md#z-index--sticky-적층).

---

## 9. Dashboard

대시보드 페이지(`/`) 전용 컴포넌트. 핸드오프: `docs/handoff/inbox/dashboard-2026-05-07/`.

**디렉토리 구조**:
```
app/(app)/dashboard/page.tsx                # 대시보드 메인 페이지 (TopHeader 사용 — §8 변형)
components/dashboard/
  ├── DashboardProgressBanner.tsx           # 메인 배너 (h-12 sticky top-24, 진행도 + 매출/비용)
  ├── FinanceSummaryBoxes.tsx               # 매출 / 비용 1:1 grid 박스
  ├── OperatingProfitCard.tsx               # 영업이익 카드 (좌측 border-l-4 blue-500)
  ├── FunnelChart.tsx                       # 6단계 영업퍼널 SVG (생산→유입→컨택진행→미팅예약→미팅완료→계약)
  ├── ProductivityIndicators.tsx            # 생산성 지표 4개 (indigo gradient: 입구 옅음 → 종착 진함)
  ├── WeeklyDualChart.tsx                   # 8주차 듀얼 차트 (활동량 + 영업이익, 영업이익 음수도 표시)
  └── ChannelPerformance.tsx                # 채널별 성과 (좌: 비용 도넛 / 우: DB유입 도넛 — 좌우 대칭)
```

### 9-1. DashboardProgressBanner

**용도**: 대시보드 메인 배너. PageBanner(top-12) 바로 아래 sticky.

**위치 / 적층**:
- `sticky top-24 z-30` — TopHeader(top-0) + PageBanner(top-12) + 본 배너(top-24).
- 자식 sticky 각각 금지 — TopHeader처럼 부모 묶기 패턴.
- z-index 추가 (메인 배너 = z-30): [tokens.md §Z-Index & Sticky 적층](./tokens.md#z-index--sticky-적층).

**Props**:
- `cohort: string` — `"6기"` (formatCohort 적용)
- `today: string` — MM/DD (`"5/4"`)
- `weekday: string` — 한글 한 글자 (`"월"`)
- `currentWeek: number` — 1~8
- `progressPercent: number` — `(today − N1) / 57 × 100`, 0~100
- `graduationDate: string` — `"6/6"` MM/DD (graduationISO에서 추출)
- `revenue: number` — 총매출
- `cost: number` — 총비용
- `feeIncome: number` — 수임비
- `commissionIncome: number` — 수수료

**상단 라벨 형식 (Belief 결정 2026-05-07)**:
```
현재 [today] ([요일]) · [N주차] 진행중
```
- 그룹 1 (`현재 5/4 (월)`): `text-base font-extrabold text-gray-900 tabular-nums`
- 구분자 (`·`): `text-base text-gray-300`
- 그룹 2 (`4주차 진행중`): `text-base font-extrabold text-blue-600`

**진행바 디자인**:
- 배경: `h-2 bg-gray-200 rounded-full`
- 진행: `bg-gradient-to-r from-blue-400 to-blue-600 rounded-full`
- 끝점 빛나는 SVG: 5겹 amber halo (외곽/중간/메인 dot/안쪽 빛/광택)
- 진행바 위/아래 마진: `mb-3` / 컨테이너 패딩: `pt-3 pb-2.5`

**하단 우측**: `🎓 [graduationDate] 종강총회` (= 수료일 통합 표시)

### 9-2. FinanceSummaryBoxes

**용도**: 매출/비용 1:1 grid (`grid grid-cols-2 gap-3`). 비용 박스 ₩4,800,000 짤림 방지로 1:1 (이전 3:2 폐기).

**디자인**:
- 매출 박스: `bg-white border border-gray-200` + 좌측에 `w-4 h-4 rounded-full bg-gray-200 text-gray-700` ＋ 배지
- 비용 박스: `bg-white border border-gray-200` + 좌측에 `w-4 h-4 rounded-full bg-red-100 text-red-600` − 배지

### 9-3. OperatingProfitCard

**용도**: 영업이익 (= 매출 − 비용) 단독 카드.

**디자인**:
- 좌측 `border-l-4 border-blue-500`
- 좌측에 `w-4 h-4 rounded-full bg-blue-100 text-blue-600` ＝ 배지
- 큰 영업이익 금액 (`text-2xl font-extrabold`)
- 부연: "영업이익률 N%" (소수 1자리)
- 매출/비용/영업이익 세 박스의 **+/−/= 배지 산술 흐름** 시각 통일

### 9-4. FunnelChart (6단계 영업퍼널)

**용도**: 6단계 stacked funnel SVG (4채널 × 6단계 = 24 cells stacked bar).

**SVG 좌표 (prototype 기준)**: `viewBox="0 0 358 250"`, 사다리꼴 높이 **15px** (이전 30px 폐기 — 컴팩트 + funnel 시각 균형).

**Props**:
- `stages: Array<{ name: string; total: number; channels: { 매입DB: number; 직접생산: number; 현수막: number; '콜·지·기·소': number } }>` — 6 항목

**채널 색**: tokens.md §채널별 색상 (4종 고정, blue/green/amber/purple)

**전체 전환율 표시**: 하단에 "유입 → 계약 8.2%" (= 계약 ÷ 유입). 생산 제외.

### 9-5. ProductivityIndicators

**용도**: 생산성 지표 5개 — `DB 퀄리티 / 컨택성공률 / 미팅실행률 / 미팅숙련도 / 영업생산성` (사용자 결정 2026-05-08 통일안).

**5지표 정의** ([data-model.md §생산성 지표 5개](../domains/data-model.md) SSOT):

| # | 지표 | 공식 | 의미 |
|---|---|---|---|
| 1 | DB 퀄리티 | `컨택진행 ÷ 유입` | DB가 부재/거절 없이 컨택된 비율 |
| 2 | 컨택성공률 | `미팅예약 ÷ 컨택진행` | 컨택 → 미팅예약 |
| 3 | 미팅실행률 | `미팅완료 ÷ 미팅예약` | 예약된 미팅 실제 진행 비율 (취소·변경 회피) |
| 4 | 미팅숙련도 | `계약 ÷ 미팅완료` | 진행된 미팅 중 계약 비율 (미팅완료 = 영업관리!L) |
| 5 | 영업생산성 | `계약 ÷ 컨택진행` | **종합** — 통화부터 계약까지 |

> **미팅완료 정의** = 계약+완료 (취소·변경 제외). 시트 `01 영업관리!L` 자동 수식 사용.

**그라데이션** (입구 옅음 → 종착 진함, 5단계):
- DB 퀄리티: `bg-indigo-300`
- 컨택성공률: `bg-indigo-400`
- 미팅실행률: `bg-indigo-500`
- 미팅숙련도: `bg-indigo-700`
- **영업생산성**: `bg-gradient-to-r from-indigo-500 to-purple-600` 강조 박스 + "종합" 배지

**섹션 제목 액센트 바**: `w-1 h-5 rounded-full bg-indigo-500` + `font-extrabold`

### 9-6. WeeklyDualChart (8주차 듀얼)

**용도**: 8주차 활동량 + 영업이익 LineChart.

**SVG**: `viewBox="0 0 358 200"`. 영업이익 음수(1~2주차 적자)도 빨강으로 표시.

**섹션 제목 액센트**: `w-1 h-5 rounded-full bg-slate-500` (시간 추이 톤, PageBanner와 동일).

### 9-7. ChannelPerformance

**용도**: 채널별 성과 — 좌·우 대칭 도넛 2개 (`grid-cols-2`).

**구조**:
- **좌**: 채널별 비용 도넛 (3채널 — 매입DB/직접생산/현수막, 콜·지·기·소 제외)
  - 가운데: `−총비용` (만원 단위, brand red)
  - 도넛 밑: 채널별 비용 + % 라벨 리스트
- **우**: 채널별 DB유입 도넛 (4채널 — 콜·지·기·소 포함)
  - 가운데: 총유입 건수 (blue-700)
  - 도넛 밑: 채널별 유입 + % 라벨 리스트

**SVG (각 도넛)**: `viewBox="0 0 170 160"`, `cx=85 cy=80 r=48 stroke=20`, `rotate(-90)` 12시 시작.

**섹션 제목 액센트**: `w-1 h-5 rounded-full bg-red-500`.

**Props**:
- `costBreakdown: DashboardCostBreakdown[]` — 3 (cost only)
- `matrix: DashboardChannelMatrix[]` — 4 (matrix.유입 사용)

**제거**: 콜·지·기·소 수임비 별도 박스 (사용자 결정 2026-05-08 — 빼버림).

**채널별 계약단가** (도넛 2개 아래 full-width, 사용자 결정 2026-05-08):
- 4채널 grid (`grid-cols-4 gap-2`)
- 공식: `채널 비용 ÷ 채널 계약건수` (1계약당 들어간 비용 — 낮을수록 효율적)
- 콜·지·기·소는 비용 0이라 "—" 표시 + "비용 없음" 부연
- 각 셀: 채널 색 dot + 채널명 + 단가(만원) + "비용 ÷ 건수" 보조

---

## 10. Page-Local Components (탭별 전용)

§1~§7은 재사용 가능 디자인 시스템 (HTML 예시 위주). §8/§9는 App Shell·Dashboard 페이지 셸.
**§10**은 5개 (app) 탭에서만 쓰는 React 구현 컴포넌트 등재 (page-local). 외부 디자이너가 새 화면을
만들 때 중복 생성 방지가 목적.

> 등재 정책: 파일 위치·역할·핵심 props만 1~3줄로. 자세한 디자인 토큰/JSX는 §1~§7 참조.

### 10-1. 공통 (`components/` + `components/ui/`)

| 컴포넌트 | 파일 | 역할 / Props |
|---|---|---|
| **TabBar** | `components/TabBar.tsx` | 모바일 BottomNav **4+1** (§5, ADR-0019). 좌2(DB생산·컨택)·중앙 캘린더 FAB·우2(일정·계약·실무수납). 단계 점(1~4)·중립 입체 FAB·480 캡(`max-w-bottom-nav`). 내부: TabItem/CenterFab/Dots. SVG `currentColor`. |
| **MetricStepper** | `components/ui/MetricStepper.tsx` | §2 Number Input(Stepper) 의 React 구현. Props: `value` / `onChange` / `min` / `max` / 채널 색 |
| **ChannelBadge** | `components/ui/ChannelBadge.tsx` | §4 채널 배지 4종 진입점. Props: `channel: Channel` (4종 enum) |
| **DateInputCustom** | `components/ui/DateInputCustom.tsx` | §2 Date Input — 커스텀 박스 + 숨겨진 native input |
| **TimeSelectPair** | `components/ui/TimeSelectPair.tsx` | §2 Time Input — 시·분 분리 select (15분 단위 강제) |
| **CrossTabHintModal** | `components/ui/CrossTabHintModal.tsx` | 탭 간 cascade 안내 모달 (2026-05-17 [DB-1/C-2]). Props: `open`, `title`, `body: ReactNode`, `navLabel`, `onNavigate`, `onClose`. [화면 유지 / 바로가기] 통일 패턴. |
| **LoadingOverlay** | `components/ui/LoadingOverlay.tsx` | 전역 로딩 팝업(loading-overlay/v3 글로우 링). Props: `message?`(기본 "불러오고 있어요"). 다크 글래스 카드+회전 conic 링+궤도 점+S 호흡+문구 페이드+하단 sweep. fixed z-[400] 중앙·dim, role=status, prefers-reduced-motion 정적 폴백. 스타일=globals.css `.lo-*`(tokens.md overlay 토큰). |
| **LoadingProvider** | `components/ui/LoadingProvider.tsx` | 전역 로딩 상태 + `useGlobalLoading()` 훅. providers.tsx(QueryClientProvider 안)에서 1회 마운트, 내부 `<LoadingOverlay>` 렌더. 명령형 show(문구)/hide(카운터) + `useIsMutating()>0` 자동("저장하고 있어요"). useIsFetching 은 안 검(과노출 방지). |

### 10-2. contact 탭 (`app/(app)/contact/_components/`)

| 컴포넌트 | 역할 / Props |
|---|---|
| **WeekHeader** | 컨택탭 주차 네비 (이전/다음 화살표 + 7일 그리드 + 일자 클릭 = 그 day 이동) + 선택 날짜 라벨 + **주차합계 inline** (2026-05-17, WeekFunnelBar 통합). Props: `weekIndex`, `courseStart`, `selectedDate`, `todayISO`, `countsByDay?`, `weekFunnel?: { 생산, 유입, 컨택진행, 미팅예약 }`, `onPrevWeek`, `onNextWeek`, `onSelectDay`. 날짜 라벨 옆에 `주차합계 : 생산 N · 유입 N · 컨택진행 N · 미팅예약 N` 한 줄 표시 (gray/amber/indigo/green 색 강조). 별도 funnel bar 없음. |
| **ChannelTabsAndPanel** | 4채널 전환 탭 + 패널 컨테이너. 탭 전환 시 그 채널의 4지표 폼 표시. 컨택탭 핵심 UI |
| **MeetingSlotItem** | 컨택탭 미팅 슬롯 입력 카드 (신규). Props: `slot: NewSlot` / `onSave` / `onRemove`. [등록] 시 미팅 append |
| **MeetingSlotCard** | 등록 완료 슬롯 표시 카드 (read-only). Props: `meeting: Meeting`. [삭제]는 미팅 + meetingReservation -1 |
| **MeetingPickerModal** | 미팅예약 -1 시 삭제할 미팅 선택 모달 (Phase 4). Props: `meetings` / `onPick` / `onClose`. 선택 시 cascade 삭제 |
| **MeetingSlotList** | 컨택탭 미팅 슬롯 리스트 (page.tsx 분할, 2026-06). 저장 미팅 + 미등록 신규 슬롯을 채널 순서로 렌더. Props: `slots: SlotEntry[]`, `reservationDate`, `onPatchSaved`, `onRemoveSaved`, `onChangeNew`, `onRegisterNew`, `onRemoveNew`. |
| **DirtyGuard** | **미저장 이탈 가드(전역, 2026-06-23)**. `components/DirtyGuard.tsx` — `DirtyProvider`(app/(app)/layout 에서 children+TabBar 감쌈) + 훅 `useDirtyRegister`(입력이 dirty 시 {save,discard,label} 등록)·`useGuardedNav`(인앱 이탈 래핑)·`useGuardedRouter`(TabBar 라우팅 가드)·`useSaveAllDirty`(통합 저장). dirty 면 [저장하고 이동]/[무시하고 이동]/취소 모달 + 브라우저 닫기 beforeunload. MeetingDirtyGuard 패턴의 전역 승격. |
| **MeetingDirtyGuard** | 미저장 이탈 가드 (company-info-unified-save-guard, 2026-06) — `ConfirmLeaveModal`([저장하기][무시하기]) 은 카드 접기 확인에 계속 사용. 전역 가드는 `DirtyGuard` 로 승격(미팅카드는 useDirtyRegister 등록). |
| **ContactResultModals** | 컨택탭 결과 모달 클러스터 (page.tsx 분할, 2026-06): DB불일치 안내(CrossTabHintModal) + DB일치 긍정확인 + 미팅 선택삭제(MeetingPickerModal). Props: `dbMismatch`, `onMismatchNavigate`, `onMismatchClose`, `dbMatchOk`, `onMatchOkClose`, `pickerMeetings`, `onPick`, `onPickerClose`. |
| **SaveBar** | 컨택탭 하단 고정 저장 바 (page.tsx 분할, 500줄 캡). 바 full-bleed + 버튼 6xl 정렬(PageContainer wide). Props: `pending`, `onSave`. |

### 10-3. schedule 탭 (`app/(app)/schedule/_components/`)

| 컴포넌트 | 역할 / Props |
|---|---|
| **WeekHeader** | 일정·계약 주차 네비 (컨택과 변형: 일자 클릭 = `scrollIntoView`, 주차 변경 X) |
| **SummaryBar** | 주간 5칸 카운터 (미팅총건/미팅예정/미팅완료/미팅취소/계약) + 매출 합계 배너. sticky 부모 묶기 |
| **WeekFallback** | 일정·계약 주간 로딩/에러 상태 (schedule/page.tsx 500줄 분리). Props: `state:"loading"\|"error"`, `onRetry`, `retrying`. 에러 시 "다시 시도"(refetch) 버튼 — 네트워크 단절 새로고침 없이 재요청 (2026-06 PostHog P2). |
| **DaySection** | 일별 미팅 섹션. 오늘 강조 좌측바 (`border-l-blue-500`). 토요일 좌측바 빨강 |
| **MeetingResultCard** | Full 미팅 카드 (4종 액션 버튼 — 계약/완료/변경/취소 + 기본편집). Props: `meeting` / 액션 콜백 |
| **BasicEditDetails** | 기본 정보 편집 폼 (액션 폼 5종 중 하나). 미팅 데이터 patch |
| **CancelForm** | 취소 액션 폼 — 취소 사유 입력 (`업체명, 이유` 형식) |
| **ContractForm** | 계약 액션 폼 — 수임비 + 계약조건 입력. 02 계약수납관리 row 자동 생성 트리거 |
| **DoneForm** | 완료(미팅했으나 미계약) 액션 폼 — 완료 사유 입력 |
| **RescheduleForm** | 변경(재예약) 액션 폼 — 새 미팅 row 자동 생성 + 기존 row.previousMeetingId 보존 |
| **AddMeetingForm** | 추가 미팅 폼 (2026-05-17 [2b]) — 완료/취소/계약 카드에서 같은 업체로 새 미팅. Props: `vendor`, `defaultDate`, `onConfirm(newDate, newTime)`, `onCancel`, `pending`. 채널/장소 동일, 상태=예약, previousMeetingId 없음 (독립 미팅). |

### 10-4. calendar 탭 (`app/(app)/calendar/_components/`)

| 컴포넌트 | 역할 / Props |
|---|---|
| **MonthGrid** | 월 캘린더 그리드 (날짜 셀 + 미팅 pill + 실무투두 pill). Props: `yyyyMM` / `meetingsByDate` / `todosByDate` / `selectedDate` / `onSelectDate`. 미팅=채널색, 투두=진회색+아이콘 (Scope 2) |
| **TodoTypeIcon** | 실무투두 type(기타/미팅/전화/메시지) 인라인 SVG. 캘린더 투두 pill·일자상세 "실무" 배지·범례 공용. Props: `type` / `size`. currentColor (진회색 위 흰색). |
| **GeneralEventModal** | 캘린더 일반이벤트 생성 모달 (consultation-log §4-3·4-4). Props: `defaultDate`, `onClose`, `onCreated`. 카테고리(기존/기타)·이벤트명·업체명·상세·날짜·시간 → POST /api/todos(type=일반, contractRef 빈값). 첫 추가 시 경고 모달 + "다시 보지 않기"(localStorage hideGeneralEventHint). teal(#0d9488, tokens). |
| **GcalConnectCard** | 구글 캘린더 연동 카드 (gcal-1/2b, google-calendar-sync §4-1 문구 정본). Props 없음 — /api/gcal(GET 상태·POST 설정·DELETE 해제)·/api/gcal/resync fetch. 미연결/연결됨/실패("연결이 풀렸어요") 3상태. 연결됨: 계정 표시 + 캘린더 드롭다운 + [다시 올리기](전체 재푸시) + [연결 해제]. 유형 토글 3종은 폐기(2026-07-09), 일정별 토글은 GcalItemToggle. [연결하기]→/api/gcal/auth. 금지 용어(동기화·토큰·OAuth) 화면 미노출(ADR-0028). |
| **GcalItemToggle** | 일정 항목별 구글 캘린더 담기/빼기 토글 (gcal-2b). Props: `kind`(meeting/todo)·`id`·`on`·`onChange`·`onToast`. 제어형 — 부모(캘린더 페이지)가 상태 배치조회(/api/gcal/states) 후 보유. 낙관적 갱신 → POST /api/gcal/toggle, 실패 롤백. 항목 클릭(네비)과 분리(stopPropagation). 캘린더 아이콘(담김=파랑+체크/뺌=회색). 금지 용어 미노출. |

### 10-5. db 탭 (`app/(app)/db/_components/`)

> 4채널 raw log 입력 (매입DB/직접생산/현수막/콜·지·기·소).

| 컴포넌트 | 역할 / Props |
|---|---|
| **ChannelTabs** | DB탭 4채널 전환 탭 (컨택탭과 다른 변형 — raw 모드) |
| **ConfirmModal** | 삭제 확인 모달 (raw row 삭제 시) |
| **OverallCard** | 4채널 합계 카드 (총 비용 + 채널별 분해) |
| **SummaryCard** | 채널별 요약 카드 (해당 채널의 합계·평균단가) |
| **RowList** | DB row 목록 컨테이너 |
| **RowCard** | DB raw row 표시 카드 (read-only). 클릭 시 RowForm으로 편집 |
| **RowForm** | DB raw row 입력/편집 폼 (4채널 각각 다른 필드 — DBPurchase/DBProduction/DBBanner/DBLead) |
<!-- BannerPostingLog 폐기 — ADR-0025: 현수막 게시=생산은 컨택 게시 스테퍼가 영업관리 E 소유. -->
| **DbNudgeBanner** | 미기록 넛지(C5) — 직접생산 종료일 지난 미완·비용 0 감지 배너(클라 빈도제어) |

### 10-6. payment 탭 (`app/(app)/payment/_components/`)

> 02 계약수납관리 — 1계약 = 1행, 자동연동 3 + 체크박스 7 + 분할 수납 슬롯 3.

| 컴포넌트 | 역할 / Props |
|---|---|
| **ContractRow** | 1계약 row 표시. 자동연동(C/D/E) + 체크박스 + 슬롯 3 인라인 확장. `highlight?` prop — 업체명에서 검색어 일치 부분 `<mark>`(yellow-100) 표시 (CompanySearchBar 연동). `courseStartISO?` — 이월 판정(isCarryoverContract: 계약일<시작일 OR 깃발)으로 뱃지·흐림 표시(arena-start-revenue-split). |
| **TerminationModal** | 계약해지 입력 모달 (contract-termination). 사유(필수 textarea) + 반환 라디오(없음/일부/전액 — 일부=금액 input) + 처리 라디오(해지 상태 보존/카드 숨김 soft delete). 확인 시 POST /api/contract-payment/[row]/terminate. Props: `cp: ContractPayment`, `onClose`, `onDone`. 해지 카드엔 ContractRow 가 "해지" 뱃지+사유·반환액 노출. |
| **DeleteConfirmModal** | 계약수납 삭제 확인 모달(cascade 옵션) — page.tsx 500줄 캡으로 분리(contract-termination PR), 마크업·동작 무변경. Props: `label`, `cascadeOpt`, `onCascadeChange`, `onCancel`, `onConfirm`. |
| **TerminationArchive** | 해지 보관함 (contract-termination 스펙) — 숨김(soft delete) 해지 계약을 접힌 아코디언에서 열람. 행: 업체명·해지일·사유·반환액(읽기전용). 기본 접힘, 숨김 건 0이면 미표시. Props: `contracts: ContractPayment[]`(숨김 해지만). |
| **nameHighlight** | (컴포넌트 아님·헬퍼 모듈) `renderNameWithHighlight`(업체명 검색어 `<mark>`)·`fmtMoney`·`fmtDate` — ContractRow 500줄 캡으로 분리. |
| **PriorContractSection** | 이전(아레나 시작 전) 계약업체 등록 버튼 + 알림 모달({시작일} 동적) + ContractForm(수임비·계약조건) 재사용 폼 → POST /api/contract-payment/prior(구분=이월). + 아레나/이월 매출 2카드(isCarryoverContract 로 분리 합산). Props: `contracts`, `courseStartISO`. arena-start-revenue-split §A·B. |
| **CheckboxList** | 7 체크박스 (서류 6 + 플러그 이관 1). "ㅇ" / "" 표기. Props: `value: ContractPayment` 부분 |
| **PaymentSlotForm** | 분할 수납 1 슬롯 입력 폼 (6필드: 진행기관/진행률/현황/승인금액/수납액/수납일). 슬롯 색 = teal/cyan/fuchsia |
| **LinkedFieldsEditor** | 계약 핵심필드(업체명·계약일·수임료) 표시+수정 토글(payment_contract_edit_toggle). Props: `cp: ContractPayment`. 평소 읽기전용+[✎ 수정], 클릭 시 이 카드만 편집모드(input+[저장]/[취소]+배지). 변경 없으면 시트 쓰기 0. 저장 시 연결 미팅 id(AK)로 대상 특정해 02↔04↔06 양방향 연동(업체명→02 D+04 G+06 / 계약일→02 C만, 미팅날짜·통계 불변 / 수임료→02 E+04 L). `useEditContractLinkedFields`, DirtyGuard(편집중 변경 시), 일부 시트 실패 시 시트명 안내+save throw. contract-edit-linked-fields. |
| **DriveLinkBar** | Drive 바로가기 + 플러그 바로가기 버튼. 미연결 시 재연결 폼. ADR-0007. |
| **TodoSection** | 진행 슬롯 내 ToDo 목록 + 추가 버튼 (Scope 2). (계약×기관) 단위, institutionRef=슬롯 진행기관(빈값이면 추가 비활성). Props: `contractRef/institutionRef/companyName/todos`. 완료 토글·삭제. |
| **TodoFormModal** | 실무 ToDo 생성 팝업 (Pluuug 모티브, 담당자 없음). type 4종·제목·예정일자·예정시각(시08~20/분00·30)·상세·캘린더표시 ON. Props: `contractRef/institutionRef/companyName/onClose`. |

> **분할 수납 색 매핑** (tailwind.config.ts safelist 기준):
> 진행1 = teal / 진행2 = cyan / 진행3 = fuchsia. 카드 좌측 보더로 활성 슬롯 시각 구분.

### 10-7. 인증·인트로 + 인프라 (`components/auth/` + `components/`)

| 컴포넌트 | 역할 / Props |
|---|---|
| **LoginScene** | 인트로 + Google 로그인 화면 (client component). 로고 중심 + Aurora 배경 + 글래스 도넛 + 8 Fluent 3D 이모지 (5탭 + 데코 3). v10 프로토타입 (docs/design/prototypes/login.html) → React. Props 없음. |
| **AdminUserPicker** | Admin 전용 수강생 관리 (`/admin/users`). Props: `users` (trainee + dates enriched), `reservedUsers?` (유보), `pendingUsers?` (승인 대기), `activeTrainers`, `sessionEmail`, `archivedCohorts?`, `viewOnly?`. 섹션: 승인 대기 → 활성 기수(CohortCategoryBoxes 3분류) → 보관 → 유보. 카드 액션: [승인]/[거절]/[유보]/[시트 열기]. POST /api/admin/switch · approve-trainee · reject-trainee · set-trainee-reserved · remove-trainee. |
| **CohortCategoryBoxes** | 수강생관리 activeGroups 를 상위 카테고리 3박스(수강생=blue·아레나=purple·테스트=gray)로 묶는 표시 래퍼(admin-cohort-category-boxes). Props: `activeGroups: [string,Trainee[]][]` + CohortSection 콜백(busy·nameByEmail·onPick·onReserve·onSetTeam·onReorder·onAssignTrainers·activeTrainers·linkedBySheet·viewOnly). cohortCategory(types)로 partition, 비어있는 카테고리 박스 숨김. 데이터·정렬 불변, 각 박스 안은 CohortSection 그대로. |
| **AdminUserPickerSections** | AdminUserPicker 의 CohortSection + ReservedSection + PendingTraineesSection + TraineePrepForm + parseAssigned/fmtDateYY/cohortProgress/groupByTeam 유틸 분리 (500줄 cap). Trainee/Trainer 타입 re-export. CohortSection 내부 CohortBody (팀별 그룹화 — 미배정 카드 먼저, 그 다음 팀 박스). |
| **TraineeCard** | /admin/users + /trainer 공통 수강생 카드 (CohortSection + 팀 박스 안에서 사용). Props: `u` (Trainee, optional `stats`), `archived`, `viewOnly`, `busy`, `nameByEmail`, `linkedBySheet?`, `onPick`, `onReserve`, `onSetTeam`, `trainerEmailLc?`. **유보** = admin only(`!viewOnly`), **시트/웹앱** = admin OR (trainer + 본인 담당, `parseAssigned(u.assignedTrainer).includes(trainerEmailLc)`). 인라인 팀명 input (Enter/blur 자동 저장). **Row 1.5** (2026-05-16): `u.stats` 가 있으면 `📅 예정 X · ✓ 완료 Y · 💼 계약 Z` 표시 (시트 01 영업관리!E4/E5/E6 8주 누적 — /schedule funnel 과 동일 SSOT). 500줄 cap 회피로 별도 파일. |
| **TraineeDiagnoseButton** | 개별 trainee 시트 진단/픽스 버튼 (2026-05-16). Props: `email`, `name`. admin only — TraineeCard 의 액션 row 에 표시. 클릭 → POST `/api/admin/diagnose-sheet` → modal 결과 + fixable 룰 옆 [🔧 fix] (POST `/api/admin/fix-sheet`). **누적 룰 카탈로그** (`lib/service/sheet-diagnostics.ts:RULES`) — 새 사고 발견 시 룰 추가 → 동일 패턴 자동 감지·픽스 (Hashimoto). v1 룰: `formula-needs-restore` (fixable), `metric-vs-meeting-mismatch` (detect-only), `o1-o2-validity` (detect-only). |
| **TraineePrepBulkForm** | 일괄 사전 등록 폼. `parsePrepText` 가 `세일즈PT_ N기 이름 수강생 경영일지` 헤더 + URL 페어 또는 TSV 라인 → `PrepItem[]` 파싱. POST /api/admin/bulk-add-trainee-prep. 500줄 cap 회피로 별도 파일. |
| **TrainerPlayerToggle** | 수강생출신 트레이너 [트레이너 관리]/[내 아레나 일지] 세그먼트 토글(P14). Props: `mode: "manager"\|"arena"`(현재 화면). 클릭 → POST /api/arena-self(쿠키 flag) → router.push(/dashboard 또는 /trainer)+refresh. me.ownArenaSheetId 있을 때만 TrainerCohortView·대시보드에 노출. self-view sheetId 는 서버가 이름매칭 계산(데이터 쓰기 없음). |
| **TrainerCohortView** | 트레이너 메인 (수강생 관리의 read-only 권한축소판, 2026-05-15 개편). Props: `sessionEmail`, `trainerName`, `trainees: Trainee[]`, `activeTrainers: Trainer[]`, `masterSheetUrl`, `canBackToAdmin`, `archivedCohorts?`. AdminUserPickerSections 의 `CohortSection` 을 `viewOnly + trainerEmailLc` 모드로 재사용 → 기수박스>팀박스>TraineeCard 계층 그대로. 전체 명단 표시하되 본인 담당 trainee 만 [시트]/[웹앱] 버튼 노출. 핸들·유보·팀 입력·동기화 UI 미포함. **2026-05-16**: "내 수강생만 보기" 토글 (기본 false=전체, true=본인 담당만 필터). |
| **TrainerMgmtPanel** | Admin 전용 트레이너 관리 패널 (`/admin/trainers`). Props: `sessionEmail`, `pendingTrainers`, `activeTrainers`, `trainees`. 4 섹션 (TrainerMgmtSections 분리) — pending 승인/거절, 트레이너별 다중 배정 체크박스, 수강생 명단 아코디언, 트레이너 명단 아코디언. |
| **TrainerMgmtSections** | TrainerMgmtPanel 의 SectionPending / SectionAssign / SectionTraineeList + parseAssigned, groupByCohort, PanelUser 유틸. SectionManagement 는 TrainerMgmtManagement 에서 re-export. |
| **TrainerMgmtManagement** | 관리부서 명단 섹션 (`/admin/trainers` 하단). Props: `staff`, `busy`, `onMoveToTrainer`, `onRemove`. 파일 크기 가드. |
| **LogoutButton** | NextAuth 5 `signOut()` 즉시 호출 클라이언트 버튼 (form POST 우회). Props: `className?`, `label?`. 서버 컴포넌트 페이지(/admin 등)에서 import. |
| **PendingApprovalScreen** | 승인 대기 안내 화면 (트레이너·수강생 공용). Props: `subtitle?` (역할별 안내 한 줄). 사용처: `app/page.tsx` (pending trainee), `app/trainer/page.tsx` (pending trainer), `app/(app)/layout.tsx` (직접 URL 진입 차단). 로그아웃 버튼만 노출. |
| **InstallFormulasButton** | 모든 trainee 시트의 자동 집계 수식 일괄 복원 헤더 버튼 (`/admin/users` 우측 상단). [🛠️ 수식 복원] → confirm → POST /api/admin/install-formulas-bulk. props 없음. 기존 InstallFormulasCard 가 본문 공간 차지해서 헤더로 이동 (2026-05-13). |
| **InstallFormulasByIdButton** | 레지스트리 **미등록** 시트(★ 양식 템플릿·8기 기복사본 등)에 수식 설치 (`/admin/users` 헤더). [📋 ID로 수식 설치] → 인라인 패널: ① **폴더에서 자동 찾기**(폴더 ID/URL + 제목 토큰 → POST /api/admin/discover-folder-sheets, read-only, 발견 ID 를 textarea 에 채움) ② 줄단위 시트/**폴더** URL → POST /api/admin/install-formulas-by-id (폴더 URL `/folders/{id}` 은 안의 경영일지 시트를 BFS 자동 발견·설치, 폴더ID 오인설치 방지 분기). props 없음. install-formulas-bulk 와 동일 installFormulas + §2.5 보존 가드 (2026-06, 콜지기소 계약 fix #319 템플릿/8기 전파용). |
| **MigrateCacheButton** | registry I~L 캐시 컬럼 (cohort_label/name_label/course_start_iso/graduation_iso) 일괄 backfill 헤더 버튼 (`/admin/users` 우측 상단). [🔄 동기화] → confirm → POST /api/admin/migrate-registry-cache. props 없음. 빈 캐시 row 만 시트 read → I~L stamp (멱등). PR B-3 (2026-05-13) 추가 — PR B-1 이전 row 일괄 backfill + B-2 시트 read 실패 row retry 용. |
| **BulkReserveButton** | 다수 trainee 일괄 유보 처리 헤더 버튼 (`/admin/users` 우측 상단, 2026-05-17 [A5]). [✋ 유보 처리] → 모달 (활성 trainee 체크박스 리스트) → 선택 → 확정 → 각 email 에 POST /api/admin/set-trainee-reserved 순차 호출. Props: `trainees: {email, name, cohort}[]`, `onDone`. 카드별 유보 버튼 제거 → 헤더 통합. |
| **SortableTraineeBox** | 박스(같은 cohort+team) 내 TraineeCard 들을 dnd-kit 로 묶는 어댑터. PR C-1 (2026-05-13). PR C-2 에서 generic SortableList 사용으로 리팩터 — TraineeCard 전용 props 매핑만 담당 (~40줄). Props: `members`, `onReorder?(emails)`, 그 외 BoxCommonProps. |
| **SortableList** | Generic dnd-kit wrapper (render prop). PR C-2 (2026-05-13). Props: `items: T[]`, `getId: (t) => string`, `onReorder?(ids)`, `renderItem: (t, drag) => ReactNode`, `disabled?`. DndContext + SortableContext + 3 Sensors (Pointer 5px, Touch 200ms, Keyboard). 사용처: SortableTraineeBox (/admin/users), SectionAssign (/admin/trainers). disabled / onReorder 없음 → plain 렌더 (dnd 비활성). |
| **TrainerAssignCard** | /admin/trainers SectionAssign 의 단일 트레이너 카드. 카드 헤더(이름·email·담당 N명) + [관리부서]·[퇴출] 버튼. 펼침: 기수별 수강생 다중 체크박스 (optimistic toggle) + 기수/전체 일괄. PR C-2 에서 TrainerMgmtSections.tsx 에서 분리(500줄 cap) + dragRef/dragStyle/dragAttributes/dragListeners/isDragging optional props 추가 → 좌측 [⋮⋮] 핸들 노출 시 SortableList 가 reorder. |
| **UnifiedPrepCard** | 신규 수강생 사전 등록 (단일/일괄 paste 모드 토글 통합 카드). Props: `busy`, `onSubmitSingle`, `onSubmitBulk`. 기존 BulkPrepForm + TraineePrepForm 두 카드 통합 (2026-05-13). 내부 SingleForm / BulkForm 모드 전환. parsePrepText 는 TraineePrepBulkForm 에서 import. |
| **ImpersonationBanner** | Admin 페이지 상단 impersonation 상태 표시 + 해제 버튼. Props: `impersonating: string`. 클릭 → POST /api/admin/switch `{email:null}` → router.refresh. |
| **WebviewWarning** | 카카오톡·네이버·인스타·페북 등 in-app 웹뷰 감지 시 풀스크린 오버레이 노출. Props 없음. KakaoTalk 안드로이드는 `kakaotalk://web/openExternal?url=` scheme 으로 외부 Chrome 점프, 그 외는 단계 안내 + URL 복사. Google OAuth가 webview UA를 차단(disallowed_useragent)하는 문제 우회. |
| **CohortMgmtPanel** | Admin 전용 기수 관리 (`/admin/cohorts`). Props: `sessionEmail`, `cohorts: {label, status, note, traineeCount, type?}[]`. 활성/보관 두 섹션 + 토글 버튼. 헤더에 CohortCreateModal(admin only). 표시 라벨: 아레나 "A1회" / 일반 "8기". POST /api/admin/set-cohort-status. |
| **CohortCreateModal** | Admin 전용 "기수/참가자 추가" 모달 (`/admin/cohorts` 헤더). Props 없음. 기수 토큰(8/a1) + 모드(생성=템플릿복제 / 연동=기존시트) 토글 + (생성) 템플릿/루트폴더/(아레나)명단 시트 ID + **수강시작일(선택, date)** + 참가자 줄단위 입력 → POST /api/admin/create-cohort-members → 생성/건너뜀/**대기(pending)**/실패 리포트. 수강시작일 넣으면 새 시트 O1/O2 자동 세팅(R3-5). parseCohortToken 으로 클라이언트 토큰 미리보기. |
| **ArenaCreateModal** | Admin 전용 "아레나 추가" 모달 (`/admin/cohorts` 헤더, ADR-0012). Props 없음. 시즌 번호 + (최초 1회) 템플릿/시트폴더/업체부모폴더 ID + 명단 줄단위 입력 → POST /api/admin/create-arena-members → 생성/건너뜀/실패 리포트. buildArenaSheetTitle/buildArenaCompanyFolderName 로 제목·폴더명 미리보기. 산출물: `세일즈PT_A{시즌}_0기 {이름}_대표님 경영일지` 시트 + `…_대표님 업체관리` 폴더. |
| **ArenaCaptainToggle** | Admin "아레나 관리"(`/admin/arena`)에서 참가자를 기수 회장으로 지정/해제. Props: `email`, `cohort`(정규화 `A1-1`), `initialOn`. POST /api/admin/set-arena-captain { email, cohort, on } → registry R(captain_of) 토글. 미클레임(email 없음)은 "미클레임" 배지로 비활성. role 불변(회장도 플레이어). §6/ADR-0014. |
| **ArenaCohortBoard** | Admin "아레나 관리"(`/admin/arena`) 시즌(A{n}) 컨테이너 + 기수 박스 DnD 재정렬. Props: `seasons: ArenaSeason[]`({season, cohorts:[{key,label,members:[{email,name,nameLabel,captainOf}]}]}). 시즌별 박스 안에서 SortableList(dnd-kit)로 기수 박스 드래그 정렬 — 순서 저장 안 함(클라 order state 만, 새로고침 시 시즌·기수 asc 복귀). 멤버 행은 ArenaCaptainToggle·ArenaCarryoverButton 유지. arena-admin-dnd §P6. |
| **ScoreboardRefreshButton** | 전광판(`/admin/arena/scoreboard`) 수동 새로고침. Props 없음. GET /api/admin/scoreboard?refresh=1 (revalidateTag 30분 캐시 무효화) → router.refresh(). §6. |
| **AwardPodium** | 전광판 캡쳐 탭 지표별 시상대 (arena-scoreboard-v2). Props: `metric`(라벨), `unit`, `color: "blue"\|"purple"\|"teal"\|"amber"\|"rose"`, `entries: RankingEntry[]`. 1·2·3등 큰 카드(이름 공개·큰 숫자, 1등 중앙·강조) + 4~6등 리스트. 색만 지표별로 바꿔 재사용(미팅=blue·계약=purple·매출=teal·앱사용량=amber·공유왕=rose). |
| **CohortSummaryBoard** | 전광판 메인 종합요약 보드 (arena-scoreboard-v2, 1안). Props: `cohorts: {cohort,paidMembers,total:{생산,유입,컨택,미팅,계약}}[]`, `week`. 기수별 5지표 평균을 계약 평균 desc 순위로 정렬, 1위 강조. 캡쳐 친화 고정폭·큰 숫자. |
| **ScoreboardView** | 전광판 클라이언트 뷰 (arena-scoreboard-v2). Props: `data: {byCohort, rankings, seasonWeek}`. 상단 [관리자 대시보드]/[캡쳐 모드] 토글. 대시보드=기수 평균 표+5지표 개인 랭킹 표 밀도형. 캡쳐=탭(메인 종합/미팅/계약/매출/앱사용량/공유왕), 메인=CohortSummaryBoard·지표탭=AwardPodium, 공통 헤더 "아레나 시즌1 · N주차 · {지표}왕". 탭 전환=hydration 후 useState(스트리밍 중 display:none 아님). |
| **CompanyInfoEditor** | 미팅 업체정보(04 T~AN + AQ~AS, 23필드) 드롭다운+팝업 편집 — 혼합 그리드(2026-06-11 §3-2 확정: 기본 1열 → sm 2열 short=span1/long=span2 → 2xl [업체]\|[대표자] 좌우 2단, 모달 2xl:max-w-3xl). placeholder 확정 문구, 기대출 2필드 textarea 자동높이(
 저장). Props: `value?: CompanyInfo`, `onSave(ci)`, `busy?`, `txtCompanyName?`(있으면 [📄 업체정보생성] — POST /api/company-info/export 로 O 폴더 TXT 1본 덮어쓰기 + 성공/실패 메시지·파일 링크, §3-3/ADR-0016). [업체]12+[대표자]8+커스텀(필드추가+). 사용처: schedule MeetingResultCard·contact SavedItem+NewItem(미팅예약+1 신규 슬롯 — 예약비고 자리 교체, 등록 시 04 포함)·payment(CompanyInfoContractSection 경유). consultation-log §3. |
| **CompanyInfoContractSection** | payment 계약 카드 업체정보 섹션. Props: `계약일`, `업체명`. GET /api/company-info(06 read) → CompanyInfoEditor → POST(04 원본+06 동기화 저장, saveCompanyInfoByContract). §3-1. |
| **CarryoverBadge** | 이월(arena-carryover §5) 표시. Props: `구분?`, `variant?: "badge"\|"note"`. 구분≠"이월"이면 null. badge=회색 "이월" 칩, note="아레나 점수 미포함" 한 줄. 사용처: MeetingResultCard(뱃지+흐림+note)·ContractRow(note). |
| **ArenaCarryoverButton** | admin 아레나 관리 사용자별 "↩ 이월 실행"(backfill, carryover §2-b). Props: `email`. POST /api/admin/arena-carryover — 멱등, 결과(복사/스킵/실패) inline 표시. 미클레임(email 없음)은 미노출. |
| **AnnouncementsGate** | `(app)` layout mount 시 새소식 자동 팝업 게이트 (announcement-popup §3). Props 없음. useAnnouncements(GET /api/announcements, 10분 stale) → 자동 조건: ① localStorage `lastSeenPr` < latestPr ② display_mode 충족 활성 공지(once=`noticeSeen:{id}`, daily=`noticeSeen:{id}:{YYYY-MM-DD}`, always=매번). 둘 다 아니면 안 띄움. 수동 재열람 = window `salespt:open-announcements` CustomEvent 수신(TopHeader 발신). [확인] 시 lastSeenPr 갱신 + 표시 공지 seen 마킹. |
| **NoticePopup** | 새소식 모달 (z-[300], GeneralEventModal 패턴). Props: `notices`, `updates`, `onConfirm`. 상단 공지(pinned 우선 — 서버 정렬, 📌, MD 렌더) → 구분선 → "새로워졌어요 ✨" UpdateAccordion → 하단 [확인]. 내용 없으면 "아직 새소식이 없어요". 모바일 우선(max-w-sm). |
| **UpdateAccordion** | 업데이트 묶음 아코디언 (§7-4, grouped-updates 개편). Props: `updates`(행) — groupUpdates 로 항목(그룹=1)화. 접힘=고객용 제목+메타줄(그룹 "개발 M/D~M/D · 적용 M/D"/단건 "적용 M/D"), 펼침="339·340…번째 업데이트" + [전]/[후] 뱃지 문단(`전:`/`후:` 포맷, 없으면 MarkdownView 폴백) + 그룹 내 개별 변경 보조 줄(작게, 단건 생략). 항목은 전부 동일 카드형 평면 나열(종속감 차단), 정렬=그룹 마지막 머지일 최신순 (group-render 정정 2026-06-11). 팝업·보관함 공용. |
| **UpdatesArchivePage** | `/updates` 보관함 (§7-4). visible 업데이트 전체 최신순 — 항목(그룹) 단위 더보기 페이징(GET /api/announcements/archive), 월별 구분선, 항목 형식 팝업과 동일(UpdateAccordion). 헤더 "새소식" 진입점·팝업 "지난 업데이트 모두 보기"가 연결. |
| **MarkdownView** | 공지/업데이트 MD 렌더 래퍼. Props: `markdown`. react-markdown — raw HTML 미렌더(rehype-raw 없음 = sanitize by construction) + 기본 urlTransform(javascript: 차단). 이미지 max-w-full rounded. |
| **NoticeContentView** | 공지 본문 렌더 공용 진입점 (notice-rich-editor/ADR-0017). Props: `content`. `isHtmlContent` 면 RichContentView(소독 HTML), 아니면 MarkdownView(레거시 MD 하위호환). 팝업·보관함·관리자 미리보기 공용. |
| **RichContentView** | 소독된 공지 HTML 렌더 (ADR-0017). Props: `html`. `sanitizeNoticeHtml`(DOMPurify 화이트리스트 — 태그/속성/style color·background-color 만) 후 dangerouslySetInnerHTML, `.notice-rich` 스타일. 렌더 시 한 번 더 소독(심층 방어). |
| **RichNoticeEditor** | 공지 리치 텍스트 에디터 (ADR-0017). Props: `value`(HTML), `onChange(html)`. tiptap v3 headless(@tiptap/react useEditor)+자작 툴바(굵게·기울임·밑줄·삭선·글씨색·형광펜·목록·제목·링크·이미지·서식지움·undo/redo). 이미지=POST /api/admin/notice-image. SSR 비호환 → NoticeManager 가 next/dynamic{ssr:false}+immediatelyRender:false 로 로드. |
| **NoticeManager** | admin 팝업관리(`/admin/popup`) 상단 — 공지 작성/수정 (announcement-popup §4). Props: `initialNotices`. 목록 선택→폼 로드, MD 에디터(편집/미리보기 토글 — MarkdownView 재사용), [🖼 이미지] → POST /api/admin/notice-image(Drive belie OAuth + anyoneWithLink reader) → MD 이미지 문법 자동 삽입. 노출 옵션(audience/display_mode/start/end/pinned/active) 폼 → POST /api/admin/announcements(upsert). 비활성 = active 토글 저장. |
| **UpdatesManager** | admin 팝업관리 하단 — 자동 수집 업데이트 현황 테이블 (§4). Props: `initialUpdates`. 행별 title_user 인라인 수정·milestone 입력·visible 토글 → PATCH /api/admin/announcements(pr 키, 전달 필드 셀만). 저장 시 수강생 캐시(tag "announcements") 무효화 → 팝업 목록 즉시 반영. |
| **CompanySearchBar** | payment 업체 검색 바 (목록 상단 sticky top-24·z-30, feat/payment-company-search). Props: `value`, `onChange`, `matchCount`, `total`. 돋보기 svg + input("업체명 검색") + 입력 시 X 초기화 버튼 + "N개 업체 일치" 카운트. 클라 필터 전용(부분일치 — 대소문자·공백 무시, 서버 호출·데이터 무변경). 0건 빈 상태는 page 가 렌더. |
| **PaymentSortControl** | payment 계약 카드 정렬 세그먼트(검색바 아래, payment-sort §P8). Props: `value: PaymentSortKey`, `onChange`. 4버튼 — 등록 빠른순/늦은순(계약일 asc/desc)·진행 낮은순/높은순(슬롯 진행률 평균 asc/desc). 선택=brand-red pill. 정렬 로직은 `_lib/payment-progress.sortContracts`(빈 계약일 끝·안정정렬), 진행도는 `contractProgress`(ContractRow 공유). |
| **PullToRefresh** | 모바일 당겨서 새로고침 (feat/pull-to-refresh). Props 없음 — (app) layout 마운트. 루트 최상단에서 세로 당김(임계 70px·저항 0.5) → react-query 활성 쿼리 invalidate + router.refresh(전체 리로드 아님 — 폼 값 보존). 가드: pointer:coarse+<1024 만(PC 무변화), 가로 제스처(위클리 스와이프) 세션 취소, `.fixed`(모달/시트) 내부 무시, 당김 중 preventDefault 로 iOS 고무줄 이중 동작 차단. 스피너 = brand-red 원형(당김 회전→animate-spin). |
| **Analytics** | GA4 측정 ID 주입 (PR #107). `next/script` 두 개 inject. props 없음. |
| **PersistentDetails** | `<details>` 래퍼 — 펼침/닫힘 상태를 localStorage(`salespt:admin:collapsed`)에 영구 저장. Props: `persistKey`, `defaultOpen?` (기본 true), 나머지 native `<details>` 속성 그대로. 사용처: /admin/users 의 CohortSection · 팀 박스 · ReservedSection. SSR 안전 — 첫 paint 는 defaultOpen, mount 후 useEffect 가 저장값 적용. |

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

---

## 10. 반응형 레이아웃 (Responsive Layout) — 2026-06-02 데스크탑 개선

### 브레이크포인트 (tailwind.config.ts)
모바일 우선 스케일(xs360~2xl768)에 **데스크탑 분기 2종** 추가:

| 이름 | px | 용도 |
|---|---|---|
| `pc` | 1024 | 데스크탑(노트북) 진입 — 폭 제한·중앙정렬·멀티컬럼 시작 |
| `wide` | 1280 | 와이드 데스크탑 — 추가 여백·열 확장 |

> 기존 `lg`/`xl`/`2xl` 은 **폰/태블릿**(430/480/768)이라 데스크탑엔 못 쓴다. 데스크탑 규칙은 반드시 `pc:`/`wide:` 프리픽스 사용.

### PageContainer
모든 페이지 루트를 감싸 데스크탑 폭을 제어하는 공용 컨테이너.

| prop | 값 | 중간폭(md↑) 캡 | 데스크탑(pc+) 폭 | 적용 화면 |
|---|---|---|---|---|
| `width="narrow"` | 기본 | `md:max-w-md` | `max-w-2xl` 중앙정렬 | 컨택·일정·DB·로그인·온보딩 (입력 중심) |
| `width="wide"` | — | `md:max-w-2xl` | `max-w-6xl` 중앙정렬 + 내부 멀티컬럼 | 실무수납·대시보드·관리자 (정보 중심) |
| `width="xwide"` | — | `md:max-w-2xl` | `max-w-[120rem]` 중앙정렬 (가장 넓음) | 캘린더 (월 그리드가 화면 대부분 차지) |

- 모바일에선 `w-full`(기존 레이아웃 그대로). **중간폭 캡**(dashboard-intermediate-width-cap):
  `md:max-w-*` 는 화면이 그 max-w 보다 클 때만 적용돼, 약 672~1024 구간에서 1단
  카드가 화면 전체로 늘어나지 않게 가운데 폭 제한(그 아래 폭은 풀폭 유지). `md:px-4` 여백.
- 데스크탑(pc+) 폭 제한 + `pc:px-6 wide:px-8` 좌우 여백.
- 정보 중심 화면은 PageContainer(wide) 안에서 카드 리스트를 `pc:grid pc:grid-cols-2 wide:grid-cols-3` 등으로 배치해 가로 공간 활용(세로 스크롤 압박 완화).
- 파일: `components/PageContainer.tsx`.
