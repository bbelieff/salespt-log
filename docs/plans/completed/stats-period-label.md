---
slug: stats-period-label
status: completed
created: 2026-08-02
closed: 2026-08-03
owner: STATS-PERIOD-LABEL-C1-R1
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 수강생 카드 통계가 코스 통계 창의 누적값임을 표시하는 최소 UI 변경 계획입니다.
> - **누가 읽나요**: 개발자, 리뷰어, 운영 담당자
> - **어떤 기능·작업과 연결?**: `components/auth/TraineeCard.tsx`의 관리자·트레이너 수강생 카드와 `STATS_WEEKS` 통계 창
> - **읽고 나면 알 수 있는 것**: 표시 범위가 어디까지인지, 계산과 캡틴 표시는 왜 바꾸지 않는지, 어떤 검증이 필요한지
> - **관련 문서**: `CLAUDE.md` §6.5, `lib/config/cohort-dates.ts`, `docs/plans/active/r4-w13-display-course-weeks.md`

# 수강생 카드 통계 기간 표기

## 목표

관리자·트레이너가 수강생 카드의 미팅 예정·완료·계약 수치가 **8주 누적**임을 바로 알 수 있게 한다.

## 범위

- `components/auth/TraineeCard.tsx`의 `u.stats` 행 맨 앞에 회색 `8주 누적` chip을 표시한다.
- 이름 옆 캡틴 아이콘과 기존 통계 숫자·데이터 요청·계산은 변경하지 않는다.
- `STATS_WEEKS`(8) 및 R4의 통계 창 의미는 변경하지 않는다.

## 비범위

- Google Sheets, DB, 환경변수, 운영 데이터 변경
- 통계 집계·주차 계산·권한·캡틴 표시 동작 변경
- 컴포넌트 테스트 구조 신설: 기존에 직접 테스트가 없고 표시 전용 최소 변경이므로 기존 검증 체인으로 확인한다.

## 수용 기준

1. 통계가 있는 카드에서 `8주 누적` chip이 예정·완료·계약 앞에 보인다.
2. 통계가 없는 카드는 기존처럼 통계 행 자체를 렌더하지 않는다.
3. 캡틴 아이콘은 이름 옆의 기존 위치·동작을 유지한다.
4. `npm run typecheck`, `npm run lint`, `npm test`, `bash scripts/check.sh`, `npm run build`가 통과한다.

## 검증 기록

- 기준: `origin/master@3fe78acc233deaeccf65b2dd181bd420395b7877`
- 소스 후보: `fix/stats-period-label@2314ac693dc2d451e40df0236bfec944c460449b`의 3줄 표시 변경만 대조·이식한다.
- 릴리스: PR #643 이후의 직렬 릴리스 슬롯을 기다린다. 이 작업은 Sheets·DB·환경변수·운영 데이터에 쓰지 않는다.

## 종료 기록 (2026-08-03 · A(260803))

- 머지 실측: `f682a74 fix(admin): label trainee stats as 8-week cumulative (#648)` — `origin/master` 반영 확인.
- 배포 실측 (2026-08-03 A(260803) 보강): "Deploy to VPS" run `30734464895` (headSha `f682a74`) = **success**.
- 미확인 잔여: 인증 화면에서의 chip 육안 확인 한 건만 남는다. 공개 health 200 확인.
- 판정: 표시 전용 변경이 master 에 있고 전체 검사(check.sh PASSED)를 통과하므로 **완료**로 이관.
