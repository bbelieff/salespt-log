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

**구현 예시:**
```html
<div class="flex items-center gap-2">
  <button class="stepper-btn bg-gray-200 hover:bg-gray-300 text-gray-700">-</button>
  <input 
    type="number" 
    class="stepper-val"
    value="12"
  >
  <button class="stepper-btn bg-blue-500 hover:bg-blue-600 text-white">+</button>
</div>
```

**CSS 정의:**
```css
.stepper-val {
  width: 48px; text-align: center; font-size: 20px; font-weight: 700;
  border: none; background: transparent; cursor: pointer;
}
.stepper-val:focus {
  outline: 2px solid #3b82f6; border-radius: 8px;
  background: white; cursor: text;
}
```

**현재 사용 위치:** 생산, 유입, 컨택 수치 입력

### Date Input
날짜 선택 입력 필드.

**구현 예시:**
```html
<input 
  type="date" 
  class="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
  value="2026-04-17"
>
```

### Time Input
시간 선택 입력 필드 (15분 단위).

**구현 예시:**
```html
<input 
  type="time" 
  class="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
  value="14:30"
  step="900"
>
```

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

### Bottom Navigation (모바일)
하단 탭 네비게이션 (4개 탭).

**구현 예시:**
```html
<nav class="bottom-nav bg-white border-t border-gray-100 px-4 py-2">
  <div class="flex justify-around">
    <button class="flex flex-col items-center gap-1 py-2 text-blue-600">
      <span class="text-sm">📊</span>
      <span class="text-xs font-medium">컨택관리</span>
    </button>
    <button class="flex flex-col items-center gap-1 py-2 text-gray-400">
      <span class="text-sm">📅</span>
      <span class="text-xs">일정·계약</span>
    </button>
    <button class="flex flex-col items-center gap-1 py-2 text-gray-400">
      <span class="text-sm">💰</span>
      <span class="text-xs">수납관리</span>
    </button>
    <button class="flex flex-col items-center gap-1 py-2 text-gray-400">
      <span class="text-sm">📊</span>
      <span class="text-xs">DB관리</span>
    </button>
  </div>
</nav>
```

**CSS 정의:**
```css
.bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; z-index: 50; }
.content-area { padding-bottom: 72px; }
```

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

💡 **컴포넌트 사용 원칙**
1. **일관성**: 같은 용도에는 같은 컴포넌트 사용
2. **접근성**: 44px 터치 타겟, 키보드 네비게이션 지원
3. **반응형**: 모바일 우선, 375px 기준 설계
4. **성능**: 애니메이션은 transform/opacity 위주로 사용