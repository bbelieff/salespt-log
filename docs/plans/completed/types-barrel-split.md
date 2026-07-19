---
slug: types-barrel-split
status: completed
created: 2026-07-19
completed: 2026-07-19
worktree: .claude/worktrees/dazzling-banach-5bff73
---

# lib/types/index.ts 도메인별 분리 (배럴 재수출)

## Intent (왜)
`lib/types/index.ts` 가 정확히 500줄 — `scripts/check.sh` 의 `-gt 500` 캡 경계다.
여기에 Zod 필드/스키마를 한 줄이라도 추가하는 다음 PR(발굴 체인 PR-5·6 및 타 트랙)은
pre-commit·CI 에서 즉시 막힌다. §3.5 상 `lib/types` 는 **공용부(계약)** 이므로 이 분리만
떼어 **단독 PR** 로 선처리해 다른 트랙을 언블록한다. 소비자 import 경로(`@/types`)는 무변경.

## Acceptance Criteria (수용 기준)
- [x] `lib/types/index.ts` = 배럴(재수출)만 — 실제 정의는 도메인별 파일로 이동 (index.ts 14줄)
- [x] 각 분리 파일 ≤ 500줄 (최대 meeting.ts 118줄), `index.ts` 대폭 축소
- [x] 전 소비자 무변경: `@/types` 배럴로 동일 심볼 27개 export 유지 (deep import 0건 — 사전 확인)
- [x] `doc-drift.sh` C 항목이 `lib/types/*.ts` 전체를 grep 하도록 조정 → 동일 심볼 27개 검사 통과
- [x] `bash scripts/check.sh` 통과 (typecheck · lint · structural · tests · 파일크기 · doc-drift)
- [x] 구조 테스트(layers·sheets 격리) 유지 — 분리 파일 간 import 는 상대경로(동일 레이어)

## Context (참고)
- 선례: `lib/repo/meetings-rows.ts` (meetings.ts 무동작 추출, #537 계열) · `lib/types/contract-status.ts`
- [[docs/domains/data-model.md]] — TS 식별자 인덱스(SSOT)
- `scripts/doc-drift.sh` §C · `scripts/check.sh` §5(파일크기)·§6(doc-drift)
- CLAUDE.md §2(레이어)·§3.5(공용부 계약)·§4(SSOT 4문서)

## Steps (점진적 공개)
1. 도메인별 파일 생성: channel · meeting · db · user · contract · todo · announcement · dashboard
2. `index.ts` → `export * from "./..."` 배럴로 축소 (contract-status 재수출은 contract.ts 로 흡수)
3. `doc-drift.sh` C: grep 대상 `lib/types/index.ts` → `lib/types/*.ts` (`-h`)
4. `data-model.md` 경로 프로즈 최소 갱신 (index.ts → *.ts / dashboard.ts)
5. `bash scripts/check.sh` 초록 확인 → 커밋 · PR · 머지 · 배포 관찰(§6.8)

## Log
- 2026-07-19 착수. 사전조사: 소비자 전원 `@/types` 배럴 사용(deep import 0건), 심볼 27개 baseline 확보.
- 2026-07-19 완료. PR #589(`ca4efb5`) squash 머지 · CI 초록 · 배포 success(run 29670671592) · health 200(root·/api/health). 8개 도메인 파일 분리 + doc-drift §C 대상경로 확장. 직후 발굴 체인 PR-2(#590)가 master 리베이스 없이 그 위에 클린 머지 — 언블록 확인.
