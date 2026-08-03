---
slug: pr643-admin-cohorts-p0
status: completed
created: 2026-08-02
closed: 2026-08-03
owner: Codex P0 recovery worker
related: arena-season1-setup
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: PR #643 배포 뒤 `/admin/cohorts` GET 500을 읽기 전용 경계로 복구하는 최소 계획이다.
> - **누가 읽나요**: 개발자, 검수자, 운영자
> - **어떤 기능·작업과 연결?**: 관리자 기수 화면, cohorts 탭, PR #643 시즌 시작일 J열
> - **읽고 나면 알 수 있는 것**: 무엇이 운영에서 실패했나 / 어떤 쓰기를 제거하나 / 무엇을 검증하고 배포하나
> - **관련 문서**: `docs/plans/active/arena-season1-setup.md`, `app/admin/cohorts/page.tsx`

# PR #643 admin cohorts P0 복구

## 진단

- Production·remote master·배포 SHA는 `844ce045`로 일치하고 공개 health와 전광판은 정상이다.
- `/admin/cohorts` Server Component GET은 `ensureCohortsTab()`을 호출해 A1:J1 헤더를 자동 보강하도록 배포됐다.
- 읽기 전용 운영 실측에서 cohorts grid는 26열이고 A1:J1 요청은 성공하지만 반환 헤더는 9칸뿐이었다. J 헤더 write는 착지하지 않았다. A2 이하 데이터와 실제 헤더 값은 출력하거나 변경하지 않았다.
- PM2 앱 로그에는 digest `767408371`의 예외 본문이 남지 않았다. 복구는 GET에서 외부 쓰기를 제거하는 최소 불변식에 결박한다.

## 변경 범위

- `app/admin/cohorts/page.tsx`: GET render의 ensure import/call 제거. 기존 read 결과 병합·표시는 보존한다.
- `tests/app/admin-cohorts-read-only.test.ts`: 정상 render와 roster read 429 모두 cohort mutation 0회를 보장한다. 429는 합성 데이터나 write retry 없이 그대로 실패한다.
- 명시적 admin mutation API route의 ensure/write, repo cache/retry 정책, Sheets·DB·환경은 변경하지 않는다.

## 검증·출시

- [x] 집중 회귀 테스트 — 2/2 PASS
- [x] TypeScript typecheck — PASS
- [x] `bash scripts/check.sh` — 101 files, 916 tests PASS
- [x] production build — Next.js 15.5.15, `/admin/cohorts` dynamic route 생성 PASS
- [ ] 독립 review
- [ ] PR/check/squash merge
- [ ] 자동 deploy success + 공개 health 200
- [ ] 인증된 `/admin/cohorts` read-only live PASS (별도 승인된 안전 probe)

## 종료 기록 (2026-08-03 · A(260803))

- 머지 실측: `f87b28f fix(admin): keep cohorts page render read-only (#649)` — `origin/master` 반영 확인.
- 미확인 잔여: 배포 run conclusion (`gh` 미설치), 인증된 `/admin/cohorts` 라이브 probe(belie 승인 필요).
  위 체크박스는 실측하지 못한 항목이므로 **비운 채로 보존**한다.
- 판정: 수정 코드가 master 에 있고 공개 health 200 이므로 **완료**로 이관. 라이브 확인은 belie 잔여 항목.
