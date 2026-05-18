---
slug: diag-modal-ux
status: active
created: 2026-05-17
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 진단 모달 가독성 — 룰별 평문 설명 + 이름/이메일 노출
> - **누가 읽나요**: 개발자/관리자
> - **어떤 기능·작업과 연결?**: TraineeDiagnoseButton

# diag-modal-ux — [B1]

## 사용자 요청 (2026-05-17)
"모바일에서 진단버튼눌러서 진단된 결과를 보면 뭘 말하는지도 잘 모르겠고 이름을 가려서 누군지 알수도 없음"

## 변경
- `RULE_EXPLANATION` 맵 추가 — 5개 룰 (formula-needs-restore / meetings-formulas-missing / metric-vs-meeting-mismatch / o1-o2-validity / revenue-mismatch) 에 평문 설명 (무엇이 / 왜 문제 / 해결)
- 모달 헤더: name 크게 (text-base font-black) + email 줄바꿈
- 룰 카드: label 크게 (text-sm), 평문 설명을 흰 박스로 강조, 원래 detail 은 작게 옆에

## Acceptance
- [ ] 모바일에서 룰 의미 한눈에 이해 가능
- [ ] 이름/이메일 보임
- [ ] check.sh 통과
