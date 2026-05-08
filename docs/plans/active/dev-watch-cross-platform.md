---
slug: dev-watch-cross-platform
status: active
created: 2026-05-08
worktree: ../wt/dev-fix
---

# fix: dev-with-watch PowerShell 호환 (bash → Node)

## Intent

`chore/dev-auto-sync` 머지 후 PowerShell에서 `npm run dev` 실패:
```
'bash'은(는) 내부 또는 외부 명령, 실행할 수 있는 프로그램, 또는 배치 파일이 아닙니다.
```

원인: `package.json` `dev` 스크립트가 `bash scripts/dev-with-watch.sh` 호출.
PowerShell PATH 에 bash 없음. Git Bash 사용자만 동작.

해결: bash 의존 제거. Node.js 로 watcher + dev server 통합 실행.

## 변경

- `scripts/dev-with-watch.mjs` 신설 — Node 통합 런처
  - `next dev` spawn (foreground)
  - 30초 watcher loop 내장 (git fetch + ff pull, stash 처리)
  - SIGINT/SIGTERM trap 으로 cleanup
  - Windows `npx.cmd` 자동 처리
- `package.json`:
  - `dev`: `bash scripts/dev-with-watch.sh` → `node scripts/dev-with-watch.mjs`
  - `dev:fresh`: 동일하게 Node 호출
  - `dev:watch` → `dev:watch-bash` 로 rename (bash 사용자용 fallback)
- `CLAUDE.md §6.6` 갱신 — Node 기반 + Windows 호환 명시
- 기존 `scripts/dev-with-watch.sh` / `scripts/dev-watch-master.sh` 는 유지 (`dev:watch-bash`에서 사용)

## Acceptance

- [x] `npm run dev` PowerShell + Git Bash + Linux/Mac 모두 동작
- [x] 30초 자동 sync 동작 (git fetch + ff pull)
- [x] Ctrl+C 한 번에 종료
- [x] check.sh PASS

## 검증

PowerShell 테스트:
```
PS> npm run dev
🔁 [dev-watch] 시작 (30s interval)
▲ Next.js ...
```
