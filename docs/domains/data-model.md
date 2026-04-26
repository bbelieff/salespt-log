---
status: verified
owner: belie
last_review: 2026-04-27
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 세일즈PT 영업일지의 백엔드 데이터 모델과 Google Sheets 1:1 매핑 설명
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: 백엔드 API 구현, Google Sheets 연동, 프론트엔드 데이터 흐름
> - **읽고 나면 알 수 있는 것**:
>   - Google Sheets와 TypeScript 모델의 정확한 매핑
>   - 각 탭별 데이터 입출력 권한과 흐름
>   - 미팅 상태 5가지 enum과 의미
> - **관련 문서**: [ER 다이어그램](./er-diagram.md), [상태 전이도](./state-machines.md), [API 명세](./api-spec.md), [sheet-structure.md](./sheet-structure.md)

# 백엔드 데이터 모델 — 경영일지 시트 1:1 매핑

## 관련 문서
- [ER 다이어그램](./er-diagram.md)
- [상태 전이도](./state-machines.md)
- [API 명세](./api-spec.md)
- [시트 구조 정의](./sheet-structure.md)

> **원칙**: Google Sheets가 SSOT. 데이터 흐름: `웹 → 업체관리/수납관리 → (시트 수식) → 영업관리 → (시트 수식) → 대시보드`. 업체관리(1미팅=1행)가 미팅 데이터 원본이고, 영업관리는 모두 시트 수식으로 자동 집계만 받는다.

## 시트 컬럼 매핑 (영업관리 탭)

`01 영업관리` 시트에서 하루 = 4행(채널별), 컬럼은 다음과 같이 4개 박스로 그룹화됨:

| 컬럼 | 헤더 | 박스 | 비고 |
|---|---|---|---|
| B | 요일 | (날짜) | 자동 |
| C | 날짜 | (날짜) | 자동 |
| D | 채널 | (날짜) | 매입DB / 직접생산 / 현수막 / 콜·지·기·소 |
| E | 생산건 수 | **컨택관리** | 채널별 (직접 입력) |
| F | 유입건 수 | **컨택관리** | 채널별 (직접 입력) |
| G | 컨택진행 수 | **컨택관리** | 채널별 (직접 입력) |
| H | 컨택성공 수 | **컨택관리** | 채널별 (직접 입력, = 미팅예약 건수) |
| I | 미팅예약 기록 | **컨택관리** | 수식 자동, 예약일 기준, 콤마 구분 |
| J | 오늘 미팅 일정 | **일정·계약관리** | 수식 자동, 미팅날짜 기준, 콤마 구분 |
| K | 오늘 미팅 수 | **일정·계약관리** | 수식 자동, COUNTIFS |
| L | 미팅 완료 수 | **일정·계약관리** | 수식 자동, 상태 IN ["계약","완료"] |
| M | 미팅사유 | **일정·계약관리** | ⭐ 수식 자동 (업체관리!M에서 TEXTJOIN), `업체명, 이유` 라인 누적 |
| N | 계약건 수 | **일정·계약관리** | 수식 자동, 상태="계약" |
| O | 수임비 금액 | **일정·계약관리** | 수식 자동, 상태="계약" SUMIFS |
| P | 계약비고 | **일정·계약관리** | 수식 자동, "업체명, 수임비, 계약조건" 누적 |
| Q | 승인건 수 | **수납관리** | 수식 자동 |
| R | 수납건 수 | **수납관리** | 수식 자동 |
| S | 수납금액 | **수납관리** | 수식 자동 |
| T | 비고(기관, 접수내용) | **수납관리** | 수식 자동 |

> ⚠️ **영업관리 I~T 모두 시트 수식 자동 집계**. 웹이 직접 쓰는 컬럼은 E~H뿐이다.

## 상단 요약 (1-6행) — 자동 계산

- **E~F열 1-6행**: 생산/유입/컨택/컨택성공/미팅/계약 총합 (`=SUM(...)`)
- **G~H열 1-6행 [영업효율관리]**: 컨택>일정/일정>미팅/미팅>계약/컨택>계약 성공률
- **H~L열 2-6행 [DB효율관리]**: 채널별 생산수/유입수/효율%
- **M~N열 2-6행 [성과관리]**: 수임비/승인수수료/매출 총합
- **N1**: 수강시작일, **N2**: 수료일

## 미팅 상태 enum (5가지) ⭐

미팅의 라이프사이클은 **5가지 상태**로 표현된다. UI 색상은 [tokens.md](./tokens.md), 상세 전이 규칙은 [state-machines.md](./state-machines.md), 시트 컬럼 매핑은 [sheet-structure.md](./sheet-structure.md) 참조.

| 상태 | 설명 | 카드 색 | 좌측바 색 | 아이콘 | M열 작성 |
|---|---|---|---|---|---|
| `예약` | 액션 미선택 (처리 대기) | 노랑 | amber | 🟡 | — |
| `계약` | 미팅 후 계약 체결 (가장 좋은 결과) | 진초록 | green | 💵 | 안 적음 |
| `완료` | 미팅했으나 계약 X (사유 필수) | 주황 | orange | 🟠 | `업체명, 이유` |
| `변경` | 일정 변경됨 (이 카드는 무효, 새 카드 생성) | 보라 | purple | 📅 | `업체명, 새날짜로 변경` |
| `취소` | 취소·노쇼 (사유 필수) | 빨강 | red | 🔴 | `업체명, 이유` |

**중요 규칙**:
- `계약`/`완료`/`변경`/`취소`로 종결된 카드는 **`예약`으로 되돌리기 가능** (revert).
- `변경` 처리 시 기존 카드는 `상태='변경'`이 되고, **새 미팅 카드가 새 날짜에 자동 생성**된다 (업체·장소·예약비고 복사).
- `K열 계약여부`는 `J열 상태='계약'`과 의미 중복이지만, 기존 수식 호환을 위해 유지 (계약 시 `K=TRUE` 동시 기록).

## 백엔드 데이터 모델 (TypeScript)

```typescript
// lib/types/daily.ts
type ChannelKey = '매입DB' | '직접생산' | '현수막' | '콜·지·기·소';

// 미팅 상태 5가지
type MeetingStatus = '예약' | '계약' | '완료' | '변경' | '취소';

// 한 채널 한 행 (E~H)
type ChannelRow = {
  channel: ChannelKey;
  생산: number;        // E
  유입: number;        // F
  컨택진행: number;    // G
  컨택성공: number;    // H, = 그 채널의 미팅예약 슬롯 수
};

// 미팅 1건 (업체관리 탭의 한 행)
type Meeting = {
  id: string;          // UUID (A열)
  예약일: string;       // YYYY-MM-DD, 예약을 잡은 날 (B열)
  예약시각: string;     // HH:MM, 예약 기록 시점 (C열)
  미팅날짜: string;     // YYYY-MM-DD, 실제 미팅 날 (D열)
  미팅시간: string;     // HH:MM, 15분 단위 강제 (E열)
  channel: ChannelKey; // 채널 (F열)
  업체명: string;       // 미팅 대상 (G열)
  장소: string;        // 미팅 장소 (H열)
  예약비고: string;     // 예약 시 메모 — 미팅 전 준비정보 (I열)

  // 미팅 후 업데이트
  상태: MeetingStatus;  // J열, 5가지
  계약여부: boolean;    // K열 (상태='계약'과 동기화)
  수임비: number;       // 만원 (L열, 계약 시만)
  미팅사유: string;     // M열 ⭐ `업체명, 이유` 형식. 영업관리!M으로 자동 집계
                        //          [완료]/[변경]/[취소] 시만 작성. [계약]은 안 적음.
  계약조건: string;     // P열 ⭐ 계약 시만 (예: "6개월 분할, 부가세 별도")

  // 시트 수식 생성 (읽기 전용)
  표시상세: string;     // N열: "4/25, 13:00, ○○치킨, 방이동" (콤마 구분)
  표시요약: string;     // O열: "13:00, ○○치킨, 방이동" (콤마 구분)
  계약합성라인: string; // Q열: "○○부동산, 300, 6개월 분할 부가세 별도" (계약 행만)
};

// 수납 1건 (수납관리 탭의 한 행)
type Payment = {
  id: string;          // UUID (A열)
  수납날짜: string;     // YYYY-MM-DD (B열)
  승인건수: number;     // C열
  수납건수: number;     // D열
  수납금액: number;     // 만원 (E열)
  기관접수내용: string; // F열
};

// 한 날짜의 일별 데이터 (영업관리 탭 한 행 = 채널별 4개 합쳐서 한 묶음)
type DailyEntry = {
  date: string;        // YYYY-MM-DD (PK)
  요일: string;
  // 컨택관리 (E~H, 채널 4개)
  channels: ChannelRow[];
  // 수납관리 (Q~T, 일별)
  수납: {
    승인건수: number;   // Q
    수납건수: number;   // R
    수납금액: number;   // S
    비고: string;       // T (기관, 접수내용)
  };
  // 영업관리 I~P는 시트 수식 자동 집계, DailyEntry에는 미포함
  // (별도 SummaryView에서 읽어옴)
};

// API에서 한 날짜 종합 응답 (모든 탭이 이걸 받음)
type DailyView = {
  daily: DailyEntry;
  meetings: Meeting[];     // 업체관리 탭에서 그 날짜 미팅 가져옴
  summary: {               // 상단 요약 (자동 계산)
    생산총합: number;
    유입총합: number;
    컨택총합: number;
    컨택성공총합: number;
    미팅총합: number;
    계약총합: number;
    수임비총합: number;
    매출총합: number;
    채널효율: { [k in ChannelKey]: { 생산: number; 유입: number; 효율: number } };
    영업효율: {
      컨택일정: number;    // H/F (컨택>일정 성공률)
      일정미팅: number;    // L/H
      미팅계약: number;    // N/L
      컨택계약: number;    // N/H
    };
  };
};
```

## 컨택관리 화면의 셀(Cell) 구조 (참고)

⚠️ 이 구조는 **프론트엔드 in-memory 상태**용이며, 시트 저장 시 위 `Meeting` 타입으로 변환된다.

```typescript
// 컨택관리 화면: 4채널 × 7요일 × 10주 = 셀 단위
// key 패턴: "{주차}_{요일idx}_{채널id}"
type Cell = {
  prod: number;      // E열: 생산
  inflow: number;    // F열: 유입
  contact: number;   // G열: 컨택진행
  success: number;   // H열: 컨택성공
  slots: Slot[];     // 미팅예약 카드 (success 수와 자동 동기화)
};

// 검증 규칙: success ≤ contact (위반 시 자동 보정)
// 검증 규칙: slots.length === success (자동 sync)
// 규칙 없음: inflow ≥ contact (전날 유입분을 오늘 컨택 가능)

type Slot = {
  id: string;                // UUID
  saved: boolean;            // [등록] 클릭 여부 (UI only, 시트 미저장)
  meetingDate: string;       // → Meeting.미팅날짜 (D)
  meetingTime: string;       // → Meeting.미팅시간 (E), 15분 단위
  company: string;           // → Meeting.업체명 (G)
  location: string;          // → Meeting.장소 (H)
  reservationNote: string;   // → Meeting.예약비고 (I)
  status: MeetingStatus;     // → Meeting.상태 (J), 기본 '예약'
  contracted: boolean;       // → Meeting.계약여부 (K)
  fee: number;               // → Meeting.수임비 (L)
  meetingReason: string;     // → Meeting.미팅사유 (M)
  // 계약조건은 일정·계약 화면에서만 입력 (컨택관리 단계에서는 불필요)
};
```

## 탭별 데이터 출처

| 탭 | 직접 쓰기 대상 | 수식 집계 | 역할 |
|---|---|---|---|
| 대시보드 | 없음 | ← 영업관리 | ❌ 읽기 전용 |
| 영업관리 | E~H | I~T (모두 자동 집계) | ✅ 생산 직접 + 자동 집계 |
| **업체관리** | A~M, P (1미팅=1행) | N, O, Q (표시문자열·합성) | 🆕 미팅 원본 |
| **수납관리** | A~F | 없음 | 🆕 수납 원본 |
| 회고노트 | 전체 | 없음 | 기존 유지 |

## API 엔드포인트 (예정)

```
GET  /api/daily/:date                    → DailyView (영업관리 탭 읽기)
POST /api/daily/:date                    → 채널 합계 저장 (영업관리 E~H)
POST /api/meeting                        → 미팅 1건 추가 (업체관리 탭 append)
PATCH /api/meeting/:id                   → 미팅 상태/계약/수임비/사유/계약조건 업데이트
                                           (업체관리 J, K, L, M, P)
POST /api/meeting/:id/action             → 4가지 액션 (contract/done/reschedule/cancel)
                                           reschedule는 새 행 자동 생성
GET /api/meetings?date=YYYY-MM-DD&dateType=reservation|meeting → 미팅 조회
POST /api/payment                        → 수납 1건 추가 (수납관리 탭 append)
GET /api/payments?date=YYYY-MM-DD        → 수납 조회
GET  /api/summary                        → 상단 요약 (대시보드 사용)
GET  /api/schedule                       → 수강시작일/수료일 + 주차 정보
```

## 프론트 데이터 흐름

```
[웹 컨택관리 / 일정·계약 탭]
        ↓
[업체관리/수납관리 탭] ↔ lib/repo/sheets.ts ↔ lib/service/meeting.ts ↔ /api/meeting ↔ React Query
        ↓ (시트 수식 자동 집계)
[영업관리 탭 I~T] ↔ lib/repo/sheets.ts ↔ lib/service/daily.ts ↔ /api/daily ↔ React Query
        ↓ (시트 수식)  
[대시보드 탭] ← 읽기 전용
```

### 주요 변경사항
- **웹 쓰기**: 업체관리/수납관리 탭만 (영업관리 E~H는 컨택관리 화면에서 직접)
- **수식 집계**: 영업관리 I~T 전체 ← 업체관리/수납관리
- **캐시 키**: `['meetings', date]`, `['payments', date]`, `['daily', date]` 분리
- **무결성**: 1미팅=1행으로 개별 편집 가능
- **상태 5개**: 예약/계약/완료/변경/취소 (3개에서 확장)

---

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-04-21 | 초기 작성 (`상태` enum 3개) |
| 2026-04-27 (1차) | 상태 enum 5개로 확장 / M=미팅결과 / P=계약조건 신설 (HTML 분석 기반) |
| **2026-04-27 (2차)** | 영업관리!M 의미 변경: 사용자 자유 메모 → **미팅사유 자동 집계** (시트 수식) |
| **2026-04-27 (2차)** | Meeting.미팅결과 → Meeting.**미팅사유** (`업체명, 이유` 간결 포맷) |
| **2026-04-27 (2차)** | Meeting에 `계약합성라인`(Q열) 추가 — 영업관리!P의 시트 수식 소스 |
| **2026-04-27 (2차)** | 표시문자열(N, O열) 구분자: 공백 → **콤마** |
| **2026-04-27 (2차)** | 영업관리 I~T 전체가 시트 수식 자동 집계로 일원화 (직접 쓰기 컬럼 E~H만) |

## 미해결 / 후속 결정 필요 (TODO)

- [ ] 영업관리!K 컬럼은 `J="계약"`과 의미 중복 — 향후 deprecation 검토
- [ ] revertToReserved 시 업체관리!M의 사유 보존 여부 — 현재는 보존(이력 유지) 가정
- [ ] 자유 메모(특이사항) 컬럼이 별도로 필요하다면 어디에 둘지 — 현재 영업관리!M은 미팅사유 자동 집계로 사용됨 (회고노트 활용 가능)
