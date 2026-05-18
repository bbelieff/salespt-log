---
slug: dev-watch-windows-hide
status: active
created: 2026-05-18
worktree: ../wt/dev-watch-hide
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: `scripts/dev-with-watch.mjs` 의 `spawnSync("git", ...)` 호출에 `windowsHide: true` 옵션 추가 — Windows에서 30초마다 콘솔 창이 깜빡이는 사고 차단.
> - **누가 읽나요**: 개발자 (Windows + `npm run dev` 사용자)
> - **어떤 기능·작업과 연결?**: `scripts/dev-with-watch.mjs`, Hashimoto 가드 (CLAUDE.md §6.6)
> - **읽고 나면 알 수 있는 것**:
>   - Windows에서 콘솔 창이 깜빡인 원인 (`spawnSync` default `windowsHide: false`)
>   - 영향 범위 (Windows 만, macOS/Linux 무관)
>   - 사고 재발 방지 패턴 (Node.js 자식 프로세스 spawn 시 windowsHide)
> - **관련 문서**: `CLAUDE.md` §6.6, `scripts/dev-with-watch.mjs`

# fix(dev-watch): Windows 콘솔 창 깜빡임 차단 — windowsHide 옵션

## 사용자 보고 (2026-05-18)

> "컴퓨터에서 원래 안뜨던 도스창들이 떴다가 아무내용없이 사라지는게
> 주기적으로 생겼는데… 파파박 떴다가 파파박사라져. 굉장히 거슬린다."

## 근본 원인

`scripts/dev-with-watch.mjs` 가 `npm run dev` 시작과 함께 30초마다 git 폴링:

```js
function gitOutput(args) {
  const r = spawnSync("git", args, { encoding: "utf8" });  // ← windowsHide 누락
  ...
}
```

Windows에서 Node.js 의 `spawnSync` 기본값은 `windowsHide: false`. 따라서 git 같은
CLI 도구를 spawn할 때마다 콘솔 창이 잠깐 생성됐다 닫힘. 사이클당 git 호출 4~9회,
각 수십 ms — "파파박 깜빡임" 패턴과 일치.

이전 PR (`chore/dev-auto-sync` + `fix/dev-watch-cross-platform`, 2026-05-08) 은
bash → Node 마이그레이션으로 PowerShell `'bash' 명령 없음` 에러는 해결했지만,
**Windows 콘솔 hiding은 빠뜨림**. Windows 호환성 후속 패치.

## 변경 사항

`scripts/dev-with-watch.mjs` 전체에서 자식 프로세스 spawn 시 `windowsHide: true`:

1. `gitOutput()` 의 `spawnSync` — 호출 4~9회/사이클 (가장 많은 깜빡임 발생원)
2. line 60 `spawnSync("git", ["stash", "push", ...])` — dirty 감지 시
3. line 72 `gitOutput(["stash", "pop"])` — 같은 헬퍼 거치므로 #1 에서 자동 커버
4. line 23 `spawn("npx.cmd", ...)` — `stdio: "inherit"` 라 새 콘솔 안 만들지만,
   방어적으로 같이 추가 (NO_OP 이지만 일관성).

## 수용 기준

- [ ] `npm run dev` 시 Windows에서 콘솔 창 깜빡임 0회 (시각적 검증)
- [ ] macOS/Linux 회귀 없음 (`windowsHide` 는 Windows 전용 옵션, no-op on POSIX)
- [ ] `npm run dev:no-watch` 정상 동작 유지 (watcher 미사용)
- [ ] origin/master 30초 폴링 + 자동 ff pull 기능 유지

## 검증

- `bash scripts/check.sh` 통과 (lint/typecheck/test/file size/doc-drift/plan)
- 변경된 파일은 `.mjs` 1개. typecheck/lint 영향 없음.

## Hashimoto 메모

같은 패턴이 또 나오면: **Node spawn on Windows = always `windowsHide: true` 검사**.
향후 `scripts/*.mjs` 추가 시 lint 규칙 후보. (지금은 1개 파일이라 PR 로 끝, 두
번째 발생 시 ESLint rule + structural test 추가 고려.)
