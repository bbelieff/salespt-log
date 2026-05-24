---
slug: minus10-darker-font
status: active
created: 2026-05-18
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 생산 -10 버튼 폰트·배경 진하게 (+10 과 시각적 대비 맞춤)
> - **누가 읽나요**: 개발자

# minus10-darker-font

## 사용자 보고 (2026-05-18)
"대량 증감버튼중 감소버튼의 폰트 (-10)이 진한색이 좋아 다른 수강생들은 옅은색이네"

## Fix
- bg: `bg-gray-100` → `bg-gray-200` (대비 강화)
- text: `text-gray-600` → `text-gray-800` (진한 검정 톤)
- hover: `bg-gray-200` → `bg-gray-300`

## Acceptance
- [ ] -10 버튼 텍스트가 +10 (text-blue-700) 만큼 또렷
- [ ] check.sh 통과
