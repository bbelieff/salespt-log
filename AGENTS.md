# 세일즈PT 영업일지 — Codex 실행 규약

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: Codex가 Claude Code와 같은 하네스를 사용하면서 안전하게 협업하기 위한 실행 진입점이다.
> - **누가 읽나요**: Codex와 이 레포에서 작업하는 모든 자동화 에이전트.
> - **어떤 기능·작업과 연결?**: 모든 코드·문서·운영 작업.
> - **읽고 나면 알 수 있는 것**: 어디서 시작할지, 어디에 작업할지, 무엇을 절대 건드리지 말아야 하는지.
> - **관련 문서**: [CLAUDE.md](./CLAUDE.md), `HANDOFF.md`(로컬 전용·미추적 — 레포에 없음), [공용 협업 규약](./docs/handoff/CODEX-COLLABORATION.md), [작업 로그](./docs/worklog.md).

## 정본과 우선순위

- 프로젝트 하네스·도메인 규칙·배포 절차의 정본은 **`CLAUDE.md`**다. Codex도 이를 그대로 따른다.
- 현재 상태와 암묵지는 **`HANDOFF.md`**를 처음부터 끝까지 읽어 확인한다. 이 파일은 로컬 전용·미추적 상태일 수 있으므로 Codex는 사용자가 명시하지 않는 한 수정하지 않는다.
- 세션 간 공유 상태와 병렬 트랙 선언은 Git으로 공유되는 **`docs/worklog.md`**가 정본이다.
- 코드와 문서가 충돌하면 코드가 진실이다. 단, 변경 전 관련 SSOT와 ADR을 확인하고 같은 PR에서 문서를 동기화한다.

## 작업 시작 절차

1. `HANDOFF.md`, `docs/worklog.md` 최근 10개 항목, 요청과 관련된 활성 plan·SSOT·ADR을 읽는다.
2. 요청의 목적·중복 여부·안전장치를 검토한다. 의도가 불명확하거나 데이터/배포 위험이 커지면 구현 전에 사용자에게 물어본다.
3. `git fetch origin` 후, 메인 체크아웃을 건드리지 않고 `origin/master`에서 전용 worktree를 만든다.

   ```powershell
   git worktree add -b <feat|fix|docs|chore>/<meaningful-slug> wt/codex-<slug> origin/master
   ```

4. 새 worktree의 `docs/worklog.md` 맨 위에 `[병렬트랙] Codex`로 소유 파일 범위와 의존 계약을 선언한다. 다른 활성 트랙과 겹치거나 애매하면 병렬 구현하지 않는다.
5. `docs/plans/active/`에 계획을 만들고, 구현·검증·문서 갱신·PR·배포 관찰을 한 작업 단위로 끝낸다.

## Claude와 충돌 없이 협업하는 규칙

- **메인 금지**: `dev-harness/` 메인 작업트리의 코드·추적 문서는 수정하거나 pull/rebase/commit하지 않는다. 현재 로컬 변경은 Claude 세션 소유로 취급한다.
- **전용 worktree**: Codex는 `dev-harness/wt/codex-<slug>`만 사용한다. 상위 `../wt/`의 오래된 worktree는 참고만 하며 변경하지 않는다.
- **파일 소유권**: `lib/types`, `lib/config`, `scripts`, `.github`, SSOT 4문서는 공용 계약이다. 변경이 필요하면 그 계약만 별도 PR로 먼저 머지한다. `docs/worklog.md` 충돌은 양쪽 기록을 보존한다.
- **직렬 머지**: PR 구현은 병렬 가능하지만, 머지부터 배포 health 확인까지는 한 트랙만 진행한다. 앞선 PR이 머지되면 후속 트랙은 `origin/master`에 rebase하고 `scripts/check.sh`를 다시 통과한다.
- **로컬 인수인계 파일 보호**: `HANDOFF.md`, `scratchpad/`, `.env*`, `logs/`는 읽기는 가능하지만 Codex가 임의로 정리·삭제·커밋하지 않는다. 새 상태는 worklog·PR 본문·완료 보고에 남긴다.
- **외부 쓰기 보호**: Google Sheets, 운영 DB/VPS, GitHub merge·push·배포, OAuth/Secret 변경은 요청 범위와 권한을 다시 확인한 뒤에만 수행한다. 일괄 시트 쓰기는 dry-run → 결과 검토 → apply 순서다.

## 구현·검증·완료 기준

- 레이어, Google Sheets 격리, 대시보드 쓰기 금지, §2.5 대량쓰기 보존 가드, 도메인 불변식은 `CLAUDE.md`를 따른다.
- 새 컴포넌트·타입·시트 키·디자인 토큰은 SSOT 4문서를 같은 PR에서 갱신한다.
- 훅이나 테스트를 우회하지 않는다. PR 전 `bash scripts/check.sh`와 `npx next build`를 통과한다.
- feat/fix 커밋은 사용자용 `Changelog:`를 포함한다. PR은 squash merge 후 배포 run의 `conclusion=success`와 공개 health HTTP 200까지 확인해야 완료다.
- 완료 시 plan을 `completed/`로 옮기고, worklog에 결과·검증·남은 위험을 기록한다. 배포 실패는 즉시 rollback 절차를 따른다.

## 금지

- `raw/`, 외부 Obsidian vault, 사용자 데이터, 테스트를 통과시키기 위한 테스트 자체를 수정·삭제하지 않는다.
- `--no-verify` 등으로 훅·린터·구조 테스트를 우회하지 않는다.
- 요청 밖의 리팩터링·추상화·정리 작업을 섞지 않는다.
- `.git/` 내부를 직접 조작하거나, 다른 에이전트의 worktree·브랜치를 정리하지 않는다.
