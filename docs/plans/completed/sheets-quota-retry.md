---
status: completed
slug: sheets-quota-retry
created: 2026-05-19
completed: 2026-05-19
archived: 2026-07-12
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: Sheets API 429 quota 자동 retry — exponential backoff 으로 transparent 복구
> - **누가 읽나요**: 개발자

# sheets-quota-retry

## 사용자 보고 (2026-05-19)
"오승진 경영일지 ⚠ 불러오기 실패: Quota exceeded for quota metric 'Read requests' and limit 'Read requests per minute per user' of service 'sheets.googleapis.com'"

## Root Cause
- Sheets API 한도: 60 read req/min/user (서비스 계정 = 단일 user)
- 페이지 로드 또는 빠른 reload 시 read 요청 폭주 → 429
- 기존 코드에 retry 없음 → 사용자 에러 노출

## Fix
`lib/repo/sheets-client.ts` 의 `sheetsClient()` 가 반환하는 객체를 Proxy 로 감싸,
모든 API 메서드 호출이 자동 `withRetry` 적용:
- 429 / "Quota exceeded" / "Rate Limit Exceeded" 감지
- exponential backoff: 1s → 2s → 4s → 8s (jitter ±250ms, 최대 4 시도)
- 60s window 내 reset 되므로 한 wave 내에 복구
- 다른 에러는 즉시 throw

## Acceptance
- [ ] 429 발생 시 자동 재시도, UI 에러 표시 안 됨
- [ ] 비-429 에러는 기존 흐름 유지
- [ ] check.sh 통과
