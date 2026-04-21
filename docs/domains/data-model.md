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

## 시트 컬럼 매핑

`01 영업관리` 시트에서 하루 = 4행(채널별), 컬럼은 다음과 같이 4개 박스로 그룹화됨:

| 컬럼 | 헤더 | 박스 | 비고 |
|---|---|---|---|
| B | 요일 | (날짜) | 자동 |
| C | 날짜 | (날짜) | 자동 |
| D | 채널 | (날짜) | 매입DB / 직접생산 / 현수막 / 콜·지·기·소 |
| E | 생산건 수 | **컨택관리** | 채널별 |
| F | 유입건 수 | **컨택관리** | 채널별 |
| G | 컨택진행 수 | **컨택관리** | 채널별 |
| H | 컨택성공 수 | **컨택관리** | 채널별 (= 미팅예약 건수) |
| I | 미팅예약 기록 | **컨택관리** | 수식 자동 (앱_미팅예약 탭에서 TEXTJOIN) |
| J | 오늘 미팅 일정 | **일정·계약관리** | 일별 (첫 행에만) |
| K | 오늘 미팅 수 | **일정·계약관리** | 일별, =COUNTA(I열) |
| L | 미팅 완료 수 | **일정·계약관리** | 일별, 미팅 후 입력 |
| M | 특이사항(변동,변수) | **일정·계약관리** | 일별 |
| N | 계약건 수 | **일정·계약관리** | 일별 |
| O | 수임비 금액 | **일정·계약관리** | 일별 (계약별 수임비 합계) |
| P | 비고(계약업체명+수임비) | **일정·계약관리** | 일별 |
| Q | 승인건 수 | **수납관리** | 일별 |
| R | 수납건 수 | **수납관리** | 일별 |
| S | 수납금액 | **수납관리** | 일별 |
| T | 비고(기관, 접수내용) | **수납관리** | 일별 |

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

// 미팅 1건 (앱_미팅예약 탭의 한 행)
type Meeting = {
  id: string;          // 행 식별자
  date: string;        // YYYY-MM-DD
  time: string;        // HH:MM
  channel: ChannelKey;
  vendor: string;
  region: string;
  note: string;        // 미팅별 메모 (시트 I열의 TEXTJOIN으로 합쳐짐)

  // 일정·계약관리 탭에서 추가 입력
  status: '예약'|'완료'|'취소';
  계약여부: boolean;     // 계약 성사 시 true
  수임비: number;        // 계약별 수임비 (만원)
  계약비고: string;
};

// 한 날짜의 일별 데이터 (J~P, Q~T 합쳐서)
type DailyEntry = {
  date: string;        // YYYY-MM-DD (PK)
  요일: string;
  // 컨택관리 (E~H, 채널 4개)
  channels: ChannelRow[];
  // 일정·계약관리 (J~P, 일별 합산)
  특이사항: string;     // M
  // 수납관리 (Q~T, 일별)
  수납: {
    승인건수: number;   // Q
    수납건수: number;   // R
    수납금액: number;   // S
    비고: string;       // T (기관, 접수내용)
  };
};

// API에서 한 날짜 종합 응답 (모든 탭이 이걸 받음)
type DailyView = {
  daily: DailyEntry;
  meetings: Meeting[];     // 별도 시트(앱_미팅예약)
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

## 탭별 데이터 출처

| 탭 | 사용 필드 | 쓰기 가능? |
|---|---|---|
| 대시보드 | summary 전체, today's daily | ❌ 읽기만 |
| 컨택관리 | daily.channels (E~H) + meetings | ✅ 쓰기 |
| 일정·계약관리 | meetings (status/계약/수임비) + daily.특이사항 | ✅ 쓰기 |
| 수납관리 | daily.수납 (Q~T) | ✅ 쓰기 |
| DB관리 | summary.채널효율 + 누적 DB 잔여 | ❌ 읽기만 (자동 계산) |
| MY | 사용자 메타 + summary | ❌ 읽기만 |

## API 엔드포인트 (예정)

```
GET  /api/daily/:date          → DailyView
POST /api/daily/:date          → 채널 합계 + 특이사항 저장
POST /api/meeting              → 미팅 1건 추가 (앱_미팅예약 탭)
PATCH /api/meeting/:id         → 미팅 상태/계약/수임비 업데이트
POST /api/payment/:date        → 수납 입력
GET  /api/summary              → 상단 요약 (대시보드, DB관리에서 사용)
GET  /api/schedule             → 수강시작일/수료일 + 주차 정보
```

## 프론트 데이터 흐름

```
[Sheets] ↔ lib/repo/sheets.ts ↔ lib/service/daily.ts ↔ /api/daily ↔ React Query cache ↔ 모든 탭
```

- React Query로 `['daily', date]` 키에 캐시 → 모든 탭이 같은 데이터를 봄
- 한 탭에서 mutate하면 invalidate → 모든 탭 자동 새로고침
- 프로토타입 단계에서는 `dayStore` 객체가 이 캐시 역할
