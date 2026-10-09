# 경영일지 — 제품·개발 규칙

> **요약**: 데이터·레이어·검증·배포 정본. 실행 규칙은 [AGENTS](AGENTS.md).
> **제품**: salespt-log 영업 기록·CRM·트레이닝 웹앱. 버전은 package.json/package-lock.json 정본.
> **운영**: salesptlog.online, /opt/salespt-log, PM2, Caddy. PWA manifest만 제공하며 서비스워커·오프라인 캐시는 없다.

## 1. 필요한 문서
- AGENTS → worklog 최근 관련 항목 → 해당 plan·SSOT·ADR. 과거 큐/사고 이력은 필요할 때만 읽는다.
- [architecture](docs/architecture.md)·[quality](docs/quality.md)·[tokens](docs/design/tokens.md)·[components](docs/design/components.md)·[data-model](docs/domains/data-model.md)·[sheet-structure](docs/domains/sheet-structure.md).
- 같은 실수가 반복되면 좁은 검사·도구를 개선한다. 긴 사고 사례를 매번 자동 주입하지 않는다.

## 2. 레이어·데이터
- 의존 방향: types → config → repo → service → app(api·ui) → components. 하위는 상위를 import하지 않는다.
- API는 service, UI는 repo를 직접 호출하지 않는다. googleapis/google-auth-library는 lib/repo에 격리한다.
- 별칭: @/types, @/config, @/repo/*, @/service, @/util/*.
- DB 전환 기수의 읽기·쓰기는 Postgres 정본이다. lib/service/daily-source.ts의 DB_READ_COHORTS/chooseDailySource/chooseWriteSource가 선택을 결정한다.
- Sheets는 비동기 미러·백업 export다. 새 동기 Sheets 호출을 요청 경로에 추가하지 않는다. 기존 예외는 구조 검사 범위만 유지한다.
- 전환 스위치·legacy 어댑터·기존 시트는 보존한다. 미등록 legacy 전환/백필은 별도 승인 범위와 최신 상태를 확인한다.
- 계정/기수/시트 연결은 현재 registry repo 기준이다. 옛 registry 시트를 유일한 DB로 가정하지 않는다.
- 시트 대시보드·수식/합계 영역 직접 쓰기 금지. 탭·A1 좌표는 lib/config와 sheet-structure 정본.
- bulk-write/batchClear는 FORMULA pre-read 후 사용자 raw 텍스트·숫자·boolean을 skip한다. 빈 셀/수식만 허용된 범위에서 덮어쓴다.
- migration 파일 추가와 운영 apply는 별개다. 배포가 자동 적용한다고 가정하지 않는다.
- 운영 쓰기 차단을 우회하지 않는다. 복구/백필은 기존 값 보존·dry-run·승인된 대상/범위 확인이 선행이다.

## 2.5 제품·기간
- 부가세 제외. 화면 기간 매출 = 수임비(계약일) + 수납액(수납일) − 반환액(해지일, 없으면 계약일), ADR-0034·현재 집계 코드 기준. 아레나 순위표·서버 KPI는 별도 정의를 유지한다. 용어는 수임비, 채널 4색 고정.
- 모바일 입력 중심·PC 대시보드/트레이닝 중심, 같은 API.
- 날짜/기간: lib/config/cohort-dates.ts, 주차: lib/util/week.ts 정본. 날짜·기간 상수 재하드코딩 금지.
- ADR-0032: 숫자 10기 이후 12주·누적 통계. 11기 이후 총회 마지막 주 토요일, 10기는 승인 예외. 기존 기록·물리 시트 10주 상한 보존.
- 9기 이하/비숫자 기수 legacy 기간은 ADR-0005·config 기준. legacy O2 직접값을 offset으로 덮지 않는다.
- ADR-0031: 수료 후 자기 기록 입력/수정 가능. 시트 좌표 밖 기록은 DB 경계에 따라 처리한다.
- 기간별 통계는 ADR-0034·현재 코드 기준. 모든 사용자에게 옛 8주 통계를 강제하지 않는다.
- 대상 확장은 docs/scope.md·승인된 ADR로 판단한다. 옛 MVP 문구 때문에 현재 관리자/수료생 기능을 제거하지 않는다.
- 게이미피케이션은 lib/service/gamification.ts 기준, XP 가중치 정책 변경은 ADR로 기록한다.
- 요청 밖 미래 대비 구현·리팩터링 금지.

## 3. 작업
- [개발 흐름](docs/development/workflow.md)에 따라 목표·수용조건·base·소유·목업 승인 버전을 확인한다. 사용자는 주문과 목업 승인, 총괄은 제작/검증 연결과 승인 후 운영 완주를 맡는다. 단순 작업은 역할을 겸할 수 있으며 일반 단계 재승인 대기는 만들지 않는다.
- 메인은 읽기 전용. 전용 worktree에서 구현·검증·commit/push/PR.
- 코드 변경은 docs/plans/active에 계획, 완료 시 completed로 이동.
- 구현·실행·검증을 구분한다. 문서 작성·타인 성공은 자기 실행 완료가 아니다.

## 3.5 병렬
- worklog에 담당 파일·선행조건을 선언한다. 같은 파일 동시 쓰기 금지.
- lib/types·lib/config·scripts·.github·SSOT 공용 계약은 별도 검토 후 의존 작업보다 먼저 병합.
- 공급자 접두사보다 현재 소유·선언이 우선. 타인 작업 임의 인수 금지.
- 병합~배포 확인은 직렬. 선행 병합 후 rebase·현재 head 검증. worklog 양쪽 기록 보존.

## 4. 필수 게이트
- commit/PR 전에 bash scripts/check.sh 통과: typecheck·lint·structural·unit/integration·크기·SSOT drift·정상 pre-commit 유지.
- docs-only도 check 대상. runtime/app bytes 변경은 production build 필수. docs-only build 생략은 이유·NOT_RUN 기록.
- 훅/테스트/권한 우회·검사 통과를 위한 테스트 약화/삭제 금지.
- 현재 head CI 성공 후 병합. 리베이스 전 CI 재사용 금지.
- UI는 기존 production 컴포넌트·토큰을 재사용하고 모바일/PC·합성 경계값 실제 화면 확인.

## 5. 문서·증거
| 영역 | SSOT |
|---|---|
| UI/컴포넌트 | docs/design/components.md |
| Zod 타입 | docs/domains/data-model.md |
| 시트 키/좌표 | docs/domains/sheet-structure.md |
| 디자인 토큰 | docs/design/tokens.md |

- 현재 코드를 근거로 같은 PR에서 문서를 동기화한다. grandfathered 누락을 새 변경의 면제로 쓰지 않는다.
- ADR은 불변. 정책 변경은 새 ADR로 supersede.
- 문서는 목적·읽는 대상·관련 문서를 짧게 소개한다. 반복되는 긴 요약 카드는 강제하지 않는다.
- worklog/PR에 목표·변경·SHA/run·검증·미완료·위험/복구를 기록한다.
- 비식별 증거만 보존한다. raw/외부 vault/사용자 데이터/비밀값을 로그·문서·테스트·커밋에 넣지 않는다.

## 6.5 브랜치·디자인·새소식
- docs|feat|fix|refactor|chore/<meaningful-kebab-slug>. 이슈 번호·시각은 PR 본문에 둔다.
- feat/fix squash 본문 Changelog: 사용자 변화 한 줄. docs/chore/refactor는 불필요.
- 새소식 상세는 announcement-popup 관련 plan과 현재 수집 코드 기준. 앵커는 lib/config/anchors.ts에 먼저 등록.
- 디자인은 tokens/components 기준. 토큰 없는 arbitrary value는 먼저 토큰 추가. 변경 범위의 docs/design/preview.html 갱신.
- 새소식 팝업을 사용자를 대신해 닫지 않는다.

## 6.6 로컬 개발
- npm run dev는 master 감시/pull 포함. 자신의 작업 브랜치는 npm run dev:no-watch로 의도치 않은 동기화를 피한다.
- 포트·프로세스 소유를 확인한다. :3100·/srv/moawork-direct는 모아워크 운영, 접근/종료 금지.
- 로컬 운영 비밀값 부재로 생기는 DB/OAuth 실패는 환경 문제로 구분한다. 비밀값 임의 복사 금지.

## 6.7 환경별 Git
- unlink를 막는 Cowork 마운트에서 Git 쓰기/.git 조작 금지. 정상 환경 담당자에게 마지막 성공·변경·다음 행동 인계.
- 정상 로컬 Codex/Claude는 전용 worktree·정상 훅으로 commit/push. 다른 환경 금지를 전부에 확대하지 않는다.

## 6.8 배포·실패 대응
- master push → Deploy to VPS. 운영 /opt/salespt-log·PM2·Caddy, 상세 docs/playbooks/deploy-vps.md.
- last-good SHA → 해당 병합 SHA/run success → 공개 health 200 → 안전한 live 확인. 200만으로 새 버전 성공을 주장하지 않는다.
- SSH/러너 연결 실패는 원격 .deploy 상태·도달성·rerun으로 대응한다. 연결 장애만으로 코드 revert 금지.
- VPS는 2GB 힙 경계. heap OOM은 같은 커밋 1회 rerun 후 확인. 힙 상향·다른 서비스 종료로 우회하지 않는다.
- 실제 build/health 결함은 자동 롤백·로그를 확인하고 revert/fix-forward. 롤백도 배포·health 확인.
- reset --hard + force-push로 master 역사 변경 금지. 실패·복구는 비식별 인시던트 기록.

## 6.9 자원·세션
- 완료한 자신의 worktree·임시 서버만 정리. 증거·미추적 파일 보존·삭제 경로 확인.
- 타인 파일·worktree·브랜치·사용자 로그 정리 금지.
- 현재 소유·미완료 인계를 확인한 뒤 세션 보관. 보관은 카드 완료·데이터 복구가 아니다.
- 파일 수정·세션이 읽음·원격 반영을 각각 확인한다. 이름으로 모델/로그인/도구를 추정하지 않는다.
