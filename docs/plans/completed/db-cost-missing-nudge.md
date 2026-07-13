---
status: completed
slug: db-cost-missing-nudge
created: 2026-06-22
owner: belie
related: pr-db-channels-full, 0022-direct-production-period-twostage
completed: 2026-06-22
archived: 2026-07-12
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 직접생산 미완/비용 누락을 감지해 입력을 유도하는 넛지 배너(C5, activation-redesign 마지막).
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: DbNudgeBanner, DB관리 page, useDBOverview
> - **읽고 나면 알 수 있는 것**: 감지 조건·빈도제어·그룹 노출 전환
> - **관련 문서**: [ADR-0022](../../decisions/0022-direct-production-period-twostage.md), [정본 PR-C5](../../handoff/pr-db-channels-full.md)

# PR-C5 — 미기록 넛지

## 스코프
직접생산이 **생산중(생산개수 0)인데 종료일이 지난 미완**이거나 **완료인데 비용(기간예산) 0**인 경우 DB관리 상단 배너로 입력 유도. 클라 빈도제어(오늘 닫으면 숨김). 의존: C1.

## 변경 (UI 전용)
- `DbNudgeBanner`(신규): useDBOverview 로 직접생산 감지 → 배너 + "직접생산 보기" CTA + ✕(localStorage 오늘 닫기).
- `db/page.tsx`: ChannelTabs 위에 배너 렌더(onGoDirect→직접생산 탭).
- components.md 등록.

## activation-redesign 그룹 종료
- 본 PR 커밋 본문에 **`Changelog-Done`** 추가 → 그룹 `activation-redesign` 전체 새소식 팝업 노출 전환(C3~C5 묶음 1항목).

## 수용 기준
- 종료일 지난 생산중 직접생산이 있으면 배너 표시, ✕ 시 오늘 숨김. 없으면 미표시.
- 다른 탭/회귀 없음. typecheck/lint/structural/unit/doc-drift/size + build + 배포 + health 200.

## Log
- 2026-06-22 구현(feat/db-cost-missing-nudge): 직접생산 미완/비용0 넛지 + Changelog-Done(그룹 노출).
