---
slug: gcal-per-user-identity
status: completed
created: 2026-07-10
owner: belie
related: google-calendar-sync, ADR-0028
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: gcal 연동 귀속 사고 수정 — 임퍼스네이션 화면이 마스터 계정 상태를 보이고 마스터에 연결되던 것을 "화면의 수강생 기준 표시 + 본인만 조작"으로 통일, 콜백 localhost 복귀도 수정.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: app/api/gcal/* 6라우트, lib/service/gcal-guard.ts, GcalConnectCard, lib/config appBaseUrl
> - **읽고 나면 알 수 있는 것**: 무엇이 새던 경로였나(세션 기준 표시), 훅·다중행은 왜 무변경인가, localhost 원인
> - **관련 문서**: docs/plans/active/google-calendar-sync.md §4·§8, ADR-0028

# gcal 귀속 수정 (per-user identity)

## 진단 (2026-07-10 실측 + 코드 확정)
- 6개 gcal 라우트 전부 `getSessionEmail`(실로그인) — 임퍼스네이션 무시가 의도였으나
  **표시(GET)까지 세션 기준** → 임퍼스네이션 화면마다 마스터 연결 상태 노출 +
  [연결하기]가 마스터 행에 저장(운영자→테스터 계정 실측 재현, 상세=레지스트리 로그).
- 훅(gcal-sync)은 active(수강생) email 인자 — 마스터 토큰 오용 **원래 없음**(무변경).
- 다중행: updateUserCell = pickPreferredRow(읽기와 동일 행) — Drive 사고 때 이미 고정(무변경).
- localhost 복귀: callback 이 `new URL("/calendar", req.url)` — 프록시 뒤 req.url 호스트가
  localhost:3000(수강생 실사용 신고 1건). redirect_uri(구글 등록용)는 AUTH_URL 기준 정상.

## 수정
- **귀속 원칙**: 표시(GET /api/gcal, /states)=화면의 수강생(active). 조작(auth 시작·설정
  POST·해제 DELETE·resync·toggle)=본인만 — 임퍼스네이션 403/selfonly 리디렉션.
  판정은 순수 `gcalActorFrom(session, active)`(gcal-guard.ts, 단위테스트).
- **카드**: impersonated 면 3상태 모두 버튼 비활성/숨김 + "본인 로그인에서만 연결할 수
  있어요". 연결 완료 토스트에 [다시 올리기] 힌트 병기.
- **복귀 URL**: appBaseUrl(AUTH_URL) 단일 기준(config) — callback·auth 리디렉션 +
  gcal-oauth redirectUri 재사용 통일.
- **오염 정리**: 마스터 계정 행 gcal S/T 실측 후 비움(스크립트, PR 본문 기록).

## Log
- 2026-07-10 구현.
- 2026-07-11 라이브 카나리아 통과 (PR #519 배포 후, 운영자 실계정):
  - 임퍼스네이션 화면: 표시=화면의 수강생 상태(connected:false·impersonated:true),
    카드 "본인 로그인에서만" 문구, 조작(POST/DELETE/resync) 전부 403.
  - 본인 실연결: OAuth 동의 → salesptlog.online/calendar 복귀 (**localhost 0회**),
    카드 연결됨 + 캘린더 목록 실로드, GET /api/gcal connected:true·본인 계정 귀속.
  - 레지스트리 실측: 마스터 행 S=암호화 토큰 저장·T=settings 생성 확인 후
    연결 해제(DELETE 200 → S 비움)·T 스크립트 비움으로 원상복구, 재실측 둘 다 빈 값.
