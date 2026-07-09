---
slug: db-dashboard-aggregates
status: completed
created: 2026-07-09
owner: belie
related: db-read-payments, db-read-production, db-migration-pilot, db-first-unlimited-roadmap
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: R2-7a — 대시보드가 읽던 시트 수식 결과(누적수임비·채널stacking·주차별 계약수·활동량)를 raw 행에서 **재계산**하는 엔진 + 시트값 대조(그림자) 인프라. 사용자 응답은 계속 시트값 — 정확도 증명 후 R2-7b에서 전환.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: lib/service/dashboard.ts, lib/service/dashboard-aggregates.ts(신규), scripts/ops/dashboard-parity.mjs(신규), R2-7b(서빙 전환)
> - **읽고 나면 알 수 있는 것**: 무엇이 이미 raw 이고 무엇이 재계산 대상인가 / 5개 도메인 불변식은 어디서 보존되나 / 그림자 대조·전수 배치 대조는 어떻게 diff 를 드러내나
> - **관련 문서**: docs/domains/data-model.md §대시보드, docs/decisions/0005(주차)

# R2-7a — 대시보드 SQL 집계 + 그림자 대조

## 이미 raw (R2-4/R2-5로 전환됨 — 재계산 불필요)
- **비용**: readDbTabFromDb 4섹션 합(주문금액·기간예산). 시트 SUM 셀 의존 이미 제거(2026-05-15 김미란 사고).
- **매출/이익**: splitContractRevenue(readContractsFromDb) — 수임료+수납액, 이월 분리. 시트 D21 의존 이미 제거.

## 재계산 대상 4종 (시트 수식 → raw 역산) — 정확 스펙은 워크플로 검증본
| 대상 | 시트 위치 | raw 입력 |
|---|---|---|
| channelStacking | 01!R1:U6 (6단계×4채널) | readSalesRowsFromDb(생산/유입/컨택/미팅예약) + readMeetingsFromDb(미팅완료/계약, 채널+상태) |
| weeklyContracts | 01!N{38..276} (8주) | 계약(미팅 상태=계약 or 계약행) × weekIndexOf |
| weeklyActivity | 대시보드 C33:H40 col H | 생산×1+컨택×1.5+미팅×2 (불변식①) × weekIndexOf |
| 누적수임비 | 대시보드 B21 | readContractsFromDb Σ수임비 (아레나/이월 판정은 검증본 따름) |

## 5개 도메인 불변식 (전부 기존 로직 재사용)
① 활동량 가중치 1/1.5/2 · ② 매출=수임료+수납액(승인금액 제외) · ③ 이월 분리(splitContractRevenue·isCarryoverContract) · ④ 주차 weekIndexOf(ADR-0005, offset 하드코딩 금지) · ⑤ 채널 4색(CHANNEL_ORDER).

## 2단계 안전 설계
- **이 PR(7a)은 그림자 대조만**: loadDashboard 가 DB 집계를 **병행 계산**해 시트값과 per-field diff 를
  PostHog(dashboard_parity 이벤트) + 콘솔 로그. **응답은 시트값 그대로** — 틀려도 무영향.
- **전수 배치 대조**: scripts/ops/dashboard-parity.mjs — 파일럿 전 사용자 × 전 항목 시트값 vs DB집계
  diff 표 출력(--user 옵션으로 단일 사용자). PR 본문에 1회 실행 결과표.
- Changelog-Group: db-dashboard (7b 에서 Changelog-Done 으로 공개 전환).

## 검증 게이트(→ R2-7b)
그림자 diff 0 이 전수 배치 + 연습 능동 시나리오에서 확인되면 7b 서빙 전환.

## Log
- 2026-07-09 착수: 재계산 스펙을 워크플로(4 설계 → 4 적대적 검증)로 확정 후 구현.
