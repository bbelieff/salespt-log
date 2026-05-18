---
slug: sales-m3-5-ratio-formulas
status: active
created: 2026-05-18
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 영업관리 M3:M5 채널별 생산효율 비율 수식을 installFormulas (수식복원) 에 포함
> - **누가 읽나요**: 개발자

# sales-m3-5-ratio-formulas

## 사용자 보고 (2026-05-18)
"수식복원 버튼에 01 영업관리!m3:5 수식을 유지하는 내용도 넣어줘."

```
M3 = '03 DB관리'!F56/L3
M4 = '03 DB관리'!K56/L4
M5 = '03 DB관리'!U56/L5
```

## 배경
- M3:M5 는 영업관리 헤더 영역 (data row 10~275 밖) → 기존 installFormulas 가 안 건드림
- 사용자가 시트 작업 중 실수로 지우면 비율 표시가 깨짐 → 수식복원에서 복구되어야 함

## Fix
- installFormulas 끝 부분에 M3:M5 처리 block 추가
- pre-read (FORMULA mode) → isSafeToOverwrite 가드 → 빈 cell/수식만 install
- raw 값 (사용자가 다른 값 입력) 이면 보존 + preservedCells 에 누적

## Acceptance
- [ ] M3:M5 가 빈 cell 이면 install 됨
- [ ] M3:M5 가 이미 같은 수식이면 idempotent (덮어쓰기 안전)
- [ ] M3:M5 에 raw text/number 있으면 보존
- [ ] check.sh 통과
