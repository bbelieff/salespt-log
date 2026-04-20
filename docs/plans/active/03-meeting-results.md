---
slug: 03-meeting-results
status: active
created: 2026-04-20
updated: 2026-04-20
worktree: ../wt/03-meeting-results
depends_on: 02-meeting-booking
---

# 03 — 미팅별 결과 입력 (상태·계약·수임비)

## Executive Summary
`prototype/index.html`의 "일정·계약" 탭에 미팅별 결과 입력 UI를 추가한다. 현재는 캘린더 + 미팅 리스트만 표시하고 있으나, 미팅 완료 후 상태(예약/완료/취소), 계약 여부, 수임비, 계약 비고를 기록할 수 있도록 한다. 입력된 데이터는 시트의 J~P열에 반영되어 대시보드 "총매출" 자동 갱신에 기여한다.

## Requirements

### 기능 요구사항
1. **미팅 카드 확장 UI**: 기존 미팅 리스트에서 각 미팅 카드 클릭 시 결과 입력 영역이 아코디언 방식으로 펼쳐짐
2. **결과 필드 입력**: 
   - 상태: 예약/완료/취소 (드롭다운)
   - 계약여부: boolean (체크박스)
   - 수임비: number (만원 단위, 계약여부=true일 때만 활성화)
   - 계약비고: text (업체명+결제조건 등)
3. **저장 및 갱신**: 저장 시 `dayStore[date].meetings[i]` 업데이트, 대시보드 총매출 자동 갱신
4. **검증**: 계약여부=true인데 수임비=0이면 경고 표시

### 데이터 요구사항 (시트 매핑)

미팅별 결과 데이터는 기존 `앱_미팅예약` 탭에 컬럼을 추가하여 저장:

| 기존 컬럼 | 추가 컬럼 | 타입 | 매핑 | 비고 |
|---|---|---|---|---|
| A-G | H: status | 예약/완료/취소 | Meeting.status | 드롭다운 |
| | I: 계약여부 | boolean | Meeting.계약여부 | 체크박스 |
| | J: 수임비 | number | Meeting.수임비 | 만원 단위, 계약여부=true시만 |
| | K: 계약비고 | text | Meeting.계약비고 | 업체명+결제조건 |

### UI/UX 요구사항
1. **모바일 우선 설계**: 기존 캘린더 레이아웃 유지, 미팅 카드만 확장
2. **아코디언 애니메이션**: 미팅 카드 탭 시 결과 입력 섹션이 부드럽게 펼쳐짐
3. **조건부 활성화**: 계약여부 체크 시에만 수임비 입력 필드 활성화
4. **즉시 반영**: 저장 후 캘린더 화면에서 미팅 카드에 상태 표시 (배지 또는 아이콘)

### 기술적 제약사항
1. **프로토타입 범위**: `prototype/index.html` 내에서만 구현, 실제 시트 연동 없이 `dayStore` 객체 사용
2. **기존 구조 유지**: `renderCalSelected()` 함수 기반 구조 활용, 새로운 렌더링 함수 추가
3. **데이터 일관성**: 미팅별 결과는 `Meeting` 객체에 추가 필드로 저장

## Acceptance Criteria

### 필수 기능
- [ ] 미팅 카드 클릭 시 결과 입력 섹션 토글 (아코디언)
- [ ] 상태 드롭다운: 예약(기본값)/완료/취소
- [ ] 계약여부 체크박스
- [ ] 수임비 입력 필드 (계약여부=true시만 활성화)
- [ ] 계약비고 텍스트 입력
- [ ] 저장 버튼 클릭 시 `dayStore` 업데이트
- [ ] 검증: 계약여부=true && 수임비=0일 때 경고 메시지

### 데이터 연동
- [ ] 저장된 결과가 대시보드 "총매출"에 반영 (기존 `calculateFinancialSummary()` 함수 확장)
- [ ] 미팅 상태별 시각적 표시 (완료: 초록색, 취소: 회색 등)
- [ ] 미팅 목록에서 계약 성사 건은 별도 표시 (💰 아이콘 등)

### UI/UX 품질
- [ ] 60fps 아코디언 애니메이션
- [ ] 모바일 터치 최적화 (최소 44px 터치 영역)
- [ ] 저장 중 로딩 상태 표시
- [ ] 저장 완료 후 토스트 메시지
- [ ] 입력 검증 실시간 피드백

### 코드 품질
- [ ] 기존 `renderCalSelected()` 함수와 일관된 코딩 스타일
- [ ] 새로운 함수: `renderMeetingResults()`, `saveMeetingResult()`, `validateMeetingResult()`
- [ ] 주석으로 기능 구분 명시
- [ ] `dayStore` 스키마 확장 문서화

## Technical Design

### 데이터 모델 확장 (프로토타입)
```javascript
// 기존 Meeting 객체에 추가
const meeting = {
  // 기존 필드...
  date: "2026-04-20",
  hour: 14,
  min: 30,
  vendor: "○○치킨",
  region: "방이동",
  
  // 추가 필드
  status: "예약",        // 예약|완료|취소
  계약여부: false,       // boolean
  수임비: 0,            // number (만원)
  계약비고: ""          // string
};
```

### 함수 설계
1. **`expandMeetingCard(meetingIndex)`**: 미팅 카드 결과 입력 섹션 토글
2. **`renderMeetingResultForm(meeting, index)`**: 결과 입력 폼 HTML 생성
3. **`saveMeetingResult(meetingIndex)`**: 결과 저장 및 `dayStore` 업데이트
4. **`validateMeetingResult(data)`**: 입력 검증 (계약여부 vs 수임비)
5. **`updateFinancialSummary()`**: 기존 함수 확장, 수임비 합계 반영

### UI 컴포넌트
1. **결과 입력 폼**: 각 미팅 카드 하단에 숨겨진 섹션
2. **상태 드롭다운**: 커스텀 스타일링으로 일관성 유지
3. **수임비 입력**: 기존 스테퍼 버튼 스타일 재사용
4. **저장 버튼**: 기존 저장 버튼과 동일한 디자인

## Context
- [[docs/domains/data-model.md]] — Meeting 타입 정의 및 시트 컬럼 매핑
- [[docs/plans/active/02-meeting-booking.md]] — 미팅 예약 기능 (선행 작업)
- [[prototype/index.html]] — 현재 "일정·계약" 탭 구현 (`renderCalSelected` 함수)

## TBD — 구현 전 확정 필요
- [ ] 미팅 결과 수정/삭제 기능 포함 여부 (Phase 1 vs Phase 2)
- [ ] 계약 성사 시 추가 알림/축하 효과 필요성
- [ ] 취소된 미팅의 시각적 처리 방식 (회색 처리 vs 숨김)
- [ ] 일괄 상태 변경 기능 (선택한 여러 미팅을 한번에 "완료" 처리 등)

## Log
- 2026-04-20 초기 플랜 작성. 요구사항 분석 및 기술적 설계 완료.