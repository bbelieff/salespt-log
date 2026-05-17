---
slug: sales-read-cell-merge
status: active
created: 2026-05-18
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 셀병합 시트 read carry — C열 빈 cell 인 비-매입DB row 누락 fix
> - **누가 읽나요**: 개발자

# sales-read-cell-merge

## 사용자 보고 (2026-05-18)
"오승진 경영일지 시트에 5/16 기록했는데 적용이 안됨. 콜지기소 1,1,1,1 저장했는데... 적용안됨. 다른날짜는 되는듯"

## Root Cause
- 영업관리 4채널 row (매입DB / 직접생산 / 현수막 / 콜·지·기·소) 중 **첫 row 만** C열에 날짜
- 나머지 3 row 는 셀병합으로 C가 빈 cell
- `readWeek` 가 `dateRaw === undefined` 면 skip → 직접생산 / 현수막 / 콜·지·기·소 누락
- 매입DB (idx 0) row 만 살아남음 → 다른 채널 입력값 안 보임
- PR #200/#202 는 **쓰기** 만 fix (deterministic row + dayPrimaryRow). 읽기는 그대로였음.

## Fix
- `lib/repo/sales.ts:readWeek` 의 row 루프에 `carryDate` 도입
- C 셀에 값 있으면 carry 갱신, 없으면 직전 carry 사용 → 병합 cell 의미 그대로 반영

## Acceptance
- [ ] 오승진 5/16 콜·지·기·소 데이터 컨택탭에 노출
- [ ] 다른 trainee 의 모든 채널/날짜 영향 없음 (carry 는 매입DB row 부터 시작)
- [ ] check.sh 통과
