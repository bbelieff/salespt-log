# 세일즈PT 영업일지 — 제품과 저장소

세일즈피티 수강생이 생산·컨택·미팅·계약을 기록하고, 대시보드와 게이미피케이션으로 영업 활동을 돌아보는 반응형 웹앱이다. 수료 후 자기 기록을 계속 입력·수정하는 기존 CRM 정책을 유지한다. 정책 확장은 사용자 결정 없이 추가하지 않는다.

작업 방식은 `AGENTS.md`에 둔다. 이 파일은 제품과 데이터 경계를 설명한다. 상세 구현·의존성·현재 운영 상태는 코드와 관련 문서를 확인하고, 예전 기록의 상태를 현재 사실로 복제하지 않는다.

## 구조와 실행

- Next.js App Router·TypeScript·Tailwind·NextAuth(Google)·Recharts·Vitest를 사용한다. 정확한 버전과 명령은 `package.json`을 확인한다.
- `app/`은 화면·Route Handler, `components/`는 UI, `lib/types/`는 모델, `lib/config/`는 설정, `lib/repo/`는 저장소 I/O, `lib/service/`는 유스케이스를 갖는다.
- `tests/structural/`은 레이어·저장소 경계를 검증한다. `scripts/check.sh`와 `.githooks/pre-commit`이 품질 게이트다.
- 서비스는 자체 VPS에 배포한다. 현재 배포 구현은 `.github/workflows/deploy.yml`, 운영 절차는 `docs/playbooks/deploy-vps.md`를 따른다. 소개 문구의 과거 런타임 설명을 배포 명령으로 사용하지 않는다.
- PWA는 홈 화면 설치용 `app/manifest.ts`를 제공한다. 서비스워커·오프라인 캐시가 있다고 가정하지 않는다.
- `npm run dev`는 자동 동기화 watcher를 포함하므로 실행 전 `scripts/dev-with-watch.mjs` 동작을 확인한다. 자동 pull이 불필요한 작업 브랜치에서는 `npm run dev:no-watch`를 사용한다.

## 데이터 정본과 보호

- 전환된 기수의 읽기·쓰기 정본은 Postgres다. 실제 적용 범위와 DB 활성 조건은 `lib/service/daily-source.ts`의 `DB_READ_COHORTS`, `isDbReadPilot`, `chooseDailySource`, `chooseWriteSource` 한 곳에서 판단한다. 기수 목록을 프롬프트나 다른 코드에 복제하지 않는다.
- 전환 범위 밖 데이터는 기존 Sheets 경로를 유지한다. 미등록 레거시 기수를 임의로 전환·백필하지 않는다. 기존 전환 게이트는 되돌림 안전선이므로 제거하지 않는다.
- DB 정본 경로에서 Sheets는 비동기 미러·백업 export다. 사용자 저장 요청에 새 동기 Sheets 호출을 추가하지 않는다. 기존 예외는 `tests/structural/sheets-request-path-guard.test.ts`의 경계를 확인한다.
- 시트 파일과 관련 연동 코드를 임의로 삭제하지 않는다. 수강생별 시트·레지스트리 매핑의 현재 구현은 `lib/repo/users.ts` 등 관련 저장소 코드를 확인한다.
- Sheets 일괄 쓰기·삭제 전에 대상 셀을 `valueRenderOption: "FORMULA"`로 읽는다. 사용자 raw 값(텍스트·숫자·boolean)은 건너뛰고, 빈 셀과 수식만 덮어쓴다. 기존 가드는 `lib/repo/setup-formulas.ts:isSafeToOverwrite`와 관련 테스트를 확인한다. 일반 개별 기록 편집과 구조·수식 일괄 복구 작업을 혼동하지 않는다.
- 대시보드 시트 탭과 수식 전용 컬럼에 직접 쓰지 않는다. 허용 쓰기 영역·수식 좌표는 `lib/config` 및 `docs/domains/sheet-structure.md`를 따른다. 기존 시트 수식과 사용자 작성값을 보존한다.
- 업체관리 시트는 한 행이 한 미팅이며 append/update 단위로 다룬다. 날짜 포함·제외 표시문자열의 기존 수식 컬럼을 보존한다.
- 운영 데이터의 비가역 변경, 비밀값·보안 변경에는 `AGENTS.md`의 승인 경계를 적용한다. 원본 데이터나 자격증명을 출력·문서화·커밋하지 않는다.

## 제품 불변조건

- 금액은 부가세를 제외한다. 매출은 수임비와 수납액의 합이며 화면·문서 용어는 `수임비`를 쓴다.
- 날짜·기간은 `lib/config/cohort-dates.ts`, 주차와 날짜 경계는 `lib/util/week.ts`를 사용한다. 기간 숫자·특정 날짜·주차 공식을 다른 곳에 다시 하드코딩하지 않는다.
- 수료일은 저장된 실제 날짜를 존중하며 임의 offset으로 덮어쓰지 않는다. 통계 집계 창, 편집 정책, 시트의 물리적 주차 상한은 서로 다르다. 시작일 기준 주차와 금요일~목요일 기준 UI 주차도 구분한다.
- 수료 후 입력·수정 허용은 `docs/decisions/`의 ADR-0031과 현재 코드에 맞춘다. 시트 좌표 범위를 벗어난 기록은 해당 DB 경로로 처리하고, 과거 편집 유예 상수로 모든 수료생을 읽기 전용으로 돌리지 않는다.
- 모바일은 기록 입력, PC는 대시보드·트레이닝에 초점을 맞춘다. 같은 API를 사용하되 화면에 맞는 레이아웃을 제공한다.
- 매입DB·직접생산·현수막·콜·지·기·소의 기존 채널 분류와 네 가지 색 체계를 유지한다. 색·간격·타이포는 디자인 토큰을 쓴다. 임의 Tailwind arbitrary value를 추가하지 않는다.
- 게이미피케이션의 기준 구현은 `lib/service/gamification.ts`다. XP 가중치 변경은 정책 결정과 ADR 절차를 거친다.

## 아키텍처 경계

- 하위 레이어에서 상위 레이어를 import하지 않는다. Route Handler는 service를 통하고 UI components는 repo를 직접 참조하지 않는다. 실제 허용 관계는 `tests/structural/layers.test.ts`와 `docs/architecture.md`가 검증한다.
- `googleapis`, `google-auth-library`의 직접 import는 `lib/repo/`로 격리한다.
- 기존 `@/types`, `@/config`, `@/repo/*`, `@/service`, `@/util/*` 별칭을 사용한다. 순수 유틸의 의존성 제약을 유지한다.
- DB 마이그레이션 번호는 현재 코드와 열려 있는 PR을 확인해 충돌을 피한다. 파일 추가와 운영 실행은 별개이며 운영 적용 여부를 검증한다.

## 필요한 문서만 읽기

| 변경 대상 | 관련 문서 |
| --- | --- |
| 레이어·저장소 경계 | `docs/architecture.md` |
| UI 컴포넌트 | `docs/design/components.md` |
| 모델·타입 | `docs/domains/data-model.md` |
| 시트 좌표·키 | `docs/domains/sheet-structure.md` |
| 디자인 토큰 | `docs/design/tokens.md` |
| 도메인 정책 결정 | 관련 `docs/decisions/` ADR |
| 배포·복구 | `docs/playbooks/deploy-vps.md` |

관련 코드와 문서는 같은 변경에서 맞춘다. 문서 드리프트 검사를 우회하지 않는다. ADR의 과거 결정을 덮어쓰지 말고 결정이 바뀌면 후속 ADR로 대체 관계를 남긴다. 낡은 plan·wireframe은 현재 구현을 덮어쓰는 명세로 취급하지 않는다.

@AGENTS.md
