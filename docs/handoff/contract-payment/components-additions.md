# 계약수납 탭 신규 컴포넌트 (components.md에 추가)

> **추가 위치**: `components.md` 끝 부분 또는 적절한 섹션에 병합
> **출처**: prototype `contract-payment-v9.html`
> **작성일**: 2026-05-04

---

## A. 페이지 골격

### A1. SlimBrandBar (슬림 브랜드 바)
모든 탭 공통 헤더. 높이 `h-12` (48px), `sticky top-0`.

**구조:**
- 좌측: 빨강 $ 로고 (32×32 PNG, base64 인라인) + "세일즈PT 경영일지"
- 우측: 기수 + 사용자명 (예: "5기 이수강")

**구현 예시:**
```html
<header class="bg-white border-b border-gray-100 h-12 sticky top-0 z-50 flex items-center justify-between px-4">
  <div class="flex items-center gap-2">
    <img src="data:image/png;base64,..." alt="SalesPT" class="w-8 h-8 object-contain" />
    <span class="font-semibold text-gray-900 text-sm">세일즈PT 경영일지</span>
  </div>
  <div class="flex items-center gap-1.5">
    <span class="text-xs text-gray-500">5기</span>
    <span class="text-sm font-medium text-gray-800">이수강</span>
  </div>
</header>
```

**현재 사용 위치**: 모든 5개 탭 (컨택관리/일정·계약/캘린더/수납/DB관리)
**브랜드 빨강 한정 영역**: 헤더의 로고 PNG에만. 본문에는 빨강을 비용/오류/삭제 신호로만 사용.

### A2. PageBanner (페이지 배너)
탭별 정체성을 보여주는 보조 헤더. 높이 `h-12`, `sticky top-12`.

**구조:**
- 좌측: `w-1 h-5 bg-slate-500` 액센트 바 + 이모지 + 탭명
- 우측 (선택): 시트 탭명 메타 정보

**구현 예시:**
```html
<div class="bg-slate-100 border-b border-slate-200 h-12 sticky top-12 z-40 flex items-center gap-3 px-4">
  <div class="w-1 h-5 bg-slate-500 rounded-full"></div>
  <div class="flex items-center gap-2">
    <span class="text-base">💰</span>
    <span class="font-semibold text-slate-700">계약수납</span>
  </div>
  <span class="ml-auto text-xs text-slate-500">02 계약수납관리</span>
</div>
```

**탭별 이모지**: 컨택관리=📋, 일정·계약=📝, 캘린더=📆, 계약수납=💰, DB관리=📊
**색상 정책**: 5탭 모두 slate 톤 통일 (이모지로 구분)

---

## B. 계약수납 전용 컴포넌트

### B1. SummaryCard (상단 요약 카드)
화면 최상단의 3분할 요약 카드 + 누적 표시.

**구조:**
- 3분할 (비율 25% : 45% : 30%): 계약(건) / 총매출(₩) / 수납 진척(%)
- 하단 구분선 + 누적 수납/승인 (₩)
- 총매출 = 수임비 + 수수료 합산
- 수납 진척% 색: 0%=gray-400 / 진행중=blue-600 / 100%+=green-600
- 비율은 inline style `grid-template-columns: 2.5fr 4.5fr 3fr` (Tailwind arbitrary value 금지 정책 준수)

**구현 예시:**
```html
<div class="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100">
  <div class="grid gap-3 text-center" style="grid-template-columns: 2.5fr 4.5fr 3fr;">
    <div>
      <div class="text-xs text-gray-500 mb-1">계약</div>
      <div class="text-xl font-bold text-gray-900">3<span class="text-sm font-medium text-gray-500">건</span></div>
    </div>
    <div class="border-x border-gray-100">
      <div class="text-xs text-gray-500 mb-1">총매출</div>
      <div class="text-xl font-bold text-gray-900">₩11,000,000</div>
      <div class="text-xs text-gray-400 mt-0.5">수임비 + 수수료</div>
    </div>
    <div>
      <div class="text-xs text-gray-500 mb-1">수납 진척</div>
      <div class="text-xl font-bold text-blue-600">73%</div>
    </div>
  </div>
  <div class="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
    <span class="text-gray-500">누적 수납 / 승인</span>
    <span class="text-gray-700 font-medium">₩2,000,000 / ₩3,000,000</span>
  </div>
</div>
```

### B2. AutoAddNotice (자동 추가 안내 카드)
일정·계약 탭에서 계약 처리 시 자동 row 추가됨을 안내.

```html
<div class="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-3 flex items-start gap-2">
  <span class="text-blue-500 text-base flex-shrink-0 leading-none mt-0.5">💡</span>
  <p class="text-xs text-blue-700 leading-relaxed">
    <strong>일정·계약</strong> 탭에서 미팅을 <strong class="text-blue-800">💵 계약</strong> 처리하면 자동 추가됩니다.
  </p>
</div>
```

### B3. ContractRowCard (계약 row 카드)
계약 1건 = 1카드. 접힘/펼침 토글.

**상태:**
- 접힘: 헤더만 (번호 + 업체명 + 계약일·매출 + 📋 N/7 + 💰 N% + 펼침 화살표)
- 펼침: 본문 (업체정보 + 서류진행 + 수납현황 + 액션)

**좌측 보더 색상 (활성 슬롯 따라감):**
| 상황 | 보더 |
|---|---|
| 7체크 + 모든 슬롯 100% (완료) | `border-l-4 border-l-green-500` |
| 진행도 > 0인 마지막 슬롯이 1 | `border-l-4 border-l-teal-500` |
| 진행도 > 0인 마지막 슬롯이 2 | `border-l-4 border-l-cyan-500` |
| 진행도 > 0인 마지막 슬롯이 3 | `border-l-4 border-l-fuchsia-500` |
| 모든 슬롯 0% (시작 전) | (없음) |

**Tailwind safelist 필요**: `border-l-4`, `border-l-green-500`, `border-l-teal-500`, `border-l-cyan-500`, `border-l-fuchsia-500`

**활성 슬롯 정의**: 진행도 > 0인 슬롯 중 가장 인덱스가 높은 슬롯.

### B4. CompanyInfoBlock (업체정보 — 양방향 동기화)
일정·계약 탭과 양방향 동기화되는 4필드 영역.

**필드**: 계약일(date) / 업체명(text) / 수임비(원, 콤마) / 수수료(원, 콤마)

**시각**: `bg-blue-50 border-blue-100` (파란 톤)으로 동기화 영역임을 시각화

```html
<div class="bg-blue-50 rounded-lg px-3 py-2.5 border border-blue-100">
  <div class="flex items-center gap-1 mb-2 text-xs text-blue-700">
    <span class="font-medium">🏢 업체정보</span>
  </div>
  <div class="grid grid-cols-2 gap-2">
    <!-- 4개 입력 필드 (.field-input.sync-input 클래스) -->
  </div>
</div>
```

**CSS:**
```css
.sync-input { background: white; border-color: #bfdbfe; }
.sync-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
```

**동작**: 입력 시 `PATCH /api/contract/:id` (가칭) 호출하여 일정·계약 탭(업체관리 시트)과 동기화.

### B5. DocChecklistGrid (서류 7체크 그리드)
계약 후 7가지 서류 진행 체크박스. 2열 그리드.

**7개 서류** (시트 컬럼 F~L 순서):
1. 공동인증서 (F)
2. 임대차계약서 (G)
3. 신분증 (H)
4. 드라이브 업로드 (I)
5. 사업계획서 초안 (J)
6. 컨설팅 5종 발송 (K)
7. 플러그 이관 (L)

**터치 영역**: 각 체크박스 `min-height: 44px` (모바일 접근성)

```html
<button data-doc="certauth" onclick="toggleDoc(...)" 
        class="flex items-center gap-1.5 px-2 py-2 rounded-lg border border-blue-500 bg-blue-50 text-left transition-colors" 
        style="min-height:44px;">
  <div class="w-5 h-5 rounded border-2 border-blue-500 bg-blue-500 flex items-center justify-center flex-shrink-0">
    <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
    </svg>
  </div>
  <span class="text-xs leading-tight text-blue-700 font-medium">공동인증서</span>
</button>
```

### B6. PaymentSlot (수납 슬롯)
1개의 수납 회차 = 1 슬롯. 슬롯별 색상 차등.

**슬롯 색상 시스템 (1<2<3 점점 강렬):**
| 슬롯 | hue | chip (저진행) | chip (100%) | 진행바 (저/중/고) |
|---|---|---|---|---|
| 수납 1 | teal | bg-teal-100 text-teal-700 | bg-teal-600 text-white | bg-teal-300/500/700 |
| 수납 2 | cyan | bg-cyan-100 text-cyan-700 | bg-cyan-600 text-white | bg-cyan-300/500/700 |
| 수납 3 | fuchsia | bg-fuchsia-100 text-fuchsia-700 | bg-fuchsia-600 text-white | bg-fuchsia-300/500/700 |

**구조:**
- 헤더: 번호 chip + "수납 N" + (i>0이면) ✕ 제거 버튼
- VolumeBar (B7)
- 5필드: 진행기관(text) / 현황(text, 진행도 설명) / 승인금액(원, 콤마) / 수납액(원, 콤마) / 수납일(date)

**중요**: 채널 4색(blue/green/amber/purple)과 의도적으로 충돌 없음. 비용 red와도 구분됨.

### B7. VolumeBar (진행도 바)
0/20/40/60/80/100% 6단계 선택 가능한 가로 채움 바.

**디자인:**
- 단일 연속 바 (회색 배경 + 활성 색이 width: pct%로 좌→우 채움)
- 클릭 영역만 5등분 (투명 버튼, 각 영역 = 20%)
- 같은 % 다시 누르면 0%로 토글
- 색 강도: 0%=gray-300 / 20-40%=family-300 / 60-80%=family-500 / 100%=family-700
- 트랜지션: `width 0.3s ease-out, background-color 0.2s`

**시트 연동**: 각 슬롯의 진행률은 시트 드롭박스 컬럼에 저장 (`02 계약수납관리`!N/T/Z — Claude Code 검증 필요).

```html
<div data-role="volume-bar">
  <div class="flex items-center justify-between mb-1.5">
    <span class="text-xs text-gray-500">진행도</span>
    <span class="text-xs font-semibold text-blue-600">60%</span>
  </div>
  <div class="relative h-3 bg-gray-200 rounded-full overflow-hidden">
    <div class="absolute inset-y-0 left-0 bg-cyan-500 rounded-full" 
         style="width: 60%; transition: width 0.3s ease-out, background-color 0.2s;"></div>
    <div class="absolute inset-0 flex">
      <button class="flex-1 hover:bg-white/30 transition-colors" aria-label="20%"></button>
      <!-- ×4 더 -->
    </div>
  </div>
  <div class="flex justify-between mt-1 text-gray-400 px-0.5" style="font-size:10px;">
    <span>0</span><span>20</span><span>40</span><span>60</span><span>80</span><span>100</span>
  </div>
</div>
```

### B8. AddSlotButton (수납 추가 버튼)
점선 outline 스타일의 추가 버튼.

```css
.add-slot-btn {
  width: 100%; min-height: 44px; padding: 10px;
  border: 1.5px dashed #cbd5e1; border-radius: 10px;
  color: #64748b; font-size: 13px; font-weight: 500;
  background: transparent; transition: all 0.15s;
  display: flex; align-items: center; justify-content: center; gap: 6px;
}
.add-slot-btn:hover { border-color: #94a3b8; color: #475569; background: #f8fafc; }
```

**표시 조건**: visiblePayments < 3일 때만 노출. 클릭 시 visiblePayments += 1.

### B9. MoneyInput (천 단위 콤마 자동 입력)
금액 입력 전용 input. 4곳에서 사용 (수임비/수수료/승인/수납).

**핵심 동작:**
- `type="text" inputmode="numeric"` (모바일 숫자 키패드 + 콤마 표시 가능)
- value는 콤마 포함 문자열로 표시 (`5,000,000`)
- store에는 순수 숫자로 저장 (`5000000`)
- 입력 시마다 콤마 재계산 + 커서 위치 보정

**구현**: `formatComma(n)` 헬퍼 + `handleMoneyInput(input, kind, id, ...)` 핸들러

```js
function formatComma(n) {
  if (!n) return '';
  return Number(n).toLocaleString('en-US');
}

function handleMoneyInput(input, kind, id, slotIdxOrField, fieldOrNull) {
  const oldVal = input.value;
  const cursorPos = input.selectionStart || 0;
  const digits = oldVal.replace(/[^\d]/g, '');
  const num = digits ? parseInt(digits, 10) : 0;
  const newVal = num ? num.toLocaleString('en-US') : '';
  input.value = newVal;
  // 커서 보정
  const oldCommas = (oldVal.slice(0, cursorPos).match(/,/g) || []).length;
  const newCommas = (newVal.slice(0, cursorPos).match(/,/g) || []).length;
  const newPos = Math.max(0, Math.min(newVal.length, cursorPos + (newCommas - oldCommas)));
  try { input.setSelectionRange(newPos, newPos); } catch(e) {}
  // store 갱신 + 부분 업데이트 (kind에 따라 분기)
  // ...
}
```

**HTML:**
```html
<input type="text" inputmode="numeric" 
       value="5,000,000"
       oninput="handleMoneyInput(this, 'sync', 1, 'fee')"
       class="field-input" placeholder="5,000,000">
```

**React 포팅 권장**: controlled component + `useMoneyInput` 커스텀 훅으로 추상화.

### B10. ConfirmModal (iframe-safe 삭제 확인 모달)
`window.confirm` 대신 사용하는 커스텀 모달. iframe(artifact preview)에서 동작.

```html
<div id="confirmModal" class="modal-overlay">
  <div class="bg-white rounded-xl max-w-sm w-full overflow-hidden shadow-2xl">
    <div class="p-5">
      <div class="flex items-center gap-2 mb-3">
        <span class="text-xl">🗑</span>
        <h3 class="font-semibold text-gray-900 text-base">계약 행을 삭제할까요?</h3>
      </div>
      <p class="text-sm text-gray-600 leading-relaxed">
        <strong>업체명</strong> 계약과 연결된 서류 7건·수납 슬롯이 모두 삭제됩니다.
        <span class="text-red-600">되돌릴 수 없습니다.</span>
      </p>
    </div>
    <div class="flex border-t border-gray-100">
      <button onclick="closeConfirm()" class="flex-1 h-12 text-gray-600 font-medium hover:bg-gray-50">취소</button>
      <button onclick="confirmDelete()" class="flex-1 h-12 text-red-600 font-semibold border-l border-gray-100 hover:bg-red-50">삭제</button>
    </div>
  </div>
</div>
```

**CSS:**
```css
.modal-overlay { 
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: none; z-index: 100;
  align-items: center; justify-content: center; padding: 16px;
}
.modal-overlay.open { display: flex; animation: fadeIn 0.15s ease; }
```

---

## C. 디자인 패턴 (참고)

### 부분 업데이트 패턴 (입력 중 IME 보호)
입력 input의 DOM을 교체하지 않고, 화면 다른 부분만 갱신하는 패턴.

**원칙:**
1. 입력 중에는 store만 갱신
2. 요약 카드, 카드 헤더 배지, 합계 텍스트만 부분 업데이트 (`patchXxx()` 함수들)
3. 구조 변경(추가/삭제/토글)에서만 풀 리렌더(`renderAll()`)

**해결하는 문제:**
- 한글 IME 조합 깨짐 방지
- input 포커스/커서 위치 보존

**React 포팅에서는**: controlled component로 자연 해결되므로 이 패턴 불필요.

### 색상 정책 요약
| 영역 | 색상 |
|---|---|
| 브랜드 빨강 (#d71617) | 헤더 로고 PNG에만 |
| 본문 빨강 | 비용/오류/삭제 신호 (cost-red) |
| 슬롯 색상 1/2/3 | teal/cyan/fuchsia (채널 4색과 충돌 없음) |
| 카드 좌측 보더 | 활성 슬롯 색 (또는 완료=green) |
| 동기화 영역 | 파란 톤 (`bg-blue-50 border-blue-100`) |
| 안내 카드 | 파란 톤 (정보) |

---

## D. 신규 컴포넌트 의존 그래프

```
SlimBrandBar (A1) — 모든 페이지 공통
PageBanner (A2) — 모든 페이지 공통

계약수납 페이지 (이 탭 전용):
  SummaryCard (B1)
  AutoAddNotice (B2)
  ContractRowCard (B3)
    └── CompanyInfoBlock (B4)
    └── DocChecklistGrid (B5)
    └── PaymentSlot (B6) × 1~3
          └── VolumeBar (B7)
          └── MoneyInput (B9) × 2 (승인/수납)
    └── AddSlotButton (B8)
    └── MoneyInput (B9) × 2 (수임비/수수료, B4 안)
  ConfirmModal (B10) — 페이지 전역
```
