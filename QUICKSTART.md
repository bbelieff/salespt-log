# Quickstart — 이 하네스로 개발 시작하기

## 1. 일회 세팅 (이미 완료되어 있으면 건너뜀)

```bash
# git 훅 경로를 .githooks로 연결 — 이걸 해야 pre-commit이 동작
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit scripts/check.sh

# 첫 커밋 (메인에서만 예외적으로 허용 — 아직 브랜치 없음)
git add -A
git commit -m "chore: bootstrap harness"
```

이후로는 **main에 직접 커밋 금지**. pre-commit 훅이 막는다.

## 2. 스택 추가
이 레포는 현재 언어 중립. 실제 개발 시 하나 선택:

- **Node/TS**: `npm init -y` → `package.json` 에 `typecheck`, `lint`, `test`, `test:structural` 스크립트 등록.
- **Python**: `pyproject.toml` + `ruff`, `mypy`, `pytest`.

`scripts/check.sh`는 두 스택 모두 자동 감지한다.

## 3. 새 작업을 시작하려면
`docs/playbooks/start-task.md` 따라가기. 요약:

```bash
git worktree add ../wt/<slug> -b feat/<slug>
cd ../wt/<slug>
cp docs/plans/active/_TEMPLATE.md docs/plans/active/<slug>.md
# 계획 작성 → 구현 → ./scripts/check.sh → commit
```

## 4. Claude에게 일 시키는 법

Claude Code를 이 디렉토리에서 열면 `CLAUDE.md`가 자동으로 주입된다. 첫 지시는 이렇게:

```
docs/playbooks/start-task.md 를 따라 '<작업 슬러그>' 작업을 시작해줘.
Intent: <한 줄>
Acceptance:
 - <항목>
 - <항목>
```

Claude는 계획 문서를 먼저 만들고, 워크트리를 파고, 구현 후 `./scripts/check.sh`를 돌려야 한다.

## 5. 실수가 나면
`docs/playbooks/fix-harness.md` 를 돌려라. 프롬프트에 "주의하세요" 붙이는 건 금지.
