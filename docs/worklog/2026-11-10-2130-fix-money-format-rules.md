> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 화면 금액 표기를 승인 규칙 4개(「원」 뒤 · 만/억 축약 하나로 · 음수 앞 「−」 · 업체정보 재무 유지)로 통일.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `lib/format/money.ts` · 대시보드·비용 원장·DB관리·일정·실무/수납·캘린더·아레나·업체정보
> - **관련 문서**: [계획](../plans/completed/money-format-rules.md) · [components.md 「금액 표기 규칙」](../design/components.md)

## 2026-11-10 · fix: 금액 표기 규칙 통일
- 브랜치 `fix/money-format-rules`. 요청: belie 「금액 표기 전수 조사」 추천 규칙 승인(①원 ②만·억 ③− ④업체정보 유지).
- 변경: 공용 `formatWon`·`formatMoneyCompact`·`formatCount` 추가(`lib/format/money.ts`), ₩ 접두 화면 전부 → `…원`, 채널 남은 돈 표·도넛·채널 표 축약 함수 하나로(−0만·10,000만 제거, 0 → 「0」, 표의 1만 미만 → 「1만 미만」), 반환·적자 `−500,000원`, 업체정보 화면 음수 `−3.2`·`약 −320만`, 비용 원장 항목 금액 칸 MoneyInput, DB 폼 자동 칸 `12,000원`, 진행건 삭제 확인창 「원」, DB 카드 건수·아레나 값 → `formatCount`.
- 저장값·계산·쓰기·입력 파싱 불변(업체정보 정본 `formatTenths` 하이픈 유지, 화면만 `formatTenthsDisplay`).
- 검증: tsc 통과 · 대상 vitest(아래). check.sh·build 는 총괄 직렬 실행 — NOT_RUN(이 세션).
- 미완료: 실제 화면 캡처 확인은 총괄 단계. 위험/복구: 표시 문자열만 바뀜 → 커밋 revert 로 복구.
