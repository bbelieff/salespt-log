/**
 * Layer: service — 유스케이스. Repo 조합 + 도메인 규칙.
 * UI/Runtime(API Route) 에서 호출하는 유일한 진입점이 되어야 한다.
 */
import { findUserByEmail } from "@/repo/users";

export async function resolveUser(email: string) {
  return findUserByEmail(email);
}

export { summarize, type Stats } from "./gamification";

// Self-claim 유스케이스 (PR-B2)
export { claimAccount, ClaimError, type ClaimResult } from "./auth";

// 컨택탭 유스케이스 (PR 2a)
export {
  loadDay,
  saveContactMetrics,
  appendNewMeeting,
  patchMeeting,
  removeMeeting,
  removeMeetingWithCascade,
  revertMeeting,
  reviveCaseClosure,
  getMeetingById,
  type ContactDayView,
  type ChannelDailyRowMetrics,
} from "./contact";

// 일정·계약 탭 유스케이스 (PR 03)
export {
  loadWeekMeetings,
  type ScheduleWeekView,
} from "./contact";

// 캘린더 탭 유스케이스 (Scope 2 — 04 미팅 + 05 투두 머지, contact 에서 분리)
export {
  loadMonthMeetings,
  type CalendarMonthView,
} from "./calendar";

// 수납탭은 PR #38·39·40에서 계약수납탭(02 계약수납관리)으로 모델 재정의됨.
// 일별 합계 모델(loadDailyRevenue / saveDailyRevenue)은 폐기.

// DB관리 탭 유스케이스 (PR 09 db-management — 4채널 raw log)
export {
  loadDBOverview,
  addPurchase,
  patchPurchase,
  removePurchase,
  addProduction,
  patchProduction,
  removeProduction,
  addBanner,
  patchBanner,
  removeBanner,
  addLead,
  patchLead,
  removeLead,
  type DBOverview,
} from "./db";

// 계약수납 탭 유스케이스 (PR 11 contract-payment-tab)
export {
  loadContractPayments,
  addFromContract,
  syncContractFee,
  patchContractPayment,
  removeContractPayment,
  removeContractPaymentWithCascade,
} from "./contract-payment";

// 실무투두 유스케이스 (Scope 2 — 05 실무투두)
export {
  listTodos,
  createTodo,
  patchTodo,
  removeTodo,
  type CreateTodoInput,
} from "./todos";

// 사용자 프로필 (모든 탭 상단 헤더 — 시트 01 영업관리!B3:C3 SSOT)
export {
  loadMe,
  enrichUsersWithSheetCohort,
  enrichUsersWithDates,
  enrichUsersWithStats,
  type MeProfile,
  type TraineeFunnelStats,
} from "./me";

// 대시보드 view (PR feat/dashboard-page — read-only, 시트 디스커버리 후 wiring)
export { loadDashboard } from "./dashboard";

// 시트 진단/픽스 카탈로그 (2026-05-16) — 개별 trainee 단위 + Hashimoto 누적 룰.
export {
  diagnoseSheet,
  fixSheet,
  type DiagnosticResult,
  type DiagnosticSeverity,
} from "./sheet-diagnostics";

// 새소식 (공지 + 업데이트, announcement-popup §3·§4)
export {
  getAnnouncementsFor,
  listAnnouncementsAdmin,
  saveNoticeAdmin,
  patchUpdateAdmin,
  uploadNoticeImageAdmin,
  type AnnouncementsView,
} from "./announcements";
