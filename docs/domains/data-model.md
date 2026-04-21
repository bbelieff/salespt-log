---
status: draft
owner: belie
last_review: 2026-04-17
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 세일즈PT 영업일지의 백엔드 데이터 모델과 Google Sheets 1:1 매핑 설명
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: 백엔드 API 구현, Google Sheets 연동, 프론트엔드 데이터 흐름
> - **읽고 나면 알 수 있는 것**:
>   - Google Sheets와 TypeScript 모델의 정확한 매핑
>   - 각 탭별 데이터 입출력 권한과 흐름
> - **관련 문서**: [ER 다이어그램](./er-diagram.md), [상태 전이도](./state-machines.md), [API 명세](./api-spec.md)

# 백엔드 데이터 모델 — 경영일지 시트 1:1 매핑

## 관련 문서
- [ER 다이어그램](./er-diagram.md)
- [상태 전이도](./state-machines.md)
- [API 명세](./api-spec.md)

> **원칙**: Google Sheets `01 영업관리` 탭이 SSOT. 백엔드는 시트 행/열을 그대로 모델링하고, 모든 프론트 탭은 같은 API에서 데이터를 받는다. 이 일관성이 깨지면 탭마다 표시가 다른 버그가 발생한다.

## 새로운 4탭 구조 개요

[ADR-0003](../decisions/0003-company-tab-split.md)에 따라 기존 영업관리 탭을 4개 탭으로 분리:

1. **업체관리 탭** (신규): 1행 = 1미팅, 미팅 데이터 SSOT
2. **수납관리 탭** (신규): 1행 = 1일 수납기록, 독립 워크플로우  
3. **영업관리 탭** (변경): 집계 전용 뷰, 하루 = 4행(채널별)
4. **대시보드 탭** (기존): 읽기 전용 차트

### 영업관리 탭 컬럼 (집계 뷰로 역할 변경)

| 컬럼 | 헤더 | 데이터 출처 | 비고 |
|---|---|---|---|
| B | 요일 | 시트 수식 | =TEXT(C열,"ddd") |
| C | 날짜 | 시트 수식 | 자동 생성 |
| D | 채널 | 시트 수식 | 매입DB/직접생산/현수막/콜·지·기·소 |
| E-H | 생산/유입/컨택진행/컨택성공 | **웹 직접 입력** | 채널별 |
| I | 미팅예약 기록 | **업체관리 탭 → 시트 수식** | 예약일 기준 TEXTJOIN |
| J-L | 오늘미팅일정/수/완료수 | **업체관리 탭 → 시트 수식** | 미팅날짜 기준 |
| M | 특이사항 | **웹 직접 입력** | 일별 메모 |
| N-P | 계약건수/수임비/비고 | **업체관리 탭 → 시트 수식** | 미팅날짜 기준 |
| Q-T | 승인건수/수납건수/금액/비고 | **수납관리 탭 → 시트 수식** | 수납날짜 기준 |

## 상단 요약 (1-6행) — 자동 계산

- **E~F열 1-6행**: 생산/유입/컨택/컨택성공/미팅/계약 총합 (`=SUM(...)`)
- **G~H열 1-6행 [영업효율관리]**: 컨택>일정/일정>미팅/미팅>계약/컨택>계약 성공률
- **H~L열 2-6행 [DB효율관리]**: 채널별 생산수/유입수/효율%
- **M~N열 2-6행 [성과관리]**: 수임비/승인수수료/매출 총합
- **N1**: 수강시작일, **N2**: 수료일

## 백엔드 데이터 모델 (TypeScript)

```typescript
// lib/types/daily.ts
type ChannelKey = '매입DB' | '직접생산' | '현수막' | '콜·지·기·소';

// 한 채널 한 행 (E~H)
type ChannelRow = {
  channel: ChannelKey;
  생산: number;
  유입: number;
  컨택진행: number;
  컨택성공: number;
};

// 미팅 1건 (업체관리 탭의 한 행) - ADR-0003
type Meeting = {
  id: string;           // A열: UUID 행 식별자
  예약일: string;        // B열: YYYY-MM-DD, 미팅 예약한 날
  예약시각: string;      // C열: HH:MM:SS, 정렬용
  미팅날짜: string;       // D열: YYYY-MM-DD, 실제 미팅 진행 날
  미팅시간: string;       // E열: HH:MM, 고객과 약속한 시간
  채널: ChannelKey;     // F열
  업체명: string;        // G열
  장소: string;         // H열: 구·동 단위
  예약비고: string;      // I열: 미팅 예약 시 메모
  상태: '예약'|'완료'|'취소';  // J열
  계약여부: boolean;     // K열: 계약 성사 시 true
  수임비: number;        // L열: 계약별 수임비 (만원)
  계약비고: string;      // M열: 계약 관련 메모
};

// 수납 1건 (수납관리 탭의 한 행) - ADR-0003 신규
type Payment = {
  id: string;           // A열: UUID 행 식별자
  수납날짜: string;      // B열: YYYY-MM-DD
  승인건수: number;      // C열: 승인 받은 건 수
  수납건수: number;      // D열: 실제 입금된 건 수
  수납금액: number;      // E열: 입금 총액 (만원)
  기관비고: string;      // F열: 승인기관, 접수내용 메모
};

// 한 날짜의 영업관리 탭 집계 뷰 - ADR-0003 변경
type DailyEntry = {
  date: string;         // C열: YYYY-MM-DD (PK)
  요일: string;         // B열: 시트 수식
  // 컨택관리 (E~H, 채널 4개) - 웹 직접 입력
  channels: ChannelRow[];
  // 특이사항 (M열) - 웹 직접 입력
  특이사항: string;
  // 미팅 관련 (I~L, N~P) - 업체관리 탭 → 시트 수식
  미팅: {
    예약기록: string;    // I열: 예약일 기준 TEXTJOIN
    오늘일정: string;    // J열: 미팅날짜 기준 TEXTJOIN  
    오늘미팅수: number;  // K열: =COUNTA(J열)
    완료수: number;      // L열: 상태='완료' COUNT
    계약건수: number;    // N열: 계약여부=TRUE COUNT
    수임비: number;      // O열: 수임비 SUM
    계약비고: string;    // P열: 계약비고 TEXTJOIN
  };
  // 수납 관련 (Q~T) - 수납관리 탭 → 시트 수식
  수납: {
    승인건수: number;   // Q열
    수납건수: number;   // R열
    수납금액: number;   // S열
    비고: string;       // T열
  };
};

// API에서 한 날짜 종합 응답 (모든 탭이 이걸 받음) - ADR-0003 업데이트
type DailyView = {
  daily: DailyEntry;        // 영업관리 탭 집계 뷰
  meetings: Meeting[];      // 업체관리 탭 원본 데이터
  payments: Payment[];      // 수납관리 탭 원본 데이터  
  summary: {                // 상단 요약 (자동 계산)
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

## 탭별 데이터 출처 (ADR-0003 업데이트)

| 웹앱 탭 | 사용 필드 | 쓰기 가능? | 데이터 원천 |
|---|---|---|---|
| 대시보드 | summary 전체 | ❌ 읽기만 | 영업관리 탭 수식 |
| 컨택관리 | daily.channels (E~H) | ✅ 쓰기 | 영업관리 탭 직접 |
| 일정·계약관리 | meetings 배열 + daily.특이사항 | ✅ 쓰기 | 업체관리 탭 + 영업관리.M |
| 수납관리 | payments 배열 | ✅ 쓰기 | 수납관리 탭 직접 |
| DB관리 | summary.채널효율 | ❌ 읽기만 | 영업관리 탭 수식 |
| MY | 사용자 메타 + summary | ❌ 읽기만 | 시트 메타데이터 |

## API 엔드포인트 (ADR-0003 업데이트)

```
// 종합 뷰
GET  /api/daily/:date                    → DailyView (영업관리 집계뷰)

// 영업관리 탭 (컨택 + 특이사항만)
POST /api/daily/:date                    → E~H(채널데이터) + M(특이사항) 저장

// 업체관리 탭 (미팅 CRUD)  
POST /api/meeting                        → 새 미팅 추가
PATCH /api/meeting/:id                   → 미팅 상태/계약/수임비 업데이트
GET  /api/meetings?date=YYYY-MM-DD&dateType=reservation|meeting
                                         → 예약일 or 미팅날짜 기준 조회

// 수납관리 탭 (수납 CRUD)
POST /api/payment                        → 새 수납 추가  
GET  /api/payments?date=YYYY-MM-DD       → 해당일 수납 조회

// 요약 데이터
GET  /api/summary                        → 상단 요약 (대시보드용)
GET  /api/schedule                       → 수강시작일/수료일 + 주차 정보
```

## 프론트 데이터 흐름 (ADR-0003 업데이트)

```
4개 시트 탭 → lib/repo/sheets.ts → lib/service/daily.ts → API 라우터 → React Query cache → 웹앱 탭들

업체관리 탭 ↘
수납관리 탭 → [시트 수식] → 영업관리 탭 → /api/daily/:date → ['daily', date] 캐시 → 모든 탭
영업관리 탭 ↗                      ↘
대시보드 탭 ←←←←←←←← [시트 수식] ←←←←↙
```

### 캐싱 전략
- React Query `['daily', date]`: 영업관리 집계뷰 + 요약 데이터
- React Query `['meetings', date, type]`: 업체관리 탭 미팅 목록  
- React Query `['payments', date]`: 수납관리 탭 수납 목록
- 한 탭에서 mutate → 관련 캐시 invalidate → 모든 탭 자동 새로고침
