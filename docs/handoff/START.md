# START — 활성화 리디자인 구현 시작 프롬프트 (Claude Code용)

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 활성화 리디자인 구현을 사용자 PC의 Claude Code에서 시작할 때 그대로 붙여넣는 launch 프롬프트.
> - **누가 읽나요**: 사용자 PC의 Claude Code(실행 주체).
> - **관련**: [pr-db-channels-full.md](./pr-db-channels-full.md)(정본), [pr-bottom-nav-4plus1.md](./pr-bottom-nav-4plus1.md), [pr-activation-redesign-1to5.md](./pr-activation-redesign-1to5.md), [CLAUDE.md](../../CLAUDE.md).

아래 블록을 Claude Code에 붙여넣어 시작.

---

```
세일즈PT 경영일지(이 레포)의 "활성화 리디자인"을 구현해줘. 기획은 확정됐고 상세 스펙이 레포에 있어.

[먼저 읽을 것]
- docs/handoff/pr-db-channels-full.md  ← 정본 (DB생산↔컨택 4채널 연동, 시트 구조, PR 분해, 검증)
- docs/handoff/pr-bottom-nav-4plus1.md  ← 바텀탭 4+1 컴포넌트화
- docs/handoff/pr-activation-redesign-1to5.md  ← 배경(주의: PR1=생산 SSOT는 ADR-0020로 이미 구현됨, 다시 만들지 말 것)
- CLAUDE.md  ← 작업 규약(워크트리·체크리스트·ADR·squash+Changelog·배포·롤백·§2.5 보존가드)

[실행 순서] 한 번에 하나씩, 머지→배포 관찰→health 확인 후 다음:
1) 바 PR (pr-bottom-nav-4plus1.md)
2) C3 부가세여부+역산 → 3) C1 직접생산(I:O 재배치) → 4) C2 현수막(게시로그 AF:AI) → 5) C4 컨택 첫행 읽기전용 → 6) C5 미기록 넛지
7) 매출측 부가세(§7, 04 AT·02 AK/AL/AM)는 별도 후속 PR

[필수 규칙]
- 절대 메인에서 직접 작업 금지 → PR마다 워크트리 + docs/plans/active/<slug>.md 계획.
- 시트 타깃 구조 = pr-db-channels-full.md §3-A(03 DB관리 컬럼맵) + §7(매출). 저장값=부가세 제외, 부가세여부는 플래그. 파생 가능한 주문금액/개당단가는 시트 저장 말고 계산.
- 생산 E는 DB집계 소유(writeProductionCell) 그대로, 집계 기준일만 채널별(매입=구매일/직접=종료일&완료/현수막=게시일/콜=접수일).
- 시트 컬럼 추가·마이그레이션(C1·C2·매출)은 소수 시트 먼저 검증 후 전체. 신규 batch write는 §2.5 보존가드.
- SSOT 동시 갱신: docs/domains/sheet-structure.md(현재 코드 반영본 → 구현분 반영), data-model.md(Zod 타입), components.md(신규 컴포넌트). doc-drift·구조테스트 green.
- ADR 작성: 탭 변경, 현수막 게시로그/직접생산 재배치, (후속)부가세 처리 표준. 번호는 docs/decisions 최신+1.
- PR 전 체크리스트 전부 green(typecheck·lint·test:structural·test·파일≤500·doc-drift·pre-commit) → squash 머지(커밋 본문 Changelog: 토스문체 한 줄) → 배포 run 관찰(gh) → 공개 health 200 → 실패 시 즉시 git revert.
- 게이미피케이션 XP가 생산 집계 변화로 흔들리는지 회귀 확인.

먼저 위 문서를 읽고, 1)번 바 PR부터 계획(plan)을 세워서 시작해줘. 진행 전 이해한 내용과 첫 PR 계획을 요약해서 확인받고 진행.
```
