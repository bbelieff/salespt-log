---
slug: stats-from-data-cols
status: active
created: 2026-05-19
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 수강생관리 카드 합계 전원 0 버그 — E4:E6(빈 header 셀) → E~N 데이터 컬럼 직접 합산
> - **누가 읽나요**: 개발자

# stats-from-data-cols

## 사용자 보고 (2026-05-19)
"수강생관리 들어가보면 전체 인원이 전부 000인데 이게 맞아?" (오승진 등 계약 이력 있는데도 0)

## Root Cause
- `readProfileBundle` 가 stats 를 01 영업관리 **E4:E6** (header 합산 셀) 에서 read.
- E1:E6 은 "사용자가 박은 합산 수식" (sheet-structure 문서 line 110) — 현재 기수
  시트에 비어있어 전원 0. installFormulas 가 설치하지 않는 셀이라 신뢰 불가.

## Fix
- stats 를 **데이터 컬럼 직접 합산** 으로 전환 (확실히 채워지는 SSOT):
  - 미팅예정 = Σ H (미팅예약 metric, 웹 직접 작성)
  - 미팅완료 = Σ L (미팅완료수, installFormulas 설치 수식)
  - 계약 = Σ N (계약건수, installFormulas 설치 수식)
- E{blockStart}:N{lastRow} 단일 range read (batchGet 1 call, quota 영향 없음).
- 각 주 28 데이터 row 만 합산 — trailer row(주차합계) 제외.
- me-bundle 캐시 키 v2 → v3 (옛 0-stats 캐시 entry 무효화).

## 주의
L/N 수식 미설치 시트는 미팅완료/계약이 0 → admin [수식복원] 한 번 실행 필요.

## Acceptance
- [ ] 계약 이력 있는 trainee 카드에 실제 숫자 표시
- [ ] trailer row(주차합계) 합산 안 됨 (정확한 누적)
- [ ] check.sh 통과
