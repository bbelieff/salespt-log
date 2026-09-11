---
status: review-ready
owner: SALES-WEEKLY-GOALS-947-WRITER
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: #947 공통 주간 목표 구현의 로컬 검증 범위와 운영 인수 조건.
> - **누가 읽나요**: OG·독립 검수자·배포 담당.
> - **관련 문서**: [기능 계약](../domains/weekly-goals.md), [활성 계획](../plans/active/weekly-goals.md), [#947](https://github.com/bbelieff/salespt-log/issues/947).

## 검증 범위

실제 제품 React 컴포넌트를 Chromium에서 렌더했다. HTTP API는 가상 계정과 메모리 저장 fixture다. 서버 인증은 별도 Vitest로, 실제 저장 SQL은 일회용 PGlite PostgreSQL로 검증했다. 이 세 증거를 운영 로그인·운영 DB·Notion 붙여넣기 증거로 합쳐 주장하지 않는다. 내부 테스트 보조자는 독립 검수자가 아니다. 최신 하네스는 Next build의 Noto Sans KR 자산을 직접 제공하고 실제 body 클래스/root 크기를 사용하며 폰트 로드도 assert한다. 그래도 실제 Next 인증·레이아웃 전체나 실계정 검증을 대체하지 않는다.

| 검사 | 확인한 결과 |
| --- | --- |
| 집중 Vitest | 9 files / 169 tests PASS: service48, overview17, identity26, actuals6, repo11, API13, copy12, proposal11, migration25 |
| 전체 Vitest | structural 8 files / 41 tests; non-structural 176 files / 1,655 tests PASS (QA_TOOLS_DIR 사용); 정확한 제출 head는 #947 체크포인트 |
| PostgreSQL | 실제 migration 재실행·repository SQL 18 assertions PASS; 운영 적용 아님 |
| 브라우저 | 21 scenarios PASS, pageerror0; desktop1440 / mobile390, 폰트 로드 확인 |
| check.sh·Next build·PR CI | 최종 제출 head 및 종료 결과는 #947/PR 체크포인트 참조; 아래 실패 이력 포함 |
| 운영 배포·인증 사용자 실화면·DB 적용 | NOT_RUN — OG 독립 검수/RELEASE 전 HOLD |
| 실제 Notion 붙여넣기 | NOT_RUN; 클립보드 복사/선택 fallback만 확인 |

발견·수정: Next typed route URL 객체 수정; fresh 권한 검사 후 옛 admin 권한으로 내부 기록을 반환하는 재현 회귀 수정; schedule 500줄 초과는 WeekBody 표시 구역 추출로 수정. 검사·테스트 자체는 약화하지 않았다. 기존 build 경고(worktree root 추론, unrelated lint/Sentry 경고)는 설정 변경으로 숨기지 않았다.

REWORK 전체 게이트 첫 실행은 새 역산 유틸의 타입 import가 `lib/util` 의존0 구조 규칙에 걸려 실패했다. 타입 import/반환 주석을 제거하고 순수 반환값 추론으로 수정했으며 구조 검사는 바꾸지 않았다. 실패 이력은 보존하고 최종 재실행 결과와 구별한다.

OG REWORK 보강: 공용/내부 명시 student 누락·빈칸 저장 거절; 동일 시트 로그인 별칭 공유 키/CAS와 다른 수강·주차 격리; 동일 이메일 trainer+arena 수강 지원·자기 내부 권한 금지; 업무탭 dirty 진입 가드; 지난주 초안 복제; 모바일 링/숫자 셀5열; 승인 누적 비율 역산. transient read 실패는 초안 유지하고401/403에서는 내부 초안/복사 UI 제거. 명단 반환 직전 권한 하향/세션 변경 회귀도 포함한다. 이 증거는 독립 검수 판정이 아니다.

정확한 migration 실행 준비는 [0005 검수 계약](weekly-goals-migration.md). migration25건 중15건은 외부 QA_TOOLS_DIR의 일회용 PostgreSQL을 사용한다. 도구가 없는 CI에서는 그15건이 명시 skip되므로 CI 통과를15건 실행 증거로 인용하지 않는다. GitGuardian의 기존 synthetic credential-shaped fixture 문제를 수정한 이후 테스트는 비자격증명 형태를 유지하며 보안 검사를 끄지 않았다.

## 브라우저 시나리오

1. PC 저장·비교 즉시 갱신·null/0 구별.
2. 내부 기록 저장·14열 수정 미리보기·클립보드 미지원 선택 fallback.
3. 함께 보기 및 공용 복사에 내부 텍스트 없음.
4. 미저장 주 이동 취소 후 입력 보존.
5. native history 취소 후 입력 보존.
6. background read 실패 시 입력 보존·stale copy 차단.
7. revision 충돌 때 saved 데이터와 입력 보존.
8. 새로고침 후 저장 내용 유지.
9. 1주차 과제만 저장·주차 분리.
10. 모바일390 긴 입력 저장·수평 overflow 없음.
11. student에 내부 버튼/요청/DOM 없음.
12. DB/컨택/일정 요약이 공통 집계를 소비(일정 WeekBody 포함).
13. trainer 담당 목표 취합·선택 학생 상세 진입.
14. 최초 조회 실패를 빈 성공/저장 가능으로 표시하지 않음.
15. 모바일 다섯 링과 다섯 입력이 각각 한 줄, 입력 hit 높이44px 이상.
16. 업무탭 요약 진입 시 저장/무시/취소, 취소는 입력 보존.
17. 지난주 가져오기 확인·취소·초안 전용·이전 주 불변.
18. 역산 미리보기·취소·overflow·dirty 확인·수정 후 명시적 저장.
19. 재조회 권한 거부 시 캐시 내부 편집/내용 제거.
20. 공용 저장403 시 접근 재조회·내부 내용 제거·저장값 불변.
21. 내부 저장403 시 내부 초안/복사 제거·저장값 불변.

화면 증거: [PC](weekly-goals-evidence/desktop.png), [모바일](weekly-goals-evidence/mobile.png). 전부 가상 인물·가상 날짜이며 production 코드에는 fixture 역할 선택·고정 날짜·localStorage 저장을 넣지 않았다.

## 재현

프로젝트 npm ci 후, 별도 임시 도구 디렉터리에 playwright1.63.0 및 @electric-sql/pglite0.5.8을 설치했다. 제품 package/lockfile은 변경하지 않았다. QA_TOOLS_DIR은 그 디렉터리를 지정하는 해당 프로세스 환경변수다.

```powershell
node tests/browser/weekly-goals-browser.mjs
node tests/browser/weekly-goals-postgres.mjs
npx vitest run tests/service/weekly-goals.test.ts tests/service/weekly-goals-overview.test.ts tests/service/weekly-goals-identity.test.ts tests/service/weekly-goals-actuals.test.ts tests/repo/weekly-goals.test.ts tests/api/weekly-goals.test.ts tests/components/weekly-goal-copy.test.ts tests/util/weekly-goal-proposal.test.ts tests/ops/weekly-goals-migrate.test.ts
bash scripts/check.sh
npx next build
```

## RELEASE 후 인수 계약

- 독립 검수 PASS와 OG RELEASE 없이는 머지/운영 DDL/배포하지 않는다.
- merge 직전 최신 master와 충돌/회귀 재확인, last-good SHA 기록. 한 트랙씩 squash 및 정확한 merge SHA의 배포 run 결론·health 관찰.
- 기존 scripts/db-migrate.mjs는 --dry-run도 schema_migrations 테이블 생성이 가능하므로 실행하지 않았다. 전체 pending/workflow dispatch 금지. 검수된 artifact의 읽기 전용 preflight 후 checksum 고정0005만 기존 이력 형식으로 적용한다. 다른 pending/history는 보존한다.
- 기능 코드 노출 전0005 실제 적용 이력(version/checksum/applied_at)과 서버 DB role/직접·상속 browser ACL/RLS·무정책 카탈로그 증거 필요. 새 자격증명·정책·브라우저 권한을 만들지 않는다. health의 auth env 성공은 DB 준비 증거가 아니다.
- 학생 API/HTML에 내부 필드 없음, assigned trainer만 내부 접근, 모바일/PC 실제 계정 흐름 확인. 저장 검증은 합의된 격리 QA 계정만 사용하고 실제 학생 기록에 테스트 쓰기 금지.
- 기능 rollback은 PR squash revert. 새 목표 테이블과 작성 기록은 보존한다. SSH 연결 실패와 앱 health 실패를 구분한다.
- 승인된 KPI 자동 쓰기/학생 키 매핑 증거 없음: KPI·Notion·Kakao 쓰기 0. 실제 Notion 붙여넣기는 별도 관찰 필요.
