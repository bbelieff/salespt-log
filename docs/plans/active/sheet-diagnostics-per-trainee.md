---
slug: sheet-diagnostics-per-trainee
status: active
created: 2026-05-16
worktree: ../wt/sheet-diag
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 개별 trainee 시트 진단/픽스 framework — 누적 룰 카탈로그(Hashimoto)
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `lib/service/sheet-diagnostics.ts`, `app/api/admin/diagnose-sheet/route.ts`, `app/api/admin/fix-sheet/route.ts`, `components/auth/TraineeDiagnoseButton.tsx`, `TraineeCard.tsx`
> - **읽고 나면 알 수 있는 것**: 시트 사고를 어떻게 개별 trainee 단위로 진단·픽스하는가? 새 룰 추가 절차?

# sheet-diagnostics-per-trainee — 개별 trainee 진단/픽스 framework

## Executive Summary
사용자 요청: "60명 시트를 하지 말고 개별 시트를 진단하자. 개별 수강생 카드마다 진단/픽스버튼을 만들어 해결된 오류는 머지하여 버튼 기능을 업그레이드".

**설계**: Hashimoto 원칙 + 누적 학습.
- 새 사고 발견 → root cause 분석 → 룰 카탈로그에 추가 → 머지
- 머지 후 동일 패턴 자동 감지·픽스 가능
- 60명 일괄 X — 카드 [🔍 진단] 클릭 시만 read-only 스캔

## 아키텍처
- `lib/service/sheet-diagnostics.ts` — `RULES[]` 카탈로그 + diagnoseSheet/fixSheet
- `/api/admin/diagnose-sheet` (POST `{email}` → DiagnosticResult[])
- `/api/admin/fix-sheet` (POST `{email, ruleId}` → `{summary}`)
- `TraineeDiagnoseButton.tsx` — admin only, modal UI
- `TraineeCard.tsx` — 액션 row 에 통합

## v1 룰 카탈로그
1. **`formula-needs-restore`** (fixable) — 영업관리 I 열 수식 누락/옛 패턴 → installFormulas
2. **`metric-vs-meeting-mismatch`** (detect-only) — H 합계 vs 04 업체관리 row 수. 사용자 [2] 사고 진단
3. **`o1-o2-validity`** (detect-only) — O1/O2 유효성, offset 검증

## 새 룰 추가 절차
1. 새 사고 root cause 분석
2. `RULES` 배열에 push (detect + 가능하면 fix)
3. PR 머지 → 자동 적용

## Acceptance Criteria
- [ ] TraineeCard 에 [🔍 진단] 노출 (admin + spreadsheetId 있는 경우)
- [ ] modal 결과 — 이슈 + fixable 룰 옆 fix 버튼
- [ ] fix 완료 alert + 재진단 권유
- [ ] check.sh 전체 통과

## Log
- 2026-05-16 framework + 3 v1 룰 + UI 통합
