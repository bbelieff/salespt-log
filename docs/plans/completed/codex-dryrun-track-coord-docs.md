---
status: completed
task_id: codex-dryrun-track-coord-docs
owner: CODEX-DRYRUN
branch: chore/track-coord-docs
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: KPI-③ Codex 드라이런으로 협업 문서 두 개를 내용 변경 없이 Git 추적에 올리는 실행 계획입니다.
> - **누가 읽나요**: CODEX-DRYRUN, TRACK-C 감독관, 운영자(belie)
> - **어떤 기능·작업과 연결?**: `docs/coordination/dispatch-queue.yaml`의 `codex-dryrun-track-coord-docs`
> - **읽고 나면 알 수 있는 것**: 변경 범위, 검증·병합·배포 관찰 순서
> - **관련 문서**: `docs/coordination/session-registry.yaml`, `docs/worklog.md`

# Codex 드라이런 — coordination 문서 추적 승격

## 범위

- `docs/handoff/CODEX-COLLABORATION.md`와 `docs/coordination/session-extraction-prompts.md`를 메인 작업트리 원본 그대로 Git 추적에 추가한다.
- 대상 두 파일의 내용은 변경하지 않는다.
- 공용 계약, 앱 코드, 외부 서비스, 다른 worktree는 수정하지 않는다.

## 완료 기준

1. 원본과 worktree 대상 파일의 SHA-256이 일치한다.
2. `scripts/check.sh`와 `npx next build`가 통과한다.
3. 단일 squash PR을 직렬 머지하고, 배포 성공과 공개 health HTTP 200을 확인한다.
4. registry와 worklog에 각 checkpoint를 남긴다.
