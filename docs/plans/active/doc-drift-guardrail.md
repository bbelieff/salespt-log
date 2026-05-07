---
slug: doc-drift-guardrail
status: active
created: 2026-05-07
worktree: ../wt/doc-drift
---

# SSOT 드리프트 가드레일 — Hashimoto 원칙 박제

## Intent (왜)

지난 11개 PR 동안 코드는 추가됐지만 SSOT 등재가 누락되며 갭이 누적됨.
원인: `CLAUDE.md §6.5` 규칙 ("새 컴포넌트는 components.md 등재 후 구현") 이 기계검증 안 됨.
`scripts/check.sh` 의 doc-drift 검사가 빈 칸 (`doc-drift.sh not written yet`) 으로 비어있어 통과.

직접 트리거: 헤더 디자인을 머지했지만 claude.ai 프로젝트 prototype에서 옛 헤더로 회귀한 사건.
SSOT가 정확히 반영돼있어야 외부 세션도 코드와 일치하는 결과를 만들 수 있음.

Hashimoto 원칙: 같은 실수가 두 번째 발생 → 하네스 패치로 박아 재발 차단.

## Acceptance Criteria

- [x] `scripts/doc-drift.sh` 신설 — 4가지 검사 (components.md / data-model.md / sheet-structure.md / 추후 tokens.md)
- [x] `docs/.ssot-grandfathered.md` 신설 — 기존 누락분 박제 (총 ~36개 심볼)
- [x] `scripts/check.sh` 가 doc-drift.sh 자동 호출 (이미 hook 됨, 본 PR은 스크립트만 추가)
- [x] 로컬 검증: 현재 코드 상태에서 PASS, 가짜 컴포넌트 추가 시 FAIL
- [x] `CLAUDE.md §4` PR 체크리스트에 SSOT 드리프트 항목 추가
- [x] `CLAUDE.md §4` 신규 "SSOT 4 문서" 섹션 — 등재 위치 매핑 + "코드가 진실" 원칙
- [ ] `npm run check` 통과
- [ ] 본 plan 머지 후 `docs/plans/completed/` 로 이동

## Context

- 이전 SSOT 갭 분석 결과: 그룹 A(컴포넌트 31개)/B(토큰)/C(타입 7+5개)/D(시트 좌표) 누락
- 사용자 결정: 옛 설계로 끌려가지 말 것. 5개 탭 현재 상태만 SSOT 반영.
- 직전 머지된 PR(`docs/header-ssot`): TopHeader/DDayBadge §8 등재 — 임시 면제 후 머지되면 grandfathered에서 제거

## Steps

1. ✅ `scripts/doc-drift.sh` 작성 (bash, Git Bash 호환)
2. ✅ `docs/.ssot-grandfathered.md` 작성 (현재 누락분 36개)
3. ✅ 로컬 검증
4. ✅ `CLAUDE.md` 업데이트
5. 커밋·푸시·PR

## Follow-up (별도 PR)

- `docs/ssot-backfill-current-state` — 5개 탭 현재 컴포넌트 일괄 등재 + TOP 5 좌표 보강
  (계약수납 row 6, Meeting R/S, sales blockStart/stride 등)
- `fix/dday-graduation-anchor` — `me.ts` 49→57 (프로젝트 결정리스트 도착 후)
- 추후: `tokens.md` arbitrary value 검사도 doc-drift.sh 에 추가 (E단 추가)
