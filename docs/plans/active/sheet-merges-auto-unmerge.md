---
slug: sheet-merges-auto-unmerge
status: active
created: 2026-05-18
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 셀병합 검출 + auto-unmerge — 시트 쓰기 사고 root cause 해결
> - **누가 읽나요**: 개발자

# sheet-merges-auto-unmerge

## 사용자 보고 (2026-05-18)
"오승진 5/16 콜지기소 1/1/1/1에 대한 미팅카드 생성했으나 엑셀에 기록되지 않음. 계약하였는데 계약도 생성 안됨. 웹에서는 되는데 시트에서 말썽임"

## Root cause
Google Sheets 셀병합 영역에 쓰기 시 API 가 merge group 의 **마스터 cell** 로 데이터를 보냄. 다른 row 를 덮어쓰거나, 보기에 "사라진" 것처럼 보임.

예시:
- 영업관리 E14:E17 cell merge (4채널 day block) → E17 (콜지기소) 쓰기 → E14 (매입DB) 로 감
- 04 업체관리 cell merge → 미팅 append 가 잘못된 row 로
- 02 계약수납관리 C/D/E merge → 계약 fan-out row 누락

PR #225 의 read 쪽 carryDate 는 read 만 fix. write 쪽 root cause 는 셀병합 자체.

## Fix
**진단 룰 6번째**: `sheet-merges-conflict` (severity: error, fixable)

- detect: `spreadsheets.get fields=sheets(merges)` 로 4개 쓰기 대상 탭 (sales / meetings / contractPayment / dbManagement + 6기 alias "02 계약관리") 의 merge 카운트
- fix: 모든 검출된 merge 에 대해 `unmergeCells` request batch 실행
  - 시각적 병합 효과는 사라지지만 데이터 무결성 회복
  - admin 이 [🔧 fix] 클릭 후 사용자 시트에서 데이터 정합성 확인

### 룰 순서
RULES 배열 **맨 앞**에 추가 — 셀병합은 다른 룰 (formula-missing 등) 의 root cause 일 수 있으므로 가장 먼저 검출.

### RULE_EXPLANATION
TraineeDiagnoseButton 모달에서 평문 설명 추가 (무엇이/왜 문제/해결).

## Acceptance
- [ ] 오승진 카드 [🔍 진단] → sheet-merges-conflict 검출
- [ ] [🔧 fix] → 모든 병합 해제 → 미팅카드 생성 정상 동작
- [ ] check.sh 통과
