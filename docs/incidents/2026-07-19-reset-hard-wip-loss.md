> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 워크트리를 master 로 올릴 때 `git status` 확인과 `git reset --hard` 를 한 명령에 체이닝해, 눈으로 본 미커밋 WIP(5파일)를 날린 사고와 재발 방지.
> - **누가 읽나요**: 에이전트(전 트랙), belie
> - **어떤 기능·작업과 연결?**: 발굴 체인 PR-6(DevB), 워크트리 리베이스 절차
> - **읽고 나면 알 수 있는 것**: 무엇을 잘못했나 / 왜 복구 불가였나 / 다음에 어떻게 막나
> - **관련 문서**: `docs/plans/active/lead-chain.md`(PR-6 Log), CLAUDE.md §5.5·§6.7

# 2026-07-19 · 워크트리 reset --hard 로 미커밋 WIP 유실 (DevB)

## 무엇이 터졌나
PR-6 재개 중 워크트리 `wt/lead-link`(구 base 573bd01)를 현재 master(daab533)로 올리려고
**한 Bash 호출에 `git status -s && … && git reset --hard origin/master`** 를 체이닝했다.
`status` 출력에 미커밋 WIP 5파일(`lib/repo/meetings.ts`, `lib/service/{contact,db,meetings-write}.ts`,
`tests/service/meetings-write.test.ts`)이 **찍혀 있었는데도** 같은 명령이라 그대로 `reset --hard` 가 실행돼
tracked 수정분을 폐기했다. (직전 컨텍스트 요약이 "PR-6 코드 없음"이라 오判한 것도 한 원인.)

## 왜 복구 불가였나
- 그 수정분은 **커밋·stage 이력이 없어** object DB 에 blob/tree 로 남지 않았다.
  `git fsck --lost-found` 의 dangling tree 는 `meetings-write.ts` 자체가 없는 **오래된 무관 트리**였다.
- 다만 **untracked 신규 파일**(`tests/service/lead-candidates.test.ts`, test-first 스펙)은
  `reset --hard` 대상이 아니라 **생존** → 그 스펙 + 설계(§4-5/§7-1)로 전량 재구현 성공. 순손실 = 재작업 시간.

## 재발 방지 (하네스 관점, §0 Hashimoto)
1. **파괴적 git 은 확인과 분리된 단계로.** `reset --hard`·`clean -fd`·`checkout -- .` 는
   **직전 단계에서 `git status`/`git stash` 로 상태를 확정한 뒤 독립 호출**로만. `status && reset --hard` 체이닝 금지.
2. **미커밋 변경이 보이면 먼저 대피**: `git stash -u`(untracked 포함) → 리셋/리베이스 → 필요 시 pop.
   워크트리를 master 로 올릴 때 작업분이 있으면 리셋이 아니라 **rebase**(작업 커밋 보존)를 쓴다.
3. **요약(compaction)의 "변경 없음" 주장을 실측보다 앞세우지 않는다** — `git status` 원본이 정본.

## 상태
PR-6 는 생존 스펙 + 설계로 재구현 완료(커밋 cb1d7ea, check.sh 초록). 코드 손실 없음(시간만).
