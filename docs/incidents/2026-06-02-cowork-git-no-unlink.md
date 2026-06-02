> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: Cowork 샌드박스에서 git 쓰기·`.git` 일괄 rename 정리가 broken ref 를 남겨 `git fetch` 를 막은 인시던트 기록 + 재발방지.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: PostHog 도입 작업(2026-06-02) 중 발생. 규칙은 `CLAUDE.md §6.7`.
> - **읽고 나면 알 수 있는 것**: 무엇이 왜 터졌나, 어떻게 복구했나, 어떻게 막나
> - **관련 문서**: [CLAUDE.md §6.7](../../CLAUDE.md), [PostHog plan](../plans/active/posthog-analytics.md)

# 인시던트 2026-06-02 — Cowork 샌드박스 git unlink 차단 → broken ref

## 타임라인
1. Cowork 데스크톱(샌드박스)에서 PostHog 작업 후, 그 자리에서 커밋/푸시를 시도하며 `git switch -c`, `git add`, `git branch -D` 실행.
2. 샌드박스 마운트 파일시스템이 **unlink(삭제)를 거부**(`Operation not permitted`) → git 이 만든 `.git/index.lock`, `refs/heads/feat/...lock` 등이 지워지지 않고 잔류. 인덱스 갱신·커밋 실패.
3. 정리하려고 `find .git -name "*.lock" | mv ... .bak-cleanup` 실행 → `refs/heads/feat/posthog-analytics.lock` 이 **ref 디렉토리 안에서** `...lock.bak-cleanup`(빈 파일)로 남음.
4. git 은 그 빈 파일을 ref(= null SHA)로 읽어 **`git fetch` 전체가 차단**됨.

## 영향
- 사용자 레포의 `git fetch` 불가. (커밋·작업물 자체는 안전.)
- 사용자 PC 의 별도 Claude Code 세션이 진단 후 broken ref 를 삭제(실제 머신은 unlink 정상)하고, PostHog 작업을 `feat/posthog-analytics`(`95ef90b` + lockfile `383cf30`)로 정상 커밋하여 복구.

## 근본 원인
- **환경 가정 오류**: Cowork 샌드박스를 일반 로컬 git 환경처럼 다룸. 이 마운트는 unlink 를 막아 git 내부 동작(락 해제·index 재작성·object/ref 정리)이 깨진다.
- **광범위 rename 정리**: `.git/` 하위를 글롭으로 일괄 rename → ref 경로에 잔재를 떨궈 더 큰 고장 유발.
- 추가로 샌드박스엔 GitHub 인증이 없어 push 자체가 불가(`could not read Username`).

## 재발 방지 (조치)
- `CLAUDE.md §6.7` 신설: 샌드박스 git 쓰기 금지 / 커밋·푸시·PR 핸드오프 / `.git` 내부 조작 금지 / 동시 세션 주의.
- `CLAUDE.md §6 금지 사항`에 한 줄 추가(포인터).
- 원칙: **Cowork 는 파일 작성까지, git 은 사용자 PC 의 Claude Code 에서.**

## 잔재 (무해, 사용자 PC 에서 1회 삭제 권장)
```
rm -f .git/index.lock.bak-cleanup .git/index.lock.removed-* .git/index.lock.stale .git/packed-refs.lock.bak-cleanup
```
