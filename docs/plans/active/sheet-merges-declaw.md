---
slug: sheet-merges-declaw
status: active
created: 2026-05-18
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: PR #229 의 셀병합 auto-unmerge 룰을 detect-only 로 declaw + 검출 범위 축소
> - **누가 읽나요**: 개발자

# sheet-merges-declaw

## 사용자 보고 (2026-05-18)
"이거는 위험한데 모든 셀병합을 풀어버린다니 정신나갔어? 핀셋 조정을 해줘야지 너무 쉬운길을 가려고 하지마. 지금 오승진 5/16 콜지기소 미팅입력이 안되는 이유를 제대로 분석해봐 정말 셀병합문제가 맞는지."

## Root Cause 재분석
- 콜·지·기·소 read 누락 = `sales.readWeek` C열 빈 cell skip (PR #225 carryDate 로 해결, 머지됨)
- 미팅 삭제 시 다른 지표 0 초기화 = `handleRemoveSavedMeeting` 전체 4채널 draft 전송 (PR #230 partial save 로 해결, 머지됨)
- **셀병합은 root cause 아니었음.** 영업관리 C열 4-row 블록 등은 사용자 시각 디자인 의도.

## Fix
1. `ruleSheetMerges` detect-only 로 전환 (fix 함수 제거, severity error → warn)
2. 검출 범위 좁힘:
   - 영업관리: E~H × row 10~277 multi-row merge 만
   - 04 업체관리 / 02 계약수납관리 / 02 계약관리: data row (row >= 2) multi-row merge 만
   - 가로 merge (rowSpan == 1), C 열 묶음, header 는 제외
3. detail 에 위험 merge 의 A1 좌표 (최대 5개) 표시
4. `TraineeDiagnoseButton` RULE_EXPLANATION 갱신 — fix 불가 + 시각 디자인 보호 명시

## Acceptance
- [ ] 진단 실행 시 평범한 셀병합 (C열, 헤더) 알람 안 뜸
- [ ] [🔧 fix] 버튼 노출 안 됨 (fixable: false)
- [ ] 위험 merge 가 실제 있으면 A1 좌표 표시
- [ ] check.sh 통과
