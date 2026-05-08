---
slug: dev-auto-sync
status: active
created: 2026-05-08
worktree: ../wt/dev-sync
---

# chore: dev server 자동 master 동기화 — Hashimoto 가드

## Intent

같은 사용자 마찰이 4번 이상 반복:
1. PR 머지 (GitHub 웹)
2. 사용자: "새로고침 안 됨"
3. 에이전트: "worktree pull + dev 재시작 필요"
4. 매번 수동 처리

→ skill issue 가 아닌 **harness issue**. CLAUDE.md §0 Hashimoto 원칙대로 환경에 박는다.

## Acceptance Criteria

- [x] `scripts/dev-watch-master.sh` — 30초마다 `git fetch + ff pull` (변경 시만)
- [x] `scripts/dev-with-watch.sh` — Next.js dev + watcher 동시 실행 (trap cleanup)
- [x] `package.json` `dev` 스크립트 → `dev-with-watch.sh` 호출
- [x] `dev:no-watch` 추가 (오프라인 작업)
- [x] `dev:watch` 단독 실행 옵션
- [x] `CLAUDE.md §6.6` — 가드 동작 + npm scripts 문서화
- [x] `check.sh` PASS

## 동작

```
$ npm run dev

🔁 dev-watch-master 시작 (30s interval)
   origin/master 변경되면 자동 pull → Next.js hot-reload.

▲ Next.js 15.x.x  Local: http://localhost:3000

  ... 사용자 작업 중 GitHub에서 PR 머지 ...

🔄 origin/master 갱신 감지 (abc1234) — pull 중...
   ✅ abc1234 으로 업데이트. Next.js 가 자동 hot-reload.
```

## Edge cases

- **워킹 디렉토리에 미커밋 변경 있음**: stash → pull → stash pop. 충돌 시 stash 보존.
- **fast-forward 불가** (force push 등): pull 실패, 에러 출력만, 다음 라운드 재시도.
- **네트워크 실패**: silent skip, 30초 후 재시도.
- **Ctrl+C**: trap → watcher 종료 → dev server 종료.

## 검증

```
▶ typecheck  : PASS
▶ lint       : 0 errors
▶ structural : 6 passed
▶ unit       : 22 passed
▶ doc-drift  : PASS
▶ check.sh   : PASSED
```
