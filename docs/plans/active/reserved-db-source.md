> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 유보생도 원래 기수 DB에서 읽도록 고친 기록
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: 유보 저장 위치 선택·0기 관리자 시험 계정
> - **읽고 나면 알 수 있는 것**: 문제·원인·수정·검증·되돌리기
> - **관련 문서**: `docs/worklog.md` 2026-10-06 항목

# 유보 수강생 저장 위치 · 0기(관리자 시험 계정) (2026-10-06)

## 문제
유보로 바꾼 DB 기수 학생이 시트 사본을 읽고 썼다. 10/2 유보 처리한 11기 하차 2명에서 발견.

## 원인
앱은 "기수 값"으로 DB/시트를 고른다(`lib/service/daily-source.ts`의 `chooseDailySource`/`chooseWriteSource`, `DB_READ_COHORTS`).
유보 기능은 명단 숨기려고 registry B열(기수 칸)을 "유보"로 덮어쓴다. 그래서 DB 학생이 시트 경로로 바뀌었다.

## 수정
`daily-source.ts`에 `sourceCohort(u)` 추가. 기수가 "유보"면 registry I열(`cohortLabel`, 시트 B3 캐시)의 원래 기수로 판단한다.
저장 위치 고르는 22곳(calendar, contact-week, contact, contract-payment, dashboard, db, todos, me)에서 사용. 유보 아닌 학생은 변화 없음.
유보 판정(`isReservedTrainee`, 퇴출 흐름)은 그대로.
"0"을 DB 기수 목록에 추가. 관리자 시험 계정 "0기 GM"은 새 시트·옮길 과거 없음·처음부터 DB 정본. 유보로 관리자 명단에만 보이고 순위표(아레나)·트레이너 화면에 안 잡힌다.

## 검증
`tests/service/daily-source-reserved.test.ts` 추가. service 테스트 941개 통과, 타입검사 통과.

## 되돌리기
squash 커밋 revert. 데이터 변경 없음.

## 후속 (같은 날) — 관리자 이메일의 수강생 클레임
- 관리자 이메일에 트레이너 행(T)이 있으면 /claim 이 기존 행을 돌려주고 끝나서 0기 GM 사전등록 행을 클레임할 수 없었다.
- 수정: claimAccount — 관리자 이메일 + 기존 행이 수강생이 아님 + 클레임 기수가 T 가 아니면 일반 수강생 클레임을 진행. 일반 사용자 영향 없음.
- 테스트 tests/service/auth-admin-trainee-claim.test.ts (패치·테스트 초안: Muse muse-spark-1.3-contributor, 총괄 검토·적용).
