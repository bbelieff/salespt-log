---
slug: loadme-trainer-empty-sheet
status: active
created: 2026-06-22
owner: belie
related: data-model
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: loadMe 가 빈 spreadsheetId 트레이너 행에서 readBundle throw → /api/me 500 → '내 아레나 일지' 토글 미노출 → 빈 시트 가드.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: lib/service/me.ts(loadMe), 트레이너 페이지/대시보드 토글

# fix — 트레이너 loadMe 빈 시트 가드

## 원인
수강생출신 트레이너는 선호 행(role=trainer)의 spreadsheetId 가 빈 값인데 `loadMe` 가 `readBundle(user.spreadsheetId)` 를 무조건 호출 → readProfileBundle("") 가 batchGet 에 빈 ID → 404 throw → loadMe throw → /api/me 500 → `me.data` undefined → 토글 게이트(ownArenaSheetId) 항상 false.

## 변경 (lib/service/me.ts loadMe)
- spreadsheetId 빈값/read 실패 시 `bundle = null` 로 강등(throw 안 함). cohort/name 은 user 값, 날짜 ISO 는 "".
- ownArenaSheetId: `findActiveArenaRowByEmail(email)?.spreadsheetId` 우선, 없으면 `findArenaSheetIdByName(user.name)` 폴백(중복·동명이인 안전).

## 수용 기준
- 수강생출신 트레이너 로그인 → /trainer·/dashboard 토글 노출, "내 아레나 일지" → 본인 시트 진입. /api/me 200.
- 순수 트레이너(아레나 행 없음)도 /api/me 200(토글 미노출 정상).
- typecheck/lint/test 그린 + build + 배포 + health 200.

## Log
- 2026-06-22 구현(fix/loadme-trainer-empty-sheet): readBundle 빈시트 가드 + ownArenaSheetId 이메일 우선.
