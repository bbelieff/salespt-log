> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: Windows Node 22에서 `npm run dev`가 `spawn npx.cmd EINVAL`로 종료되는 문제를 최소 수정하고 재발 방지 테스트로 고정합니다.
> - **누가 읽나요**: Windows에서 SalesPT 개발 서버를 실행하는 개발자와 릴리스 검수자
> - **어떤 기능·작업과 연결?**: `scripts/dev-with-watch.mjs`, `tests/structural/dev-with-watch-windows.test.ts`
> - **읽고 나면 알 수 있는 것**: EINVAL의 원인 / Windows와 POSIX 실행 차이 / 검증 및 롤백 방법
> - **관련 문서**: `CLAUDE.md` §6.6, `docs/plans/completed/dev-watch-cross-platform.md`, `docs/plans/completed/dev-watch-windows-hide.md`

# Windows dev watcher EINVAL 수정

## 문제

Windows Node 22에서 `.cmd` 파일을 `shell: false`로 직접 실행하면 `spawnSync("npx.cmd", ...)`가
`EINVAL`을 반환합니다. 현재 `npm run dev`도 같은 `npx.cmd + shell:false` 조합을 사용하므로
Next.js 개발 서버를 시작하지 못합니다.

## 변경 범위

- Windows에서만 dev-server spawn의 `shell`을 활성화합니다.
- macOS/Linux의 `npx + shell:false` 동작과 모든 경로의 `windowsHide:true`는 유지합니다.
- 구조 테스트가 실행 옵션을 고정하고, Windows에서는 실제 `npx.cmd --version` 실행이 EINVAL 없이 끝나는지 확인합니다.

## 수용 조건

- [x] Windows Node 22에서 `npx.cmd`가 EINVAL 없이 실행됩니다.
- [x] Windows 외 플랫폼은 `shell:false`를 유지합니다.
- [x] `windowsHide:true`가 유지됩니다.
- [x] focused test, typecheck, `scripts/check.sh`, production build가 통과합니다.
- [ ] 독립 검수 전까지 PR은 draft로 유지합니다.

## 롤백

단일 squash commit을 revert하면 기존 런처 설정으로 돌아갑니다. 운영 데이터·환경변수·Sheets에는 영향이 없습니다.

## 종료 기록 (2026-08-03 · A(260803))

- 머지 실측: `6380916 chore(dev): support Windows Node 22 watcher (#650)` — `origin/master` 반영 확인.
- 데스크탑 실측 재확인: `tests/structural/dev-with-watch-windows.test.ts` 2/2 PASS (Node v24.18.1 / Windows 11).
- 배포 실측 (2026-08-03 A(260803) 보강): "Deploy to VPS" run `30739988555` (headSha `6380916`) = **success**.
  공개 health 200 확인 → 미확인 잔여 없음.
- 판정: 코드 변경분이 master 에 있고 회귀 테스트가 초록이므로 **완료**로 이관.
