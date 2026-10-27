> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 작업 기록(worklog)은 2026-10-26부터 항목마다 파일 하나로 남긴다 — PR끼리 같은 줄을 다투지 않게.
> - **누가 읽나요**: 모든 개발 세션(Claude·Codex)·belie
> - **어떤 기능·작업과 연결?**: CLAUDE.md §1·§3, AGENTS.md, `.githooks/pre-commit`(직접 수정 차단), `.gitattributes`(옛 파일 union 병합)
> - **읽고 나면 알 수 있는 것**: 새 기록 쓰는 법 · 최근 기록 읽는 법 · 옛 `docs/worklog.md` 는 어떻게 되나
> - **관련 문서**: [옛 작업 기록(2026-10-26까지)](../worklog.md) · [더 옛 기록](../worklog-archive/)

# 작업 기록 — 항목마다 파일 하나

**왜 바꿨나**: 모든 PR이 `docs/worklog.md` 맨 위에 기록을 끼워 넣어서, 다른 PR이 먼저 병합되면 매번 충돌이 났다(2026-10-26 하루 6번). 충돌을 풀 때마다 커밋 검사(6~10분)를 다시 돌렸고, 그 사이 또 다른 PR이 병합되면 또 충돌했다.

## 쓰기
- 파일 하나 = 기록 하나: `docs/worklog/YYYY-MM-DD-HHMM-<브랜치 slug>.md` (한국 시각, 예 `2026-10-26-1610-chore-worklog-per-entry.md`).
- 내용 형식은 예전과 같다 — 첫 줄 `## 날짜 · 제목`, 다음 줄부터 `- 브랜치. 요청·결정·변경·검증(SHA/run)·미완료·[plan](…)`.
- 같은 작업의 후속(병합·배포 결과)은 **같은 파일에 줄을 더하거나** 새 파일을 만든다. 다른 사람의 파일은 고치지 않는다.
- 병렬 트랙 선언(`[병렬트랙]`)도 이 방식으로 파일을 만든다.

## 읽기
- 최근 기록: `ls docs/worklog/ | sort -r | head -10` (파일 이름이 날짜·시각 순이라 정렬이 곧 최신순).
- 내용까지: `for f in $(ls docs/worklog/2*.md | sort -r | head -10); do cat "$f"; echo; done`
- 2026-10-26 이전 기록은 [`docs/worklog.md`](../worklog.md)(더 옛날은 `docs/worklog-archive/`).

## 지키는 장치
- `docs/worklog.md` 는 **고정 보관본**이다. 커밋에 이 파일 수정이 들어가면 `.githooks/pre-commit` 이 막는다(master 를 병합하는 커밋은 통과).
- 옛 규칙대로 쓴 세션이 있어도 `.gitattributes` 의 `merge=union` 덕에 로컬 병합은 양쪽 줄을 다 살려 자동으로 끝난다.
