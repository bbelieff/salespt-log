> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 대시보드 시트 fallback에서 프로필 의존 미팅 조회를 다른 초기 조회와 겹쳐 응답 지연을 줄이는 작업 계획입니다.
> - **누가 읽나요**: 개발자, 독립 검증자, 배포 담당자
> - **어떤 기능·작업과 연결?**: `lib/service/dashboard.ts`의 `loadDashboardFromSheet`와 집중 회귀 테스트
> - **읽고 나면 알 수 있는 것**: 어떤 호출을 병렬화하는가 / 무엇을 보존하는가 / 어떤 증거로 완료를 판정하는가
> - **관련 문서**: `CLAUDE.md`, `docs/worklog.md`, `docs/domains/data-model.md`, `docs/domains/sheet-structure.md`

# Dashboard Sheet Latency R1

status: code-ready / independent verify 대기
work-id: SALES-PT-LATENCY-R1-SHEET-FALLBACK-01
base: 1a11406d52fdf0aeb4b7988991a15d51a634aedb

## 목표

`loadDashboardFromSheet`가 프로필을 얻은 직후 `readCourseMeetings`를 시작하되, 다른 초기 Sheets 조회가 끝날 때까지 기다리지 않도록 한다. 반환 `DashboardView`, 해지 오버레이, 오류 전파, 정확히 일곱 번의 Sheets 호출은 유지한다.

## 변경 범위

- `lib/service/dashboard.ts`: `profilePromise`와 종속 `meetingsPromise`를 초기 `Promise.all`에 포함한다.
- `tests/service/dashboard-sheet-latency.test.ts`: 호출 중첩과 프로필 거절 계약을 시간 측정 없이 검증한다.
- 이 계획과 `docs/worklog.md`의 중요 checkpoint만 갱신한다.

## 비범위

- DB/admin/reverse shadow 동작, 반환 타입·수치 계산, Sheets·운영 데이터, 인증·권한, R6 migration
- 공용 타입·설정·repo 계약, 호출 수 변경, 타 작업자의 파일

## 검증 계획

- [x] 프로필 resolve 뒤 다른 초기 read가 pending이어도 `findByDateRange`가 이미 시작됨
- [x] held read를 풀면 기존과 동일한 `DashboardView` 및 해지 오버레이 반환
- [x] 프로필 reject 시 전체 reject, 미팅 조회 0회
- [x] Sheets 호출 정확히 7회
- [x] focused Vitest, 관련 정적 검사, `bash scripts/check.sh`, production build
- [x] candidate 경로·diff·SHA256·Git status·검사 receipt 동결 후 독립 검증 요청
- [ ] 독립 검증 PASS 뒤 writer가 commit·PR·배포 완료 시 completed로 이동

## Rollback

단일 서비스 변경과 집중 테스트/문서 변경을 되돌리면 기존 순차 미팅 조회로 복귀한다. 데이터 변경은 없다.
