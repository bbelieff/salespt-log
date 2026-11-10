# 디자인 B — 회색 slate 통일·흰 글자 파란 버튼 진하게

- 목표: 사용자 승인 「디자인은 A+B」(2026-11-10) 중 B. A(#1393) 위에 앱 전체 기준을 하나로.
- 변경: app·components·lib 의 Tailwind `gray-*` → `slate-*`(약 1,900곳, 194파일, 시험 포함 동일 치환), 흰 글자와 함께 쓰는 `bg-blue-500/600` → `bg-blue-700`, `hover:bg-blue-600/700` → `hover:bg-blue-800`. design 문서(tokens·components·preview) 동기화.
- 수용: tests/structural/design-b-slate.test.ts(gray 재유입 금지, 흰 글자 파란 버튼 700 이상), check.sh·build, 실제 화면 확인.
