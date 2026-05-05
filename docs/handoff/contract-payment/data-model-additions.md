# 계약수납 데이터 모델 (data-model.md에 추가)

> **추가 위치**: `data-model.md` 도메인 모델 섹션
> **출처**: prototype `contract-payment-v9.html`
> **작성일**: 2026-05-04

---

## Contract (계약 1건 = 시트 1행)

```typescript
interface Contract {
  id: string;                // 시트 row ID (자동)
  rowNumber: number;         // 시트 B열 순번

  // 자동 연동 영역 (일정·계약 탭과 양방향 동기화)
  contractDate: string;      // YYYY-MM-DD, 시트 C열
  company: string;           // 업체명, 시트 D열
  fee: number;               // 수임비, 원 단위, 시트 E열  ※ 단위 정책 참조
  commission: number;        // 수수료, 원 단위, 시트 ?열  ※ 신규 컬럼 — 시트 검증 필요

  // 서류 진행 (7개 boolean, 시트 F~L)
  docs: {
    certauth: boolean;       // F: 공동인증서
    lease: boolean;          // G: 임대차계약서
    idcard: boolean;         // H: 신분증
    drive: boolean;          // I: 드라이브 업로드
    plan: boolean;           // J: 사업계획서 초안
    consult5: boolean;       // K: 컨설팅 5종 발송
    plug: boolean;           // L: 플러그 이관
  };

  // 분할 수납 (최대 3슬롯)
  payments: [PaymentSlot, PaymentSlot, PaymentSlot];
  visiblePayments: 1 | 2 | 3;  // UI 상 보이는 슬롯 수 (기본 1, +로 추가)
}

interface PaymentSlot {
  기관: string;       // 진행기관 (text)
  진행도: 0 | 20 | 40 | 60 | 80 | 100;  // 시트 드롭박스 (N/T/Z 가정)
  현황: string;       // 진행도 설명 텍스트 (예: "실사 진행 중")
  승인: number;       // 승인금액, 원 단위
  수납: number;       // 수납액, 원 단위
  일자: string;       // 수납일 YYYY-MM-DD
}
```

---

## 단위 정책 (확정)

**전체 시스템: 원(₩) 단위**
- 입력 (UI): 원 단위 (천 단위 콤마 표시: `5,000,000`)
- 저장 (시트): 원 단위 그대로 (예: `5000000`)
- 표시 (UI): 원 단위 + 콤마 + ₩ 기호 (`₩5,000,000`)

**기존 SSOT(만원 단위) 변경 사항**: 
- `data-model.md` line 89 `수임비: number; // 만원 (L열)` → `// 원 (E열)`
- `data-model.md` line 103 `수납금액: number; // 만원 (E열)` → `// 원`
- `sheet-structure.md` line 109, 147의 "만원 단위" 표기 → "원 단위"

⚠️ **이미 시트에 만원 단위로 입력된 데이터가 있다면**: Claude Code가 마이그레이션 스크립트로 ×10000 일괄 변환 후 진행할 것.

---

## 진척 계산 로직 (UI 전용, 시트 저장 안 함)

```typescript
// 서류 진행
function docProgress(c: Contract): { checked: number; total: 7; pct: number } {
  const checked = Object.values(c.docs).filter(Boolean).length;
  return { checked, total: 7, pct: Math.round((checked / 7) * 100) };
}

// 수납 합계 (실 금액 기준)
function payTotals(c: Contract): { approved: number; paid: number; pct: number } {
  let approved = 0, paid = 0;
  c.payments.forEach(p => {
    approved += p.승인 || 0;
    paid += p.수납 || 0;
  });
  const pct = approved > 0 ? Math.round((paid / approved) * 100) : 0;
  return { approved, paid, pct };
}

// 평균 진행도 (헤더 배지용 — 보이는 슬롯만 평균)
function avgSlotProgress(c: Contract): number {
  const visible = c.payments.slice(0, c.visiblePayments);
  if (!visible.length) return 0;
  const sum = visible.reduce((s, p) => s + (p.진행도 || 0), 0);
  return Math.round(sum / visible.length);
}

// 활성 슬롯 (카드 좌측 보더 색 결정)
function getActiveSlotIndex(c: Contract): number {
  for (let i = c.visiblePayments - 1; i >= 0; i--) {
    if ((c.payments[i].진행도 || 0) > 0) return i;
  }
  return -1;  // 시작 전
}

// 완료 판정 (좌측 보더 = green)
function isComplete(c: Contract): boolean {
  return docProgress(c).checked === 7 
    && c.visiblePayments >= 1 
    && avgSlotProgress(c) >= 100;
}
```

---

## API 엔드포인트 (제안)

```
GET    /api/contracts                          → Contract[] 전체 조회
PATCH  /api/contracts/:id                      → 계약 정보 수정 (회사정보/서류)
                                                   ↳ 일정·계약 탭(업체관리 시트)과 양방향 동기화
PATCH  /api/contracts/:id/progress             → 진행률 업데이트 (시트 N/T/Z 드롭박스)
                                                   body: { slotIdx: 0|1|2, value: '20%'|... }
DELETE /api/contracts/:id                      → 계약 삭제 (이번 탭에서만 — 일정·계약은 별도)
```

**일정·계약 ↔ 계약수납 동기화 흐름**:
```
일정·계약 탭 → 업체관리 시트 (1미팅=1행, K=계약여부 boolean, L=수임비)
계약여부=TRUE 미팅 → 02 계약수납관리 시트에 row 자동 생성
양방향 수정 (계약일/업체명/수임비/수수료):
  계약수납 → PATCH → 02 계약수납관리 + 업체관리 양쪽 update
  일정·계약 → PATCH → 업체관리 + 02 계약수납관리 양쪽 update
```

---

## 시트 매핑 검증 사항 (Claude Code 작업)

prototype은 다음을 **가정**하고 진행. Claude Code가 실제 시트 보고 검증/조정 필요:

1. **수납 슬롯 컬럼 구조** — 5컬럼인지 6컬럼(진행률 추가)인지
   - 현재 가정: 6컬럼 (기관/진행률/현황/승인/수납/일자)
   - 검증: `02 계약수납관리` 시트 1~2행 헤더 확인
2. **진행률 컬럼 위치** — N, T, Z (사용자 명시)
   - 검증: 드롭박스 적용된 컬럼이 정말 N, T, Z인지
3. **드롭박스 옵션 값** — 가정: `'', '20%', '40%', '60%', '80%', '100%'`
   - 검증: 시트 데이터 검증 규칙(Validation) 확인
4. **수수료 컬럼** — 새 컬럼인지 기존 컬럼 재활용인지

---

## 보강된 SSOT 흐름도

```
[일정·계약 탭]
  └── 업체관리 시트 (1미팅=1행)
        └── K(계약여부)=TRUE인 row가 트리거

[계약수납 탭] ← 이 작업의 대상
  └── 02 계약수납관리 시트
        ├── A: 공란
        ├── B: 순번
        ├── C: 계약일       ──┐
        ├── D: 업체명       ──┼── 업체관리와 양방향 동기화
        ├── E: 수임비(원)   ──┤
        ├── ?: 수수료(원)   ──┘  ※ 위치 검증 필요
        ├── F~L: 7체크
        ├── M~?: 수납1 (기관/진행률[N]/현황/승인/수납/일자)
        ├── ?~?: 수납2 (.../진행률[T]/...)
        └── ?~?: 수납3 (.../진행률[Z]/...)

[01 영업관리 시트]
  └── O열(수임비합계), Q~T(승인/수납 집계)
        └── SUMIFS(...02 계약수납관리...) 수식으로 끌어감
            ※ 수식 재설계 필요 — 기존엔 다른 시트 참조했음
```
