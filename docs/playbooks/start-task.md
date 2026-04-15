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

## 7. 워크트리 정리
```bash
git worktree remove ../wt/$SLUG
```
