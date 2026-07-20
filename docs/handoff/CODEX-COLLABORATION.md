# Claude Code · Codex 공용 협업 규약

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 같은 salespt-log 레포에서 Claude Code와 Codex가 서로의 작업을 덮어쓰지 않고 이어받는 방법이다.
> - **누가 읽나요**: belie, Claude Code, Codex.
> - **어떤 기능·작업과 연결?**: 병렬 개발, 핸드오프, PR 머지와 배포.
> - **읽고 나면 알 수 있는 것**: 현재 상태의 정본, worktree 분리 방법, 충돌과 배포의 처리 순서.
> - **관련 문서**: [프로젝트 하네스](../../CLAUDE.md), [Codex 실행 규약](../../AGENTS.md), [작업 로그](../worklog.md), [배포 절차](../playbooks/deploy-vps.md).

## 상태를 읽는 순서

1. `HANDOFF.md` 전체: 로컬의 최신 맥락과 보류 결정을 파악한다.
2. `docs/worklog.md` 최근 항목: Git으로 공유되는 진행 상태·트랙 소유권을 확인한다.
3. 요청 관련 active plan, SSOT, ADR, 코드: 실제 구현 기준을 확인한다.
4. `git log origin/master -1`와 PR/CI 상태: 현재 원격 기준선을 확인한다.

`HANDOFF.md`는 Claude의 로컬 세션 기억으로 유지한다. Codex의 작업 결과는 `docs/worklog.md`, plan, PR 설명에 기록해 공유한다. 이 구분은 미추적 로컬 파일 충돌을 막기 위한 것이다.

## 작업 영역

| 역할 | 작업 위치 | 기준 브랜치 | 금지 영역 |
|---|---|---|---|
| Claude Code | 기존 Claude worktree | 해당 작업의 원격 기준선 | Codex 소유 worktree |
| Codex | `dev-harness/wt/codex-<slug>` | `origin/master` | 메인 체크아웃, Claude 소유 worktree |
| 메인 체크아웃 | 상태 확인·개발 서버 기준 | 현재 로컬 상태 | 직접 구현·정리·강제 동기화 |

현재 메인에 미커밋/미추적 파일이 있어, Codex는 메인에서 `pull`, `rebase`, `checkout`, 코드 수정 또는 커밋을 하지 않는다. 새 작업은 항상 독립 worktree에서 시작한다.

## 공용 작업 프로토콜

1. 시작 전 worklog에 `[병렬트랙]`으로 소유 디렉터리·파일과 공용 계약 의존성을 선언한다.
2. 공용 계약(`lib/types`, `lib/config`, `scripts`, `.github`, SSOT 4문서)은 별도 선행 PR로 제한한다.
3. 한 트랙은 자기 구역만 수정한다. 겹침이 불명확하면 직렬로 전환한다.
4. PR을 열기 전 `scripts/check.sh`와 `npx next build`를 통과하고, plan/SSOT/worklog를 갱신한다.
5. 머지는 한 번에 하나만 한다. 머지한 트랙이 배포 `success`와 health 200을 확인한 뒤에 다음 PR을 머지한다.
6. 뒤따르는 트랙은 `origin/master` rebase, 전체 check 재실행, 충돌 해결 후에만 머지한다. worklog 충돌에서는 두 기록을 모두 남긴다.

## 인수인계 템플릿

작업을 넘길 때 worklog 또는 PR에 아래를 남긴다.

```markdown
### YYYY-MM-DD · <Claude Code|Codex> · <작업명>
- 상태: 진행 중 | PR # | 머지·배포 완료 | 차단됨
- 소유 범위: `경로/` 또는 파일 목록
- 기준선: `<origin/master SHA>` / 브랜치 `<name>`
- 완료·검증: 구현 내용, `check.sh`, build, CI, 배포·health 결과
- 다음 행동 / 결정 대기: 한 문장씩
- 위험·되돌리기: 데이터·배포 영향과 rollback 지점 (해당 시)
```

## 운영 권한 경계

코드 구현과 로컬 검증은 전용 worktree에서 독립 진행할 수 있다. 다음은 명시적 요청 또는 기존 승인 범위가 있어야 한다.

- 실제 Google Sheets/DB 데이터 쓰기, 마이그레이션 apply, 백필 실행
- GitHub push·PR merge, production deployment·rollback
- VPS SSH, Secret/OAuth/환경변수 변경, 외부 메시지 전송

이 규약은 하네스를 대체하지 않는다. 레이어·보존 가드·SSOT·검증·배포 상세는 항상 `CLAUDE.md`와 관련 playbook을 따른다.
