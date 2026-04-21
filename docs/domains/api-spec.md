> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 세일즈PT 영업일지 API의 엔드포인트 명세와 Google Sheets 매핑
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: API 구현, 프론트엔드 연동, Google Sheets 연동
> - **읽고 나면 알 수 있는 것**:
>   - 각 API 엔드포인트의 요청/응답 형식
>   - API와 Google Sheets 탭의 매핑 관계
> - **관련 문서**: [ER 다이어그램](./er-diagram.md), [상태 전이도](./state-machines.md), [데이터 모델](./data-model.md)

# API 명세

## 엔드포인트 개요

| Method | Path | Body | Response | 시트 작업 | 인증 | Rate Limit |
|--------|------|------|----------|-----------|------|------------|
| GET | `/api/daily/:date` | - | `DailyView` | 01 영업관리 read | ✅ | 60/min |
| POST | `/api/daily/:date` | `DailyEntry` | `{ok, savedRows}` | 01 영업관리 write 4 rows | ✅ | 30/min |
| POST | `/api/meeting` | `Meeting` | `{id}` | 업체관리 append | ✅ | 30/min |
| PATCH | `/api/meeting/:id` | `MeetingUpdate` | `{ok}` | 업체관리 update | ✅ | 30/min |
| GET | `/api/meetings` | - | `Meeting[]` | 업체관리 read | ✅ | 60/min |
| POST | `/api/payment` | `Payment` | `{id}` | 수납관리 append | ✅ | 30/min |
| GET | `/api/payments` | - | `Payment[]` | 수납관리 read | ✅ | 60/min |
| POST | `/api/db-order` | `DBOrder` | `{id}` | DB관리 append | ✅ | 30/min |
| GET | `/api/summary` | - | `Summary` | 대시보드 read | ✅ | 120/min |
| GET | `/api/schedule` | - | `Schedule` | N1, C248 | ✅ | 60/min |

## 상세 API 명세

### 1. GET `/api/daily/:date`
**용도**: 특정 날짜의 영업 데이터 조회

**Parameters**:
- `date`: YYYY-MM-DD 형식

**Response** (`DailyView`):
```json
{
  "daily": {
    "date": "2026-04-21",
    "요일": "월",
    "channels": [
      {
        "channel": "매입DB",
        "생산": 10,
        "유입": 8,
        "컨택진행": 6,
        "컨택성공": 3
      }
    ],
    "특이사항": "휴일로 인한 컨택 감소",
    "수납": {
      "승인건수": 2,
      "수납건수": 2,
      "수납금액": 150,
      "비고": "A기관 2건"
    }
  },
  "meetings": [
    {
      "id": "meeting_001",
      "date": "2026-04-21",
      "time": "14:00",
      "channel": "매입DB",
      "vendor": "ABC업체",
      "region": "서울",
      "status": "예약",
      "계약여부": false,
      "수임비": 0
    }
  ],
  "summary": {
    "생산총합": 100,
    "유입총합": 85,
    "매출총합": 1200
  }
}
```

**에러 코드**:
- `401`: 인증 실패
- `404`: 날짜 데이터 없음
- `500`: Google Sheets 접근 오류

---

### 2. POST `/api/daily/:date`
**용도**: 일별 영업 데이터 저장

**Parameters**:
- `date`: YYYY-MM-DD 형식

**Request Body** (`DailyEntry`):
```json
{
  "channels": [
    {
      "channel": "매입DB",
      "생산": 10,
      "유입": 8,
      "컨택진행": 6,
      "컨택성공": 3
    }
  ],
  "특이사항": "휴일로 인한 컨택 감소"
}
```

**Response**:
```json
{
  "ok": true,
  "savedRows": 4,
  "message": "일별 데이터 저장 완료"
}
```

**Google Sheets 작업**:
- `01 영업관리` 탭에 4행 추가/업데이트 (채널별)
- B~H열 데이터 입력
- M열 특이사항 입력

**에러 코드**:
- `400`: 필수 필드 누락, 잘못된 채널명
- `401`: 인증 실패
- `409`: 이미 존재하는 날짜 데이터
- `500`: Google Sheets 쓰기 오류

---

### 3. POST `/api/meeting`
**용도**: 새 미팅 예약 생성

**Request Body** (`Meeting`):
```json
{
  "미팅날짜": "2026-04-21",
  "미팅시간": "14:00",
  "channel": "매입DB",
  "업체명": "ABC업체",
  "장소": "서울 강남",
  "예약비고": "초기 상담"
}
```

**Response**:
```json
{
  "id": "meeting_001",
  "message": "미팅 예약 생성 완료"
}
```

**Google Sheets 작업**:
- `업체관리` 탭에 새 행 추가
- 예약일/예약시각은 서버에서 자동 설정
- 상태는 자동으로 "예약"으로 설정

**에러 코드**:
- `400`: 필수 필드 누락, 잘못된 날짜/시간 형식
- `401`: 인증 실패
- `500`: Google Sheets 쓰기 오류

---

### 4. PATCH `/api/meeting/:id`
**용도**: 기존 미팅 상태 업데이트

**Parameters**:
- `id`: 미팅 식별자

**Request Body** (`MeetingUpdate`):
```json
{
  "상태": "완료",
  "계약여부": true,
  "수임비": 500,
  "계약비고": "ABC업체 프랜차이즈 계약 체결"
}
```

**Response**:
```json
{
  "ok": true,
  "message": "미팅 상태 업데이트 완료"
}
```

**Google Sheets 작업**:
- `업체관리` 탭에서 해당 행 업데이트 (J~M열)
- 상태 변경 시 `영업관리` 탭의 수식 집계 자동 갱신

**에러 코드**:
- `400`: 잘못된 상태 값, 수임비 형식 오류
- `401`: 인증 실패
- `404`: 존재하지 않는 미팅 ID
- `500`: Google Sheets 업데이트 오류

---

### 5. GET `/api/meetings`
**용도**: 미팅 목록 조회

**Query Parameters**:
- `date`: YYYY-MM-DD (특정 날짜 필터)
- `dateType`: "reservation" | "meeting" (예약일 vs 미팅날짜 기준)
- `status`: "예약" | "완료" | "취소" (상태 필터)

**Response**:
```json
{
  "meetings": [
    {
      "id": "uuid-1",
      "예약일": "2026-04-20",
      "예약시각": "09:15",
      "미팅날짜": "2026-04-21",
      "미팅시간": "14:00",
      "channel": "매입DB",
      "업체명": "ABC업체",
      "장소": "서울 강남",
      "상태": "완료",
      "계약여부": true,
      "수임비": 500,
      "표시상세": "4/21 14:00 ABC업체 서울강남",
      "표시요약": "14:00 ABC업체 서울강남"
    }
  ]
}
```

**Google Sheets 작업**:
- `업체관리` 탭 전체 행 읽기
- 필터 조건에 따른 데이터 반환

---

### 6. POST `/api/payment`
**용도**: 수납 데이터 입력

**Request Body** (`Payment`):
```json
{
  "수납날짜": "2026-04-21",
  "승인건수": 2,
  "수납건수": 2,
  "수납금액": 1500,
  "기관접수내용": "서울시청 개인회생 2건"
}
```

**Response**:
```json
{
  "id": "payment_uuid",
  "message": "수납 데이터 저장 완료"
}
```

**Google Sheets 작업**:
- `수납관리` 탭에 새 행 추가
- 영업관리 Q~T열은 수식으로 자동 집계

**에러 코드**:
- `400`: 음수 값, 필수 필드 누락
- `401`: 인증 실패
- `500`: Google Sheets 쓰기 오류

---

### 7. GET `/api/payments`
**용도**: 수납 목록 조회

**Query Parameters**:
- `date`: YYYY-MM-DD (특정 날짜 필터)

**Response**:
```json
{
  "payments": [
    {
      "id": "payment_uuid",
      "수납날짜": "2026-04-21",
      "승인건수": 2,
      "수납건수": 2,
      "수납금액": 1500,
      "기관접수내용": "서울시청 개인회생 2건"
    }
  ]
}
```

**Google Sheets 작업**:
- `수납관리` 탭 전체 행 읽기
- 날짜 필터에 따른 데이터 반환

---

### 8. POST `/api/db-order`
**용도**: DB 주문 생성

**Request Body** (`DBOrder`):
```json
{
  "channel": "매입DB",
  "quantity": 100,
  "date": "2026-04-21"
}
```

**Response**:
```json
{
  "id": "order_001",
  "message": "DB 주문 생성 완료"
}
```

**Google Sheets 작업**:
- `DB관리` 탭에 새 행 추가
- status는 자동으로 "입력"으로 설정

**에러 코드**:
- `400`: 잘못된 채널명, 음수 수량
- `401`: 인증 실패
- `500`: Google Sheets 쓰기 오류

---

### 9. GET `/api/summary`
**용도**: 대시보드 요약 데이터 조회

**Response** (`Summary`):
```json
{
  "매출": 1200,
  "비용": 800,
  "이익": 400,
  "채널효율": {
    "매입DB": {
      "생산": 100,
      "유입": 85,
      "효율": 85.0
    }
  },
  "영업효율": {
    "컨택일정": 75.2,
    "일정미팅": 80.1,
    "미팅계약": 60.5,
    "컨택계약": 45.8
  }
}
```

**Google Sheets 작업**:
- `대시보드` 탭의 자동 계산된 값 읽기
- SUM, 효율 수식 결과 조회

**에러 코드**:
- `401`: 인증 실패
- `500`: Google Sheets 읽기 오류

---

### 10. GET `/api/schedule`
**용도**: 수강 일정 정보 조회 (동적 계산)

**Response** (`Schedule`):
```json
{
  "startDate": "2026-01-01",
  "endDate": "2026-02-25",
  "editEndDate": "2026-03-11",
  "currentWeek": 3,
  "dDay": 45,
  "editDDay": 59,
  "periodType": "course",
  "weekLabel": "3주차"
}
```

**응답 필드 설명**:
- `startDate`: 시트 N1에서 읽은 수강시작일
- `endDate`: startDate + 55일 (8주 수료일)
- `editEndDate`: startDate + 69일 (편집 가능 마감일)
- `currentWeek`: 1~8 (수강 기간), 또는 null (유예/종료)
- `dDay`: 수료일까지 남은 일수 (음수 가능)
- `editDDay`: 편집 마감까지 남은 일수 (음수 가능)
- `periodType`: "before" | "course" | "grace" | "archived"
- `weekLabel`: UI 표시용 라벨 ("3주차" | "📌 유예" | "종료")

**Google Sheets 작업**:
- N1 (수강시작일) 셀 읽기
- 서버에서 모든 날짜 계산 수행 (하드코딩 금지)

**에러 코드**:
- `401`: 인증 실패
- `500`: Google Sheets 읽기 오류

---

## MVP 스코프 제약

### 기간 제한 API 동작
모든 날짜 관련 API는 다음 제약을 따릅니다:

1. **수강 시작 전**: 읽기 전용 응답, 입력 API는 400 에러
2. **수강 기간 (1~8주)**: 모든 API 정상 동작
3. **마감 유예 (9~10주)**: 미팅/계약/수납 API만 허용, 나머지는 400 에러
4. **완전 종료 (11주~)**: 모든 쓰기 API 403 에러, 읽기만 허용

### 동적 계산 원칙
- 모든 기간 계산은 시트 N1 기준으로 서버에서 수행
- 클라이언트에 하드코딩된 날짜 금지
- `GET /api/schedule`이 모든 기간 정보를 제공

---

## 인증 및 보안

### 인증 방식
- **NextAuth Google OAuth**: 모든 API 엔드포인트 인증 필요
- Session 기반 인증, JWT 토큰 사용
- Google 계정의 email을 사용자 식별자로 활용

### Rate Limiting
- **읽기 API**: 60-120/min (사용자별)
- **쓰기 API**: 30/min (사용자별)
- Google Sheets API 할당량 고려한 제한

### 에러 처리
모든 API는 일관된 에러 응답 형식 사용:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "필수 필드가 누락되었습니다",
    "details": {
      "field": "channels",
      "reason": "배열이 비어있습니다"
    }
  }
}
```

### CORS 및 보안 헤더
- Next.js API Routes 기본 보안 설정
- 동일 출처 정책, CSRF 보호
- Google Sheets API 권한: 읽기/쓰기 (특정 스프레드시트만)