# Claude Code 핸드오프 — 계약수납 탭 (PR 3?)

> **세일즈PT 영업일지 MVP — `02 계약수납관리` 탭 구현**
> **작성일**: 2026-05-04 / claude.ai → Claude Code
> **상태**: prototype v9 확정 → React 포팅 + 시트 검증 단계

---

## 1. 요약

이 PR에서 구현할 것:
- 새 탭 **계약수납** (5탭 중 4번째, 수납 아이콘)
- 새 시트 **02 계약수납관리** (사용자가 이미 일부 시트 컬럼 작성함 — N/T/Z 진행률 드롭박스)
- 일정·계약 탭과 양방향 동기화 (계약일/업체명/수임비/수수료)

**선행 PR과의 관계**: 컨택관리 / 일정·계약 탭이 먼저 구현된 상태를 가정. `업체관리` 시트의 K(계약여부)=TRUE 트리거로 이 탭의 row가 자동 생성된다.

**의존하는 도메인 변경**:
1. **단위 정책**: 만원 → **원** (전체 시스템). 기존 SSOT의 만원 단위 명시를 모두 원으로 수정.
2. **새 시트** `02 계약수납관리` 추가
3. **새 컴포넌트 12종** (이 패키지 `components-additions.md` 참조)

---

## 2. 진행 순서

```
[1] 시트 검증     → 사용자 시트 직접 열어 컬럼 구조 확인
[2] SSOT 업데이트 → 검증 결과로 data-model.md / sheet-structure.md 확정
[3] PR 1 / 1.5 정합성 확인 → 단위 변경(만원→원) 영향 범위
[4] React 포팅   → prototype의 v9 마크업 + 부분 업데이트 패턴 → controlled
[5] API 구현     → /api/contracts CRUD + 양방향 동기화 로직
[6] 시트 수식 재설계 → 01 영업관리!Q~T 수식이 02 계약수납관리 참조하도록
[7] E2E 테스트   → prototype의 더미 시나리오 3건과 동일하게 동작 검증
```

---

## 3. ⚠️ 검증 우선 — 시트 컬럼 구조

**가장 먼저 할 일**: 사용자 시트 직접 열어 다음 확인.

시트 URL: `https://docs.google.com/spreadsheets/d/1nx1EufkFFGaf5dp-8Dp2GvX0jU_P4EUe8QEMKTPM_rY/edit?gid=1202128611`

### 검증 항목

1. **N, T, Z가 정말 진행률 드롭박스인지** (사용자 명시)
2. **드롭박스 옵션 값**: `''/20%/40%/60%/80%/100%`인지, 아니면 `완료/진행중/시작` 같은 텍스트인지
3. **수납 슬롯이 5컬럼인지 6컬럼인지** (진행률 추가됐으면 6컬럼)
4. **수수료 컬럼 위치** — 신규 컬럼인지, 어디에 있는지
5. **계약일/업체명/수임비의 자동 연동 출처** — 업체관리 시트의 어떤 컬럼에서 끌어오는지
6. **현재 시트에 입력된 데이터 단위** — 만원? 원?

### 가정과 다르면

prototype/SSOT가 가정한 컬럼 위치(`sheet-structure-additions.md`)는:
- 수납 슬롯 6컬럼 구조 (진행률/기관/현황/승인/수납/일자)
- 수납1: N~S, 수납2: T~Y, 수납3: Z~AE
- 수수료: F (E 수임비 다음)

다르면 **SSOT 문서를 먼저 수정**한 뒤 React 코드 작성. 사용자에게 확인 필요한 사항은 즉시 보고.

---

## 4. prototype 참조

`/handoff/contract-payment-v9.html` (이 패키지 동봉, 2분만에 미리보기 가능)

### 핵심 동작 시연
- **카드 1 (믿음치킨)**: 펼친 상태, 5/7 체크 + 수납1=80%/수납2=40%, **좌측 보더 cyan-500** (활성=수납2)
- **카드 2 (○○부동산)**: 접힘, 7/7 + 모든 슬롯 100%, **좌측 보더 green-500** (완료)
- **카드 3 (△△식당)**: 접힘, 0/7, **좌측 보더 없음** (시작 전)

### 인터랙션 검증 포인트
- [ ] 한글 입력(IME) 깨지지 않는지 — 업체명/기관/현황 필드에 길게 타이핑
- [ ] 금액 input 콤마 자동 표시 + 커서 위치 보존
- [ ] 진행도 바 클릭 → 슬롯 색 + 카드 좌측 보더 색 동시 변화
- [ ] 수납 추가 (+) → 슬롯 2가 cyan으로 추가, 한 번 더 → 슬롯 3 fuchsia
- [ ] 슬롯 ✕ 버튼으로 마지막 슬롯 제거
- [ ] 삭제 모달이 iframe에서도 동작 (window.confirm 사용 안 함)
- [ ] 동기화 영역(업체정보)에서 수임비 변경 → 헤더 매출 + 상단 총매출 즉시 갱신

---

## 5. 데이터 모델

`data-model-additions.md` 참조. 핵심:

```typescript
interface Contract {
  id: string;
  contractDate: string;      // ↔ 업체관리 동기화
  company: string;           // ↔ 업체관리 동기화
  fee: number;               // 원 단위, ↔ 업체관리 동기화
  commission: number;        // 원 단위 (신규 필드)
  docs: { /* 7 boolean */ };
  payments: [PaymentSlot, PaymentSlot, PaymentSlot];
  visiblePayments: 1 | 2 | 3;
}
interface PaymentSlot {
  기관: string; 진행도: 0|20|40|60|80|100; 현황: string;
  승인: number; 수납: number; 일자: string;
}
```

---

## 6. 컴포넌트 (12종)

`components-additions.md` 참조. 핵심 신규 컴포넌트:

| 카테고리 | 컴포넌트 |
|---|---|
| 페이지 골격 | SlimBrandBar, PageBanner |
| 계약수납 전용 | SummaryCard, AutoAddNotice, ContractRowCard |
| 카드 내부 | CompanyInfoBlock, DocChecklistGrid, PaymentSlot |
| 인풋/위젯 | VolumeBar, AddSlotButton, MoneyInput, ConfirmModal |

### React 포팅 시 주의사항

**MoneyInput**: prototype에서는 vanilla JS로 콤마 + 커서 보정 처리. React에서는 controlled component + `useMoneyInput` 커스텀 훅으로 추상화 권장.

```tsx
// 제안 인터페이스
function useMoneyInput(initial: number = 0) {
  const [value, setValue] = useState(initial);
  const display = formatComma(value);  // "5,000,000"
  const onChange = (e) => {
    const digits = e.target.value.replace(/[^\d]/g, '');
    setValue(digits ? parseInt(digits, 10) : 0);
  };
  return { display, onChange, value };
}
```

**부분 업데이트 패턴 불필요**: prototype에서는 IME 보호를 위해 `patchSummary/patchCardHeader/patchSlotProgress` 등으로 부분 갱신했지만, React에서는 controlled component + state 관리로 자연 해결됨. 이 패턴은 제거.

**Tailwind safelist 필요**:
```js
// tailwind.config.js
safelist: [
  // 슬롯 색상
  'bg-teal-300','bg-teal-500','bg-teal-700','bg-teal-100','bg-teal-600','text-teal-700',
  'bg-cyan-300','bg-cyan-500','bg-cyan-700','bg-cyan-100','bg-cyan-600','text-cyan-700',
  'bg-fuchsia-300','bg-fuchsia-500','bg-fuchsia-700','bg-fuchsia-100','bg-fuchsia-600','text-fuchsia-700',
  // 카드 좌측 보더
  'border-l-4','border-l-green-500','border-l-teal-500','border-l-cyan-500','border-l-fuchsia-500',
]
```

---

## 7. API 엔드포인트

```
GET    /api/contracts                          → Contract[]
PATCH  /api/contracts/:id                      → 계약 정보 수정
                                                   ↳ 업체관리 시트와 양방향 동기화
PATCH  /api/contracts/:id/progress             → 진행률 (시트 N/T/Z 드롭박스)
                                                   body: { slotIdx, value }
DELETE /api/contracts/:id                      → 계약 삭제
```

### 양방향 동기화 구현 핵심

```typescript
// PATCH /api/contracts/:id 핸들러
async function updateContract(id: string, patch: Partial<Contract>) {
  // 1. 02 계약수납관리 시트 update
  await sheets.update('02 계약수납관리', findRow(id), patch);
  
  // 2. C/D/E/F가 변경됐다면 업체관리 시트도 update
  const syncFields = ['contractDate', 'company', 'fee', 'commission'];
  if (syncFields.some(f => f in patch)) {
    const meetingRowId = await findMeetingRow(id);
    await sheets.update('업체관리', meetingRowId, {
      // contractDate → D(미팅날짜) ※ 매핑 검증 필요
      // company → G(업체명)
      // fee → L(수임비)
      // commission → 신규 컬럼? 아니면 별도 시트?
    });
  }
}
```

⚠️ **수수료(commission)의 시트 매핑 결정 필요**:
- 옵션 A: 업체관리 시트에 신규 컬럼 추가 (M)
- 옵션 B: 02 계약수납관리에만 저장 (단방향)
- 사용자 결정 필요

---

## 8. 시트 수식 재설계

### 01 영업관리!Q~T (승인/수납 집계)

기존: 다른 시트(수납관리?) 참조
변경 후: `02 계약수납관리` 참조

```
Q (승인건수) = COUNTIFS('02 계약수납관리'!N (or T or Z), "100%")
              + 일자 필터
R (수납건수) = ?  ※ 정의 명확화 필요
S (수납금액) = SUMIFS('02 계약수납관리'!R, ...) 
              + SUMIFS('02 계약수납관리'!X, ...)
              + SUMIFS('02 계약수납관리'!AD, ...)
T (수납내용) = TEXTJOIN(...)  ※ 형식 사용자 확인
```

**일자 기준 정책 결정 필요**: 수납일(S/Y/AE) vs 계약일(C). 사용자 확인 필요.

---

## 9. 단위 변경(만원 → 원)의 영향 범위

기존 SSOT가 만원이었으므로 다른 탭/컴포넌트도 영향 받음:

- [ ] 일정·계약 탭의 수임비 입력 — 원으로 통일
- [ ] 대시보드의 재무 요약 카드 — 표시 단위 통일
- [ ] 영업관리 시트의 수식 — 그대로 유지 가능 (숫자 자체만 다름)
- [ ] **마이그레이션**: 기존 시트 데이터가 만원 단위면 ×10000 일괄 변환 필요

⚠️ 사용자 결정: **시트에 이미 입력된 만원 데이터가 있는지** 확인 후 마이그레이션 여부 결정.

---

## 10. Definition of Done

- [ ] 시트 컬럼 구조 검증 완료, SSOT 문서 확정
- [ ] React 컴포넌트 12종 구현 + 단위테스트
- [ ] `/api/contracts` CRUD + 양방향 동기화 동작
- [ ] 시트 N/T/Z 드롭박스에 진행률 저장 검증
- [ ] prototype의 더미 데이터 3건 시나리오와 동일 동작
- [ ] 한글 IME 입력 검증 (업체명/기관/현황)
- [ ] MoneyInput 콤마 + 커서 보존 검증
- [ ] iframe에서도 모달 동작 (배포 환경 검증)
- [ ] 모바일 375px 폭 + 터치 타겟 44px 확인

---

## 11. 디스커버리 리포트 (Claude Code → claude.ai 회신 사항)

다음 항목은 작업 중 발견되면 즉시 보고:
1. 시트 컬럼 구조가 가정과 다른 부분
2. 드롭박스 옵션이 가정과 다른 부분
3. 수수료의 시트 매핑 (옵션 A/B 중 결정)
4. 일자 기준 정책 (수납일 vs 계약일)
5. 마이그레이션 필요 여부
6. 일정·계약 ↔ 계약수납 동기화 시 충돌 케이스

회신 형식: 디스커버리 마크다운으로 정리 → claude.ai에서 SSOT 문서 v6/v7로 업데이트 → Claude Code 재투입.

---

## 12. 첨부

이 폴더에 함께:
- `contract-payment-v9.html` — prototype (단일 HTML, Tailwind CDN, 즉시 미리보기)
- `components-additions.md` — components.md에 병합할 내용
- `data-model-additions.md` — data-model.md에 병합할 내용
- `sheet-structure-additions.md` — sheet-structure.md에 병합할 내용
- `HANDOFF.md` — 이 문서

---

## 부록: 의사결정 히스토리 (prototype v1 → v9)

| 버전 | 주요 변경 |
|---|---|
| v1 | 초기 사양 (자동연동 read-only, 분할수납 3슬롯 동시) |
| v2 | 총매출(수임비+수수료) / 양방향 동기화 / 진행도 볼륨바 / 수납1만 표시+버튼 |
| v3 | 입력 IME 버그 수정 (풀 리렌더 → 부분 업데이트) |
| v4 | 단위 만원 통일 (잠시) |
| v5 | 단위 원으로 변경 / 진행도 바 연속 채움 / 카드 보더 색=활성 슬롯 색 |
| v6 | 천 단위 콤마 / "업체정보" 헤더 / 안내문구 정리 |
| v7 | 실제 로고 적용 / 진행률 시트 연동 placeholder |
| v8 | SummaryCard 비율 1:1:1 → 2.5:4:3.5 (총매출 칸 강조) |
| v9 | SummaryCard 비율 미세 조정 → 2.5:4.5:3 (25%:45%:30%) |
