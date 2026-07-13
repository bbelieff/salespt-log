---
status: completed
slug: install-popup-update-notes
created: 2026-05-18
completed: 2026-05-25
archived: 2026-07-12
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 수식복원 confirm 팝업에 최근 변경사항 메모 추가
> - **누가 읽나요**: admin

# install-popup-update-notes

## 사용자 보고 (2026-05-18)
"수식복원 클릭하면 나오는 팝업에 최근 업데이트된 내용사항도 메모해줘"

## Fix
`InstallFormulasButton.tsx` confirm 메시지에 "🆕 최근 업데이트" 섹션 추가:
- D 컬럼 콜·지·기·소 라벨 정상화 (#232)
- M3:M5 비율 수식 install 포함 (#233)
- J~M 채널 필터 제거 — 4채널 셀병합 통합 (#237)

admin 이 클릭 전 어떤 수식이 새로 install/변경되는지 명시적으로 보게 됨.

## Acceptance
- [ ] 수식복원 버튼 클릭 시 팝업에 3개 업데이트 항목 노출
- [ ] check.sh 통과
