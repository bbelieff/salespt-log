---
status: completed
slug: contact-inflow-wait
created: 2026-06-22
owner: belie
related: pr-db-channels-full, contact-firstrow-readonly
completed: 2026-06-22
archived: 2026-07-12
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 컨택 매입DB 첫 행을 '구매 누적'이 아닌 '유입대기 = 생산누적−유입누적'으로(유입할수록 실시간 차감).
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: lib/service/contact.ts(loadDay), lib/repo/dashboard.ts(readChannelStacking), ChannelTabsAndPanel
> - **관련 문서**: [정본 §2/3-B](../../handoff/pr-db-channels-full.md), [C4](./contact-firstrow-readonly.md)

# fix — 매입DB 첫 행 유입대기

## 원인
C4 에서 매입DB 첫 행을 '구매 누적'만 표시(유입누적 미로딩). 스펙은 유입대기 = max(0, 생산누적 − 유입누적), 유입 +/− 시 실시간 차감.

## 변경
- `lib/repo/dashboard.ts`: `readChannelStacking(sid)` — 01 영업관리 R1:U6 만 경량 read([stage][channel]).
- `lib/service/contact.ts loadDay`: stacking 읽어 `inflowWaitBase = 생산누적(R1) − 유입누적(R2) + 오늘 저장 유입(매입DB)` 계산 → ContactDayView 에 포함.
- `ChannelTabsAndPanel`: 매입DB 첫 행 = `max(0, inflowWaitBase − draft.유입)`, 라벨 "유입대기"(🔒 DB자동), 부제 "구매 누적 − 유입 누적". 다른 채널 첫 행은 그대로.
- page: inflowWaitBase 패널에 전달.

## 수용 기준
- 구매누적 80·유입 저장 5 → 유입대기 75. 유입 + 누를 때마다 74,73… 즉시 감소. 음수 0 클램프.
- 직접생산/현수막/콜 첫 행 회귀 없음. typecheck/lint/test 그린 + build + 배포 + health 200.

## Log
- 2026-06-22 구현(fix/contact-inflow-wait): readChannelStacking + inflowWaitBase + 유입대기 실시간 차감.
