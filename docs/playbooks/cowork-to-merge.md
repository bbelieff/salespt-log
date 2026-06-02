> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: Cowork(샌드박스)가 working tree 에 만든 변경을, 사용자 PC 의 Claude Code 가 검수→커밋→푸시→PR→머지까지 한 번에 처리하도록 붙여넣는 명령문 템플릿.
> - **누가 읽나요**: 사용자(belie), 에이전트
> - **어떤 기능·작업과 연결?**: 모든 Cowork→PC 핸드오프 (CLAUDE.md §6.7)
> - **읽고 나면 알 수 있는 것**: 복붙용 명령문, 게이트·머지 규칙
> - **관련 문서**: [CLAUDE.md §6.7](../../CLAUDE.md)

# Cowork → Claude Code 머지 명령문

Cowork 는 파일 작성까지만 한다(§6.7). 아래를 **Claude Code 세션 첫 메시지로 붙여넣으면** 머지까지 자동 진행.

## 재사용 템플릿 (아무 변경에나)

```
레포 dev-harness 의 working tree 에 Cowork 가 만든 변경이 커밋 안 된 채로 있어.
이걸 검수→커밋→푸시→PR→머지까지 끝내줘. CLAUDE.md 규약을 따르고, 게이트 우회(--no-verify 등) 금지.

순서:
1. `git status` 로 변경 파일 확인하고, 무슨 작업인지 한 줄로 요약.
2. 의미있는 브랜치 생성: feat/<slug> · fix/<slug> · docs/<slug> 중 알맞게 (kebab-case 2~5단어).
3. docs/plans/active/ 에 관련 plan 문서가 있는지 확인(없고 lib·app·components 변경이면 먼저 만들 것 — pre-commit 차단됨).
4. 검수 게이트 전부 초록일 것: `npm install` (필요시) → `npm run check` → `npm run build`.
   하나라도 빨가면 멈추고 원인 고친 뒤 다시. 절대 우회하지 마.
5. 변경 스테이징(`git add -A`) 후 컨벤션 커밋: `<type>(<scope>): <요약>` (한국어 OK).
6. `git push -u origin <branch>` → `gh pr create --fill --base master`.
7. PR 의 CI(Actions)가 초록이 되면 `gh pr merge --squash --delete-branch` 로 머지하고 브랜치 삭제.
   (CI 가 빨가면 머지하지 말고 로그 보고해.)
8. 끝나면 머지된 커밋 SHA 와 PR 링크를 알려줘.
```

## 빠른 버전 (이미 plan 있고 작은 변경)

```
working tree 의 Cowork 변경을 feat/<slug> 브랜치로 올려줘.
npm run check + npm run build 초록 확인 → 커밋 → 푸시 → gh pr create →
CI 초록 되면 gh pr merge --squash --delete-branch. 우회 금지. 끝나면 PR 링크 줘.
```

> auto-merge 를 켜두면(`gh pr merge --auto --squash --delete-branch`) CI 통과 즉시 자동 머지된다. 레포 설정에서 auto-merge 허용 필요.
