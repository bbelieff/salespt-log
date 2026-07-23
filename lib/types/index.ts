/**
 * Layer: types — 도메인 모델(Zod) **배럴**. 다른 레이어 import 안 함(구조 테스트 강제).
 * 실제 정의는 도메인별 파일로 분리(2026-07-19, 500줄 캡). 소비자는 `@/types` 경로 그대로 사용.
 * 필드명 규칙: 시스템(id·channel)=영어, 시트 도메인=한국어(컬럼 1:1).
 * SSOT: data-model.md · sheet-structure.md. doc-drift.sh 는 lib/types/*.ts 전체를 grep 한다.
 */
export * from "./channel"; // Channel · MetricKey · RankingMetric · RankingEntry
export * from "./meeting"; // MeetingState · CompanyInfo · Meeting · ChannelDailyRow
export * from "./db"; // DBPurchase · DBProduction · DBBanner · DBLead
export * from "./user"; // User · cohort* 헬퍼
export * from "./contract"; // Progress · PaymentSlot · ContractPayment · (contract-status 재수출)
export * from "./todo"; // TodoType · Todo
export * from "./announcement"; // UpdateItem · Notice*
export * from "./dashboard"; // Dashboard* view 인터페이스
export * from "./expense-ledger"; // 비용 원장: 카테고리·일회성·반복 비용
