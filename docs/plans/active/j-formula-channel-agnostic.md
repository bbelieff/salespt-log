---
slug: j-formula-channel-agnostic
status: active
created: 2026-05-18
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 영업관리 J (오늘미팅일정) 수식에서 채널 필터 제거 — 4채널 셀병합 통합 표시
> - **누가 읽나요**: 개발자

# j-formula-channel-agnostic

## 사용자 보고 (2026-05-18)
"오늘미팅일정 J 가 J{dpr}:J{dpr+3} 4채널 row 를 셀병합해놓은 거. 채널별로 가는 게 아니라 통합 일정표로 보기 위해 디자인. 지금 4셀 병합 결과 수식은 한 채널만 참조 → 다른 채널 내용 누락."

## Root Cause
- 영업관리 I (미팅예약기록) — 채널별 표시 (4 row 별도)
- 영업관리 J (오늘미팅일정) — **4 row 셀병합 통합 표시** (디자인 의도)
- 옛 J 수식 `D:D=$C{dpr}*F:F=$D{r}` — 채널 필터링 → 마스터 row 채널만 표시
- (주)밤볼 5/16 콜지기소 미팅 — J 마스터 (매입DB row) 가 콜지기소 채널을 filter out → 누락

## Fix
- **J, K, L, M 모두** 채널 필터 제거 (사용자 확인: J~M 4채널 셀병합)
  - J: `FILTER(O:O, D:D=$C{dpr})` — 통합 일정 list
  - K: `COUNTIF(D:D, $C{dpr})` — 통합 미팅 수
  - L: `COUNTIFS(D:D=$C{dpr}, J:J="계약") + COUNTIFS(D:D=$C{dpr}, J:J="완료")` — 통합 완료 수
  - M: `FILTER(M:M, D:D=$C{dpr})` — 통합 미팅사유
- N (계약건수), O (수임비합계), P (계약비고) 는 **채널별 유지** (셀병합 X)
- 4 row 모두 동일 수식 install — 셀병합 마스터에 통합 결과 표시

> **후속 (2026-06)**: N/O/P 의 채널별 정확매칭(`04!F:F=$D{r}`)이 콜·지·기·소 separator
> 변종(04!F="콜-지-기-소" 등)에서 실패 → 계약 미집계 사고. 채널별은 유지하되 콜지기소
> 행만 separator-무관 매칭으로 보강. 정본: [contract-formula-channel-agnostic](contract-formula-channel-agnostic.md).

## Acceptance
- [ ] check.sh 통과
- [ ] 머지·배포 후 admin install-formulas-bulk 클릭 → J 수식 재install
- [ ] 오승진 5/16 콜지기소 (주)밤볼 미팅이 영업관리 J 에 표시
