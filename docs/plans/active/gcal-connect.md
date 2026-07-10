---
slug: gcal-connect
status: active
created: 2026-07-09
owner: belie
related: google-calendar-sync, 0028-user-gcal-oauth-token, sheet-structure
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: gcal-1 — 구글 캘린더 opt-in OAuth 연결/해제 + refresh token AES-256-GCM 암호화 저장 + 연동 카드 UI(캘린더 선택 드롭다운·연결 해제). 유형 토글 폐기(2026-07-09), 일정별 개별 토글·이벤트 전파는 gcal-2.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: ADR-0028, google-calendar-sync §6 PR-2, 레지스트리 users S/T 컬럼, 캘린더 탭
> - **읽고 나면 알 수 있는 것**: 토큰을 어떻게 암호화·저장하나 / OAuth 흐름·CSRF / 카드 3상태 / 무엇이 gcal-2 로 미뤄졌나
> - **관련 문서**: docs/plans/active/google-calendar-sync.md, docs/decisions/0028-user-gcal-oauth-token.md

# gcal-1 — 구글 캘린더 연결 + 연동 카드

## 구현
- **crypto** (lib/repo/gcal-crypto.ts): AES-256-GCM, 키=HKDF-SHA256(AUTH_SECRET). 포맷
  `v1:iv:tag:ct`. GCM 무결성(변조 throw). 왕복·변조·포맷·빈값 7테스트.
- **레지스트리 컬럼**: users 탭 S(gcal_token 암호화)·T(gcal_settings JSON `{calendarId}`) append(A2:R→A2:T,
  parseRow r[18]/r[19], User.gcalToken/gcalSettings). 기존 컬럼 무변경(2026-05-12 사고 가드).
- **OAuth** (lib/repo/gcal-oauth.ts): 로그인 분리 opt-in, 스코프 2개(calendar.events+readonly).
  buildConsentUrl(access_type=offline·prompt=consent) / exchangeCodeForToken / revokeToken /
  listWritableCalendars(드롭다운, owner|writer). googleapis 격리 규칙 준수(repo).
- **service** (lib/service/gcal-connect.ts): 연결 완료·해제·카드 상태·설정. 평문 토큰 응답 미노출.
- **라우트**: /api/gcal/auth(시작, state 쿠키 CSRF)·/api/gcal/callback(교환·저장, state 대조)·
  /api/gcal(GET 카드·POST 설정·DELETE 해제). 전부 getSessionEmail(impersonation 무시).
- **UI** (calendar/_components/GcalConnectCard.tsx): §4-1 문구 정본. 미연결/연결됨/실패 3상태.
  연결됨=캘린더 드롭다운+[연결 해제]. 금지 용어(동기화·토큰·OAuth·만료·캘린더 ID) 화면 미노출.
  ※ 유형 토글 3종(미팅/실무/일반)은 폐기(2026-07-09, feat/gcal-drop-type-toggles) — 아래 gcal-2.

## gcal-2 로 미룸 (스코프 밖)
- **일정별 개별 토글(기본 ON, 제외 마커 `"-"`)** — 캘린더 탭 각 일정 항목에(카드가 아님).
- [다시 올리기](전체 재동기화)·계정 표시·이벤트 생성/수정/삭제 전파·gcal_event_ids 컬럼·gcal-client(v3 쓰기).
  → 카드에 [다시 올리기]·계정 표시는 gcal-2 에서 추가(전파할 이벤트가 생긴 뒤).

## 운영 선행 (belie, 코드 밖 — google-calendar-sync §5)
- GCP Calendar API 활성·동의화면 scope 추가·테스트 사용자 등록·리디렉션 URI
  (https://salesptlog.online/api/gcal/callback) 등록. 미완이면 연결 시 "확인되지 않은 앱" 경고.

## 수용 기준
- 암복호화 왕복·변조 7테스트, 구조(googleapis 격리에 gcal-oauth 포함), check 초록.
- 라이브 카나리아(배포 후 belie): 연결→경고 통과→"연결됨"→해제.

## Log
- 2026-07-09 구현: crypto+레지스트리 S/T+OAuth+service+3라우트+카드. 365 테스트 초록. #511 머지·배포·health 200.
- 2026-07-09 개정(feat/gcal-drop-type-toggles): 유형 토글 3종 폐기 → gcal_settings=calendarId 만.
  카드에서 토글 3행 제거, SettingsPatch/GcalSettings/User 타입/SoR §0·§2·§4·§8·components·sheet-structure 동기화.
  parseGcalSettings 옛 토글키 strip 테스트 추가. 일정별 개별 토글은 gcal-2.
