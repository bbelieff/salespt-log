# ADR-0028 — 사용자별 구글 캘린더 토큰: 최소 스코프 opt-in OAuth + 레지스트리 암호화 저장

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 구글 캘린더 동기화용 권한을 로그인과 분리된 별도 opt-in OAuth(최소 스코프 2개)로 받고, per-user refresh token 을 레지스트리 시트 컬럼에 AES-256-GCM 으로 암호화 저장하기로 한 결정.
> - **누가 읽나요**: 개발자, 에이전트, 운영자(belie)
> - **어떤 기능·작업과 연결?**: 구글 캘린더 동기화(docs/plans/active/google-calendar-sync.md), NextAuth 로그인, 레지스트리 users 탭, `lib/repo/gcal-client.ts`(예정)
> - **읽고 나면 알 수 있는 것**: 왜 로그인 스코프를 안 늘리나, 어떤 스코프 2개를 왜 받나, 토큰을 어디에 어떻게 저장·폐기하나
> - **관련 문서**: [ADR-0015](0015-admin-oauth-drive-create.md), [google-calendar-sync 플랜](../plans/active/google-calendar-sync.md), docs/domains/sheet-structure.md

- **status**: accepted
- **date**: 2026-07-06
- **related**: [ADR-0015](0015-admin-oauth-drive-create.md) — 관리자 Drive 토큰과 같은 "별도 토큰" 패턴의 사용자판

## 맥락

캘린더 동기화(앱→구글 단방향)는 **수강생 본인의 구글 캘린더**에 이벤트를 써야 한다.
쓰기 권한을 얻는 경로는 셋 중 하나: ① 로그인(NextAuth) OAuth 스코프 확장,
② 서비스 계정(SA) 위임, ③ 기능 전용 별도 OAuth 동의(opt-in).

`calendar.events` 는 Google 분류상 **sensitive scope** — 동의 화면 경고·브랜드 검증
요건이 걸린다(플랜 §1 운영 리스크). 데이터 저장소는 SSOT 원칙상 Google Sheets 뿐이다
(별도 DB 금지, CLAUDE.md §2.5).

## 결정

1. **로그인 스코프 무변경 — 기능 전용 opt-in OAuth 를 분리한다.**
   캘린더 탭의 [연결하기] 버튼 → 별도 동의 화면 → per-user refresh token 획득.
   연결을 누른 사용자에게만 권한·리스크가 발생한다.
2. **최소 스코프 2개만 요청**: `calendar.events`(이벤트 쓰기) + `calendar.readonly`
   (대상 캘린더 드롭다운용 calendarList 조회 — `calendar.events` 만으로는 목록 조회 불가).
   전체 권한(`calendar`) 금지.
3. **토큰 저장 = 레지스트리 users 탭 신규 컬럼 `gcal_token`, AES-256-GCM 암호화.**
   키는 `AUTH_SECRET` 파생(HKDF). **평문 저장 절대 금지.** 설정은 `gcal_settings`(JSON)
   컬럼. 두 컬럼 모두 끝에 append(기존 컬럼 shift 금지), sheet-structure.md 등재 의무.
4. **해제 = `gcal_token` 비움 + 가능하면 구글 token revoke.** 이미 등록된 구글 이벤트는
   남긴다(사용자 안내 문구로 고지).

## 근거 · 기각한 대안

- **① 로그인 스코프 확장 — 기각.**
  - sensitive scope 가 로그인에 붙으면 **전체 수강생**(기능 안 쓸 사람 포함)이 경고
    동의 화면을 통과해야 함 — opt-in 불가, 온보딩 이탈 리스크.
  - 스코프 변경 시 기존 세션 재동의(re-consent) 유발 — 전원 재로그인 소동.
  - 브랜드 검증 심사 대상이 로그인 전체로 확대 — 실패 시 로그인 자체가 인질.
  - 최소 권한 원칙 위반: 캘린더를 안 쓰는 사용자의 토큰에도 캘린더 권한이 실림.
- **② SA(서비스 계정) 위임 — 기각.** 개인 구글 캘린더에 SA 가 쓰려면 domain-wide
  delegation 이 필요한데 이는 Workspace 전용 — 수강생은 소비자 계정이라 불가.
  (ADR-0015 에서 SA 한계로 관리자 OAuth 를 도입한 것과 동일 계열의 제약.)
- **③ opt-in 별도 OAuth — 채택.** ADR-0015(관리자 Drive refresh token)로 이미 검증된
  패턴의 사용자판. 권한·리스크가 "연결 누른 사람"으로 국한된다.
- **토큰 저장 위치**: SSOT=Sheets 원칙(별도 DB 금지)상 레지스트리가 유일한 per-user
  영속 저장소. 단 refresh token 은 민감 자격증명이므로 **암호화가 저장의 전제조건**
  — 시트 열람 권한(운영·SA)과 토큰 사용 권한을 분리한다(복호화는 `AUTH_SECRET` 보유
  서버만 가능).

## 영향

- 수강생 로그인 흐름·기존 토큰 영향 0. 캘린더 연결은 전적으로 선택.
- 레지스트리 users 탭 컬럼 2개 추가(`gcal_token`, `gcal_settings`) — sheet-structure.md
  §6 등재 후 구현(SSOT 드리프트 가드 대상).
- `AUTH_SECRET` 이 토큰 암호화 키 원천이 됨 — **`AUTH_SECRET` 로테이션 시 기존
  gcal_token 전부 복호화 불가** → 전원 "다시 연결" 필요. 로테이션 절차에 이 사실 명기.
- 운영 선행 작업(코드 밖): GCP Calendar API 활성화, 동의 화면 스코프 추가·테스트
  사용자 등록, 리디렉션 URI 등록 — 플랜 §5.
- 브랜드 검증 전에는 동의 화면 경고 또는 테스트 사용자(100명 한도, 현재 ~40명) 운용 —
  장기적으로 브랜드 검증 신청.
