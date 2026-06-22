# ADR-0025 — 현수막: 생산 = 게시 (컨택 게시 스테퍼가 E 소유, 게시로그 폐기)

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 현수막 한정으로 ADR-0020 을 supersede + ADR-0023(게시로그 1:N) 폐기 — 생산(E)은 컨택 "게시" 스테퍼가 소유, 게시수 = E.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: 컨택관리(현수막 게시), DB생산(현수막 주문), lib/service/contact.ts·db.ts, lib/repo/sales.ts, 01 영업관리 E, 03 DB관리 P:V/AF:AI
> - **읽고 나면 알 수 있는 것**: 현수막 E 를 누가 소유하나, 재고 계산, 게시로그 폐기 범위, ADR-0020/0023 과의 경계
> - **관련 문서**: [[docs/decisions/0024-direct-production-inflow-sync]], [[docs/decisions/0020-production-metric-ssot-to-db]], [[docs/decisions/0023-banner-posting-log-1n]]

- **status**: accepted
- **date**: 2026-06-23
- **supersedes (부분)**: ADR-0020 — **현수막 채널 한정** (매입DB·콜·지·기·소는 ADR-0020 그대로).
- **retires**: ADR-0023 (현수막 게시로그 1:N, AF:AI) — 게시로그 서브시스템 전체 삭제.

## 맥락
ADR-0023 은 현수막 1주문 N게시를 별도 로그(03 DB관리 AF:AI)로 기록하고, DB집계 `syncProduction(현수막)` 이
게시일별 Σ게시수를 영업관리 E 에 기입했다. 그러나 학생은 매일 컨택관리에서 활동하는데 게시를 또 DB생산 탭에서
따로 기록해야 해 이중 동선이었다. 직접생산을 유입=생산으로 통일한 [ADR-0024](0024-direct-production-inflow-sync.md)
와 같은 원리로, 현수막도 **게시 = 생산** 이라 컨택에서 게시만 적으면 된다.

## 결정 (현수막 한정)
1. **생산(E) = 게시.** 컨택관리 현수막 첫 행을 **"게시" 스테퍼(+/-)** 로 — 그 날 게시한 장수를 입력하면
   `batchWriteChannelDailyRows` 가 영업관리 E(현수막)=production(게시) 로 기입(컨택 소유). 직접생산 E=유입과 같은 패턴.
2. **재고 = Σ주문장수 − Σ게시누적.** 주문장수 = 03 DB관리 현수막 주문(P:V) 의 주문개수 합. 게시누적 = Σ E(현수막).
   재고 base 는 loadDay 가 서버 계산(`Σ주문장수 − stacking[0][2] + 오늘 saved게시`), UI 는 `max(0, base − draft.게시)`.
   재고 0 에서 게시 + 클램프(경고) — 주문보다 많이 게시 불가.
3. **장당단가는 주문 때 확정** (총액 ÷ 주문장수, 부가세 제외). 게시는 재고·생산집계만 움직이고 단가에 영향 없음.
4. **게시로그(AF:AI) 서브시스템 폐기.** ADR-0023 의 DBBannerPost·banner-post repo·BannerPostingLog·전용 API/훅·
   03 DB관리 AF:AI 섹션·DB집계 `syncProduction(현수막)` 모두 삭제. 현수막 DB생산은 **주문만** 입력.
5. **마이그레이션.** 기존 E(현수막)은 구 syncProduction 이 이미 게시일별 Σ게시수로 채워둠 → 배포 시 데이터 유실 없음.
   1회 스크립트(`scripts/migrate-banner-posts-to-sales-E.mjs`, dry-run 기본)로 AF:AI 잔여 게시를 E 로 ensure 후 AF:AI clear (belie 확인 후 실행).

## 근거
- 이중 동선(컨택+DB게시) 제거 → 컨택에서 게시만. 직접생산(ADR-0024)과 일관된 "활동=생산" 모델.
- 재고를 주문−게시로 실시간 표시 → 남은 현수막 가시화.

## 영향
- E(현수막) 보존가드: app-owned(컨택 소유) — 직접생산 E 와 동일 취급(§2.5 비대상은 단일셀 동기화 한정 아님; E:H writer 무가드 동일).
- ADR-0023 의 게시로그 데이터 모델·UI·집계 경로 전부 제거. 옛 AF:AI 데이터는 E 에 이미 반영됨(lazy).
- 매입DB·콜·지·기·소 의 E 소유(ADR-0020, DB집계)는 불변.

## 후속
- 결정 변경 시 새 ADR 로 supersede.
