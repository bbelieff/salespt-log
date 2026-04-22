---
status: verified
owner: belie
last_review: 2026-04-21
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

> **원칙**: Google Sheets가 SSOT이되 **데이터 흐름이 변경됨**: `웹 → 업체관리/수납관리 → (수식) → 영업관리 → (수식) → 대시보드`. 업체관리(1미팅=1행)가 미팅 데이터 원본이고, 영업관리는 수식으로 집계만 받는다.

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

// 미팅 1건 (업체관리 탭의 한 행)
type Meeting = {
  id: string;          // UUID (A열)
  예약일: string;       // YYYY-MM-DD, 예약을 잡은 날 (B열)
  예약시각: string;     // HH:MM, 예약 기록 시점 (C열)
  미팅날짜: string;     // YYYY-MM-DD, 실제 미팅 날 (D열)
  미팅시간: string;     // HH:MM, 미팅 진행 시간 (E열)
  channel: ChannelKey; // 채널 (F열)
  업체명: string;       // 미팅 대상 (G열)
  장소: string;        // 미팅 장소 (H열)
  예약비고: string;     // 예약 시 메모 (I열)

  // 미팅 완료 후 업데이트
  상태: '예약'|'완료'|'취소';  // J열
  계약여부: boolean;           // K열
  수임비: number;             // 만원 (L열)
  계약비고: string;           // M열
  
  // 수식 생성 (읽기 전용)
  표시상세: string;           // N열: "4/25 13:00 ○○치킨 방이동"
  표시요약: string;           // O열: "13:00 ○○치킨 방이동"
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

| 탭 | 직접 쓰기 대상 | 수식 집계 | 역할 변경 |
|---|---|---|---|
| 대시보드 | 없음 | ← 영업관리 | ❌ 읽기 전용 |
| 영업관리 | E~H, M | I~L, N~T | ✅ 생산+수식집계 |
| **업체관리** | A~M (1미팅=1행) | N~O (표시문자열) | 🆕 신설 |
| **수납관리** | A~F | 없음 | 🆕 신설 |
| 회고노트 | 전체 | 없음 | 기존 유지 |

## API 엔드포인트 (예정)

```
GET  /api/daily/:date                    → DailyView (영업관리 탭 읽기)
POST /api/daily/:date                    → 채널 합계 + 특이사항 저장 (영업관리 E~H, M)
POST /api/meeting                        → 미팅 1건 추가 (업체관리 탭 append)
PATCH /api/meeting/:id                   → 미팅 상태/계약/수임비 업데이트 (업체관리 J~M)
GET /api/meetings?date=YYYY-MM-DD&dateType=reservation|meeting → 미팅 조회
POST /api/payment                        → 수납 1건 추가 (수납관리 탭 append)
GET /api/payments?date=YYYY-MM-DD        → 수납 조회
GET  /api/summary                        → 상단 요약 (대시보드 사용)
GET  /api/schedule                       → 수강시작일/수료일 + 주차 정보
```

## 프론트 데이터 흐름

```
[업체관리/수납관리 탭] ↔ lib/repo/sheets.ts ↔ lib/service/meeting.ts ↔ /api/meeting ↔ React Query
                              ↓ (수식)
[영업관리 탭] ↔ lib/repo/sheets.ts ↔ lib/service/daily.ts ↔ /api/daily ↔ React Query
                              ↓ (수식)  
[대시보드 탭] ← 읽기 전용
```

### 주요 변경사항
- **웹 쓰기**: 업체관리/수납관리 탭만
- **수식 집계**: 영업관리 I~L,N~T ← 업체관리/수납관리
- **캐시 키**: `['meetings', date]`, `['payments', date]`, `['daily', date]` 분리
- **무결성**: 1미팅=1행으로 개별 편집 가능
