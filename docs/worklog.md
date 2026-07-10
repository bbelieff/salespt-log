> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 모든 세션(Cowork·Claude Code)이 공유하는 작업 일지 — 세션 시작 시 읽고, 끝날 때 쓴다. 핸드오프 문서를 대체한다.
> - **누가 읽나요**: 모든 에이전트 세션(필수), 운영자(belie)
> - **어떤 기능·작업과 연결?**: 전체 트랙 공통 (CLAUDE.md §3 작업 규약 0단계)
> - **읽고 나면 알 수 있는 것**: 지금까지 무슨 일이 있었나 / 이번 요청이 어느 트랙의 연장인가 / 다음에 하기로 한 것은 무엇인가
> - **관련 문서**: CLAUDE.md §3·§5.5, docs/plans/active/* (각 트랙 SoR)

# 세션 워크로그 (Session Worklog)

## 프로토콜 (모든 세션 의무)

**시작할 때 (읽기)**
1. 아래 로그의 **최근 항목 5~10개**를 읽는다.
2. 지금 받은 요청이 **어느 트랙의 연장인지, 이전 결정과 충돌하지 않는지** 한 번 사고한 뒤,
   작업 첫 응답에 한 줄로 선언한다. (예: "이 작업은 R2 읽기 전환 트랙의 2호 PR입니다")
3. 상세가 필요하면 항목의 SoR 링크를 따라간다. 워크로그는 **지도**, 상세는 SoR에.

**끝날 때 (쓰기)**
- 작업 종료, 중요한 결정, PR 머지, 사고(incident) 시 **맨 위에** 항목을 추가한다.
- 형식 (한 항목 3~8줄, 초과 금지 — 길어지면 SoR 문서에 쓰고 링크만):

```
### YYYY-MM-DD · 세션종류(Cowork/Claude Code) · 한줄 제목
- 의도: 사용자가 왜 시켰나
- 한 것: 결과 중심 (PR#, 검증 결과, 생성물)
- 결정: 새로 확정되거나 뒤집힌 것 (없으면 생략)
- 다음: 남긴 것, 차기 세션이 이어받을 것
- SoR: 상세 문서 경로
```

**유지 규칙**
- 새 항목은 항상 맨 위 (최신순).
- 항목 40개 초과 시 오래된 것을 `docs/worklog-archive/YYYY-MM.md` 로 이동.
- 비밀값(비밀번호·토큰·URI) 절대 기록 금지.
- 이 파일은 append 전용에 가깝게 — 과거 항목 수정은 오기 정정만.

---

## 로그

### 2026-07-09 · Claude Code · gcal-1 구글 캘린더 연결 완주(#511) + VPS 배포·health 200
- 의도: gcal-1(OAuth 연결/해제 + refresh token AES-256-GCM 암호화 + 연동 카드) PR 완주 → 배포까지(§6.8)
- 한 것: #511 머지(레지스트리 S/T 컬럼 append, gcal-crypto 7테스트, 3라우트, 카드 3상태). 배포는 **GH러너→VPS:22 도달성 장애(#495 계열) 연속 실패(#510 2회·#511 초기)** → `gh run rerun --failed` **새 러너에서 성공**. VPS=origin/master=`d644567`, 공개 health 200. (PC-SSH 수동배포는 오토모드 가드가 차단 → 파이프라인 재시도로 정상 완주, 수동 불필요)
- 결정: 도달성 장애는 provider-edge — rerun 우회 가능하나 재발성이라 belie 가 provider 방화벽 점검 필요. GCP 사전작업은 이미 belie 완료(7/6~7, #477/#479) — 직전 보고에서 잘못 미완으로 표기했던 것 정정
- 다음: gcal-1 설계 개정(유형 토글 폐기, 아래 항목), 이후 라이브 카나리아(belie), DATABASE_URL 비번 로테이션(보류)
- SoR: docs/plans/active/gcal-connect.md, docs/plans/active/google-calendar-sync.md §6

### 2026-07-08 · Cowork · chore/api-timing-baseline = 이미 #484로 완료·배포 확인(중복 회피)
- 의도: DB 이전 효과 증명용 P0 기준선(api_timing 계측) PR 완주 지시 받음
- 한 것: 착수 전 상태 확인 → api_timing 계측이 **이미 master 반영**(PR #484 `11f2da1`, withApiTiming 58라우트 래핑 + AsyncLocalStorage sheets_ms/sheets_calls + PostHog api_timing). #487/R2가 이 계측 위에서 동작 중. 사이트 health 200(prod release 확인). **재구현·머지 안 함**
- 결정: 잔존 브랜치 `chore/api-timing-baseline`(376f6da)는 #484 머지 前 옛 master에서 뜬 **낡은 중복본**(api-timing.ts 내용도 master보다 구버전) → 머지 시 후퇴. **삭제 대상**(로컬+원격, git 정리는 PC에서). p50/p95 추출법: PostHog Insights→Trends→api_timing 이벤트 ms median/p95 + route breakdown (또는 HogQL quantile(0.5|0.95)(ms))
- 다음: PC에서 stale 브랜치 삭제(`git push origin --delete chore/api-timing-baseline` + 로컬 `git branch -D`). db-migration-pilot §1은 P0 완료 상태로 간주
- SoR: docs/plans/active/db-migration-pilot.md §1 P0, lib/analytics/api-timing.ts(master)

### 2026-07-08 · Cowork(Fable) · 9기 재등록 요청 = 이미 완료 확인(중복 회피) + 아레나 중간점검 발표자료 완성
- 의도: 사용자 (1) "9기 5명 등록" 요청 (2) 아레나 A1 중간점검 발표 PPT 제작·최신화
- 한 것: ① 레지스트리 교차확인 — 9기 5행(구상희·유민영·전수민·박진우(조다영)·오이슬, 개강 7/10·종강 8/29, 시트 배정 완료) 이미 존재 → 재등록 안 함. admin 사전등록 폼은 시트 URL 필수라 그대로 진행했으면 중복 시트 생성 위험(워크로그가 막음). ② 아레나 중간점검 발표 PPT 18장 완성(전광판 라이브 기준) — outputs 폴더
- 결정: 부부=박진우(조다영) 한 시트로 이미 처리(name-match resolver가 두 이름 클레임 흡수). 발표 누적 수치는 PostHog 이벤트(528) 대신 전광판 실데이터로 재베이스(6/12~현재 4대지표 1,327·부문 시상 5종: 미팅/계약/매출/앱사용/공유왕)
- 다음: 9기 7/10 클레임 안내(부부는 한 명만·아무 이름으로나). 발표 노션 대본은 아직 17장(18장 재싱크 미완)
- SoR: docs/plans/active/db-migration-pilot.md(9기 파일럿), 발표물=outputs(비레포)

### 2026-07-08 · Cowork(Opus) · DB 마이그레이션 운영자 교육 세션 (belie 전체~세부 구조 이해)
- 의도: 곧 전체 DB 전환이라 belie가 큰 그림~세부를 쥐어야 함 — 용어·단계·저장위치·앱화면·어드민·Supabase/MCP 질의응답
- 한 것: 비주얼 5종 설명(①시트→PG 목표구조 ②읽기/쓰기 정본 뒤집힘 4단계 ③개인·기수·아레나·트레이너·어드민 전체구성+RLS ④지금데이터 저장위치 매핑 ⑤Supabase Studio 화면). 저장(공지/점수)↔계산(전광판/대시보드) 구분 강조. Supabase MCP=개발용·read-only+scoped 권고(운영DB 금지, 앱접속 DATABASE_URL과 별개) 안내. 메모리 project-db-migration-pilot 갱신
- 결정: 없음 — 교육/오리엔테이션, 트랙 방향 변경 없음(내가 P2/P3로 부르던 걸 로드맵 정본 R2/R3로 정렬)
- 다음: belie 요청 시 참고문서(용어·구조·저장지도) 1편 저장 또는 특정 테이블(payments/users) 컬럼 상세. Supabase MCP 설치는 belie가 클라이언트에서 — 절차 안내 대기
- SoR: docs/plans/active/db-first-unlimited-roadmap.md, docs/plans/active/db-migration-pilot.md

### 2026-07-08 · Cowork · 사용법 카페 연재 12편 이미지·제목 정비 (콘텐츠 트랙)
- 의도: 사용법(how-to) 시리즈 게시 전 검열 — 홈화면추가 정확도, 실제화면 클릭 마커, 제목 포맷 통일
- 한 것: USE01 홈화면추가 이미지 = 모바일 세로 4단계 재제작(iOS 크롬 공유→더보기(⌄)→홈 화면에 추가→추가, 사용자 실제폰 확인·검증). USE02~09 실제화면에 번호 마커 v2(얇은 하이라이트+흰테 핀+하단 legend, 좌표그리드 실측, 핀 위치 통일·겹침 제거). 아레나 언급 전편 삭제(USE10=이전계약등록만). 제목 `NN. [사용법] 부제`로 12편 통일
- 결정: 연재 순서 = 사용법 먼저→기능설명 나중(2단계). 마커 렌더는 DSF1 사용(shot.cjs DSF2는 tall 이미지 상하 2벌 중복 버그). 아이폰 홈추가는 크롬·사파리 모두 "공유→더보기→홈 화면에 추가"(iOS 크롬도 가능 — 초기 오안내 정정)
- 다음: USE04(미팅잡기)↔USE02(컨택입력) 동일화면 중복 차별화 결정, 기능설명 시리즈 목차, USE10~12 개념도 검열. 게시는 belie 운영세션(파일만 준비 완료)
- SoR: `경영일지 앱관련 카페글쓰기/사용법/`, 메모리 feedback-usage-series-writing

### 2026-07-08 · Claude Code · R2-1 컨택 읽기 DB 전환 완주 (#491) + 후속 docs(#493)
- 의도: R2 읽기 전환 트랙 1호 — loadDay의 readWeek+stacking을 파일럿 기수(8·9·연습) 한정 DB 단일 쿼리로
- 한 것: #491 머지·배포 success(attempt1은 rc=255×7 VPS 도달성 장애 → rerun 성공)·health 200. chooseDailySource 단일 게이트 + Sentry+시트 fallback, 정합 7테스트, contact-week.ts 분리(500줄 캡). #493으로 plan completed 이동(머지됨, 배포 관찰 중)
- 결정: "후" 속도 수치는 로컬 측정 불가(DATABASE_URL은 운영만) — 파일럿 실사용 api_timing이 쌓이면 PostHog HogQL로 뽑아 PR #491 코멘트에 전/후 표 갱신(전: p50 1,845/p95 2,515ms, 목표 p50≤300)
- 다음: #491 코멘트 후 수치 갱신(관찰 대기), R2-2(meetings·banners 읽기 전환), 대기열: gcal-connect→sync-engine, deploy-env-admin-token
- SoR: docs/plans/completed/db-read-contact.md, docs/plans/active/db-first-unlimited-roadmap.md(R2)

### 2026-07-08 · Cowork(Fable) · DB 파일럿 초록 판정 + R2 조기 착수
- 의도: 9기 마무리 검증 → "속도 개선은 2단계부터인데 바로 가면 안 되나"(사용자) → 셀프테스트로 관문 조기 통과
- 한 것: ① 9기 5시트+레지스트리 최종 검증 완료(#VALUE! 해결 확인, #DIV/0! 6곳=템플릿 동일=정상, a9/a유민영 오염 행 수정 확인, 폴더 이동 무해 확인) ② 연습용 계정 임퍼스네이션(트레이너 페이지→웹앱 버튼)으로 컨택 유입+1/컨택+1 저장 → 시트(유입 82→83)·DB(284→288행) 동시 반영 = 이중기록 정합 초록 ③ R2-1(feat/db-read-contact)·R2-1.5(feat/db-pilot-arena) 프롬프트 사용자에게 전달
- 결정: R2(읽기 전환)를 9기 자연 관찰 없이 조기 착수(시트=정본 유지라 fallback 가능). 아레나 속도 개선을 R5(체계 통합)에서 분리 — R2-1 검증 후 R2-1.5로 편입. admin의 DB 진단 UI는 /admin 하단 배너뿐(/admin/db-parity 라우트 없음 — 무한로딩 함정 주의)
- 다음: R2-1 실행(Claude Code) → 머지·배포 확인 후 R2-1.5. 9기 7/10 클레임 안내(부부=박진우(조다영) 한 명만). 9기 첫 기록 dual-write 관찰(블로커 아님)
- SoR: docs/plans/active/db-first-unlimited-roadmap.md(R2·§B), docs/plans/active/db-migration-pilot.md

### 2026-07-07~08 · Cowork · 9기 생성 (admin 우회, Drive 직접)
- 의도: 9기 5명(구상희·유민영·박진우(조다영)·오이슬·전수민, 개강 7/10) 시트·레지스트리 준비
- 한 것: admin 기수 생성 실패(VPS에 ADMIN_DRIVE_REFRESH_TOKEN 미설정) → Drive copy_file로 5시트 직접 복제(9기 루트 폴더). O1/O2를 RAW로 써서 전면 #VALUE! 사고 → USER_ENTERED 재기록으로 해결(Claude Code fix/cohort9-finalize). 시작 7/10·종강 8/29(+50일)
- 결정: 개별 시트 날짜 셀은 반드시 USER_ENTERED (RAW면 날짜가 텍스트가 되어 수식 전멸). 레지스트리는 RAW 유지
- 다음: chore/deploy-env-admin-token(다음 기수부터 admin 버튼으로) — 프롬프트 전달됨, 미실행
- SoR: docs/decisions/0005(날짜 규칙), docs/decisions/0015(시트 복제=belie OAuth)

### 2026-07-06~07 · Cowork+Claude Code · DB 파일럿 인프라~백필 (PR #480~#488)
- 의도: 앱 느림의 구조적 해결 — Sheets→Supabase(관리형 Postgres) 전환 1단계(이중기록)
- 한 것: 기획 등재(#480), Supabase 확정(Seoul, PG17, 프로젝트 aoevgfroxdvgbmgvzlfb)(#482), GitHub Secrets→VPS .env 주입(#481), api_timing 계측 기준선(#484), 인프라(#485), 배포 SSH 재시도(#486), dual-write 24훅(#487), 8기 backfill 273건(#488). DATABASE_URL 호스트 오입력 사고 → keep-alive로 발견·교체
- 결정: DB 비밀번호 등 자격증명은 에이전트가 평문 조합·기입 금지(고정 원칙). 시트가 정본인 동안 DB 장애=무영향(fire-and-forget)
- 다음: (7/8에 이어짐 — 위 항목)
- SoR: docs/plans/active/db-migration-pilot.md, docs/handoffs/2026-07-06-owner-return-checklist.md

### 2026-07-06~07 · Cowork · 구글 캘린더 연동 준비 100% (구현 대기)
- 의도: 미팅 예약을 수강생 구글 캘린더에 자동 반영 ("항상 기억" 지시)
- 한 것: 기획+ADR-0028 등재(#477), GCP 콘솔 사전작업 3종 직접 완료(Calendar API 활성·scope 등록·리디렉션 URI, 계정 beliefkimkim), NEW 뱃지 앵커 calendar.gcalCard 예약(#479)
- 다음: feat/gcal-connect → feat/gcal-sync-engine (DB 트랙과 레포 구역 겹침 → R2-1 이후 순차 실행 권장). SoR의 §4-1 문구표·§8 QA 30케이스 최신본은 워킹트리 기준
- SoR: docs/plans/active/google-calendar-sync.md
