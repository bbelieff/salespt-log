---
slug: dashboard-qualitative-count-r1
status: active
created: 2026-10-16
worktree: ../../../wt/codex-dashboard-qualitative-count-r1
---

# 대시보드 정성목표 긴 본문 건수 요약

> **WORK-ID** `SALES-PT-DASHBOARD-QUALITATIVE-COUNT-R1` · **담당** WORKER F · **기준** `d039317175f6b16a2a13d4dea3b9afef34ddc54c` · **운영 데이터 변경** 없음

## Intent (왜)

대시보드 정성목표는 짧은 PT과제를 원문 그대로 보여 주되, 실제 카드 폭에서 두 줄을 넘는 본문은 유효 과제 행 수인 `N건`으로 바꿔 카드 높이가 길어지지 않게 한다. 글자 수 추정이 아니라 브라우저가 렌더한 줄 수를 기준으로 판정하고 상세 진입·주차 이동·compact·로딩·오류 동작은 보존한다.

## Acceptance Criteria (수용 기준)

- [ ] 실제 폭에서 2줄 이하는 원문을 그대로 표시하고, 2줄 초과만 `splitTaskRows(task ?? "").length` 기반 `N건`으로 바꾼다.
- [ ] 공백은 `0건`, 긴 단일 행은 `1건`, CRLF·여러 행·중복 행은 유효 행 수를 표시한다.
- [ ] 과제·주차·학생·폭 변경 시 다시 측정하며 observer/listener를 정리한다.
- [ ] 측정용 텍스트는 접근성 트리에 중복 노출하지 않는다.
- [ ] 요약 카드만 변경하고 상세 진입·키보드·compact·로딩·오류 동작을 보존한다.
- [ ] PC 및 320/375/430px에서 짧은/0/공백/CRLF/긴 단일/여러 행/10,000자 렌더를 확인한다.
- [ ] focused RED→GREEN, `scripts/check.sh`, production build, normal hook을 통과한다.

## Scope

- `components/weekly-goals/WeeklyGoalSummary.tsx`
- `components/weekly-goals/weekly-goals-flow.css`
- `tests/components/weekly-summary-presentation.test.ts`
- 이 계획과 `docs/worklog.md`의 append-only 체크포인트

API·service·type·schema·운영 데이터·Drive/OAuth/권한은 변경하지 않는다.

## Steps (점진적 공개)

1. 현재 긴 텍스트가 그대로 노출되는 focused RED를 고정한다.
2. 숨은 측정 노드와 `ResizeObserver`로 실제 2줄 초과 여부를 판정하고 유효 행 수를 표시한다.
3. 단위/렌더 매트릭스와 전체 검사·빌드·정상 훅을 통과한 뒤 non-draft PR을 HOLD한다.

## Log

- 2026-10-16: base·lease·열린 PR 충돌을 확인하고 구현 시작. 기능 경로 충돌 0, 공용 worklog는 기존 기록을 보존하는 tail 추가만 허용.
