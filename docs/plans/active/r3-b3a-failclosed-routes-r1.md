---
slug: r3-b3a-failclosed-routes-r1
status: active
created: 2026-10-17
---

> **이 문서는 무엇인가요?**
> - **한 줄 요약**: 업체정보·계약수납·연결 가능 미팅 API의 수강생 신원을 정본 컨텍스트로 결박하는 보존 후보의 복구와 PR HOLD 계획.
> - **누가 읽나요**: 작업원 E, 독립 검수자, Foreman.
> - **연결된 작업**: `SALES-PT-R3-B3A-FAILCLOSED-ROUTES-R2` (R1 복구 후보 독립 검수 후 수정).
> - **읽고 나면 알 수 있는 것**: 정확한 범위, 거절 계약, 기존 증거의 한계와 후속 검증·복구 순서.
> - **관련 문서**: [실행 규칙](../../../AGENTS.md), [제품 규칙](../../../CLAUDE.md).

# 수강생 컨텍스트 API 결박 후보 복구

## 목표와 승인 범위

기준 master는 `5492fb0587c099f6ffd0172b2eda806e94b01e31`, 소유 브랜치는 `codex/r3-b3a-failclosed-routes`다. R1은 보존된 11파일 바이트를 유지해 복구했다. R2는 독립 검수에서 발견한 쓰기 게이트 누락을 같은 12경로 안에서 수정한다. 추가 문서는 이 plan뿐이며 기존 PR #1165 HOLD를 유지한다. 정상 검사·빌드·원격 CI와 F 재검수, Foreman release 전에는 병합·배포하지 않는다.

- `requireStudentViewContext`를 9개 route의 14개 handler 진입점에서 호출한다.
- 미인증은 401, 무효 대상·대상 미선택·허용되지 않은 학생 화면은 403으로 거절한다. `StudentViewContextError`는 안정된 `{error: code, code}` 응답으로 변환한다.
- 거절 시 하위 서비스 호출은 0회다. 정상 own·assigned·arena 모드에서는 정본이 해석한 이메일을 하위 서비스로 전달한다. 업체정보 GET도 세션의 트레이너 이메일 대신 해석된 arena 수강생 이메일을 사용한다.
- 변경을 수행하는 10개 handler는 `requireStudentViewContext`를 먼저 호출한 뒤 기존 `getWritableUserEmail` 권한 결정을 유지한다. 두 이메일을 trim/lowercase로 비교해 불일치하면 본문 읽기·서비스 호출 전에 403 `{error: "student_write_target_mismatch", code: "student_write_target_mismatch"}`로 거절한다. 일치하면 trusted context 이메일로 전달한다. 읽기 허용만으로 쓰기 권한을 대체하지 않는다.
- 기존 입력 검증·업무 오류·성공 응답·서비스/저장소 계약은 유지한다. 인증 정본, 서비스, 저장소, 타입, UI, 운영 데이터·권한은 이 후보에서 수정하지 않는다.

## 정확한 12경로 lease

1. `app/api/company-info/route.ts`
2. `app/api/contract-payment/route.ts`
3. `app/api/contract-payment/[row]/route.ts`
4. `app/api/contract-payment/[row]/terminate/route.ts`
5. `app/api/contract-payment/[row]/link-meeting/route.ts`
6. `app/api/contract-payment/edit-linked/route.ts`
7. `app/api/contract-payment/prior/route.ts`
8. `app/api/contract-payment/standalone/route.ts`
9. `app/api/meetings/linkable/route.ts`
10. `tests/api/b3-student-context-routes.test.ts`
11. `tests/api/contract-payment-standalone-route.test.ts`
12. `docs/plans/active/r3-b3a-failclosed-routes-r1.md`

`docs/worklog.md`, 패키지/lockfile, 다른 plan·코드·테스트는 lease 밖이다. #1158/#1136/#798과 타인·Claude worktree를 보존한다. helper=NONE. 고객/DB/Sheet/Drive/권한 쓰기는 0이다.

## 복구 체크포인트

- 원래 HEAD `9abae99e6e06381aad4f35e05b64190cb712dc75`, index tree `a686d830f335c2194c7c4b448c790d13314ccf46`의 정확한 11파일·SHA256·바이너리 index patch·manifest를 저장소 밖 recovery 디렉터리에 보존했다.
- 이름으로 소유를 확인한 immutable stash `2fac440caffb42686abac2076dc05c56ab274ebc`의 index tree가 원본과 일치한다. SHA로 apply했으며 stash를 pop/drop하지 않는다.
- 원본→기준 master의 11경로 delta=0. 인접 identity 변경은 주석뿐이고 계약수납 서비스 진입점은 유지된다. DB 우선 계약 행 조회 변경은 시그니처와 호환된다. PR #1163(DB/리드/export)·#1164(월간 일정/todo)는 lease와 겹치지 않는다.
- 현재 master로 fast-forward한 뒤 정확한 11파일의 SHA256 11/11 일치를 확인했다. 패키지/lockfile도 설치 전 별도 보존·해시한다.

## R1 증거와 당시 실행 순서 (이력)

- **과거 증거**: 옛 base에서 실제 route+정본 identity를 쓰는 B3 8개, standalone 업무 13개, 무관한 save-coalesce 12개 집중 테스트가 33/33 PASS였다. 예전 전체 검사는 자원 경쟁으로 후보 밖 시간 초과가 발생해 `ENV_RESOURCE`로 중단됐다. 현재 master의 검사 성공을 뜻하지 않는다.
- **현재 복구 확인 PASS**: 정확한 lease 충돌 0, immutable stash 복원과 후보 바이트 보존 11/11. 소유 `node_modules`·`.next`의 일반 디렉터리 여부를 확인하고 오래된 `.next`는 저장소 밖으로 보존 이동한다.
- **PENDING**: process-local bundled Node 24로 `npm ci` 정확히 1회. 설치 후 package/lockfile과 정확한 12파일의 바이트를 재확인한다. 전역 PATH·공유 의존성 링크는 변경하지 않는다.
- **PENDING**: 정확한 12경로 stage 후 정상 커밋 훅 1회. `VITEST_MIN/MAX_THREADS=1`, `VITEST_MIN/MAX_FORKS=1`로 타입·린트·구조·전체 단위/통합·파일 크기·문서 드리프트를 검증한다. 테스트 삭제·완화·훅 우회는 금지한다.
- **PENDING**: 훅 PASS 뒤 동일 Node 24로 정상 production build 1회. 설치·훅·빌드는 순차 실행하고 실패 시 재시도나 설정 변경 없이 STOP한다.
- **NOT_RUN at plan checkpoint**: push, non-draft PR HOLD, 해당 head의 원격 CI·GitGuardian terminal, 독립 exact-tree 검수. 이후 실제 결과는 PR/RESULT에 기록한다.
- **NOT_RUN**: 운영 고객 계정 UI·실데이터 검증, 병합·배포. 합성 서비스 목 route 테스트는 운영 저장 지속성 검증이 아니다.

## 복구와 전달

실패 시 후보·manifest·named stash와 이동한 `.next`를 보존하고 정확한 실패 단계·출력·현재 해시를 Foreman에게 반환한다. 최종 결과는 base/head/tree·12경로 해시·정상 훅/빌드/CI/security·미실행 사항을 묶어 전달한다. 향후 배포 후 복구가 필요하면 승인된 squash commit을 revert하고 정상 재배포·health를 확인한다. 스키마 migration이나 데이터 rollback은 이 작업에 없다.

## R1 실측 결과와 R2 수정·검증 계획

- R1 head `1652d7a6e69c7aa30f084441f684cc30747e3a83`, tree `4970999ed7203030c309e5153a64b27bfde5821d`와 로그·복구 자료를 저장소 밖에 보존한다. R1 정상 훅은 구조94·단위3801 PASS/45 기존 SKIP, Node24 빌드는 정적81/81 PASS였다. PR #1165의 CI check·GitGuardian은 PASS, build는 외부 Google 폰트 다운로드 후 next/font 로더 오류로 FAIL이었다. 수동 재실행하지 않았다.
- F 독립 검수는 R1의 10개 mutation handler에서 기존 writable 권한 결정이 사라진 점을 REWORK로 판정했다. 학생 context가 허용돼도 쓰기 대상 결정이 달라질 수 있으므로 기존 R1 녹색 테스트는 이 반례를 입증하지 못했다. R1은 병합하지 않는다.
- R2는 10개 mutation handler의 dual gate를 복원하고 대체됐다고 주장한 주석을 수정한다. 4개 읽기 handler의 학생 컨텍스트 흐름과 기존 입력·업무·성공 응답은 보존한다. shared auth/service/repo/type/config/workflow/font 변경은 없다.
- 집중 회귀는 실제 인증 정본에서 첫 담당 권한 조회는 허용하고 후속 writable 조회는 철회된 상태로 만들어 10개 handler 모두의 불일치 403·본문 읽기0·하위 서비스0을 검사한다. 기존 own/assigned/arena 성공 단언은 유지한다. standalone에는 불일치, 정규화된 동일 이메일 허용, writable 예외 차단을 추가한다.
- **PENDING at R2 checkpoint**: 영향 집중 테스트 → process-local Node24/caps1 정상 커밋 훅 1회 → PASS 후 production build 1회. 테스트/임계값/훅은 완화하지 않으며 실패 시 반복·설정 변경 없이 STOP한다. 재설치는 하지 않는다.
- **NOT_RUN at R2 checkpoint**: 새 head push와 자동 CI·GitGuardian terminal, F 재검수. 새 커밋을 정상 훅으로 만들고 기존 PR #1165 HOLD에 push한다. 이전 head CI는 재실행하지 않는다. 운영 데이터 쓰기·병합·배포는 0이다. 이후 실측은 PR/RESULT에 기록한다.
