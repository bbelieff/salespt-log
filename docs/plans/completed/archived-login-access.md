---
slug: archived-login-access
status: active
created: 2026-07-07
owner: belie
related: rejoin-routing, user-priority, identity
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 보관(archived) 처리된 등록 수강생이 본인 로그인 시 /claim 으로 무한히 튕기는 버그를 "시트 있는 등록 수강생은 통과(읽기 전용)"로 고치는 계획.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: app/page.tsx · app/(app)/layout.tsx 라우팅, lib/auth/identity.ts(쓰기 가드), lib/repo/user-priority.ts(순수 판정), 일반 쓰기 API 라우트 전체
> - **읽고 나면 알 수 있는 것**: 왜 튕겼나(4곳 redirect), 무엇을 완화하나, 읽기 전용을 어디서 보장하나
> - **관련 문서**: tests/repo/rejoin-routing.test.ts, docs/domains/data-model.md

# 보관 기수 수강생 로그인 허용 (읽기 전용)

## 배경
- 신고: 함진숙(7기, 레지스트리 행 status=archived) 본인 로그인 → /claim 무한루프.
- 원인: page.tsx L61·L63 + (app)/layout.tsx L45·L48 — archived(행 status 또는 cohorts
  보관 기수)면 무조건 /claim. 재등록해도 옛 기수라 다시 보관 판정 → 무한.

## 방침
- **시트 있는 등록 수강생(role=trainee, spreadsheetId 있음)은 archived 여도 통과** →
  본인 대시보드(읽기 전용). 진짜 미등록(행 없음/시트 없음)만 /claim.
- 순수 판정 `hasOwnSheet(u)` 를 user-priority.ts 에 추가(단위테스트 대상).
- **쓰기 차단(안전장치)**: 편집기간 서버 가드가 실제로는 없음(주석만) → identity.ts 에
  `getWritableUserEmail()` 신설: 대상 사용자 status=archived 면 throw(읽기 전용 안내).
  admin 세션(impersonation)은 예외(기존 보정 작업 유지). 일반 쓰기 라우트(POST/PATCH/
  DELETE)만 이 함수로 교체 — GET 은 기존 getCurrentUserEmail 유지(보관 사용자 읽기 허용).
- 불변: isNumericCohortArchived 함수 본체 · pickPreferredUser 우선순위 · claim 라우트
  (명시적 재참가 경로) · admin/trainer/pending/아레나 분기.

## 수용 기준
- archived 등록 수강생 본인 로그인 → /dashboard 진입(무한루프 없음), 저장 시도는 차단.
- 미등록 사용자는 여전히 /claim. 트레이너/아레나/pending/admin 회귀 없음.
- check.sh + next build 초록, 단위테스트 추가.

## Log
- 2026-07-07 착수 (Cowork 진단 → PC 구현).
