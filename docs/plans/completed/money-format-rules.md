---
status: completed
slug: money-format-rules
created: 2026-11-10
owner: belie
completed: 2026-11-10
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 화면마다 14가지로 섞여 있던 금액 표기(₩1,234 · 1,234만 · −0만 · ₩-1,234 …)를 승인된 규칙 4개로 맞춘다.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `lib/format/money.ts`(공용 표시 함수), 대시보드·비용 원장·DB관리·일정·실무/수납·캘린더·아레나·업체정보 화면
> - **읽고 나면 알 수 있는 것**: 승인 규칙 · 바뀐 곳과 일부러 그대로 둔 곳 · 검증
> - **관련 문서**: [components.md 「금액 표기 규칙」](../../design/components.md) · [worklog](../../worklog/2026-11-10-2130-fix-money-format-rules.md)

# 금액 표기 규칙 통일

## 목표·수용 조건 (belie 2026-11-10 승인 — 「금액 표기 전수 조사」 추천안 그대로)
1. 정확한 금액 `1,234,567원` — ₩ 앞 대신 「원」 뒤, 띄어쓰기 없음.
2. 좁은 자리 요약 `1,234만` · 1억부터 `1.9억`. 두 함수를 하나로 — 도넛에 `−0만`·`10,000만` 없음, 0 은 `0`, 채널 비용·단가 표의 0 아닌 1만 미만은 `1만 미만`.
3. 음수는 숫자 앞 `−`(U+2212): `−56만` · `−500,000원`. `₩-1,234`·`−₩500,000`·업체정보 `-3.2` 없앰. 빨간 비용 칸은 부호 없이 그대로.
4. 업체정보 재무(백만원·천원·약 2.5억·문서 자동입력 비교표)는 그대로, 화면 음수 부호만 `−`.
5. 함께: 비용 원장 항목 편집 금액 칸 천단위 쉼표(MoneyInput), DB 입력 폼 자동 칸 `12,000 원` → `12,000원`, 진행건 삭제 확인창 금액에 「원」, 건수를 금액 함수로 찍던 곳 → 건수 함수, 아레나 순위표 공용 함수.
6. 저장값·계산·시트/DB 쓰기·입력 파싱은 바꾸지 않는다.

## 설계
- 기존 단일 원천 `lib/format/money.ts` 에 `formatWon` · `formatMoneyCompact(n, { underMan })` · `formatCount` · `MINUS` 를 더했다(새 모듈 없음).
- `components/dashboard/channel-profit.ts` 의 `formatManShort`·`formatWonFull` 과 `ChannelPerformance` 의 `fmtMan` 계산을 지우고 공용 함수로.
- 업체정보는 저장 정본 `formatTenths`(하이픈)를 그대로 두고 화면 전용 `formatTenthsDisplay` 를 더했다. `moneyHint`·`moneyWithUnit`·`formatMoneyTxt` 는 화면/글 출력이라 `−`.

## 일부러 그대로 둔 곳
- 업체정보 재무 입력칸 자체 값(사용자가 친 글이 곧 저장값) · 「12,000원 × 50건」 부제(이미 규칙대로) · 계약/수납 입력칸 라벨 「(원)」 · DB관리시트 공급처 원문 값 · 아레나 단위 표시(숫자와 단위를 따로 그림) · `formatMoney`(입력·부제용 숫자만 함수, 남겨 둠).

## 검증
- `npx tsc --noEmit -p .` · 대상 `npx vitest run`(worklog 참조). `bash scripts/check.sh`·build 는 총괄이 직렬로 실행.
