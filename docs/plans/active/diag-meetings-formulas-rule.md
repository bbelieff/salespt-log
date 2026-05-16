---
slug: diag-meetings-formulas-rule
status: active
created: 2026-05-16
worktree: ../wt/diag-meetings
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 진단 카탈로그 v2 — 04 업체관리 N/O/Q 수식 누락 룰 추가
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `lib/service/sheet-diagnostics.ts` 의 RULES[]
> - **읽고 나면 알 수 있는 것**: 왜 영업관리 I/J 가 비어 보이는가? 누적 룰 동작 예시

# diag-meetings-formulas-rule — 4번째 룰 추가

## Executive Summary
2026-05-16 사용자 보고: PR #204 진단 결과 metric-vs-meeting-mismatch detect 됐으나 **영업관리 수식은 OK** (formula-needs-restore 미발생). 그런데 미팅카드 생성 시 영업관리 I/J 비어 보임.

**Root cause 가설**: 영업관리 I 수식이 `04업체관리!N` 의 TEXTJOIN 결과. 04 업체관리 row 가 추가됐는데 **N/O/Q 수식 누락** → 영업관리 I 매칭 결과 empty.

## 새 룰: `meetings-formulas-missing`
- **detect**: 04 업체관리 B/D/N/O/Q FORMULA mode read. 데이터 있는 row 의 N/O/Q 가 수식 아닌 cell 카운트
- **fix**: `installFormulas` (이미 04 업체관리 N/O/Q 처리 — raw 값 보존)
- **fixable**: 빈 cell 있으면 true, raw 값만 있으면 false (수동 정리 필요)

## Hashimoto 누적 학습 시연
- PR #204 의 framework 가 새 사고를 위한 룰 추가 절차 정의 (`RULES.push`)
- 이번 PR 은 **첫 사용 사례**: 새 사고 (이장현 시트 I/J 비어 보임) → root cause 분석 → 새 룰 추가 → 머지
- 향후 모든 trainee 가 [🔍 진단] 시 자동 감지

## Acceptance Criteria
- [ ] 김선주/이장현 카드 [🔍 진단] → `meetings-formulas-missing` detect
- [ ] [🔧 fix] → installFormulas → 영업관리 I/J 정상 동작 확인
- [ ] check.sh 통과

## Log
- 2026-05-16 4번째 룰 추가 (누적 학습 첫 사용)
