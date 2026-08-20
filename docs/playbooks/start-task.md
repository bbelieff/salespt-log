# Playbook — 새 작업 시작하기

CLAUDE.md §3 Task Contract의 실행 절차.

## 0. 사전
- 메인(`main`)이 최신인지 확인: `git fetch && git status`
- 작업 슬러그 정하기: 짧은 kebab-case. 예: `fix-login-race`

## 1. 워크트리 생성
```bash
SLUG=fix-login-race
git worktree add ../wt/$SLUG -b feat/$SLUG
cd ../wt/$SLUG
```
> ⚠️ **워크트리를 만들면 `node_modules` 1.3GB 가 딸려온다.** 문서(`.md`)만 고칠 거면
> `npm ci` 하지 마라 — 돌릴 `check.sh` 가 없고 CI 가 검증한다.
> 머지 후엔 `rm -rf wt/<이름>/node_modules` 로 회수한다. (CLAUDE.md §6.9 · BBE-254)

## 2. 계획 문서 작성
`docs/plans/active/$SLUG.md`를 `_TEMPLATE.md` 기반으로 생성.
- Intent, Acceptance Criteria, Steps 필수.
- Plan 없이 `src/` 건드리면 pre-commit에서 차단됨.

## 3. 구현 — 점진적 공개
한 번에 모든 것을 읽지 말 것. 필요 시점에 `docs/domains/<관련>.md`만 읽는다.

## 4. 자기 검증
```bash
./scripts/check.sh
```
UI 작업이면 스크린샷/DOM 스냅샷을 `docs/plans/active/$SLUG.md`에 첨부.

## 5. 커밋 → 머지
```bash
git add -A && git commit -m "feat: ..."   # pre-commit 훅 통과해야 함
cd ../../clone
git merge --no-ff feat/$SLUG
```

## 6. 계획 이동 (상태 동기화)
```bash
git mv docs/plans/active/$SLUG.md docs/plans/completed/$SLUG.md
# frontmatter의 status: active → completed 로 수정
git commit -m "docs(plan): complete $SLUG"
```

## 7. 워크트리 정리 — 완주의 일부다 (건너뛰지 마라)
```bash
rm -rf ../wt/$SLUG/node_modules   # 최소 — npm ci 로 복구되므로 무손실
git worktree remove ../wt/$SLUG   # 권장 — 브랜치가 남으면 언제든 재생성
git worktree prune                # 등록 잔재 청소
```
이걸 아무도 안 해서 2026-08-20 에 워크트리 82개로 개발 PC 하드가 찼다 (BBE-254).
`check.sh` §8 이 12개 초과 시 경고한다.
